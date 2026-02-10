# API con Doble Conexión Prisma

API REST construida con Express y TypeScript que soporta conexiones simultáneas a dos bases de datos MySQL usando Prisma ORM con patrón Singleton.

## Arquitectura de Bases de Datos

Esta API está diseñada para trabajar con dos bases de datos independientes:

- **Legacy DB**: Base de datos existente que contiene datos heredados
- **Main DB**: Base de datos principal con esquema transformado y optimizado

### Casos de Uso

1. **Migración progresiva**: Migrar datos de la base de datos legacy a la nueva base de datos
2. **Transformación de datos**: Aplicar transformaciones durante la migración
3. **Operaciones paralelas**: Consultar y modificar ambas bases de datos simultáneamente
4. **Comparación de datos**: Validar que los datos se migraron correctamente

## Estructura del Proyecto

```
.
├── prisma/
│   ├── schema-legacy.prisma    # Schema de la base de datos legacy
│   └── schema-main.prisma      # Schema de la base de datos principal
├── src/
│   ├── database/
│   │   ├── legacy/
│   │   │   └── prisma-legacy.service.ts  # Servicio singleton para legacy DB
│   │   └── main/
│   │       └── prisma-main.service.ts    # Servicio singleton para main DB
│   ├── modules/
│   │   ├── legacy-data/         # CRUD para legacy DB
│   │   ├── main-data/           # CRUD para main DB
│   │   └── migration/           # Herramientas de migración
│   ├── config/
│   │   └── envs.ts             # Variables de entorno
│   └── presentation/
│       └── routes.ts           # Rutas principales de la API
└── package.json
```

## Configuración

### 1. Variables de Entorno

Crea un archivo `.env` basado en `.env.template`:

```bash
PORT=3000

# Base de datos Legacy (antigua)
DATABASE_URL_LEGACY="mysql://user:password@localhost:3306/legacy_db"

# Base de datos Main (nueva)
DATABASE_URL_MAIN="mysql://user:password@localhost:3306/main_db"
```

### 2. Instalación de Dependencias

```bash
npm install
```

Esto ejecutará automáticamente `npm run prisma:generate` que generará ambos clientes Prisma.

## Scripts Disponibles

### Desarrollo
```bash
npm run dev          # Inicia el servidor en modo desarrollo
```

### Build y Producción
```bash
npm run build        # Compila TypeScript a JavaScript
npm start           # Compila y ejecuta en producción
```

### Prisma - Legacy DB
```bash
npm run prisma:generate:legacy   # Genera el cliente Prisma para legacy
npm run prisma:migrate:legacy    # Ejecuta migraciones en legacy DB
npm run prisma:studio:legacy     # Abre Prisma Studio para legacy DB
npm run prisma:push:legacy       # Push del schema a legacy DB (sin migraciones)
```

### Prisma - Main DB
```bash
npm run prisma:generate:main     # Genera el cliente Prisma para main
npm run prisma:migrate:main      # Ejecuta migraciones en main DB
npm run prisma:studio:main       # Abre Prisma Studio para main DB
npm run prisma:push:main         # Push del schema a main DB (sin migraciones)
```

### Prisma - Ambas DBs
```bash
npm run prisma:generate          # Genera ambos clientes
```

## Endpoints de la API

### Legacy Data (`/api/legacy`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/legacy` | Obtiene todos los registros de la DB legacy |
| GET | `/api/legacy/:id` | Obtiene un registro específico por ID |
| POST | `/api/legacy` | Crea un nuevo registro en la DB legacy |

**Ejemplo de body para POST:**
```json
{
  "id": "uuid-here",
  "message": "Contenido del mensaje"
}
```

### Main Data (`/api/main`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/main` | Obtiene todos los registros de la DB principal |
| GET | `/api/main/:id` | Obtiene un registro específico por ID |
| POST | `/api/main` | Crea un nuevo registro en la DB principal |

**Ejemplo de body para POST:**
```json
{
  "content": "Contenido transformado"
}
```

### Migration Tools (`/api/migration`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/migration/migrate` | Inicia el proceso de migración de legacy a main |
| GET | `/api/migration/statistics` | Obtiene estadísticas de ambas bases de datos |
| GET | `/api/migration/compare/:id` | Compara un registro entre ambas DBs |

