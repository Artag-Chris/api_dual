import { Request, Response } from 'express';
import UsersMigrationService from '../../domain/class/users-migration.service';
import updateService from '../../domain/class/user-admin-update.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

class UsuariosMigrationController {
  private migrationService = UsersMigrationService.getInstance();
  private updateService = updateService;
  private logger = WinstonAdapter;

  async migrateUsersAdmin(req: Request, res: Response) {
    try {
      this.logger.info(`[API] POST /api/admin/migrate-users - Iniciando migración de usuarios`);

      const result = await this.migrationService.migrateAllUsersAdmin();

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

  /**
   * POST /api/admin/update-users-from-excel
   * Actualiza información de usuarios admin desde archivo Excel
   * 
   * Realiza fuzzy matching automático:
   * - punto (Excel) → zona_id (sucursal)
   * - rol_ (Excel) → id_permiso (lista_permisos)
   * 
   * Threshold: 70%
   * Por defecto: zona_id=NULL, id_permiso=5 (Asesor)
   */
  async updateUsersAdminFromExcel(req: Request, res: Response) {
    try {
      // Validar que se recibió archivo
      if (!req.file) {
        this.logger.warn('[API] POST /api/admin/update-users-from-excel - No file provided');
        return res.status(400).json({
          success: false,
          status: "ERROR",
          message: 'No file provided. Use multipart/form-data with field name "file"'
        });
      }

      // Validar que sea xlsx
      if (!req.file.mimetype.includes('spreadsheet') && !req.file.originalname.endsWith('.xlsx')) {
        this.logger.warn(
          `[API] POST /api/admin/update-users-from-excel - Invalid file type: ${req.file.mimetype}`
        );
        return res.status(400).json({
          success: false,
          status: "ERROR",
          message: 'File must be .xlsx format'
        });
      }

      this.logger.info(
        `[API] POST /api/admin/update-users-from-excel - Iniciando actualización desde Excel`
      );

      // Procesar archivo
      const result = await this.updateService.updateUsersAdminFromExcel(req.file.buffer);

      this.logger.info(
        `[API] Resultado actualización: ${result.status} (${result.totalActualizados}/${result.totalProcesados})`
      );

      return res.status(200).json({
        success: result.status === 'SUCCESS' || result.status === 'PARTIAL',
        status: result.status,
        data: {
          totalProcesados: result.totalProcesados,
          totalActualizados: result.totalActualizados,
          totalErrores: result.totalErrores,
          resumen: result.resumen,
          resultados: result.resultados
        }
      });

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[API] Error en updateUsersAdminFromExcel: ${msg}`);
      
      return res.status(500).json({
        success: false,
        status: "ERROR",
        message: msg
      });
    }
  }
}

export default new UsuariosMigrationController();
