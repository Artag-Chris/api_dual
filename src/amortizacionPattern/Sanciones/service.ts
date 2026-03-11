/**
 * FASE 3 - Service: LEE amortización de MAIN, obtiene sanciones/extras de LEGACY y aplica
 * 
 * Responsabilidad:
 * - LEER la amortización (ya con pagos aplicados) desde la tabla `amortizacion` de MAIN DB
 * - Consultar sanciones pendientes (estado='Debe') desde LEGACY
 * - Consultar sanciones exoneradas (estado='Exonerada') desde LEGACY
 * - Consultar gastos cartera (extras) desde LEGACY
 * - Invocar SancionesStrategy.aplicar() con la amortización leída de MAIN
 * - SOLO LECTURA: No hace INSERT/UPDATE
 * 
 * FLUJO:
 *   1. Lee amortización de MAIN (prismaMainService.amortizacion) - ya incluye pagos de Fase 2
 *   2. Mapea campos de MAIN → RefinanciamientoItem[]
 *   3. Consulta sanciones/extras de LEGACY
 *   4. Delega a SancionesStrategy (lógica pura)
 */

import { SancionesStrategy } from './class';
import {
  RefinanciamientoItem,
  SancionRegistro,
  ExtraRegistro,
  InfoCreditoData,
  InfoPagosProcessados,
  ResultadoSanciones,
} from '../interfaces';
import WinstonAdapter from '../../config/adapters/winstonAdapter';
import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import { prismaMainService } from '../../database/main/prisma-main.service';

class SancionesService {
  private static instance: SancionesService;
  private logger = WinstonAdapter;

  private constructor() {}

  public static getInstance(): SancionesService {
    if (!SancionesService.instance) {
      SancionesService.instance = new SancionesService();
    }
    return SancionesService.instance;
  }

  // ═══════════════════════════════════════════════════════════════
  // LEER AMORTIZACIÓN DESDE MAIN DB (ya con pagos aplicados en Fase 2)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Lee la amortización desde MAIN (tabla amortizacion).
   * En este punto ya tiene los pagos aplicados por Fase 2 y persistidos por QueueProcessor.
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
      this.logger.info(`[SANCIONES-SVC] Leyendo amortización de MAIN para préstamo ${prestamoId}`);

      const registros = await prismaMainService.amortizacion.findMany({
        where: { prestamoID: prestamoId },
        orderBy: { Numero_cuota: 'asc' },
      });

      if (!registros || registros.length === 0) {
        this.logger.warn(`[SANCIONES-SVC] No se encontró amortización en MAIN para préstamo ${prestamoId}`);
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
          capitalEnMora: saldo,
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
        `[SANCIONES-SVC] OK Amortización leída de MAIN: ${amortizacion.length} cuotas, préstamo=${prestamoId}`
      );

