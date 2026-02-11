import { Router } from 'express';
import { LegacyDataController } from './legacy-data.controller';

export class LegacyDataRoutes {
  static get routes(): Router {
    const router = Router();
    const controller = new LegacyDataController();

    // ==================== CLIENTES ====================
    router.get('/clientes', controller.getAllClientes);
    router.get('/clientes/documento/:num_doc', controller.getClienteByDocumento);
    router.get('/clientes/:id', controller.getClienteById);

    // ==================== CRÉDITOS ====================
    router.get('/creditos', controller.getAllCreditos);
    router.get('/creditos/:id', controller.getCreditoById);
    router.get('/creditos/cliente/:cliente_id', controller.getCreditosByCliente);

    // ==================== CODEUDORES ====================
    router.get('/codeudores', controller.getAllCodeudores);

    // ==================== FACTURAS ====================
    router.get('/facturas', controller.getAllFacturas);

    // ==================== PAGOS ====================
    router.get('/pagos', controller.getAllPagos);

    // ==================== PRECREDITOS ====================
    router.get('/precreditos', controller.getAllPrecreditos);

    // ==================== ESTADÍSTICAS ====================
    router.get('/stats', controller.getEstadisticas);

    return router;
  }
}
