/**
 * Controlador de Amortización
 * Maneja las peticiones HTTP relacionadas con el cálculo de amortizaciones
 */

import { Request, Response } from 'express';
import AmortizacionService from './amortizacion.service';
import { AmortizacionParams } from './amortizacion.class';
import RefinanciamientoService from './amortizacion-refinanciamiento.service';
import { RefinanciamientoParams } from './amortizacion-refinanciamiento.class';
import WinstonAdapter from '../config/adapters/winstonAdapter';

class AmortizacionController {
  private amortizacionService = AmortizacionService.getInstance();
  private refinanciamientoService = RefinanciamientoService.getInstance();
  private logger = WinstonAdapter;

  /**
   * POST /api/amortizacion/calcular
   * 
   * Calcula la amortización completa basada en los parámetros proporcionados
   * 
   * Body JSON:
   * {
   *   "prestamo": 1000000,
   *   "plazo": 12,
   *   "periocidad": "mensual",
   *   "documento": "1234567890",
   *   "prestamoId": 1,
   *   "pablok": 5000,
   *   "seguro": 2.5,
   *   "iva_aval": 19,
   *   "seguro_add": 10000,
   *   "tasa": 24,
   *   "diasPago": [15],
   *   "fechaDesembolso": "2024-01-15"
   * }
   * 
   * Respuesta exitosa (200):
   * {
   *   "success": true,
   *   "message": "Amortización calculada exitosamente",
   *   "data": [
   *     {
   *       "prestamoId": 1,
   *       "documento": "1234567890",
   *       "numeroCuota": 1,
   *       "valorPrestamo": 1000000,
   *       "cuotaTotal": 95000,
   *       "interes": 20000,
   *       "aval": 2000,
   *       "iva": 380,
   *       "capital": 70000,
   *       "saldo": 930000,
   *       "pablok": 5000,
   *       "seguro": 10000,
   *       "fechaPago": "2024-02-15"
   *     },
   *     ...
   *   ],
   *   "estadisticas": {
   *     "totalCuotas": 12,
   *     "cuotaPromedio": 95000,
   *     "totalIntereses": 150000,
   *     "totalAval": 25000,
   *     "totalIVA": 4750,
   *     "totalCapital": 1000000,
   *     "saldoFinal": 0
   *   }
   * }
   */
  async calcularAmortizacion(req: Request, res: Response): Promise<void> {
    try {
      const params: AmortizacionParams = {
        prestamo: req.body.prestamo,
        plazo: req.body.plazo,
        periocidad: req.body.periocidad,
        documento: req.body.documento,
        prestamoId: req.body.prestamoId,
        pablok: req.body.pablok,
        seguro: req.body.seguro,
        iva_aval: req.body.iva_aval,
        seguro_add: req.body.seguro_add,
        tasa: req.body.tasa,
        diasPago: req.body.diasPago,
        fechaDesembolso: req.body.fechaDesembolso ? new Date(req.body.fechaDesembolso) : undefined,
      };

      // Validar parámetros
      const erroresValidacion = this.amortizacionService.validarParametros(params);
      if (erroresValidacion.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Parámetros inválidos',
          errores: erroresValidacion,
        });
        return;
      }

      // Calcular amortización
      const amortizaciones = await this.amortizacionService.calcularAmortizacion(params);

      // Obtener estadísticas
      const estadisticas = this.amortizacionService.getEstadisticas(amortizaciones);

      // Respuesta exitosa
      res.status(200).json({
        success: true,
        message: 'Amortización calculada exitosamente',
        data: amortizaciones,
        estadisticas,
      });

      this.logger.info(
        `[AMORTIZACION-CTRL] POST /calcular - Cliente: ${params.documento}, Cuotas: ${amortizaciones.length}`
      );
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      
      res.status(500).json({
        success: false,
        message: 'Error al calcular amortización',
        error: mensaje,
      });

