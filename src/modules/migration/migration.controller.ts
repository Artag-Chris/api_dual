import { Request, Response } from 'express';
import MigrationService from './migration.service';

/**************************************************************************************************
 * Controlador de Migración
 * 
 * Maneja las peticiones HTTP relacionadas con la migración de datos
 * entre la base de datos legacy y la base de datos principal.
 ***************************************************************************************************/

export class MigrationController {
  constructor(
    private readonly migrationService = MigrationService.getInstance()
  ) {}

  /**
   * GET /api/migration/statistics
   * Obtiene estadísticas de migración de ambas bases de datos
   */
  getMigrationStatistics = async (req: Request, res: Response) => {
    try {
      const stats = await this.migrationService.getMigrationStatistics();
      res.status(200).json(stats);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error obteniendo estadísticas',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/migration/validate
   * Valida la consistencia de datos entre ambas bases de datos
   */
  validateConsistency = async (req: Request, res: Response) => {
    try {
      const validation = await this.migrationService.validateDataConsistency();
      res.status(200).json(validation);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error validando consistencia',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/migration/preview
   * Pre-visualiza los datos que se van a migrar
   */
  previewMigration = async (req: Request, res: Response) => {
    try {
      const { skip, take } = req.query;
      const preview = await this.migrationService.previewMigration(
        skip ? parseInt(skip as string) : 0,
        take ? parseInt(take as string) : 10
      );
      res.status(200).json(preview);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error en pre-visualización',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