      return amortizacion;
    } catch (error) {
      this.logger.error(
        `[SANCIONES-SVC] Error al leer amortización de MAIN: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CONSULTAS A LEGACY (sanciones y extras)
  // ═══════════════════════════════════════════════════════════════

  // ─── Obtener sanciones pendientes desde LEGACY ──────────────
  async obtenerSancionesPendientes(creditoId: number): Promise<SancionRegistro[]> {
    try {
      this.logger.info(`[SANCIONES-SVC] Obteniendo sanciones pendientes del crédito ${creditoId}`);

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
        AND s.estado = 'Debe'
        ORDER BY s.created_at ASC
      `) as SancionRegistro[];

      this.logger.info(`[SANCIONES-SVC] OK Se encontraron ${sanciones.length} sanciones pendientes`);
      return sanciones;
    } catch (error) {
      this.logger.error(
        `[SANCIONES-SVC] Error al obtener sanciones pendientes: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
      throw error;
    }
  }

  // ─── Obtener sanciones exoneradas desde LEGACY ──────────────
  async obtenerSancionesExoneradas(creditoId: number): Promise<SancionRegistro[]> {
    try {
      this.logger.info(`[SANCIONES-SVC] Obteniendo sanciones exoneradas del crédito ${creditoId}`);

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

      this.logger.info(`[SANCIONES-SVC] OK Se encontraron ${sanciones.length} sanciones exoneradas`);
      return sanciones;
    } catch (error) {
      this.logger.error(
        `[SANCIONES-SVC] Error al obtener sanciones exoneradas: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
      throw error;
    }
  }

  // ─── Obtener gastos cartera (extras) desde LEGACY ───────────
  async obtenerGastosCartera(creditoId: number): Promise<ExtraRegistro[]> {
    try {
      this.logger.info(`[SANCIONES-SVC] Obteniendo gastos cartera del crédito ${creditoId}`);

      const extras = (await prismaLegacyService.$queryRaw`
        SELECT 
          e.id,
          e.credito_id,
          e.concepto,
          e.estado,
          e.valor,
          e.fecha,
          e.descripcion,
          e.created_at,
          e.updated_at
        FROM extras e
        WHERE e.credito_id = ${creditoId}
        AND e.concepto IN ('Prejuridico', 'Juridico')
        AND e.estado = 'Debe'
        ORDER BY e.created_at ASC
      `) as ExtraRegistro[];

      this.logger.info(`[SANCIONES-SVC] OK Se encontraron ${extras.length} gastos cartera`);
      return extras;
    } catch (error) {
      this.logger.error(
        `[SANCIONES-SVC] Error al obtener gastos cartera: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MÉTODO PRINCIPAL: Ejecutar Fase 3
  // ═══════════════════════════════════════════════════════════════

  /**
   * Ejecuta la Fase 3 completa:
   * 1. LEE la amortización (con pagos ya aplicados) desde MAIN DB
   * 2. Obtiene sanciones pendientes, exoneradas y gastos cartera desde LEGACY
   * 3. Delega al SancionesStrategy para distribuir y aplicar sobre la amortización de MAIN
   * 4. Retorna ResultadoSanciones (SOLO datos, SIN persistencia)
   * 
   * @param prestamoId ID del préstamo en MAIN (para leer amortización)
   * @param infoCredito Info del crédito (para periodicidad)
   * @param creditoId ID del crédito en legacy (para consultar sanciones/extras)
   * @param cuotaMaximaPagada Última cuota completamente pagada (de Fase 2)
   * @param infoPagos Info de pagos procesados (para restar pagos jurídicos de extras)
   */
  async ejecutarFase3(
    prestamoId: number,
    infoCredito: InfoCreditoData,
    creditoId: number,
    cuotaMaximaPagada: number = 0,
    infoPagos?: InfoPagosProcessados
  ): Promise<ResultadoSanciones> {
    try {
      this.logger.info(`[SANCIONES-SVC] ═══ FASE 3: Aplicando sanciones y gastos para crédito ${creditoId} (préstamo MAIN: ${prestamoId}) ═══`);

      // 1. LEER amortización desde MAIN DB (ya tiene pagos aplicados de Fase 2)
      const amortizacion = await this.obtenerAmortizacionDesdeMain(prestamoId);
      if (!amortizacion || amortizacion.length === 0) {
        return {
          exitoso: false,
          mensaje: `No se encontró amortización en MAIN para préstamo ${prestamoId}. ¿Se ejecutaron las Fases 1 y 2?`,
          errores: ['Amortización no encontrada en MAIN DB'],
        };
      }

      this.logger.info(
        `[SANCIONES-SVC] Amortización leída de MAIN: ${amortizacion.length} cuotas`
      );

      // 2. Obtener datos de LEGACY en paralelo
      const [sancionesPendientes, sancionesExoneradas, extras] = await Promise.all([
        this.obtenerSancionesPendientes(creditoId),
        this.obtenerSancionesExoneradas(creditoId),
        this.obtenerGastosCartera(creditoId),
      ]);

      // 3. Determinar periodicidad
      const periocidad = (
        String(infoCredito.periodicidad).toLowerCase() === 'mensual' ? 'mensual' : 'quincenal'
      ) as 'mensual' | 'quincenal';

      // 4. Delegar al SancionesStrategy (lógica pura sobre amortización de MAIN)
      const resultado = SancionesStrategy.aplicar(
        amortizacion,
        sancionesPendientes,
        sancionesExoneradas,
        extras,
        periocidad,
        cuotaMaximaPagada,
        infoPagos
      );

      if (resultado.exitoso) {
        this.logger.info(
          `[SANCIONES-SVC] ✅ Fase 3 completada: sanciones=${resultado.estadisticas?.totalSanciones || 0}, gastosCartera=${resultado.estadisticas?.totalGastosCartera || 0}`
        );
      } else {
        this.logger.error(
          `[SANCIONES-SVC] ❌ Fase 3 fallida: ${resultado.mensaje} - Errores: ${resultado.errores.join(', ')}`
        );
      }

      return resultado;
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`[SANCIONES-SVC] Error fatal en Fase 3: ${mensaje}`);
      return {
        exitoso: false,
        mensaje: 'Error al ejecutar Fase 3',
        errores: [mensaje],
      };
    }
  }

  /**
   * Ejecutar Fase 3 con datos ya obtenidos (sin consulta a BD)
   * Útil para testing o cuando ya se cargaron amortización y sanciones externamente.
   * 
   * NOTA: Si ya tienes el prestamoId, usa ejecutarFase3() que lee de MAIN automáticamente.
   */
  ejecutarFase3ConDatos(
    amortizacion: RefinanciamientoItem[],
    infoCredito: InfoCreditoData,
    sancionesPendientes: SancionRegistro[],
    sancionesExoneradas: SancionRegistro[],
    extras: ExtraRegistro[],
    cuotaMaximaPagada: number = 0,
    infoPagos?: InfoPagosProcessados
  ): ResultadoSanciones {
    this.logger.info(`[SANCIONES-SVC] ═══ FASE 3 (con datos pre-cargados): Aplicando sanciones y gastos ═══`);

    const periocidad = (
      String(infoCredito.periodicidad).toLowerCase() === 'mensual' ? 'mensual' : 'quincenal'
    ) as 'mensual' | 'quincenal';

    return SancionesStrategy.aplicar(
      amortizacion,
      sancionesPendientes,
      sancionesExoneradas,
      extras,
      periocidad,
      cuotaMaximaPagada,
      infoPagos
    );
  }
}

export default SancionesService;
