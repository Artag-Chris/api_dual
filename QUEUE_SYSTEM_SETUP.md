# 🚀 Sistema de Colas FIFO - Setup Completo

**Versión:** 1.0  
**Fecha:** 19 de Febrero de 2026  
**Propósito:** Migración de 32k clientes con persistencia en BD y procesamiento en batches automáticos

---

## 📋 Tabla de Contenidos

1. [Estructura General](#-estructura-general)
2. [Schema Prisma - Tabla Obligatoria](#-schema-prisma---tabla-obligatoria)
3. [QueueService - Clase Singleton](#-queueservice---clase-singleton)
4. [Configuración y Dependencias](#-configuración-y-dependencias)

---

## 🏗️ Estructura General

```
API de Migración con Colas FIFO
│
├── BD Main (Principal)
│   └── migration_queue (TABLA NUEVA)
│   └── migration_queue_dlq (Dead Letter Queue)
│
├── QueueService (Singleton)
│   ├── enqueue()      → Añade items a la cola
│   ├── dequeue()      → Obtiene primero (FIFO)
│   ├── markCompleted()→ Marca como completado
│   ├── markError()    → Maneja errores
│   └── getMetrics()   → Ver estado
│
└── MigrationService (Usa QueueService)
    ├── processBatchesInBackground()  → Productor
    ├── procesarClientesConsumer()    → Consumidor 1
    ├── procesarCreditosConsumer()    → Consumidor 2
    ├── procesarPagosConsumer()       → Consumidor 3
    └── getQueueStatus()              → Monitoreo

Flujo:
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│  CLIENTES   │───▶│CREDITOS COLA │───▶│    PAGOS    │───▶│AMORTIZACIONES│
│ (Productor) │    │(Consumidor 1)│    │(Consumidor 2)    │(Consumidor 3)│
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
```

---

## 📊 Schema Prisma - Tabla Obligatoria

### Ubicación: `/prisma/schema-main.prisma`

**PASO 1:** Añade estas dos tablas al final del archivo schema-main.prisma:

```prisma
// ===============================================
// TABLAS PARA SISTEMA DE COLAS DE MIGRACIÓN
// ===============================================

/// Cola FIFO para procesar migraciones por fases
/// - Almacena documentos/referencias que necesitan ser procesados
/// - Estado: PENDIENTE, PROCESANDO, COMPLETADO, ERROR
/// - FIFO garantizado por: orderBy createdAt ASC
model migration_queue {
  id        Int     @id @default(autoincrement())
  
  // Identificador del cliente
  documento String  @db.VarChar(50)
  
  // Fase de migración: CLIENTES, CREDITOS, PAGOS, AMORTIZACIONES, BODEGA
  fase      String  @db.VarChar(50)
  
  // Estado del procesamiento
  estado    String  @db.VarChar(50)     // PENDIENTE, PROCESANDO, COMPLETADO, ERROR
  
  // Control de reintentos
  intentos  Int     @default(0)         // Cuántos intentos ha tenido (máximo 3)
  
  // Información de error (si aplica)
  error     String? @db.LongText        // Mensaje de error completo
  
  // Timestamps
  createdAt DateTime @default(now())    // Cuándo se enqueó
  updatedAt DateTime @updatedAt
  processedAt DateTime?                 // Cuándo se completó
  
  // Índices para queries rápidas
  @@index([documento])                  // Buscar por cliente
  @@index([fase])                       // Buscar por fase
  @@index([estado])                     // Buscar por estado (PENDIENTE, etc)
  @@index([createdAt])                  // FIFO: obtener más antiguos primero
}

/// Dead Letter Queue - para items que não se pudieron procesar
/// - Items que agotaron reintentos (3 intentos fallidos)
/// - Requiere intervención manual
model migration_queue_dlq {
  id        Int     @id @default(autoincrement())
  
  documento String  @db.VarChar(50)
  fase      String  @db.VarChar(50)
  
  // Error completo que causó que llegara aquí
  error     String  @db.LongText
  
  createdAt DateTime @default(now())
  
  @@index([documento])
  @@index([createdAt])
}
```

**PASO 2:** Después de añadir el schema, ejecuta:

```bash
# Genera los tipos de Prisma (necesario)
npm run prisma:generate:main

# Crea la tabla en la BD
npm run prisma:push:main

# O si prefieres con migración formal
npm run prisma:migrate:main
```

**Resultado en BD MySQL:**
```sql
-- Se verán estas tablas
SHOW TABLES;
-- ... otras tablas ...
-- migration_queue
-- migration_queue_dlq

-- Estructura
DESC migration_queue;
-- id (PK), documento, fase, estado, intentos, error, createdAt, updatedAt, processedAt
```

---

## 🔧 QueueService - Clase Singleton

### Ubicación: `src/domain/class/queue.service.ts`

**PASO 1:** Crea el archivo:

```typescript
import { prismaMainService } from '../../database/main/prisma-main.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

/**
 * ✓ Servicio de Cola FIFO para migración
 * ✓ Implementa patrón Singleton - igual que LegacyDataService
 * ✓ Persistent en BD Main - no se pierde si se reinicia
 * ✓ FIFO garantizado por createdAt ASC
 */
class QueueService {
  private static instance: QueueService;
  private logger = WinstonAdapter;

  constructor() {}

  /**
   * Obtiene la instancia singleton
   */
  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  /**
   * ENQUEUE: Añade un item a la cola
   * 
   * @param documento - Identificador del cliente (ej: "1234567890")
   * @param fase - En qué fase migrarlo (CLIENTES, CREDITOS, PAGOS, AMORTIZACIONES)
   * @returns Item creado en la cola
   * 
   * @example
   * await queueService.enqueue('1234567890', 'CREDITOS');
   * // Resultado: { id: 1, documento: '1234567890', fase: 'CREDITOS', estado: 'PENDIENTE', ... }
   */
  async enqueue(documento: string, fase: string) {
    try {
      const item = await prismaMainService.migration_queue.create({
        data: {
          documento,
          fase,
          estado: 'PENDIENTE',
          intentos: 0,
        }
      });

      this.logger.debug(`[QUEUE] Enqueued: ${documento} → ${fase}`);
      return item;
      
    } catch (error) {
      this.logger.error(`[QUEUE] Error enqueuing: ${error.message}`);
      throw error;
    }
  }

  /**
   * DEQUEUE: Obtiene el primer item de la cola (FIFO)
   * 
   * Automáticamente lo marca como PROCESANDO para evitar que otro 
   * proceso lo agarre simultáneamente.
   * 
   * @param fase - Qué fase procesar (CLIENTES, CREDITOS, PAGOS, etc)
   * @returns Item más antiguо en PENDIENTE, o null si la cola está vacía
   * 
   * @example
   * const item = await queueService.dequeue('CREDITOS');
   * if (!item) {
   *   // Cola vacía, esperar y reintentar
   *   await sleep(5000);
   * } else {
   *   // Procesar item.documento
   *   console.log(`Procesando: ${item.documento}`);
   * }
   */
  async dequeue(fase: string) {
    try {
      // Busca el PRIMERO (más antiguo) en PENDIENTE - ESTO ES FIFO!
      const item = await prismaMainService.migration_queue.findFirst({
        where: {
          fase,
          estado: 'PENDIENTE'
        },
        orderBy: {
          createdAt: 'asc'  // ← Ordenar ASC = FIFO: primero que entró sale primero
        }
      });

      if (!item) {
        this.logger.debug(`[QUEUE] Empty queue for phase: ${fase}`);
        return null;
      }

      // Marca como PROCESANDO para evitar que otro worker lo agarre
      await prismaMainService.migration_queue.update({
        where: { id: item.id },
        data: { estado: 'PROCESANDO' }
      });

      this.logger.debug(`[QUEUE] Dequeued: ${item.documento} (${fase})`);
      return item;
      
    } catch (error) {
      this.logger.error(`[QUEUE] Error dequeuing: ${error.message}`);
      throw error;
    }
  }

  /**
   * Marca un item como completado exitosamente
   * 
   * @param id - ID del item en la cola
   * @returns Item actualizado
   */
  async markCompleted(id: number) {
    try {
      const item = await prismaMainService.migration_queue.update({
        where: { id },
        data: {
          estado: 'COMPLETADO',
          processedAt: new Date(),
          intentos: 0  // Reset para claridad
        }
      });

      this.logger.info(`[QUEUE] Completed: ${item.documento}`);
      return item;
      
    } catch (error) {
      this.logger.error(`[QUEUE] Error marking completed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Maneja errores: reintenta 3 veces o mueve a Dead Letter Queue
   * 
   * @param id - ID del item en la cola
   * @param errorMessage - Mensaje de error
   * 
   * Si intentos < 3:
   *   → Vuelve a estado PENDIENTE (será reintentado)
   * Si intentos >= 3:
   *   → Mueve a migration_queue_dlq (requiere intervención manual)
   */
  async markError(id: number, errorMessage: string) {
    try {
      const item = await prismaMainService.migration_queue.findUnique({
        where: { id }
      });

      if (!item) {
        this.logger.warn(`[QUEUE] Item ${id} not found`);
        return;
      }

      // ¿Alcanzó 3 reintentos?
      if (item.intentos >= 2) {  // 0, 1, 2 = 3 intentos totales
        this.logger.error(`[QUEUE] Max retries reached: ${item.documento}`);

        // Mueve a Dead Letter Queue
        await prismaMainService.migration_queue_dlq.create({
          data: {
            documento: item.documento,
            fase: item.fase,
            error: `Intentos agotados (3). Último error: ${errorMessage}`
          }
        });

        // Elimina de cola principal
        await prismaMainService.migration_queue.delete({
          where: { id }
        });

      } else {
        // Reintenta: vuelve a PENDIENTE con intento incrementado
        await prismaMainService.migration_queue.update({
          where: { id },
          data: {
            estado: 'PENDIENTE',
            intentos: item.intentos + 1,
            error: errorMessage,
            updatedAt: new Date()
          }
        });

        this.logger.warn(
          `[QUEUE] Retry #${item.intentos + 1}: ${item.documento} - ${errorMessage}`
        );
      }
      
    } catch (error) {
      this.logger.error(`[QUEUE] Error handling error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene métricas de la cola en tiempo real
   * 
   * @returns Objeto con conteos por estado
   * 
   * @example
   * const metrics = await queueService.getMetrics();
   * // {
   * //   pendientes: 30000,
   * //   procesando: 45,
   * //   completados: 1955,
   * //   errores: 0,
   * //   total: 32000
   * // }
   */
  async getMetrics() {
    try {
      const [pendientes, procesando, completados, errores] = await Promise.all([
        prismaMainService.migration_queue.count({
          where: { estado: 'PENDIENTE' }
        }),
        prismaMainService.migration_queue.count({
          where: { estado: 'PROCESANDO' }
        }),
        prismaMainService.migration_queue.count({
          where: { estado: 'COMPLETADO' }
        }),
        prismaMainService.migration_queue.count({
          where: { estado: 'ERROR' }
        })
      ]);

      const total = pendientes + procesando + completados + errores;
      const progreso = total > 0 ? ((completados / total) * 100).toFixed(2) : '0';

      return {
        pendientes,
        procesando,
        completados,
        errores,
        total,
        progreso: `${progreso}%`,
        timestamp: new Date()
      };
      
    } catch (error) {
      this.logger.error(`[QUEUE] Error getting metrics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene items de Dead Letter Queue (errores graves)
   * 
   * @param limit - Cuántos mostrar
   * @returns Array de items en DLQ
   */
  async getDeadLetterQueue(limit: number = 100) {
    try {
      return await prismaMainService.migration_queue_dlq.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      this.logger.error(`[QUEUE] Error getting DLQ: ${error.message}`);
      throw error;
    }
  }

  /**
   * Limpia la cola (útil para reinicios o testing)
   * ⚠️ USE CON CUIDADO - elimina todos los datos de la cola
   */
  async clearQueue() {
    try {
      const result = await prismaMainService.migration_queue.deleteMany({});
      this.logger.warn(`[QUEUE] Cleared ${result.count} items from queue`);
      return result;
    } catch (error) {
      this.logger.error(`[QUEUE] Error clearing queue: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene items que pasaron mucho tiempo en PROCESANDO (stalled)
   * Útil si un worker se cuelga sin marcar completado
   */
  async getStalled(minutes: number = 5) {
    try {
      const minutesAgo = new Date(Date.now() - minutes * 60000);
      
      return await prismaMainService.migration_queue.findMany({
        where: {
          estado: 'PROCESANDO',
          updatedAt: {
            lt: minutesAgo
          }
        }
      });
    } catch (error) {
      this.logger.error(`[QUEUE] Error getting stalled: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resetea items stalled de vuelta a PENDIENTE
   */
  async resetStalled(minutes: number = 5) {
    try {
      const stalled = await this.getStalled(minutes);
      
      for (const item of stalled) {
        await prismaMainService.migration_queue.update({
          where: { id: item.id },
          data: {
            estado: 'PENDIENTE',
            intentos: item.intentos + 1
          }
        });
      }

      this.logger.info(`[QUEUE] Reset ${stalled.length} stalled items`);
      return stalled.length;
    } catch (error) {
      this.logger.error(`[QUEUE] Error resetting stalled: ${error.message}`);
      throw error;
    }
  }
}

export default QueueService;
```

---

## ⚙️ Configuración y Dependencias

### Instala dependencias necesarias:

```bash
npm install node-cron
npm install @types/node-cron --save-dev
```

### Actualiza package.json scripts:

En `package.json`, ya están los scripts de Prisma, pero asegúrate de tener estos:

```json
{
  "scripts": {
    "dev": "tsnd --respawn --clear src/app.ts",
    "build": "rimraf ./dist && tsc",
    "start": "npm run build && node dist/app.js",
    "prisma:generate:main": "prisma generate --schema=./prisma/schema-main.prisma",
    "prisma:migrate:main": "prisma migrate dev --schema=./prisma/schema-main.prisma",
    "prisma:push:main": "prisma db push --schema=./prisma/schema-main.prisma"
  }
}
```

### Estructura de carpetas después de implementar:

```
src/
├── domain/
│   └── class/
│       ├── queue.service.ts              ← NUEVO
│       ├── amortizacion-generator.ts
│       └── ...
└── modules/
    └── migration/
        ├── migration.service.ts          ← ACTUALIZAR
        ├── migration.controller.ts       ← ACTUALIZAR
        └── migration.routes.ts           ← ACTUALIZAR
```

---

## 🎯 Resumen del Setup

| Paso | What | Location |
|------|------|----------|
| 1 | Agregar tablas al schema | `prisma/schema-main.prisma` |
| 2 | Generar tipos y crear tablas | `npm run prisma:generate:main` + `npm run prisma:push:main` |
| 3 | Crear QueueService | `src/domain/class/queue.service.ts` |
| 4 | Actualizar MigrationService | `src/modules/migration/migration.service.ts` |
| 5 | Actualizar MigrationController | `src/modules/migration/migration.controller.ts` |
| 6 | Actualizar routes | `src/modules/migration/migration.routes.ts` |
| 7 | Instalar dependencias | `npm install node-cron` |

---

## ✅ Checklist de Validación

- [ ] Schema Prisma incluye `migration_queue` y `migration_queue_dlq`
- [ ] Ejecutaste `npm run prisma:generate:main`
- [ ] Ejecutaste `npm run prisma:push:main` (tablas creadas en BD)
- [ ] QueueService.ts creado con todos los métodos
- [ ] QueueService implementa Singleton (getInstance)
- [ ] QueueService usa Prisma correctamente
- [ ] node-cron instalado
- [ ] Winston logger está importado en QueueService

**Próximo paso:** Ver `MIGRATION_IMPLEMENTATION.md` para implementar MigrationService, Controller y Routes
