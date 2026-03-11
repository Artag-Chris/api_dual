/**
 * Service del Patrón de Amortización (4 Fases)
 * 
 * Ejecuta las 4 fases encadenadas en memoria a partir de un creditoId.
 * LÓGICA PURA reutilizable desde cualquier parte del código (controladores, otros servicios, colas, etc.)
 * 
 * Fases:
 *   1. Factory → Crea amortización base (lee LEGACY)
 *   2. Pagos  → Aplica pagos sobre la amortización base
 *   3. Sanciones → Aplica sanciones y gastos cartera
 *   4. Reconciliación → Compara contra creditos.saldo y redistribuye si diferencia > 100k
 * 
 * NO depende de Express (Request/Response). Solo recibe creditoId y retorna datos.
 */

import AmortizacionFactoryService from './amortizacionFactory/service';
import PagosStrategyService from './pagosStrategy/service';
import SancionesService from './Sanciones/service';
import ReconciliacionSaldoService from './ReconciliacionSaldo/service';
import WinstonAdapter from '../config/adapters/winstonAdapter';
import {
  ResultadoFactory,
  ResultadoPagos,
  ResultadoSanciones,
  ResultadoReconciliacion,
  RefinanciamientoItem,
  InfoCreditoData,
  InfoPagosProcessados,
  GastosCartera,
  TipoAmortizacion,
} from './interfaces';

// ═══════════════════════════════════════════════════════════════
// INTERFACE DE RESULTADO COMPLETO
// ═══════════════════════════════════════════════════════════════

export interface ResultadoCompleto {
  success: boolean;
  message: string;
  creditoId: number;
  /** Si hubo error, indica en qué fase falló (1, 2, 3 o 4) */
  faseError?: number;
  errores?: string[];
  fase1?: {
    tipo: TipoAmortizacion;
    cuotasGeneradas: number;
    diasPago?: number[];
  };
  fase2?: {
    infoPagos?: InfoPagosProcessados;
  };
  fase3?: {
    gastosCartera?: GastosCartera;
    estadisticas?: ResultadoSanciones['estadisticas'];
  };
  fase4?: {
    redistribucionAplicada: boolean;
    saldoLegacy: number;
    diferencia: number;
    saldoNetoCuotas?: number;
    cuotasCompletasRedistribuidas?: number;
    excedenteParcial?: number;
  };
  infoCredito?: InfoCreditoData;
  amortizacionOriginal?: RefinanciamientoItem[];
  amortizacionConPagos?: RefinanciamientoItem[];
  amortizacionFinal?: RefinanciamientoItem[];
  cuotasPendientes?: number;
}

// ═══════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════

class AmortizacionPatternService {
  private static instance: AmortizacionPatternService;
  private factoryService = AmortizacionFactoryService.getInstance();
  private pagosService = PagosStrategyService.getInstance();
  private sancionesService = SancionesService.getInstance();
  private reconciliacionService = ReconciliacionSaldoService.getInstance();
  private logger = WinstonAdapter;

  private constructor() {}

  public static getInstance(): AmortizacionPatternService {
    if (!AmortizacionPatternService.instance) {
      AmortizacionPatternService.instance = new AmortizacionPatternService();
    }
    return AmortizacionPatternService.instance;
  }

  // ═══════════════════════════════════════════════════════════════
  // MÉTODO PRINCIPAL: Ejecutar las 3 fases encadenadas
  // ═══════════════════════════════════════════════════════════════

