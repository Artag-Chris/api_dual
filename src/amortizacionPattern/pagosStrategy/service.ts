/**
 * FASE 2 - Service: LEE amortización de MAIN, obtiene pagos de LEGACY y aplica
 * 
 * Responsabilidad:
 * - LEER la amortización ya creada en Fase 1 desde la tabla `amortizacion` de MAIN DB
 * - Consultar pagos desde LEGACY
 * - Consultar sanciones exoneradas y pagadas desde LEGACY
 * - Invocar PagosStrategy.aplicar() con la amortización leída de MAIN
 * - SOLO LECTURA: No hace INSERT/UPDATE
 * 
 * FLUJO:
 *   1. Lee amortización de MAIN (prismaMainService.amortizacion)
 *   2. Mapea campos de MAIN → RefinanciamientoItem[]
 *   3. Consulta pagos/sanciones de LEGACY
 *   4. Delega a PagosStrategy (lógica pura)
 */

import { PagosStrategy } from './class';
import {
  RefinanciamientoItem,
  PagoRegistro,
  SancionRegistro,
  InfoCreditoData,
  ResultadoPagos,
} from '../interfaces';
import WinstonAdapter from '../../config/adapters/winstonAdapter';
import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import { prismaMainService } from '../../database/main/prisma-main.service';

class PagosStrategyService {
  private static instance: PagosStrategyService;
  private logger = WinstonAdapter;

  private constructor() {}

  public static getInstance(): PagosStrategyService {
    if (!PagosStrategyService.instance) {
      PagosStrategyService.instance = new PagosStrategyService();
    }
    return PagosStrategyService.instance;
  }

