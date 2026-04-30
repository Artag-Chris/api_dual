import { Request, Response } from 'express';
import UsersMigrationService from '../../domain/class/users-migration.service';
import updateService from '../../domain/class/user-admin-update.service';
import docUpdateService from '../../domain/class/user-admin-doc-update.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

class UsuariosMigrationController {
  private migrationService = UsersMigrationService.getInstance();
  private updateService = updateService;
  private docUpdateService = docUpdateService;
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

  async migrateInactiveUsersAdmin(req: Request, res: Response) {
    try {
      this.logger.info(`[API] POST /api/admin/migrate-users-inactive - Iniciando migración de usuarios inactivos`);

      const result = await this.migrationService.migrateInactiveUsersAdmin();

      this.logger.info(`[API] Resultado migración inactivos: ${result.status}`);

      return res.status(200).json({
        success: result.status === "USUARIOS_MIGRADOS",
        status: result.status,
        data: {
          usuariosMigrados: result.usuariosMigrados || 0,
          usuariosProcesados: result.usuariosProcesados || 0,
          tipo: 'CC',
          estado: 'INACTIVO'
        },
        errores: result.errores || []
      });

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[API] Error en migrateInactiveUsersAdmin: ${msg}`);
      
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

  /**
   * POST /api/admin/update-docs-from-csv
   * Actualiza documentos y passwords de usuarios admin desde archivo CSV
   * 
   * Búsqueda por prioridad:
   * 1. telefono (CSV) en campo documento (BD)
   * 2. cedula (CSV) en campo documento (BD)
   * 3. name (CSV) fuzzy match en nombre_completo/nombre/apellido (BD)
   * 
   * Acciones al encontrar:
   * - Si documento=telefono → reemplaza por cedula
   * - Hashea cedula como password (bcrypt)
   * - Mapea rol_ con fuzzy match → id_permiso
   */
  async updateDocsFromCsv(req: Request, res: Response) {
    try {
      if (!req.file) {
        this.logger.warn('[API] POST /api/admin/update-docs-from-csv - No file provided');
        return res.status(400).json({
          success: false,
          status: 'ERROR',
          message: 'No file provided. Use multipart/form-data with field name "file"'
        });
      }

      const filename = req.file.originalname || 'file.csv';
      const validExtensions = ['.csv', '.xlsx'];
      const hasValidExtension = validExtensions.some((ext) => filename.toLowerCase().endsWith(ext));

      if (!hasValidExtension) {
        this.logger.warn(
          `[API] POST /api/admin/update-docs-from-csv - Invalid file type: ${req.file.mimetype}`
        );
        return res.status(400).json({
          success: false,
          status: 'ERROR',
          message: 'File must be .csv or .xlsx format'
        });
      }

      this.logger.info(
        `[API] POST /api/admin/update-docs-from-csv - Iniciando actualización desde ${filename}`
      );

      const result = await this.docUpdateService.updateUsersDocFromCsv(req.file.buffer, filename);

      this.logger.info(
        `[API] Resultado actualización docs: ${result.status} (${result.totalActualizados}/${result.totalProcesados})`
      );

      return res.status(200).json({
        success: result.status === 'SUCCESS' || result.status === 'PARTIAL',
        status: result.status,
        data: {
          totalProcesados: result.totalProcesados,
          totalActualizados: result.totalActualizados,
          totalNoEncontrados: result.totalNoEncontrados,
          totalErrores: result.totalErrores,
          resumen: result.resumen,
          actualizados: result.actualizados,
          noEncontrados: result.noEncontrados,
          errores: result.errores
        }
      });

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[API] Error en updateDocsFromCsv: ${msg}`);

      return res.status(500).json({
        success: false,
        status: 'ERROR',
        message: msg
      });
    }
  }
}

export default new UsuariosMigrationController();
