import { Router } from 'express';
import multer from 'multer';
import usuariosMigrationController from './usuarios-migration.controller';

// Configuración de multer para Excel
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx files are allowed'));
    }
  }
});

export class UsuariosRoutes {
  static get routes(): Router {
    const router = Router();

    /**
     * POST /api/admin/migrate-users
     * Migra todos los usuarios de legacy.users a main.user_admin
     * 
     * Respuesta:
     * {
     *   success: boolean,
     *   status: "USUARIOS_MIGRADOS" | "TODOS_FALLIDOS" | "ERROR",
     *   data: {
     *     usuariosMigrados: number,
     *     usuariosProcesados: number,
     *     duplicadosEmail: number,
     *     sinZona: number
     *   },
     *   errores: string[]
     * }
     */
    router.post('/migrate-users', usuariosMigrationController.migrateUsersAdmin.bind(usuariosMigrationController));

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
     * 
     * Ejemplo de cabecera Excel (case-insensitive):
     * LABORA | name | estado | rol_ | email | telefono | num_cuenta | banco_id | punto | aliado
     * 
     * Request: multipart/form-data, campo "file" con archivo .xlsx
     * 
     * Respuesta:
     * {
     *   success: boolean,
     *   status: "SUCCESS" | "PARTIAL" | "FAILED",
     *   data: {
     *     totalProcesados: number,
     *     totalActualizados: number,
     *     totalErrores: number,
     *     resumen: {
     *       matchesExactos: number,
     *       matchesFuzzy: number,
     *       usuariosNoEncontrados: number,
     *       zonaIdDefault: number
     *     },
     *     resultados: UserUpdateResult[]
     *   }
     * }
     */
    router.post(
      '/update-users-from-excel',
      upload.single('file'),
      usuariosMigrationController.updateUsersAdminFromExcel.bind(usuariosMigrationController)
    );

    return router;
  }
}
