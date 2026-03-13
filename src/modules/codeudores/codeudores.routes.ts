import { Router } from 'express';
import { CodeudoresClienteController } from './codeudores-migration.controller';
import CodeudoresClienteMapperService from '../../domain/class/codeudores-cliente-mapper.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

export class CodeudoresRoutes {
  static get routes(): Router {
    const router = Router();

    // Instanciar dependencias singleton
    const codeudoresMapper = CodeudoresClienteMapperService.getInstance();
    const logger = WinstonAdapter;

    // Crear controller
    const controller = new CodeudoresClienteController(
      codeudoresMapper,
      logger,
    );

    // Rutas: /api/admin/codeudores/migrate
    router.post('/codeudores/migrate', (req, res) =>
      controller.migrateCodeudoresClientes(req, res),
    );

    return router;
  }
}
