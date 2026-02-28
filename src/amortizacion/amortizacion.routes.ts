/**
 * Rutas de Amortización
 * Define los endpoints disponibles para operaciones de amortización
 */

import { Router, Request, Response } from 'express';
import AmortizacionController from './amortizacion.controller';
import { ReporteCarteraCiudadController } from '../amortizacion/reporte/reporte-cartera-ciudad.controller';


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
 * POST /api/amortizacion/refinanciamiento/calcular-con-pagos
 * 
 * Calcula refinanciamiento mediante consulta automática a BD
 * Obtiene directamente la información del crédito y procesa pagos realizados Y sanciones pendientes
 * 
 * Body JSON requerido:
 * {
 *   "creditoId": 26122 -ejemplo 1 (sin sanciones o sanciones pagadas)
 *    "creditoId" : 8770 - ejemplo 2 (caso de muchas sanciones y pagos sin num cuota)
 *   "creditoId" : 25391 - ejemplo 3 (caso con sanciones pagadas y sin pagar - 115+ sanciones pendientes)
 * }
 * 
 * Respuesta: amortización actualizada sin las cuotas pagadas, con sanciones distribuidas por fecha/cuota
 */
router.post('/refinanciamiento/calcular-con-pagos', (req: Request, res: Response) =>
  controller.calcularRefinanciamientoConPagos(req, res)
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



/*
* RUTA PARA EL REPORTE DE CARTERA POR CIUDAD
*/

/**
 * GET /api/amortizacion/reporte
 * Obtiene el reporte completo de créditos por cartera y ciudad
 * 
 * Clasificación de carteras según franja_dias:
 * - franja_dias='150' → Se agrupan como CASTIGADA
 * - Otras franjas → Se muestran por su nombre específico (AL DIA, IDEAL, ALERTA, CRITICO, PREJURIDICO)
 * - Créditos sin cartera → SE EXCLUYEN del reporte, solo se cuentan en estadísticas
 * 
 * Estados de créditos incluidos: ACTIVO, JURIDICO, PREJURIDICO, REFINANCIADO
 * 
 * Respuesta:
 * {
 *   "success": true,
 *   "message": "Reporte de cartera obtenido correctamente",
 *   "data": {
 *     "titulo": "Reporte de Créditos por Cartera y Ciudad",
 *     "fecha_generacion": "2024-02-28T10:30:00.000Z",
 *     "datos": [
 *       {
 *         "ciudad": "Bogotá",
 *         "carteras": {
 *           "AL DIA": {
 *             "cantidad": 150,
 *             "total": 500000000,
 *             "porcentaje": 25.50
 *           },
 *           "CASTIGADA": {
 *             "cantidad": 10,
 *             "total": 50000000,
 *             "porcentaje": 2.55
 *           }
 *         },
 *         "totalCiudad": {
 *           "cantidad": 160,
 *           "total": 1960784314
 *         }
 *       }
 *     ],
 *     "grandTotal": {
 *       "cantidad": 500,
 *       "total": 5000000000
 *     },
 *     "carterasUniques": ["AL DIA", "IDEAL", "ALERTA", "CRITICO", "PREJURIDICO", "CASTIGADA"],
 *     "estadisticas": {
 *       "totalCiudades": 5,
 *       "totalCarteras": 6,
 *       "totalCreditos": 500,
 *       "totalValor": 5000000000,
 *       "creditosSinCartera": 3,
 *       "observacion": "Se han excluido 3 crédito(s) sin cartera asignada del reporte..."
 *     }
 *   }
 * }
 */
router.get('/reporte', ReporteCarteraCiudadController.obtenerReporte);

export default router;