  // ═══════════════════════════════════════════════════════════════
  // LEER AMORTIZACIÓN DESDE MAIN DB (creada en Fase 1)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Lee la amortización base ya persistida en MAIN (tabla amortizacion).
   * Esta amortización fue creada por Fase 1 (Factory) y persistida por el QueueProcessor.
   * 
   * Mapeo de campos MAIN → RefinanciamientoItem:
   *   prestamoID    → prestamoId
   *   documento     → documento
   *   Numero_cuota  → numeroCuota (parse Int)
   *   capital       → capital
   *   interes       → interes
   *   aval          → aval
   *   IVA           → iva
   *   total_cuota   → cuotaTotal
   *   saldo         → saldo (parse Int)
   *   fecha_pago    → fechaPago
   *   sancion       → sancion
   * 
   * @param prestamoId ID del préstamo en MAIN (FK a detalle_credito.prestamo_ID)
   */
  async obtenerAmortizacionDesdeMain(prestamoId: number): Promise<RefinanciamientoItem[]> {
    try {
      this.logger.info(`[PAGOS-SVC] Leyendo amortización de MAIN para préstamo ${prestamoId}`);

      const registros = await prismaMainService.amortizacion.findMany({
        where: { prestamoID: prestamoId },
        orderBy: { Numero_cuota: 'asc' },
      });

      if (!registros || registros.length === 0) {
        this.logger.warn(`[PAGOS-SVC] No se encontró amortización en MAIN para préstamo ${prestamoId}`);
        return [];
      }

      // Mapear campos de MAIN → RefinanciamientoItem
      const amortizacion: RefinanciamientoItem[] = registros.map(reg => {
        const numeroCuota = parseInt(String(reg.Numero_cuota), 10) || 0;
        const capital = Number(reg.capital) || 0;
        const interes = Number(reg.interes) || 0;
        const aval = Number(reg.aval) || 0;
        const iva = Number(reg.IVA) || 0;
        const sancion = Number(reg.sancion) || 0;
        const totalCuota = Number(reg.total_cuota) || 0;
        const saldo = parseInt(String(reg.saldo), 10) || 0;

        return {
          prestamoId: reg.prestamoID,
          documento: reg.documento,
          numeroCuota,
          capitalEnMora: saldo, // El saldo de la primera cuota equivale al capital total
          capital,
          interes,
          aval,
          iva,
          cuotaTotal: totalCuota,
          saldo,
          fechaPago: reg.fecha_pago,
          sancion: sancion > 0 ? sancion : undefined,
        };
      });

      // Ajustar capitalEnMora: usar el saldo de la primera cuota (= capital total)
      if (amortizacion.length > 0) {
        const capitalEnMora = amortizacion[0].saldo;
        amortizacion.forEach(item => {
          item.capitalEnMora = capitalEnMora;
        });
      }

      this.logger.info(
        `[PAGOS-SVC] OK Amortización leída de MAIN: ${amortizacion.length} cuotas, préstamo=${prestamoId}`
      );

      return amortizacion;
    } catch (error) {
      this.logger.error(
        `[PAGOS-SVC] Error al leer amortización de MAIN: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CONSULTAS A LEGACY (pagos y sanciones)
  // ═══════════════════════════════════════════════════════════════

  // ─── Obtener pagos desde LEGACY ──────────────────────────────
  async obtenerPagos(creditoId: number): Promise<PagoRegistro[]> {
    try {
      this.logger.info(`[PAGOS-SVC] Obteniendo pagos del crédito ${creditoId}`);

      const pagos = (await prismaLegacyService.$queryRaw`
        SELECT 
          p.id,
          p.credito_id,
          p.concepto,
          p.abono,
          p.debe,
          p.estado,
          p.num_cuota,
          p.created_at,
          p.descripcion
        FROM pagos p
        INNER JOIN creditos c ON p.credito_id = c.id
        WHERE p.credito_id = ${creditoId}
        ORDER BY p.created_at ASC
      `) as PagoRegistro[];

      this.logger.info(`[PAGOS-SVC] OK Se encontraron ${pagos.length} pagos`);
      return pagos;
    } catch (error) {
      this.logger.error(
        `[PAGOS-SVC] Error al obtener pagos: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
      throw error;
    }
  }

  // ─── Obtener sanciones exoneradas desde LEGACY ──────────────
  async obtenerSancionesExoneradas(creditoId: number): Promise<SancionRegistro[]> {
    try {
      this.logger.info(`[PAGOS-SVC] Obteniendo sanciones exoneradas del crédito ${creditoId}`);

      const sanciones = (await prismaLegacyService.$queryRaw`
        SELECT 
          s.id,
          s.credito_id,
          s.valor,
          s.estado,
          s.pago_id,
          s.created_at
        FROM sanciones s
        WHERE s.credito_id = ${creditoId}
        AND s.estado = 'Exonerada'
        ORDER BY s.created_at ASC
      `) as SancionRegistro[];

      this.logger.info(`[PAGOS-SVC] OK Se encontraron ${sanciones.length} sanciones exoneradas`);
      return sanciones;
    } catch (error) {
      this.logger.error(
        `[PAGOS-SVC] Error al obtener sanciones exoneradas: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
      throw error;
    }
  }

  // ─── Obtener sanciones pagadas desde LEGACY ──────────────────
  async obtenerSancionesPagadas(creditoId: number): Promise<SancionRegistro[]> {
    try {
      this.logger.info(`[PAGOS-SVC] Obteniendo sanciones pagadas del crédito ${creditoId}`);

      const sanciones = (await prismaLegacyService.$queryRaw`
        SELECT 
          s.id,
          s.credito_id,
          s.valor,
          s.estado,
          s.pago_id,
          s.created_at
        FROM sanciones s
        WHERE s.credito_id = ${creditoId}
        AND s.estado = 'Ok'
        ORDER BY s.created_at ASC
      `) as SancionRegistro[];

      this.logger.info(`[PAGOS-SVC] OK Se encontraron ${sanciones.length} sanciones pagadas`);
      return sanciones;
    } catch (error) {
      this.logger.error(
        `[PAGOS-SVC] Error al obtener sanciones pagadas: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MÉTODO PRINCIPAL: Ejecutar Fase 2
  // ═══════════════════════════════════════════════════════════════

  /**
   * Ejecuta la Fase 2 completa:
   * 1. LEE la amortización base desde MAIN DB (creada en Fase 1)
   * 2. Obtiene pagos y sanciones desde LEGACY
   * 3. Delega al PagosStrategy para aplicar pagos sobre la amortización de MAIN
   * 4. Retorna ResultadoPagos (SOLO datos, SIN persistencia)
   * 
   * @param prestamoId ID del préstamo en MAIN (para leer amortización)
   * @param infoCredito Info del crédito (para cuotas_faltantes, valor_cuota, etc.)
   * @param creditoId ID del crédito en legacy (para consultar pagos)
   */
  async ejecutarFase2(
    prestamoId: number,
    infoCredito: InfoCreditoData,
    creditoId: number
  ): Promise<ResultadoPagos> {
    try {
      this.logger.info(`[PAGOS-SVC] ═══ FASE 2: Aplicando pagos para crédito ${creditoId} (préstamo MAIN: ${prestamoId}) ═══`);

      // 1. LEER amortización base desde MAIN DB (creada en Fase 1)
      const amortizacion = await this.obtenerAmortizacionDesdeMain(prestamoId);
      if (!amortizacion || amortizacion.length === 0) {
        return {
          exitoso: false,
          mensaje: `No se encontró amortización en MAIN para préstamo ${prestamoId}. ¿Se ejecutó la Fase 1?`,
          errores: ['Amortización no encontrada en MAIN DB'],
        };
      }

      this.logger.info(
        `[PAGOS-SVC] Amortización leída de MAIN: ${amortizacion.length} cuotas`
      );

      // 2. Obtener datos de LEGACY (pagos + sanciones)
      const [pagos, sancionesExoneradas, sancionesPagadas] = await Promise.all([
        this.obtenerPagos(creditoId),
        this.obtenerSancionesExoneradas(creditoId),
        this.obtenerSancionesPagadas(creditoId),
      ]);

      // 3. Preparar parámetros
      const periocidad = (String(infoCredito.periodicidad).toLowerCase() === 'mensual' ? 'mensual' : 'quincenal') as 'mensual' | 'quincenal';
      const diasPago: number[] = [];
      if (periocidad === 'quincenal') {
        if (infoCredito.fecha_pago1) diasPago.push(Number(infoCredito.fecha_pago1));
        if (infoCredito.fecha_pago2) diasPago.push(Number(infoCredito.fecha_pago2));
      } else {
        if (infoCredito.fecha_pago1) diasPago.push(Number(infoCredito.fecha_pago1));
      }

      // 4. Delegar al PagosStrategy (lógica pura sobre amortización de MAIN)
      const resultado = PagosStrategy.aplicar(
        amortizacion,
        pagos,
        Number(infoCredito.valor_cuota),
        Number(infoCredito.cuotas_faltantes),
        infoCredito.numero_cuotas ?? Number(infoCredito.cantidad_meses),
        sancionesExoneradas,
        sancionesPagadas,
        infoCredito.proxima_fecha_pago,
        diasPago,
        periocidad
      );

      if (resultado.exitoso) {
        this.logger.info(
          `[PAGOS-SVC] ✅ Fase 2 completada: cuotaMaxPagada=${resultado.infoPagos?.cuotaMaximaPagada}, parcial=${resultado.infoPagos?.tieneCuotaParciall}`
        );
      } else {
        this.logger.error(
          `[PAGOS-SVC] ❌ Fase 2 fallida: ${resultado.mensaje} - Errores: ${resultado.errores.join(', ')}`
        );
      }

      return resultado;
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`[PAGOS-SVC] Error fatal en Fase 2: ${mensaje}`);
      return {
        exitoso: false,
        mensaje: 'Error al ejecutar Fase 2',
        errores: [mensaje],
      };
    }
  }

  /**
   * Ejecutar Fase 2 con amortización y pagos ya obtenidos (sin consulta a BD)
   * Útil para testing o cuando ya se cargaron los datos externamente.
   * 
   * NOTA: Si ya tienes el prestamoId, usa ejecutarFase2() que lee de MAIN automáticamente.
   */
  ejecutarFase2ConDatos(
    amortizacion: RefinanciamientoItem[],
    pagos: PagoRegistro[],
    infoCredito: InfoCreditoData,
    sancionesExoneradas?: SancionRegistro[],
    sancionesPagadas?: SancionRegistro[]
  ): ResultadoPagos {
    this.logger.info(`[PAGOS-SVC] ═══ FASE 2 (con datos pre-cargados): Aplicando pagos ═══`);

    const periocidad = (String(infoCredito.periodicidad).toLowerCase() === 'mensual' ? 'mensual' : 'quincenal') as 'mensual' | 'quincenal';
    const diasPago: number[] = [];
    if (periocidad === 'quincenal') {
      if (infoCredito.fecha_pago1) diasPago.push(Number(infoCredito.fecha_pago1));
      if (infoCredito.fecha_pago2) diasPago.push(Number(infoCredito.fecha_pago2));
    } else {
      if (infoCredito.fecha_pago1) diasPago.push(Number(infoCredito.fecha_pago1));
    }

    return PagosStrategy.aplicar(
      amortizacion,
      pagos,
      Number(infoCredito.valor_cuota),
      Number(infoCredito.cuotas_faltantes),
      infoCredito.numero_cuotas ?? Number(infoCredito.cantidad_meses),
      sancionesExoneradas,
      sancionesPagadas,
      infoCredito.proxima_fecha_pago,
      diasPago,
      periocidad
    );
  }
}

export default PagosStrategyService;