**Ejemplo de respuesta de `/api/migration/statistics`:**
```json
{
  "success": true,
  "data": {
    "legacy": {
      "something": 150
    },
    "main": {
      "transformedData": 120
    }
  }
}
```

## Uso de los Servicios Prisma

### Importar los servicios

```typescript
import { prismaLegacyService } from '../database/legacy/prisma-legacy.service';
import { prismaMainService } from '../database/main/prisma-main.service';
```

### Consultar datos

```typescript
// Desde legacy DB
const legacyData = await prismaLegacyService.something.findMany();

// Desde main DB
const mainData = await prismaMainService.transformedData.findMany();
```

### Consultas en paralelo

```typescript
const [legacyCount, mainCount] = await Promise.all([
  prismaLegacyService.something.count(),
  prismaMainService.transformedData.count()
]);
```

### Migración de datos

```typescript
// 1. Leer de legacy
const legacyRecords = await prismaLegacyService.something.findMany();

// 2. Transformar
const transformed = legacyRecords.map(record => ({
  id: record.id,
  content: record.message,
}));

// 3. Insertar en main
await prismaMainService.transformedData.createMany({
  data: transformed,
  skipDuplicates: true
});
```

## Patrón Singleton

Ambos servicios de Prisma implementan el patrón Singleton para garantizar una única instancia de conexión a cada base de datos:

```typescript
// Obtener instancia
const legacyService = PrismaLegacyService.getInstance();
const mainService = PrismaMainService.getInstance();

// Las instancias ya están exportadas para uso directo
import { prismaLegacyService, prismaMainService } from '...';
```

## Schemas de Prisma

### Legacy Schema (`schema-legacy.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/@prisma/client-legacy"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL_LEGACY")
}

model something {
  id      String @id
  message String @db.VarChar(4096)
}
```

### Main Schema (`schema-main.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/@prisma/client-main"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL_MAIN")
}

model TransformedData {
  id        String   @id @default(uuid())
  content   String   @db.VarChar(4096)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("transformed_data")
}
```

## Manejo de Errores

Todos los endpoints están protegidos con try-catch y devuelven respuestas estructuradas:

```json
{
  "success": true,
  "data": { ... }
}
```

En caso de error:

```json
{
  "success": false,
  "message": "Descripción del error",
  "error": "Detalles técnicos"
}
```

## Ciclo de Vida de las Conexiones

Las conexiones a ambas bases de datos se:
- **Inicializan** automáticamente al arrancar la aplicación
- **Mantienen abiertas** durante toda la ejecución
- **Cierran automáticamente** al recibir señales SIGINT o SIGTERM

```typescript
process.on('SIGINT', async () => {
  await prismaLegacyService.destroy();
  await prismaMainService.destroy();
  process.exit(0);
});
```

## Tecnologías

- **Node.js** con **TypeScript**
- **Express** - Framework web
- **Prisma ORM** - Cliente de base de datos type-safe
- **MySQL** - Sistema de gestión de bases de datos
- **Winston** - Logging
- **Socket.io** - WebSockets (opcional)

## Dependencias Principales

| Paquete | Versión | Uso |
|---------|---------|-----|
| @prisma/client | 6.19.2 | Cliente Prisma |
| express | 4.22.1 | Framework web |
| typescript | 5.7.3 | Lenguaje |
| dotenv | 16.6.1 | Variables de entorno |
| env-var | 7.5.0 | Validación de env vars |

## Próximos Pasos

1. **Agregar más modelos** a `schema-main.prisma` según necesites
2. **Implementar transformaciones personalizadas** en el servicio de migración
3. **Crear migraciones de Prisma** para cambios en el esquema
4. **Agregar validación de datos** con DTOs
5. **Implementar logging** detallado de operaciones de migración
6. **Agregar tests** unitarios y de integración

## Notas Importantes

- No es posible hacer transacciones nativas entre ambas bases de datos
- Para operaciones que requieran consistencia transaccional entre DBs, implementa un patrón de compensación
- Los clientes Prisma se generan en `node_modules/@prisma/client-legacy` y `node_modules/@prisma/client-main`
- Siempre ejecuta `npm run prisma:generate` después de modificar los schemas

## Soporte

Para reportar problemas o sugerencias, abre un issue en el repositorio.
