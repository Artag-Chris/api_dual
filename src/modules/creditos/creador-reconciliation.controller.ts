import { Request, Response } from 'express';
import CreadorReconciliationService from '../../domain/class/creador-reconciliation.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

export class CreadorReconciliationController {
  private creadorService = CreadorReconciliationService.getInstance();
  private logger = WinstonAdapter;

  /**
   * Inicia la reconciliación de creadores
   * POST /api/admin/creditos/reconcile-creador
   */
  async reconcileCreadores(req: Request, res: Response): Promise<void> {
    try {
      this.logger.info('[CREADOR-CONTROLLER] Iniciando reconciliación...');

      // Ejecutar en background sin esperar respuesta
      this.creadorService.reconcileAllCreditos().catch((error) => {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`[CREADOR-CONTROLLER] Error en background: ${msg}`);
      });

      res.json({
        status: 'iniciado',
        message: 'Reconciliación de creadores iniciada. Revise los logs',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[CREADOR-CONTROLLER] Error: ${msg}`);
      res.status(500).json({
        status: 'error',
        message: msg,
      });
    }
  }
}

export default new CreadorReconciliationController();
