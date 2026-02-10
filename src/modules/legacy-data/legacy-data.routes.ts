import { Router } from 'express';
import { LegacyDataController } from './legacy-data.controller';

export class LegacyDataRoutes {
  static get routes(): Router {
    const router = Router();
    const controller = new LegacyDataController();

    router.get('/', controller.getAll);
    router.get('/:id', controller.getById);
    router.post('/', controller.create);

    return router;
  }
}
