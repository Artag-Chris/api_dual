import { Router } from 'express';
import { MainDataController } from './main-data.controller';

export class MainDataRoutes {
  static get routes(): Router {
    const router = Router();
    const controller = new MainDataController();

    router.get('/', controller.getAll);
    router.get('/:id', controller.getById);
    router.post('/', controller.create);

    return router;
  }
}
