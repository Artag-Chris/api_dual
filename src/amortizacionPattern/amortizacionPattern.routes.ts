/**
 * Rutas del Patrón de Amortización (3 Fases)
 * 
 * Endpoints disponibles:
 * 
 *   POST /api/amortizacion-pattern/completo
 *     → Ejecuta las 3 fases encadenadas con un solo creditoId
 *     → Body: { "creditoId": 26122 }
 * 
 *   POST /api/amortizacion-pattern/fase1/factory
 *     → Solo Fase 1: crea amortización base desde LEGACY
 *     → Body: { "creditoId": 26122 }
 * 
 *   POST /api/amortizacion-pattern/fase2/pagos
 *     → Solo Fase 2: lee amortización de MAIN + aplica pagos
 *     → Body: { "creditoId": 26122, "prestamoId": 12345 }
 * 
 *   POST /api/amortizacion-pattern/fase3/sanciones
 *     → Solo Fase 3: lee amortización de MAIN + aplica sanciones
 *     → Body: { "creditoId": 26122, "prestamoId": 12345, "cuotaMaximaPagada": 5 }
 */

import { Router, Request, Response } from 'express';
import AmortizacionPatternController from './amortizacionPattern.controller';

const router = Router();
const controller = new AmortizacionPatternController();

// ═══════════════════════════════════════════════════════════════
// RUTA PRINCIPAL: Las 3 fases con un solo creditoId
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/amortizacion-pattern/completo
 * 
 * Ejecuta Factory + Pagos + Sanciones encadenados en memoria.
 * Solo necesita creditoId.
 * 
 * Body: { "creditoId": 26122 }
 * 
 * Ejemplos:
 *   creditoId: 26122 → sin sanciones o sanciones pagadas
 *   creditoId: 8770  → muchas sanciones y pagos sin num_cuota
 *   creditoId: 25391 → sanciones pagadas y sin pagar (115+)
 */
router.post('/completo', (req: Request, res: Response) =>
  controller.ejecutarCompleto(req, res)
);

// ═══════════════════════════════════════════════════════════════
// RUTAS INDIVIDUALES POR FASE
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/amortizacion-pattern/fase1/factory
 * 
 * Fase 1: Crea amortización base desde datos LEGACY
 * Body: { "creditoId": 26122 }
 */
router.post('/fase1/factory', (req: Request, res: Response) =>
  controller.ejecutarFase1(req, res)
);

/**
 * POST /api/amortizacion-pattern/fase2/pagos
 * 
 * Fase 2: Lee amortización de MAIN + aplica pagos de LEGACY
 * Requiere que Fase 1 ya esté persistida en MAIN
 * Body: { "creditoId": 26122, "prestamoId": 12345 }
 */
router.post('/fase2/pagos', (req: Request, res: Response) =>
  controller.ejecutarFase2(req, res)
);

/**
 * POST /api/amortizacion-pattern/fase3/sanciones
 * 
 * Fase 3: Lee amortización de MAIN + aplica sanciones de LEGACY
 * Requiere que Fases 1 y 2 ya estén persistidas en MAIN
 * Body: { "creditoId": 26122, "prestamoId": 12345, "cuotaMaximaPagada": 5 }
 */
router.post('/fase3/sanciones', (req: Request, res: Response) =>
  controller.ejecutarFase3(req, res)
);

export default router;
