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
   * POST /api/migration/migrate
   * Inicia el proceso de migración de datos
   */
  migrateData = async (req: Request, res: Response) => {
    try {
      const result = await this.migrationService.migrateSomething();
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error durante la migración',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/migration/statistics
   * Obtiene estadísticas de ambas bases de datos
   */
  getStatistics = async (req: Request, res: Response) => {
    try {
      const stats = await this.migrationService.getStatistics();
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error obteniendo estadísticas',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/migration/compare/:id
   * Compara un registro específico entre ambas bases de datos
   */
  compareRecord = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const comparison = await this.migrationService.compareRecord(id);
      res.status(200).json({
        success: true,
        data: comparison
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error comparando registros',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