      this.logger.error(
        `[AMORTIZACION-CTRL] Error en POST /calcular: ${mensaje}`
      );
    }
  }

  /**
   * GET /api/amortizacion/test
   * 
   * Endpoint de prueba que calcula una amortización con valores predeterminados
   * Útil para verificar que el servicio está funcionando correctamente
   */
  async test(req: Request, res: Response): Promise<void> {
    try {
      // Parámetros de prueba
      const params: AmortizacionParams = {
        prestamo: 1000000,
        plazo: 12,
        periocidad: 'mensual',
        documento: '1234567890',
        prestamoId: 999,
        pablok: 5000,
        seguro: 2.5,
        iva_aval: 19,
        seguro_add: 10000,
        tasa: 24,
        diasPago: [15],
        fechaDesembolso: new Date(),
      };

      // Calcular amortización
      const amortizaciones = await this.amortizacionService.calcularAmortizacion(params);

      // Obtener estadísticas
      const estadisticas = this.amortizacionService.getEstadisticas(amortizaciones);

      // Respuesta exitosa
      res.status(200).json({
        success: true,
        message: 'Prueba de amortización ejecutada exitosamente',
        parametros: params,
        data: amortizaciones,
        estadisticas,
      });

      this.logger.info(
        `[AMORTIZACION-CTRL] GET /test - Prueba ejecutada exitosamente`
      );
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      
      res.status(500).json({
        success: false,
        message: 'Error en la prueba de amortización',
        error: mensaje,
      });

      this.logger.error(
        `[AMORTIZACION-CTRL] Error en GET /test: ${mensaje}`
      );
    }
  }

  /**
   * POST /api/amortizacion/refinanciamiento/calcular-con-pagos
   * 
   * ═══════════════════════════════════════════════════════════════════════════
   * FLUJO COMPLETO DE REFINANCIAMIENTO CON VALIDACIÓN DE PAGOS
   * ═══════════════════════════════════════════════════════════════════════════
   * 
   * 1️⃣  OBTIENE INFORMACIÓN DEL CRÉDITO
   *     - Documento, valor préstamo, valor cuota, periocidad, cantidad meses
   *     - Fecha de creación, cuotas faltantes
   *
   * 2️⃣  CALCULA AMORTIZACIÓN DE REFINANCIAMIENTO
   *     - Capital distribuido equitativamente
   *     - Aval e IVA fijos por cuota (30% interés, 50% aval, 20% IVA)
   *
   * 3️⃣  OBTIENE PAGOS REGISTRADOS DEL CRÉDITO
   *     - Busca pagos en la tabla 'pagos' filtrando por credito_id
   *     - Obtiene estado de pago, monto abonado, monto debido, num_cuota
   *
   * 4️⃣  VALIDA Y PROCESA PAGOS
   *     - Identifica cuota máxima pagada (estado = 'Ok')
   *     - ELIMINA esas cuotas de la amortización actualizada
   *     - Si existe cuota parcial (estado = 'Debe' + abono > 0):
   *       → Calcula proporción de pago vs cuota total
   *       → Ajusta capital, interés, aval e IVA proporcionalmente
   *       → El resultado es lo que aún debe pagar
   *
   * 5️⃣  RETORNA AMORTIZACIÓN ACTUALIZADA
   *     - Solo las cuotas que faltan por pagar
   *     - Cuota parcial ajustada al monto que aún debe
   *
   * Body JSON:
   * {
   *   "creditoId": 26122
   * }
   * 
   * Respuesta exitosa (200):
   * {
   *   "exitoso": true,
   *   "mensaje": "Refinanciamiento calculado exitosamente. Cuotas pendientes: 5",
   *   "infoCredito": { documento, valor_prestamo, periodicidad, ... },
   *   "infoPagos": { cuotaMaximaPagada, tieneCuotaParcial, montoDebe, ... },
   *   "amortizacionOriginal": [ 18 cuotas calculadas ],
   *   "amortizacionActualizada": [ 5 cuotas pendientes ],
   *   "estadisticas": { totalCuotas, cuotaTotal, totalCapital, ... }
   * }
   */
  async calcularRefinanciamientoConPagos(req: Request, res: Response): Promise<void> {
    try {
      const { creditoId } = req.body;

      // Validar parametro
      if (!creditoId || creditoId <= 0) {
        res.status(400).json({
          success: false,
          message: 'Parametros invalidos',
          errores: ['creditoId es requerido y debe ser un numero positivo'],
        });
        return;
      }

      // Llamar al servicio - usa prismaMainService internamente
      const resultado = await this.refinanciamientoService.calcularRefinanciamientoConPagos(creditoId);

      // Retornar resultado
      if (resultado.exitoso) {
        res.status(200).json({
          success: true,
          ...resultado,
        });

        this.logger.info(
          `[REFINANCIAMIENTO-CTRL] OK POST /calcular-con-pagos - Credito: ${creditoId}, Cuotas pendientes: ${resultado.amortizacionActualizada?.length || 0}`
        );
      } else {
        res.status(400).json({
          success: false,
          ...resultado,
        });

        this.logger.warn(
          `[REFINANCIAMIENTO-CTRL] WARN POST /calcular-con-pagos - Credito: ${creditoId} - ${resultado.mensaje}`
        );
      }
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      
      res.status(500).json({
        success: false,
        message: 'Error al calcular refinanciamiento con pagos',
        error: mensaje,
      });

      this.logger.error(
        `[REFINANCIAMIENTO-CTRL] ERROR en /calcular-con-pagos: ${mensaje}`
      );
    }
  }

  /**
   * POST /api/amortizacion/refinanciamiento/calcular
   * 
   * Calcula refinanciamiento (sistema equitativo)
   * 
   * Body JSON:
   * {
   *   "capitalEnMora": 500000,
   *   "cantidadMeses": 6,
   *   "periocidad": "mensual",
   *   "valorCuotaAcordada": 100000,
   *   "documento": "1234567890",
   *   "prestamoId": 1,
   *   "fechaPrimerPago": "2024-03-15"
   * }
   */
  async calcularRefinanciamiento(req: Request, res: Response): Promise<void> {
    try {
      const params: RefinanciamientoParams = {
        capitalEnMora: req.body.capitalEnMora,
        cantidadMeses: req.body.cantidadMeses,
        periocidad: req.body.periocidad,
        valorCuotaAcordada: req.body.valorCuotaAcordada,
        documento: req.body.documento,
        prestamoId: req.body.prestamoId,
        iva_aval: req.body.iva_aval || 19,
        fechaPrimerPago: req.body.fechaPrimerPago ? new Date(req.body.fechaPrimerPago) : undefined,
      };

      // Validar parámetros
      const erroresValidacion = this.refinanciamientoService.validarParametros(params);
      if (erroresValidacion.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Parámetros inválidos',
          errores: erroresValidacion,
        });
        return;
      }

      // Calcular refinanciamiento
      const resultado = await this.refinanciamientoService.calcularRefinanciamiento(params);

      // Obtener estadísticas
      const estadisticas = this.refinanciamientoService.getEstadisticas(resultado);

      res.status(200).json({
        success: true,
        message: 'Refinanciamiento calculado exitosamente',
        data: resultado,
        estadisticas,
      });

      this.logger.info(
        `[REFINANCIAMIENTO-CTRL] POST /calcular - Cliente: ${params.documento}, Cuotas: ${resultado.length}`
      );
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      
      res.status(500).json({
        success: false,
        message: 'Error al calcular refinanciamiento',
        error: mensaje,
      });

      this.logger.error(
        `[REFINANCIAMIENTO-CTRL] Error: ${mensaje}`
      );
    }
  }
}

export default AmortizacionController;
