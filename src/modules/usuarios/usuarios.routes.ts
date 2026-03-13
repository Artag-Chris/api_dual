import { Router } from 'express';
import usuariosMigrationController from './usuarios-migration.controller';

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

    return router;
  }
}
