import { Router } from 'express';
import creadorReconciliationController from './creador-reconciliation.controller';

const router = Router();

/**
 * POST /api/admin/creditos/reconcile-creador
 * Reconcilia todos los creadores de créditos, mapeando nombres a IDs de user_admin
 */
router.post('/reconcile-creador', (req, res) =>
  creadorReconciliationController.reconcileCreadores(req, res)
);

export default router;
