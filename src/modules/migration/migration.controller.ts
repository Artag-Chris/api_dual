import { Request, Response } from 'express';
import MigrationService from './migration.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

/**
 * Controlador para endpoints de migración con sistema de colas FIFO
 * Maneja los requests HTTP y delega lógica a MigrationService
 */
class MigrationController {
  private migrationService = MigrationService.getInstance();
  private logger = WinstonAdapter;

  /**
   * POST /api/migration/start
   * 
   * ✅ Inicia migración automática en batches
   * ✅ Retorna al instante (no bloquea)
   * ✅ Procesa 32k clientes en background
   * 
   * @query batchSize - Tamaño del batch (default: 500)
   */
  async startMigration(req: Request, res: Response): Promise<void> {
    try {
      const batchSize = parseInt(req.query.batchSize as string) || 500;

      if (batchSize < 10 || batchSize > 5000) {
        res.status(400).json({
          success: false,
          message: 'batchSize debe estar entre 10 y 5000'
        });
        return;
      }

      await this.migrationService.processBatchesInBackground(batchSize);

      res.status(200).json({
        success: true,
        message: 'Migración iniciada en background',
        config: {
          batchSize,
          timestamp: new Date()
        }
      });

    } catch (error) {
      this.logger.error(`[CONTROLLER] Error iniciando migración: ${(error as any).message}`);
      res.status(500).json({
        success: false,
        message: 'Error iniciando migración',
        error: (error as any).message
      });
    }
  }

  /**
   * POST /api/migration/start-with-consumers
   * 
   * ✅ Inicia migración + consumidores automáticamente
   * ✅ Opción "all-in-one": ejecuta todo
   */
  async startMigrationWithConsumers(req: Request, res: Response): Promise<void> {
    try {
      const batchSize = parseInt(req.query.batchSize as string) || 500;

      if (batchSize < 10 || batchSize > 5000) {
        res.status(400).json({
          success: false,
          message: 'batchSize debe estar entre 10 y 5000'
        });
        return;
      }

      await this.migrationService.processBatchesInBackground(batchSize);
      await this.migrationService.startAllConsumers();

      res.status(200).json({
        success: true,
        message: 'Migración y consumidores iniciados',
        producer: 'RUNNING',
        consumers: 'RUNNING',
        config: { batchSize, timestamp: new Date() }
      });

    } catch (error) {
      this.logger.error(`[CONTROLLER] Error: ${(error as any).message}`);
      res.status(500).json({
        success: false,
        message: 'Error',
        error: (error as any).message
      });
    }
  }

  /**
   * GET /api/migration/metrics
   * 
   * 📊 Ver estado actual de la migración EN TIEMPO REAL
   * ✅ NO interrumpe nada
   * ✅ Se puede llamar múltiples veces
   */
  async getQueueMetrics(req: Request, res: Response): Promise<void> {
    try {
      const status = await this.migrationService.getQueueStatus();

      res.status(200).json({
        success: true,
        ...status
      });

    } catch (error) {
      this.logger.error(`[CONTROLLER] Error en metrics: ${(error as any).message}`);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo métricas',
        error: (error as any).message
      });
    }
  }

  /**
   * POST /api/migration/start-consumers
   */
  async startConsumers(req: Request, res: Response): Promise<void> {
    try {
      await this.migrationService.startAllConsumers();

      res.status(200).json({
        success: true,
        message: 'Consumidores iniciados'
      });

    } catch (error) {
      this.logger.error(`[CONTROLLER] Error: ${(error as any).message}`);
      res.status(500).json({
        success: false,
        message: 'Error iniciando consumidores',
        error: (error as any).message
      });
    }
  }

  /**
   * POST /api/migration/pause
   */
  async pauseConsumers(req: Request, res: Response): Promise<void> {
    try {
      await this.migrationService.pauseConsumers();

      res.status(200).json({
        success: true,
        message: 'Consumidores pausados'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error pausando consumidores',
        error: (error as any).message
      });
    }
  }

  /**
   * POST /api/migration/resume
   */
  async resumeConsumers(req: Request, res: Response): Promise<void> {
    try {
      await this.migrationService.resumeConsumers();

      res.status(200).json({
        success: true,
        message: 'Consumidores reanudados'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error reanudando consumidores',
        error: (error as any).message
      });
    }
  }

  /**
   * POST /api/migration/stop
   */
  async stopMigration(req: Request, res: Response): Promise<void> {
    try {
      await this.migrationService.stopMigration();

      res.status(200).json({
        success: true,
        message: 'Migración detenida completamente'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deteniendo migración',
        error: (error as any).message
      });
    }
  }

  /**
   * POST /api/migration/reset-stalled
   */
  async resetStalledItems(req: Request, res: Response): Promise<void> {
    try {
      const minutes = parseInt(req.query.minutes as string) || 5;
      const count = await this.migrationService.resetStalledItems(minutes);

      res.status(200).json({
        success: true,
        message: `Reseteados ${count} items stalled`,
        itemsReset: count
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error reseteando stalled items',
        error: (error as any).message
      });
    }
  }

  /**
   * POST /api/migration/clear-queue
   */
  async clearQueue(req: Request, res: Response): Promise<void> {
    try {
      const confirm = req.query.confirm as string;

      if (confirm !== 'true') {
        res.status(400).json({
          success: false,
          message: 'Requiere ?confirm=true para limpiar la cola'
        });
        return;
      }

      await this.migrationService.clearQueue();

      res.status(200).json({
        success: true,
        message: 'Cola limpiada completamente',
        warning: 'Se eliminaron todos los datos de la cola'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error limpiando cola',
        error: (error as any).message
      });
    }
  }

  // LEGACY: Métodos para compatibilidad

  /**
   * GET /api/migration/statistics
   */
  async getMigrationStatistics(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.migrationService.getMigrationStatistics();
      res.status(200).json(stats);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error obteniendo estadísticas',
        error: (error as any).message
      });
    }
  }

  /**
   * GET /api/migration/validate
   */
  async validateConsistency(req: Request, res: Response): Promise<void> {
    try {
      const validation = await this.migrationService.validateDataConsistency();
      res.status(200).json(validation);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error validando',
        error: (error as any).message
      });
    }
  }
}

export default MigrationController;
