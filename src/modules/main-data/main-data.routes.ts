import { Router } from 'express';
import { MainDataController } from './main-data.controller';

export class MainDataRoutes {
  static get routes(): Router {
    const router = Router();
    const controller = new MainDataController();

    // ==================== USER CLIENTE ====================
    router.get('/usuarios', controller.getAllUserClientes);
    router.get('/usuarios/:id', controller.getUserClienteById);

    // ==================== INFO PERSONAL ====================
    router.get('/info-personal', controller.getAllInfoPersonal);

    // ==================== INFO CONTACTO ====================
    router.get('/info-contacto', controller.getAllInfoContacto);

    // ==================== INFO LABORAL ====================
    router.get('/info-laboral', controller.getAllInfoLaboral);

    // ==================== INFO REFERENCIAS ====================
    router.get('/info-referencias', controller.getAllInfoReferencias);

    // ==================== PAGOS ====================
    router.get('/pagos', controller.getAllPagos);

    // ==================== PRODUCTOS ====================
    router.get('/productos', controller.getAllProductos);

    // ==================== INVENTARIO ====================
    router.get('/inventario', controller.getAllInventario);

    // ==================== PEDIDOS ====================
    router.get('/pedidos', controller.getAllPedidos);

    // ==================== ESTUDIOS CRÉDITO ====================
    router.get('/estudios', controller.getAllEstudiosCredito);

    // ==================== HISTORIAL PAGOS ====================
    router.get('/historial-pagos', controller.getAllHistorialPagos);

    // ==================== ESTADÍSTICAS ====================
    router.get('/stats', controller.getEstadisticas);

    return router;
  }
}
