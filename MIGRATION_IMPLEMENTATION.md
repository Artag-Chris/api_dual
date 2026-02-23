# 🔄 Implementación del Sistema de Migración por Batches

**Versión:** 1.0  
**Fecha:** 19 de Febrero de 2026  
**Basado en:** QUEUE_SYSTEM_SETUP.md

---

## 📋 Tabla de Contenidos

1. [MigrationService - Actualización](#-migrationservice---actualización)
2. [MigrationController - Nuevos Endpoints](#-migrationcontroller---nuevos-endpoints)
3. [Routes - Configuración](#-routes---configuración)
4. [Ejemplos de Uso](#-ejemplos-de-uso)
5. [Flujo Completo Visualizado](#-flujo-completo-visualizado)
6. [Monitoreo y Debugging](#-monitoreo-y-debugging)

---

## 🔧 MigrationService - Actualización

### Ubicación: `src/modules/migration/migration.service.ts`

**Reemplaza el contenido completo del archivo:**

```typescript
import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import { prismaMainService } from '../../database/main/prisma-main.service';
import LegacyDataService from '../legacy-data/legacy-data.service';
import MainDataService from '../main-data/main-data.service';
import QueueService from '../../domain/class/queue.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

/**
 * ✅ Servicio de Migración con Sistema de Colas FIFO
 * 
 * Características:
 * - Procesa 32k clientes en batches automáticos
 * - Utiliza colas persistentes en BD
 * - Múltiples consumidores en paralelo
 * - Reintenta automáticamente en caso de error
 * - Patrón Singleton
 */
class MigrationService {
  private static instance: MigrationService;
  
  // Servicios
  private legacyDataService = LegacyDataService.getInstance();
  private mainDataService = MainDataService.getInstance();
  private queueService = QueueService.getInstance();
  private logger = WinstonAdapter;

  // Control de procesos
  private isProcessing = false;
  private batchIndex = 0;
  private consumersRunning = false;

  constructor() {}

  public static getInstance(): MigrationService {
    if (!MigrationService.instance) {
      MigrationService.instance = new MigrationService();
    }
    return MigrationService.instance;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTOR: Procesa clientes por batches y los añade a la cola
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Inicia migración en batches de manera automática y continua
   * 
   * SIN BLOQUEAR: Retorna inmediatamente
   * Procesa 32k clientes en background
   * 
   * @param batchSize - Cuántos clientes por lote (ej: 500)
   * 
   * @example
   * // Usuario presiona "Iniciar Migración"
   * await migrationService.processBatchesInBackground(500);
   * // Retorna al instante
   * // En background: procesa 32k clientes en batches de 500
   */
  async processBatchesInBackground(batchSize: number = 500): Promise<void> {
    // Evita iniciar múltiples procesos simultáneamente
    if (this.isProcessing) {
      throw new Error('Ya hay una migración en progreso');
    }

    this.isProcessing = true;
    this.batchIndex = 0;

    this.logger.info(
      `[MIGRATION] Iniciando migración de clientes en batches de ${batchSize}`
    );

    // ← ESTE CÓDIGO CORRE EN BACKGROUND (no espera)
    (async () => {
      try {
        let skip = 0;
        const totalClientes = await this.getTotalClientesLegacy();

        this.logger.info(`[MIGRATION] Total clientes legacy: ${totalClientes}`);

        while (skip < totalClientes) {
          try {
            this.batchIndex++;
            const end = Math.min(skip + batchSize, totalClientes);

            this.logger.info(
              `[MIGRATION] Batch ${this.batchIndex}: procesando clientes ${skip}-${end}`
            );

            // Obtiene batch de clientes
            const clientes = await this.legacyDataService
              .getAllClientes(skip, batchSize);

            if (clientes.length === 0) {
              this.logger.warn(`[MIGRATION] Batch returned 0 clientes, breaking`);
              break;
            }

            // Migra cada cliente (apenas los añade a la cola)
            for (const cliente of clientes) {
              // Validar que documento existe
              if (!cliente.num_doc) {
                this.logger.warn(`[MIGRATION] Cliente sin documento: ${cliente.id}`);
                continue;
              }

              // Enqueue para la siguiente fase
              await this.queueService.enqueue(cliente.num_doc, 'CLIENTES');
            }

            this.logger.info(
              `[MIGRATION] Batch ${this.batchIndex} encolado: ${clientes.length} clientes`
            );

            // Pausa entre batches para no sobrecargar BD
            // → Puedes ajustar este tiempo según tu capacidad
            await this.sleep(2000);

            skip += batchSize;

          } catch (batchError) {
            this.logger.error(
              `[MIGRATION] Error en batch ${this.batchIndex}: ${batchError.message}`
            );
            // Continúa con siguiente batch en lugar de fallar completamente
          }
        }

        this.logger.info(
          `[MIGRATION] ✓ Todos los clientes han sido encolados (${this.batchIndex} batches)`
        );

      } catch (error) {
        this.logger.error(`[MIGRATION] Error crítico en procesamiento de batches: ${error.message}`);
      } finally {
        this.isProcessing = false;
      }
    })(); // ← Fire and forget: ejecuta sin esperar

    return Promise.resolve(); // Retorna al instante
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSUMIDORES: Procesan items de la cola y generan siguiente fase
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Inicia todos los consumidores en paralelo
   * Cada uno procesa su propia fase sin interferer con otros
   * 
   * @example
   * await migrationService.startAllConsumers();
   * // Inicia 4 consumidores en background
   */
  async startAllConsumers(): Promise<void> {
    if (this.consumersRunning) {
      this.logger.warn('[MIGRATION] Consumidores ya están corriendo');
      return;
    }

    this.consumersRunning = true;
    this.logger.info('[MIGRATION] Iniciando consumidores...');

    // Inicia cada consumidor en background (sin esperar)
    this.procesarClientesConsumer();
    this.procesarCreditosConsumer();
    this.procesarPagosConsumer();
    this.procesarAmortizacionesConsumer();

    this.logger.info('[MIGRATION] ✓ Todos los consumidores iniciados');
  }

  /**
   * CONSUMIDOR 1: Procesa clientes de la cola
   * Entrada: CLIENTES (PENDIENTE)
   * Salida: Enqueue a CREDITOS
   */
  private async procesarClientesConsumer(): Promise<void> {
    const consumerName = 'ClientesConsumer';

    while (this.consumersRunning) {
      try {
        const item = await this.queueService.dequeue('CLIENTES');

        if (!item) {
          // Cola vacía, espera antes de reintentar
          await this.sleep(5000);
          continue;
        }

        try {
          this.logger.debug(
            `[${consumerName}] Procesando: ${item.documento}`
          );

          // Obtiene cliente de BD legacy
          const cliente = await this.legacyDataService
            .getClienteByDocumento(item.documento);

          if (!cliente) {
            this.logger.warn(
              `[${consumerName}] Cliente no encontrado: ${item.documento}`
            );
            throw new Error(`Cliente ${item.documento} no encontrado en BD legacy`);
          }

          // Migra a BD main
          // ← AQUÍ IMPLEMENTARÍAS tu mapeo y creación en BD main
          // await this.mainDataService.createClienteFromLegacy(cliente);

          // Marca como completado
          await this.queueService.markCompleted(item.id);

          // IMPORTANTE: Enqueue para siguiente fase
          await this.queueService.enqueue(item.documento, 'CREDITOS');

          this.logger.info(
            `[${consumerName}] ✓ Completado: ${item.documento}`
          );

        } catch (error) {
          this.logger.error(
            `[${consumerName}] Error procesando ${item.documento}: ${error.message}`
          );
          // Reintenta o mueve a DLQ
          await this.queueService.markError(item.id, error.message);
        }

      } catch (error) {
        this.logger.error(`[${consumerName}] Error en loop: ${error.message}`);
        await this.sleep(5000);
      }
    }
  }

  /**
   * CONSUMIDOR 2: Procesa créditos de la cola
   * Entrada: CREDITOS (PENDIENTE)
   * Salida: Enqueue a PAGOS
   */
  private async procesarCreditosConsumer(): Promise<void> {
    const consumerName = 'CreditosConsumer';

    while (this.consumersRunning) {
      try {
        const item = await this.queueService.dequeue('CREDITOS');

        if (!item) {
          await this.sleep(5000);
          continue;
        }

        try {
          this.logger.debug(
            `[${consumerName}] Procesando créditos para: ${item.documento}`
          );

          // Obtiene créditos del cliente
          const creditos = await this.legacyDataService
            .getCreditosByDocumento(item.documento);

          // Migra cada crédito
          for (const credito of creditos) {
            // await this.mainDataService.createCreditoFromLegacy(credito, item.documento);
          }

          await this.queueService.markCompleted(item.id);
          await this.queueService.enqueue(item.documento, 'PAGOS');

          this.logger.info(
            `[${consumerName}] ✓ Completado: ${item.documento} (${creditos.length} créditos)`
          );

        } catch (error) {
          this.logger.error(
            `[${consumerName}] Error: ${item.documento} - ${error.message}`
          );
          await this.queueService.markError(item.id, error.message);
        }

      } catch (error) {
        this.logger.error(`[${consumerName}] Error en loop: ${error.message}`);
        await this.sleep(5000);
      }
    }
  }

  /**
   * CONSUMIDOR 3: Procesa pagos de la cola
   * Entrada: PAGOS (PENDIENTE)
   * Salida: Enqueue a AMORTIZACIONES
   */
  private async procesarPagosConsumer(): Promise<void> {
    const consumerName = 'PagosConsumer';

    while (this.consumersRunning) {
      try {
        const item = await this.queueService.dequeue('PAGOS');

        if (!item) {
          await this.sleep(5000);
          continue;
        }

        try {
          this.logger.debug(
            `[${consumerName}] Procesando pagos para: ${item.documento}`
          );

          const pagos = await this.legacyDataService
            .getPagosByDocumento(item.documento);

          for (const pago of pagos) {
            // await this.mainDataService.createPagoFromLegacy(pago, item.documento);
          }

          await this.queueService.markCompleted(item.id);
          await this.queueService.enqueue(item.documento, 'AMORTIZACIONES');

          this.logger.info(
            `[${consumerName}] ✓ Completado: ${item.documento} (${pagos.length} pagos)`
          );

        } catch (error) {
          this.logger.error(
            `[${consumerName}] Error: ${item.documento} - ${error.message}`
          );
          await this.queueService.markError(item.id, error.message);
        }

      } catch (error) {
        this.logger.error(`[${consumerName}] Error en loop: ${error.message}`);
        await this.sleep(5000);
      }
    }
  }

  /**
   * CONSUMIDOR 4: Procesa amortizaciones de la cola
   * Entrada: AMORTIZACIONES (PENDIENTE)
   * Salida: Enqueue a BODEGA (si aplica)
   */
  private async procesarAmortizacionesConsumer(): Promise<void> {
    const consumerName = 'AmortizacionesConsumer';

    while (this.consumersRunning) {
      try {
        const item = await this.queueService.dequeue('AMORTIZACIONES');

        if (!item) {
          await this.sleep(5000);
          continue;
        }

        try {
          this.logger.debug(
            `[${consumerName}] Procesando amortizaciones para: ${item.documento}`
          );

          // Lógica de amortizaciones
          // await this.mainDataService.createAmortizacionesFromLegacy(item.documento);

          await this.queueService.markCompleted(item.id);

          this.logger.info(
            `[${consumerName}] ✓ Completado: ${item.documento}`
          );

        } catch (error) {
          this.logger.error(
            `[${consumerName}] Error: ${item.documento} - ${error.message}`
          );
          await this.queueService.markError(item.id, error.message);
        }

      } catch (error) {
        this.logger.error(`[${consumerName}] Error en loop: ${error.message}`);
        await this.sleep(5000);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTROL Y MONITOREO
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Obtiene estado actual de la migración
   * 
   * @returns Objeto con métricas actualizadas
   */
  async getQueueStatus() {
    try {
      const queueMetrics = await this.queueService.getMetrics();

      return {
        isProducerRunning: this.isProcessing,
        isConsumersRunning: this.consumersRunning,
        batchesProcessedByProducer: this.batchIndex,
        queue: queueMetrics,
        dlq: await this.queueService.getDeadLetterQueue(10)
      };
    } catch (error) {
      this.logger.error(`[MIGRATION] Error obteniendo estado: ${error.message}`);
      throw error;
    }
  }

  /**
   * Pausa los consumidores (el productor sigue si está en progreso)
   */
  async pauseConsumers(): Promise<void> {
    this.consumersRunning = false;
    this.logger.info('[MIGRATION] Consumidores pausados');
  }

  /**
   * Reanuda los consumidores
   */
  async resumeConsumers(): Promise<void> {
    if (this.consumersRunning) {
      throw new Error('Consumidores ya están corriendo');
    }

    this.consumersRunning = true;
    await this.startAllConsumers();
    this.logger.info('[MIGRATION] Consumidores reanudados');
  }

  /**
   * Detiene la migración completamente
   */
  async stopMigration(): Promise<void> {
    this.isProcessing = false;
    this.consumersRunning = false;
    this.logger.info('[MIGRATION] Migración detenida');
  }

  /**
   * Resetea items que se quedaron en PROCESANDO (workers que se colgaron)
   */
  async resetStalledItems(minutes: number = 5): Promise<number> {
    const count = await this.queueService.resetStalled(minutes);
    this.logger.info(`[MIGRATION] Reseteados ${count} items stalled`);
    return count;
  }

  /**
   * Limpia la cola completamente (⚠️ USE CON CUIDADO)
   */
  async clearQueue(): Promise<void> {
    await this.queueService.clearQueue();
    this.batchIndex = 0;
    this.logger.warn('[MIGRATION] Cola limpiada');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Obtiene total de clientes en BD legacy
   */
  private async getTotalClientesLegacy(): Promise<number> {
    try {
      const result = await prismaLegacyService.$queryRaw<
        Array<{ count: number }>
      >`SELECT COUNT(*) as count FROM clientes`;
      
      return result[0].count;
    } catch (error) {
      this.logger.error(`[MIGRATION] Error contando clientes: ${error.message}`);
      return 0;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Estimación de tiempo restante (muy básico)
   */
  private estimateTimeRemaining(queueMetrics: any): string {
    const pending = queueMetrics.pendientes || 0;
    if (pending === 0) return 'Completado';

    // Asume 5 items procesados por segundo (ajusta según tu capacidad)
    const secondsRemaining = Math.ceil(pending / 5);
    const hours = Math.floor(secondsRemaining / 3600);
    const minutes = Math.floor((secondsRemaining % 3600) / 60);

    if (hours > 0) {
      return `~${hours}h ${minutes}m`;
    }
    return `~${minutes}m`;
  }
}

export default MigrationService;
```

---

## 📱 MigrationController - Nuevos Endpoints

### Ubicación: `src/modules/migration/migration.controller.ts`

**Reemplaza el archivo completo:**

```typescript
import { Request, Response } from 'express';
import MigrationService from './migration.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

/**
 * Controlador para endpoints de migración
 * Maneja los requests HTTP y delega lógica a MigrationService
 */
class MigrationController {
  private migrationService = MigrationService.getInstance();
  private logger = WinstonAdapter;

  /**
   * POST /migration/start
   * 
   * ✅ Inicia migración automática en batches
   * ✅ Retorna al instante (no bloquea)
   * ✅ Procesa 32k clientes en background
   * 
   * @query batchSize - Tamaño del batch (default: 500)
   * 
   * @example
   * POST http://localhost:3000/api/migration/start?batchSize=1000
   * 
   * Response:
   * {
   *   "success": true,
   *   "message": "Migración iniciada",
   *   "config": { "batchSize": 1000 }
   * }
   */
  async startMigration(req: Request, res: Response): Promise<void> {
    try {
      const batchSize = parseInt(req.query.batchSize as string) || 500;

      // Validar rango sensato
      if (batchSize < 10 || batchSize > 5000) {
        res.status(400).json({
          success: false,
          error: 'batchSize debe estar entre 10 y 5000'
        });
        return;
      }

      // Inicia migración en background
      await this.migrationService.processBatchesInBackground(batchSize);

      res.json({
        success: true,
        message: `Migración iniciada. Procesando en batches de ${batchSize}`,
        config: {
          batchSize,
          nextEndpoint: 'GET /api/migration/metrics para ver progreso'
        },
        note: 'Este endpoint retorna instantáneamente. La migración corre en background'
      });

    } catch (error) {
      this.logger.error(`[CONTROLLER] Error iniciando migración: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /migration/start-with-consumers
   * 
   * ✅ Inicia migración DE CLIENTES + inicia consumidores
   * ✅ Opción "all-in-one": ejecuta todo automáticamente
   * 
   * @query batchSize - Tamaño del batch (default: 500)
   * 
   * @example
   * POST http://localhost:3000/api/migration/start-with-consumers
   * 
   * Response:
   * {
   *   "success": true,
   *   "message": "Migración y consumidores iniciados",
   *   "producer": "RUNNING",
   *   "consumers": "RUNNING"
   * }
   */
  async startMigrationWithConsumers(req: Request, res: Response): Promise<void> {
    try {
      const batchSize = parseInt(req.query.batchSize as string) || 500;

      // Inicia productor
      await this.migrationService.processBatchesInBackground(batchSize);

      // Inicia consumidores
      await this.migrationService.startAllConsumers();

      res.json({
        success: true,
        message: 'Migración y consumidores iniciados',
        status: {
          producer: 'RUNNING',
          consumers: 'RUNNING',
          batchSize,
          note: 'Puedes monitorear con GET /api/migration/metrics'
        }
      });

    } catch (error) {
      this.logger.error(`[CONTROLLER] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /migration/metrics
   * 
   * 📊 Ver estado actual de la migración EN TIEMPO REAL
   * ✅ NO interrumpe nada
   * ✅ Se puede llamar múltiples veces
   * 
   * @example
   * GET http://localhost:3000/api/migration/metrics
   * 
   * Response:
   * {
   *   "success": true,
   *   "progress": "4.25%",
   *   "queue": {
   *     "pendientes": 30656,
   *     "procesando": 52,
   *     "completados": 1360,
   *     "errores": 0,
   *     "total": 32000,
   *     "progreso": "4.25%",
   *     "timestamp": "2026-02-19T14:30:45.123Z"
   *   },
   *   "estimatedTimeRemaining": "~106m"
   * }
   */
  async getQueueMetrics(req: Request, res: Response): Promise<void> {
    try {
      const status = await this.migrationService.getQueueStatus();

      // Calcula progreso
      const total = status.queue.total || 1;
      const completed = status.queue.completados || 0;
      const progress = ((completed / total) * 100).toFixed(2);

      res.json({
        success: true,
        progress: `${progress}%`,
        queue: status.queue,
        producer: {
          isRunning: status.isProducerRunning,
          batchesProcessed: status.batchesProcessedByProducer
        },
        consumers: {
          isRunning: status.isConsumersRunning
        },
        deadLetterQueue: {
          count: status.dlq.length,
          recentErrors: status.dlq.slice(0, 3)
        },
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.error(`[CONTROLLER] Error obteniendo métricas: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /migration/start-consumers
   * 
   * Inicia los consumidores (después de haber iniciado el productor)
   * 
   * @example
   * POST http://localhost:3000/api/migration/start-consumers
   */
  async startConsumers(req: Request, res: Response): Promise<void> {
    try {
      await this.migrationService.startAllConsumers();

      res.json({
        success: true,
        message: 'Consumidores iniciados',
        note: 'Los consumidores procesarán items de las colas'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /migration/pause
   * 
   * ⏸️ Pausa los consumidores
   * El productor NO se detiene (si está en progreso)
   * 
   * @example
   * POST http://localhost:3000/api/migration/pause
   */
  async pauseConsumers(req: Request, res: Response): Promise<void> {
    try {
      await this.migrationService.pauseConsumers();

      res.json({
        success: true,
        message: 'Consumidores pausados'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /migration/resume
   * 
   * 🔄 Reanuda los consumidores desde donde se pausaron
   * 
   * @example
   * POST http://localhost:3000/api/migration/resume
   */
  async resumeConsumers(req: Request, res: Response): Promise<void> {
    try {
      await this.migrationService.resumeConsumers();

      res.json({
        success: true,
        message: 'Consumidores reanudados'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /migration/stop
   * 
   * ⏹️ Detiene todo (productor + consumidores)
   * 
   * @example
   * POST http://localhost:3000/api/migration/stop
   */
  async stopMigration(req: Request, res: Response): Promise<void> {
    try {
      await this.migrationService.stopMigration();

      res.json({
        success: true,
        message: 'Migración detenida completamente'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /migration/reset-stalled
   * 
   * Resetea items que estuvieron demasiado tiempo en PROCESANDO
   * (Útil si un worker se cuelga sin completar)
   * 
   * @query minutes - Cuántos minutos se considera "stalled" (default: 5)
   * 
   * @example
   * POST http://localhost:3000/api/migration/reset-stalled?minutes=10
   */
  async resetStalledItems(req: Request, res: Response): Promise<void> {
    try {
      const minutes = parseInt(req.query.minutes as string) || 5;

      const count = await this.migrationService.resetStalledItems(minutes);

      res.json({
        success: true,
        message: `${count} items reseteados`,
        resetItemsCount: count
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /migration/clear-queue
   * 
   * ⚠️ PELIGROSO: Limpia la cola completamente
   * Solo usar si realmente necesitas reiniciar desde cero
   * 
   * @example
   * POST http://localhost:3000/api/migration/clear-queue
   */
  async clearQueue(req: Request, res: Response): Promise<void> {
    try {
      // Double check: requiere parámetro de confirmación
      if (req.query.confirm !== 'true') {
        res.status(400).json({
          success: false,
          error: 'Requiere ?confirm=true para limpiar la cola'
        });
        return;
      }

      await this.migrationService.clearQueue();

      res.json({
        success: true,
        message: 'Cola limpiada completamente'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default MigrationController;
```

---

## 🛣️ Routes - Configuración

### Ubicación: `src/modules/migration/migration.routes.ts`

**Reemplaza el archivo completo:**

```typescript
import { Router, Request, Response } from 'express';
import MigrationController from './migration.controller';

const router = Router();
const controller = new MigrationController();

// ═══════════════════════════════════════════════════════════════════════════
// ENDPOINTS DE MIGRACIÓN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/migration/start
 * Inicia migración de clientes por batches automáticos
 * 
 * Query params:
 * - batchSize: 500 (default)
 * 
 * Ejemplo:
 * curl -X POST "http://localhost:3000/api/migration/start?batchSize=500"
 */
router.post('/start', (req: Request, res: Response) =>
  controller.startMigration(req, res)
);

/**
 * POST /api/migration/start-with-consumers
 * Inicia migración + todos los consumidores en un solo call
 * Opción "all-in-one" para empezar todo de una vez
 */
router.post('/start-with-consumers', (req: Request, res: Response) =>
  controller.startMigrationWithConsumers(req, res)
);

/**
 * GET /api/migration/metrics
 * Ver estado actual de la migración EN TIEMPO REAL
 * 
 * Se puede llamar múltiples veces sin interrumpir nada
 * Ejemplo:
 * curl -X GET "http://localhost:3000/api/migration/metrics"
 */
router.get('/metrics', (req: Request, res: Response) =>
  controller.getQueueMetrics(req, res)
);

/**
 * POST /api/migration/start-consumers
 * Inicia específicamente los consumidores
 * (útil si iniciaste solo el productor antes)
 */
router.post('/start-consumers', (req: Request, res: Response) =>
  controller.startConsumers(req, res)
);

/**
 * POST /api/migration/pause
 * Pausa los consumidores (el productor sigue si está en progreso)
 */
router.post('/pause', (req: Request, res: Response) =>
  controller.pauseConsumers(req, res)
);

/**
 * POST /api/migration/resume
 * Reanuda los consumidores desde donde se pausaron
 */
router.post('/resume', (req: Request, res: Response) =>
  controller.resumeConsumers(req, res)
);

/**
 * POST /api/migration/stop
 * Detiene todo completamente (productor + consumidores)
 */
router.post('/stop', (req: Request, res: Response) =>
  controller.stopMigration(req, res)
);

/**
 * POST /api/migration/reset-stalled
 * Resetea items que se quedaron en PROCESANDO demasiado tiempo
 * 
 * Query params:
 * - minutes: 5 (default) - Items en PROCESANDO más de este tiempo se resetean
 */
router.post('/reset-stalled', (req: Request, res: Response) =>
  controller.resetStalledItems(req, res)
);

/**
 * POST /api/migration/clear-queue
 * ⚠️ PELIGROSO: Limpia la cola completamente
 * Requiere ?confirm=true
 */
router.post('/clear-queue', (req: Request, res: Response) =>
  controller.clearQueue(req, res)
);

export default router;
```

---

## 📋 Ejemplos de Uso

### Escenario 1: Empezar todo desde cero

```bash
# PASO 1: Inicia migración de clientes en batches de 500
curl -X POST "http://localhost:3000/api/migration/start?batchSize=500"

# Response:
# {
#   "success": true,
#   "message": "Migración iniciada. Procesando en batches de 500",
#   ...
# }
# ✓ Retorna al instante

# PASO 2: Inicia consumidores (después de 1-2 segundos)
curl -X POST "http://localhost:3000/api/migration/start-consumers"

# Response:
# {
#   "success": true,
#   "message": "Consumidores iniciados"
# }

# PASO 3: Ver progreso (puedes hacerlo mientras corre todo)
curl -X GET "http://localhost:3000/api/migration/metrics"

# Response:
# {
#   "success": true,
#   "progress": "2.35%",
#   "queue": {
#     "pendientes": 31246,
#     "procesando": 48,
#     "completados": 706,
#     ...
#   },
#   ...
# }

# PASO 4: Espera a que termine (o monitorea)
# En una pestaña diferente, ejecuta /metrics cada 5 segundos
```

### Escenario 2: Todo de una vez

```bash
# Un solo call que hace todo
curl -X POST "http://localhost:3000/api/migration/start-with-consumers?batchSize=1000"

# Inicia automáticamente:
# - Productor: procesa clientes en batches de 1000
# - Consumidores: procesan créditos, pagos, amortizaciones
```

### Escenario 3: Pausar y reanudar

```bash
# Pausa los consumidores (pero el productor sigue)
curl -X POST "http://localhost:3000/api/migration/pause"

# Ver estado
curl -X GET "http://localhost:3000/api/migration/metrics"

# Reanuda desde donde se pausó
curl -X POST "http://localhost:3000/api/migration/resume"
```

---

## 🔄 Flujo Completo Visualizado

```
TIEMPO: Momento 0 - Usuario presiona "INICIAR MIGRACIÓN"

curl -X POST /migration/start-with-consumers?batchSize=500
     ↓
[Response al instante: "Migración iniciada"]
     ↓
┌─────────────────────────────────────────────────────────────────┐
│ EN BACKGROUND - PRODUCTOR COMIENZA                              │
├─────────────────────────────────────────────────────────────────┤
│ Batch 1: Obtiene clientes 0-500 → Enqueue a CLIENTES           │
│ Batch 2: Obtiene clientes 500-1000 → Enqueue a CLIENTES        │
│ Batch 3: Obtiene clientes 1000-1500 → Enqueue a CLIENTES       │
│ ... (espera 2s entre batches, continúa)                         │
└─────────────────────────────────────────────────────────────────┘

PARALELO EN BACKGROUND - CONSUMIDORES COMIENZAN

┌──────────────────────────────────────┐
│ CONSUMIDOR 1: Clientes               │
│ - Dequeue CLIENTES (PENDIENTE)       │
│ - Migra cliente                      │
│ - Enqueue CREDITOS                   │
└──────────────────────────────────────┘
          ↓
┌──────────────────────────────────────┐
│ CONSUMIDOR 2: Créditos               │
│ - Dequeue CREDITOS (PENDIENTE)       │
│ - Migra créditos                     │
│ - Enqueue PAGOS                      │
└──────────────────────────────────────┘
          ↓
┌──────────────────────────────────────┐
│ CONSUMIDOR 3: Pagos                  │
│ - Dequeue PAGOS (PENDIENTE)          │
│ - Migra pagos                        │
│ - Enqueue AMORTIZACIONES             │
└──────────────────────────────────────┘

TIEMPO: 500ms - Usuario presiona "VER PROGRESO"

curl -X GET /migration/metrics
     ↓
[Respuesta instantánea con estado actual]
{
  "progress": "2.35%",
  "queue": {
    "pendientes": 31246,
    "procesando": 48,
    "completados": 706
  }
}

TIEMPO: 1s después - Usuario vuelve a presionar "VER PROGRESO"

curl -X GET /migration/metrics
     ↓
[Respuesta instantánea]
{
  "progress": "3.12%",
  "queue": {
    "pendientes": 30980,
    "procesando": 52,
    "completados": 968
  }
}
# ✓ Aumentó a 968, sin interrumpir nada

TIEMPO: 30 minutos después - Usuario decide pausar

curl -X POST /migration/pause
     ↓
[Consumidores se detienen, con 20,000 clientes completados]

TIEMPO: 1 hora después - Usuario reanuda

curl -X POST /migration/resume
     ↓
[Consumidores reanudan desde item pendiente siguiente]

TIEMPO: N horas después - Se completa

curl -X GET /migration/metrics
     ↓
{
  "progress": "100%",
  "queue": {
    "pendientes": 0,
    "procesando": 0,
    "completados": 32000,
    "errores": 0
  }
}
```

---

## 🔍 Monitoreo y Debugging

### Ver logs de migración

```bash
# En desarrollo, verás esto en consola:
# [MIGRATION] Iniciando migración de clientes en batches de 500
# [MIGRATION] Total clientes legacy: 32000
# [MIGRATION] Batch 1: procesando clientes 0-500
# [MIGRATION] Batch 1 encolado: 500 clientes
# [ClientesConsumer] Procesando: 1234567890
# [ClientesConsumer] ✓ Completado: 1234567890
# ...
```

### Verificar estado de la BD

```sql
-- Ver cuántos items en cada estado
SELECT estado, COUNT(*) as count 
FROM migration_queue 
GROUP BY estado;

-- Ver items en error
SELECT documento, fase, error, intentos 
FROM migration_queue 
WHERE estado = 'ERROR' OR intentos > 0;

-- Ver Dead Letter Queue
SELECT * FROM migration_queue_dlq ORDER BY createdAt DESC LIMIT 10;

-- Ver items que llevan mucho tiempo en PROCESANDO
SELECT * 
FROM migration_queue 
WHERE estado = 'PROCESANDO' 
AND updatedAt < DATE_SUB(NOW(), INTERVAL 5 MINUTE);
```

### Troubleshooting

| Problema | Causa | Solución |
|----------|-------|----------|
| **Metrics dice "procesando": 0 pero hay pendientes** | Consumidores no iniciados | `POST /migration/start-consumers` |
| **Items se quedan en PROCESANDO** | Worker se colgó | `POST /migration/reset-stalled?minutes=5` |
| **Errors en Dead Letter Queue** | Datos inconsistentes/falta mapeo | Ver error_message en DLQ, corregir mapeo en MainDataService |
| **Migración muy lenta** | Batch size muy pequeño o BD lenta | Aumenta batchSize en query params |
| **BD se ve sobrecargar** | Demasiado procesamiento en paralelo | Reduce batchSize o aumenta sleep entre batches |

---

## ✅ Resumen

| Step | Action | Endpoint | Expected |
|------|--------|----------|----------|
| 1 | Iniciar migración + consumidores | `POST /start-with-consumers` | Response inmediata |
| 2 | Ver progreso (repetir cada 5s) | `GET /metrics` | % completado, pendientes, etc |
| 3 | Si se cuela un worker | `POST /reset-stalled` | Items vuelven a PENDIENTE |
| 4 | Pausar si necesitas | `POST /pause` | Consumidores se detienen |
| 5 | Reanudar | `POST /resume` | Continúan desde donde pararon |
| 6 | Cuando termina | Check `/metrics` | 100% completado |

**Ahora listo para implementar!**
