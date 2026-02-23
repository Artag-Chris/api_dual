import { Router, Request, Response } from 'express';
import MigrationController from './migration.controller';

const router = Router();
const controller = new MigrationController();

// ═══════════════════════════════════════════════════════════════════════════
// ENDPOINTS PARA SISTEMA DE COLAS FIFO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/migration/start
 * Inicia migración de clientes por batches automáticos
 * 
 * Query params:
 * - batchSize: 500 (default, rango: 10-5000)
 * 
 * Ejemplo:
 * curl -X POST "http://localhost:3000/api/migration/start?batchSize=500"
 */
router.post('/start', (req: Request, res: Response) =>
  controller.startMigration(req, res)
);

/**
 * POST /api/migration/start-with-consumers
 * Inicia migración + todos los consumidores en un solo call
 * Opción "all-in-one" para empezar todo de una vez
 */
router.post('/start-with-consumers', (req: Request, res: Response) =>
  controller.startMigrationWithConsumers(req, res)
);

/**
 * GET /api/migration/metrics
 * Ver estado actual de la migración EN TIEMPO REAL
 * 
 * Se puede llamar múltiples veces sin interrumpir nada
 * Ejemplo:
 * curl -X GET "http://localhost:3000/api/migration/metrics"
 */
router.get('/metrics', (req: Request, res: Response) =>
  controller.getQueueMetrics(req, res)
);

/**
 * POST /api/migration/start-consumers
 * Inicia específicamente los consumidores
 * (útil si iniciaste solo el productor antes)
 */
router.post('/start-consumers', (req: Request, res: Response) =>
  controller.startConsumers(req, res)
);

/**
 * POST /api/migration/pause
 * Pausa los consumidores (el productor sigue si está en progreso)
 */
router.post('/pause', (req: Request, res: Response) =>
  controller.pauseConsumers(req, res)
);

/**
 * POST /api/migration/resume
 * Reanuda los consumidores desde donde se pausaron
 */
router.post('/resume', (req: Request, res: Response) =>
  controller.resumeConsumers(req, res)
);

/**
 * POST /api/migration/stop
 * Detiene todo completamente (productor + consumidores)
 */
router.post('/stop', (req: Request, res: Response) =>
  controller.stopMigration(req, res)
);

/**
 * POST /api/migration/reset-stalled
 * Resetea items que se quedaron en PROCESANDO demasiado tiempo
 * 
 * Query params:
 * - minutes: 5 (default) - Items en PROCESANDO más de este tiempo se resetean
 */
router.post('/reset-stalled', (req: Request, res: Response) =>
  controller.resetStalledItems(req, res)
);

/**
 * POST /api/migration/clear-queue
 * ⚠️ PELIGROSO: Limpia la cola completamente
 * Requiere ?confirm=true
 */
router.post('/clear-queue', (req: Request, res: Response) =>
  controller.clearQueue(req, res)
);

// ═══════════════════════════════════════════════════════════════════════════
// ENDPOINTS LEGACY (compatibilidad)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/statistics', (req: Request, res: Response) =>
  controller.getMigrationStatistics(req, res)
);

router.get('/validate', (req: Request, res: Response) =>
  controller.validateConsistency(req, res)
);

export default router;
