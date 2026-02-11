import { Router } from 'express';
import { MigrationController } from './migration.controller';

/**************************************************************************************************
 * Rutas del módulo de Migración
 ***************************************************************************************************/

export class MigrationRoutes {
  static get routes(): Router {
    const router = Router();
    const controller = new MigrationController();

    // GET /api/migration/statistics - Obtiene estadísticas de migración
    router.get('/statistics', controller.getMigrationStatistics);

    // GET /api/migration/validate - Valida consistencia entre DBs
    router.get('/validate', controller.validateConsistency);

    // GET /api/migration/preview - Pre-visualiza datos a migrar
    router.get('/preview', controller.previewMigration);

    return router;
  }
}
