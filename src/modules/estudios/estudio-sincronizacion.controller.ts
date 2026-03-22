import { Request, Response } from 'express';
import EstudioSincronizacionService from '../../domain/class/estudio-sincronizacion.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

export class EstudioSincronizacionController {
  private estudiosService = EstudioSincronizacionService.getInstance();
  private logger = WinstonAdapter;

  /**
   * Inicia sincronización de estudios
   * POST /api/admin/estudios/sincronizar
   */
  async sincronizar(req: Request, res: Response): Promise<void> {
    try {
      this.logger.info('[ESTUDIO-CONTROLLER] Iniciando sincronización...');

      // Ejecutar en background sin esperar respuesta
      this.estudiosService.sincronizarTodos().catch((error) => {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`[ESTUDIO-CONTROLLER] Error en background: ${msg}`);
      });

      res.json({
        status: 'iniciado',
        message: 'Sincronización de estudios iniciada. Revise los logs',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[ESTUDIO-CONTROLLER] Error: ${msg}`);
      res.status(500).json({
        status: 'error',
        message: msg,
      });
    }
  }
}

export default new EstudioSincronizacionController();
