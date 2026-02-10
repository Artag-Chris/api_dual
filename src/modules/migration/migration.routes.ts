import { Router } from 'express';
import { MigrationController } from './migration.controller';

/**************************************************************************************************
 * Rutas del módulo de Migración
 ***************************************************************************************************/

export class MigrationRoutes {
  static get routes(): Router {
    const router = Router();
    const controller = new MigrationController();

    // POST /api/migration/migrate - Inicia la migración de datos
    router.post('/migrate', controller.migrateData);

    // GET /api/migration/statistics - Obtiene estadísticas de ambas DBs
    router.get('/statistics', controller.getStatistics);

    // GET /api/migration/compare/:id - Compara un registro específico
    router.get('/compare/:id', controller.compareRecord);

    return router;
  }
}