  /**
   * Ejecuta las 4 fases encadenadas en memoria usando solo el creditoId.
   * NO requiere persistencia intermedia en MAIN — pasa datos en memoria entre fases.
   * 
   * Flujo:
   *   1. Fase 1: Factory → amortización base (desde LEGACY)
   *   2. Fase 2: PagosStrategy → aplica pagos sobre amortización base
   *   3. Fase 3: SancionesStrategy → aplica sanciones sobre amortización con pagos
   *   4. Fase 4: Reconciliación → compara contra creditos.saldo, redistribuye si diferencia > 100k
   *   5. Retorna ResultadoCompleto con toda la información
   * 
   * @param creditoId ID del crédito en legacy
   * @returns ResultadoCompleto con datos de las 3 fases
   * 
   * @example
   * // Desde cualquier servicio o clase:
   * const service = AmortizacionPatternService.getInstance();
   * const resultado = await service.ejecutarCompleto(12360);
   * if (resultado.success) {
   *   console.log(resultado.amortizacionFinal);
   *   console.log(resultado.fase3?.estadisticas);
   * }
   */
  async ejecutarCompleto(creditoId: number): Promise<ResultadoCompleto> {
    try {
      this.logger.info(`[PATTERN-SVC] ejecutarCompleto - creditoId: ${creditoId} ═══ INICIANDO 4 FASES ═══`);

      // ─── FASE 1: Factory ────────────────────────────────
      const resultadoFase1 = await this.factoryService.ejecutarFase1(creditoId);

      if (!resultadoFase1.exitoso || !resultadoFase1.amortizacionBase || !resultadoFase1.infoCredito) {
        return {
          success: false,
          message: `Fase 1 falló: ${resultadoFase1.mensaje}`,
          creditoId,
          faseError: 1,
          errores: resultadoFase1.errores,
        };
      }

      this.logger.info(
        `[PATTERN-SVC] Fase 1 OK: tipo=${resultadoFase1.tipo}, cuotas=${resultadoFase1.amortizacionBase.length}`
      );

      // ─── FASE 2: Pagos (usa amortización de Fase 1 en memoria) ──
      const resultadoFase2 = this.pagosService.ejecutarFase2ConDatos(
        resultadoFase1.amortizacionBase,
        await this.pagosService.obtenerPagos(creditoId),
        resultadoFase1.infoCredito,
        await this.pagosService.obtenerSancionesExoneradas(creditoId),
        await this.pagosService.obtenerSancionesPagadas(creditoId)
      );

      if (!resultadoFase2.exitoso || !resultadoFase2.amortizacionConPagos) {
        return {
          success: false,
          message: `Fase 2 falló: ${resultadoFase2.mensaje}`,
          creditoId,
          faseError: 2,
          errores: resultadoFase2.errores,
          fase1: {
            tipo: resultadoFase1.tipo,
            cuotasGeneradas: resultadoFase1.amortizacionBase.length,
          },
        };
      }

      this.logger.info(
        `[PATTERN-SVC] Fase 2 OK: cuotaMaxPagada=${resultadoFase2.infoPagos?.cuotaMaximaPagada}, parcial=${resultadoFase2.infoPagos?.tieneCuotaParciall}`
      );

      // ─── FASE 3: Sanciones (usa amortización de Fase 2 en memoria) ──
      const resultadoFase3 = this.sancionesService.ejecutarFase3ConDatos(
        resultadoFase2.amortizacionConPagos,
        resultadoFase1.infoCredito,
        await this.sancionesService.obtenerSancionesPendientes(creditoId),
        await this.sancionesService.obtenerSancionesExoneradas(creditoId),
        await this.sancionesService.obtenerGastosCartera(creditoId),
        resultadoFase2.infoPagos?.cuotaMaximaPagada || 0,
        resultadoFase2.infoPagos
      );

      if (!resultadoFase3.exitoso) {
        return {
          success: false,
          message: `Fase 3 falló: ${resultadoFase3.mensaje}`,
          creditoId,
          faseError: 3,
          errores: resultadoFase3.errores,
          fase1: { tipo: resultadoFase1.tipo, cuotasGeneradas: resultadoFase1.amortizacionBase.length },
          fase2: { infoPagos: resultadoFase2.infoPagos },
        };
      }

      this.logger.info(
        `[PATTERN-SVC] Fase 3 OK: sanciones=${resultadoFase3.estadisticas?.totalSanciones}, gastos=${resultadoFase3.estadisticas?.totalGastosCartera}`
      );

      // ─── FASE 4: Reconciliación contra saldo legacy ─────────
      const periocidadNormalizada = (
        String(resultadoFase1.infoCredito.periodicidad).toLowerCase() === 'mensual' ? 'mensual' : 'quincenal'
      ) as 'mensual' | 'quincenal';

      const resultadoFase4 = await this.reconciliacionService.ejecutarFase4(
        resultadoFase3.amortizacionFinal!,
        resultadoFase1.amortizacionBase,
        creditoId,
        resultadoFase3.gastosCartera,
        periocidadNormalizada
      );

      if (!resultadoFase4.exitoso) {
        return {
          success: false,
          message: `Fase 4 falló: ${resultadoFase4.mensaje}`,
          creditoId,
          faseError: 4,
          errores: resultadoFase4.errores,
          fase1: { tipo: resultadoFase1.tipo, cuotasGeneradas: resultadoFase1.amortizacionBase.length },
          fase2: { infoPagos: resultadoFase2.infoPagos },
          fase3: { gastosCartera: resultadoFase3.gastosCartera, estadisticas: resultadoFase3.estadisticas },
        };
      }

      this.logger.info(
        `[PATTERN-SVC] Fase 4 OK: redistribucion=${resultadoFase4.redistribucionAplicada}, diferencia=${resultadoFase4.diferencia}`
      );

      // La amortización final es la reconciliada (Fase 4) si hubo redistribución,
      // o la de Fase 3 si no se requirió redistribución
      const amortizacionDefinitiva = resultadoFase4.amortizacionReconciliada || resultadoFase3.amortizacionFinal;

      // ─── RESULTADO COMPLETO ──────────────────────────────
      const cuotasPendientes = amortizacionDefinitiva?.filter(c => c.capital > 0) || [];

      this.logger.info(
        `[PATTERN-SVC] ═══ COMPLETO OK para crédito ${creditoId}: ${cuotasPendientes.length} cuotas pendientes ═══`
      );

      return {
        success: true,
        message: `Amortización calculada exitosamente. Tipo: ${resultadoFase1.tipo}. Cuotas pendientes: ${cuotasPendientes.length}${resultadoFase4.redistribucionAplicada ? ' (redistribuida por saldo legacy)' : ''}`,
        creditoId,
        fase1: {
          tipo: resultadoFase1.tipo,
          cuotasGeneradas: resultadoFase1.amortizacionBase.length,
          diasPago: resultadoFase1.diasPago,
        },
        fase2: {
          infoPagos: resultadoFase2.infoPagos,
        },
        fase3: {
          gastosCartera: resultadoFase3.gastosCartera,
          estadisticas: resultadoFase3.estadisticas,
        },
        fase4: {
          redistribucionAplicada: resultadoFase4.redistribucionAplicada,
          saldoLegacy: resultadoFase4.saldoLegacy,
          diferencia: resultadoFase4.diferencia,
          saldoNetoCuotas: resultadoFase4.saldoNetoCuotas,
          cuotasCompletasRedistribuidas: resultadoFase4.cuotasCompletasRedistribuidas,
          excedenteParcial: resultadoFase4.excedenteParcial,
        },
        infoCredito: resultadoFase1.infoCredito,
        amortizacionOriginal: resultadoFase1.amortizacionBase,
        amortizacionConPagos: resultadoFase2.amortizacionConPagos,
        amortizacionFinal: amortizacionDefinitiva,
        cuotasPendientes: cuotasPendientes.length,
      };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`[PATTERN-SVC] Error en ejecutarCompleto: ${mensaje}`);
      return {
        success: false,
        message: 'Error al ejecutar las 4 fases',
        creditoId,
        errores: [mensaje],
      };
    }
  }
}

export default AmortizacionPatternService;
