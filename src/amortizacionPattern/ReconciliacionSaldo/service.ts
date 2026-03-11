/**
 * FASE 4 - Service: LEE creditos.saldo de LEGACY y delega al ReconciliacionSaldoStrategy
 * 
 * Responsabilidad:
 * - Consultar creditos.saldo desde LEGACY (la verdad)
 * - Invocar ReconciliacionSaldoStrategy.aplicar() con la amortización post Fase 3
 * - SOLO LECTURA: No hace INSERT/UPDATE
 * 
 * FLUJO:
 *   1. Query creditos.saldo de legacy
 *   2. Delegar al ReconciliacionSaldoStrategy (lógica pura)
 *   3. Retornar ResultadoReconciliacion
 */

import { ReconciliacionSaldoStrategy } from './class';
import {
  RefinanciamientoItem,
  GastosCartera,
  ResultadoReconciliacion,
} from '../interfaces';
import WinstonAdapter from '../../config/adapters/winstonAdapter';
import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';

class ReconciliacionSaldoService {
  private static instance: ReconciliacionSaldoService;
  private logger = WinstonAdapter;

  private constructor() {}

  public static getInstance(): ReconciliacionSaldoService {
    if (!ReconciliacionSaldoService.instance) {
      ReconciliacionSaldoService.instance = new ReconciliacionSaldoService();
    }
    return ReconciliacionSaldoService.instance;
  }

  // ═══════════════════════════════════════════════════════════════
  // CONSULTA A LEGACY: creditos.saldo
  // ═══════════════════════════════════════════════════════════════

  /**
   * Obtiene creditos.saldo desde legacy.
   * Este valor es LA VERDAD del saldo pendiente del crédito.
   */
  async obtenerSaldoLegacy(creditoId: number): Promise<number | null> {
    try {
      this.logger.info(`[RECONCILIACION-SVC] Obteniendo creditos.saldo para crédito ${creditoId}`);

      const resultado = (await prismaLegacyService.$queryRaw`
        SELECT creditos.saldo
        FROM creditos
        WHERE creditos.id = ${creditoId}
        LIMIT 1
      `) as Array<{ saldo: number | bigint | string | null }>;

      if (!resultado || resultado.length === 0 || resultado[0].saldo === null) {
        this.logger.warn(`[RECONCILIACION-SVC] No se encontró saldo para crédito ${creditoId}`);
        return null;
      }

      const saldo = Number(resultado[0].saldo);
      this.logger.info(`[RECONCILIACION-SVC] Saldo legacy crédito ${creditoId}: ${saldo.toLocaleString()}`);
      return saldo;
    } catch (error) {
      this.logger.error(
        `[RECONCILIACION-SVC] Error al obtener saldo legacy: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MÉTODO PRINCIPAL: Ejecutar Fase 4
  // ═══════════════════════════════════════════════════════════════

  /**
   * Ejecuta la Fase 4 completa:
   * 1. Obtiene creditos.saldo desde LEGACY
   * 2. Delega al ReconciliacionSaldoStrategy para comparar y redistribuir si aplica
   * 
   * @param amortizacionPostFase3 Amortización final de Fase 3
   * @param amortizacionOriginal Amortización de Fase 1 (valores originales)
   * @param creditoId ID del crédito en legacy
   * @param gastosCartera Gastos cartera de Fase 3
   */
  async ejecutarFase4(
    amortizacionPostFase3: RefinanciamientoItem[],
    amortizacionOriginal: RefinanciamientoItem[],
    creditoId: number,
    gastosCartera?: GastosCartera,
    periocidad: 'mensual' | 'quincenal' = 'mensual'
  ): Promise<ResultadoReconciliacion> {
    try {
      this.logger.info(`[RECONCILIACION-SVC] ═══ FASE 4: Reconciliación contra saldo legacy para crédito ${creditoId} ═══`);

      // 1. Obtener saldo de legacy
      const saldoLegacy = await this.obtenerSaldoLegacy(creditoId);

      if (saldoLegacy === null) {
        return {
          exitoso: false,
          mensaje: `No se pudo obtener creditos.saldo para crédito ${creditoId}`,
          errores: ['Saldo no encontrado en legacy'],
          redistribucionAplicada: false,
          saldoLegacy: 0,
          sumaCuotasCalculada: 0,
          totalSanciones: 0,
          totalGastosCartera: 0,
          diferencia: 0,
          tolerancia: 100000,
        };
      }

      // 2. Delegar al strategy (lógica pura)
      const resultado = ReconciliacionSaldoStrategy.aplicar(
        amortizacionPostFase3,
        amortizacionOriginal,
        saldoLegacy,
        gastosCartera,
        periocidad
      );

      if (resultado.exitoso) {
        if (resultado.redistribucionAplicada) {
          this.logger.info(
            `[RECONCILIACION-SVC] ✅ Fase 4 completada CON redistribución: diferencia=${resultado.diferencia.toLocaleString()}, ` +
            `cuotasRedist=${resultado.cuotasCompletasRedistribuidas}, excedente=${resultado.excedenteParcial?.toLocaleString()}`
          );
        } else {
          this.logger.info(
            `[RECONCILIACION-SVC] ✅ Fase 4 completada SIN redistribución: diferencia=${resultado.diferencia.toLocaleString()} (dentro de tolerancia)`
          );
        }
      } else {
        this.logger.error(
          `[RECONCILIACION-SVC] ❌ Fase 4 fallida: ${resultado.mensaje} - Errores: ${resultado.errores.join(', ')}`
        );
      }

      return resultado;
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`[RECONCILIACION-SVC] Error fatal en Fase 4: ${mensaje}`);
      return {
        exitoso: false,
        mensaje: 'Error al ejecutar Fase 4',
        errores: [mensaje],
        redistribucionAplicada: false,
        saldoLegacy: 0,
        sumaCuotasCalculada: 0,
        totalSanciones: 0,
        totalGastosCartera: 0,
        diferencia: 0,
        tolerancia: 100000,
      };
    }
  }

  /**
   * Ejecutar Fase 4 con saldo ya obtenido (sin consulta a BD).
   * Útil para testing o cuando se consulta el saldo externamente.
   */
  ejecutarFase4ConDatos(
    amortizacionPostFase3: RefinanciamientoItem[],
    amortizacionOriginal: RefinanciamientoItem[],
    saldoLegacy: number,
    gastosCartera?: GastosCartera,
    periocidad: 'mensual' | 'quincenal' = 'mensual'
  ): ResultadoReconciliacion {
    this.logger.info(`[RECONCILIACION-SVC] ═══ FASE 4 (con datos pre-cargados): saldoLegacy=${saldoLegacy.toLocaleString()} ═══`);

    return ReconciliacionSaldoStrategy.aplicar(
      amortizacionPostFase3,
      amortizacionOriginal,
      saldoLegacy,
      gastosCartera,
      periocidad
    );
  }
}

export default ReconciliacionSaldoService;
