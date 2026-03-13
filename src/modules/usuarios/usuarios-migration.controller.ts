import { Request, Response } from 'express';
import UsersMigrationService from '../../domain/class/users-migration.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

class UsuariosMigrationController {
  private service = UsersMigrationService.getInstance();
  private logger = WinstonAdapter;

  async migrateUsersAdmin(req: Request, res: Response) {
    try {
      this.logger.info(`[API] POST /api/admin/migrate-users - Iniciando migración de usuarios`);

      const result = await this.service.migrateAllUsersAdmin();

      this.logger.info(`[API] Resultado migración: ${result.status}`);

      return res.status(200).json({
        success: result.status === "USUARIOS_MIGRADOS",
        status: result.status,
        data: {
          usuariosMigrados: result.usuariosMigrados || 0,
          usuariosProcesados: result.usuariosProcesados || 0,
          duplicadosEmail: result.duplicadosEmail || 0,
          sinZona: result.sinZona || 0
        },
        errores: result.errores || []
      });

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[API] Error en migrateUsersAdmin: ${msg}`);
      
      return res.status(500).json({
        success: false,
        status: "ERROR",
        message: msg
      });
    }
  }
}

export default new UsuariosMigrationController();
