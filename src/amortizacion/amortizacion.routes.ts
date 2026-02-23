/**
 * Rutas de Amortización
 * Define los endpoints disponibles para operaciones de amortización
 */

import { Router, Request, Response } from 'express';
import AmortizacionController from './amortizacion.controller';

const router = Router();
const controller = new AmortizacionController();

// ═══════════════════════════════════════════════════════════════════════════
// RUTAS DE AMORTIZACIÓN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/amortizacion/test
 * 
 * Ruta de prueba que calcula una amortización con parámetros predeterminados
 * 
 * Respuesta:
 * {
 *   "success": true,
 *   "message": "Prueba de amortización ejecutada exitosamente",
 *   "data": [array de cuotas],
 *   "estadisticas": {
 *     "totalCuotas": 12,
 *     "cuotaPromedio": 95000,
 *     ...
 *   }
 * }
 * 
 * Ejemplo:
 * curl -X GET "http://localhost:3000/api/amortizacion/test"
 */
router.get('/test', (req: Request, res: Response) =>
  controller.test(req, res)
);

/**
 * POST /api/amortizacion/calcular
 * 
 * Calcula la amortización completa con parámetros personalizados
 * 
 * Body JSON requerido:
 * {
 *   "prestamo": 1000000,          // Monto del préstamo (requerido)
 *   "plazo": 12,                  // Plazo en meses/quincenas (requerido)
 *   "periocidad": "mensual",      // "mensual" o "quincenal" (requerido)
 *   "documento": "1234567890",    // Documento del cliente (requerido)
 *   "prestamoId": 1,              // ID del préstamo (requerido)
 *   "pablok": 5000,               // Valor del pablok (requerido)
 *   "seguro": 2.5,                // Porcentaje de aval (requerido)
 *   "iva_aval": 19,               // Porcentaje IVA sobre aval (opcional, default: 19)
 *   "seguro_add": 10000,          // Seguro adicional (opcional)
 *   "tasa": 24,                   // Tasa de interés mensual (opcional)
 *   "diasPago": [15],             // Días de pago en el mes (opcional, default: [1])
 *   "fechaDesembolso": "2024-01-15" // Fecha de desembolso (opcional, default: hoy)
 * }
 * 
 * Respuesta exitosa (200):
 * {
 *   "success": true,
 *   "message": "Amortización calculada exitosamente",
 *   "data": [array de cuotas],
 *   "estadisticas": { ... }
 * }
 * 
 * Respuesta con error (400/500):
 * {
 *   "success": false,
 *   "message": "Descripción del error",
 *   "error" o "errores": detalles adicionales
 * }
 * 
 * Ejemplo:
 * curl -X POST "http://localhost:3000/api/amortizacion/calcular" \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "prestamo": 1000000,
 *     "plazo": 12,
 *     "periocidad": "mensual",
 *     "documento": "1234567890",
 *     "prestamoId": 1,
 *     "pablok": 5000,
 *     "seguro": 2.5,
 *     "tasa": 24
 *   }'
 */
router.post('/calcular', (req: Request, res: Response) =>
  controller.calcularAmortizacion(req, res)
);

/**
 * POST /api/amortizacion/refinanciamiento/calcular
 * 
 * Calcula refinanciamiento con sistema equitativo (capital distribuido equitativamente)
 * 
 * Body JSON requerido:
 * {
 *   "capitalEnMora": 500000,          // Capital a refinanciar
 *   "cantidadMeses": 6,               // Meses para pagar
 *   "periocidad": "mensual",          // "mensual" o "quincenal"
 *   "valorCuotaAcordada": 95000,     // Cuota fija a pagar
 *   "documento": "1234567890",        // Documento cliente
 *   "prestamoId": 1,                  // ID del préstamo
 *   "iva_aval": 19,                   // % IVA sobre aval (opcional, default 19)
 *   "fechaPrimerPago": "2024-03-15"   // Fecha primer pago (opcional)
 * }
 * 
 * Distribución del restante (valorCuota - capital/cuota):
 * - 30% → Interés
 * - 50% → Aval
 * - 20% → IVA Aval
 */
router.post('/refinanciamiento/calcular', (req: Request, res: Response) =>
  controller.calcularRefinanciamiento(req, res)
);

export default router;
