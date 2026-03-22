import { Router } from 'express';
import estudioSincronizacionController from './estudio-sincronizacion.controller';

const router = Router();

/**
 * POST /api/admin/estudios/sincronizar
 * Sincroniza creadores y crea registros en estudios_realizados
 */
router.post('/sincronizar', (req, res) =>
  estudioSincronizacionController.sincronizar(req, res)
);

export default router;
