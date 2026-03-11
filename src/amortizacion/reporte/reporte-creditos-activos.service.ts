import { prismaMainService } from '../../database/main/prisma-main.service';

/**
 * Interface para datos de cada crédito en el reporte
 */
interface CreditoConValores {
  prestamo_id: number;
  documento: string;
  estado: string;
  valor_prestamo: string;
  numero_cuotas: string;
  cuotas_en_tabla: number;
  total_cuota: number;
  total_sanciones: number;
  total_prejuridico: number;
  total_juridico: number;
  total_gastos: number;
}

/**
 * Interface para resumen por estado
 */
interface ResumenEstado {
  cantidad_creditos: number;
  total_cuota: number;
  total_sanciones: number;
  total_prejuridico: number;
  total_juridico: number;
  total_gastos: number;
  gran_total: number;
}

/**
 * Interface para el reporte final
 */
interface ReporteCredítosActivos {
  titulo: string;
  fecha_generacion: Date;
  fecha_filtro: string;
  creditos: CreditoConValores[];
  resumen_por_estado: Record<string, ResumenEstado>;
  totales: {
    cantidad_creditos: number;
    total_cuota: number;
    total_sanciones: number;
    total_prejuridico: number;
    total_juridico: number;
    total_gastos: number;
    gran_total: number;
  };
}

/**
 * Estados válidos para filtrar créditos
 */
const ESTADOS_VALIDOS = ['ACTIVO', 'JURIDICO', 'PREJURIDICO'];

/**
 * Fecha de filtro (desde esta fecha en adelante)
 */
const FECHA_FILTRO = '2026-03-03 17:44:29';

export class ReporteCredítosActivosService {
  /**
   * Obtiene todos los créditos activos con sus valores de cuotas, sanciones y gastos
   *
   * LÓGICA:
   * 1. Obtiene todos los créditos en estados ACTIVO, JURIDICO, PREJURIDICO
   * 2. Filtra por fecha_actualizacion >= FECHA_FILTRO
   * 3. Para cada crédito (usando solo amortizacion + gastos_cartera):
   *    - Suma todas las cuotas (total_cuota) de amortizaciones
   *    - Suma sanciones de amortizaciones
   *    - Suma gastos prejuridico de gastos_cartera
   *    - Suma gastos juridico de gastos_cartera
   *    - total_gastos = prejuridico + juridico (calculado en TS)
   * 4. Retorna detalle, resumen por estado y totales
   *
   * NOTA: No se usa historial_pagos porque no hay sincronización total con esa tabla.
   * Los datos se obtienen únicamente de amortizacion y gastos_cartera.
   */
  static async obtenerReporte(): Promise<ReporteCredítosActivos> {
    try {
      // Paso 1: Obtener todos los créditos activos con fecha >= FECHA_FILTRO
      const creditosConValores = await this.obtenerCreditosConValores();

      // Paso 2: Calcular resumen por estado
      const resumenPorEstado = this.calcularResumenPorEstado(creditosConValores);

      // Paso 3: Calcular totales globales
      const totales = this.calcularTotales(creditosConValores);

      return {
        titulo: 'Reporte de Créditos Activos - Amortizaciones y Gastos',
        fecha_generacion: new Date(),
        fecha_filtro: FECHA_FILTRO,
        creditos: creditosConValores,
        resumen_por_estado: resumenPorEstado,
        totales,
      };
    } catch (error) {
      console.error('Error en obtenerReporte:', error);
      throw error;
    }
  }

  /**
   * Obtiene los créditos con sus valores de cuotas, sanciones y gastos
   *
   * Usa subqueries correlacionadas para evitar multiplicación de valores
   * debido a múltiples registros en amortizacion y gastos_cartera.
   *
   * Campos adicionales de contexto:
   * - valor_prestamo: monto original del crédito
   * - numero_cuotas: cuotas pactadas en detalle_credito
   * - cuotas_en_tabla: cuántas filas existen en amortizacion (para verificar consistencia)
   *
   * Se eliminaron CAST innecesarios (total_cuota, sancion, prejuridico, juridico ya son Int)
   * Se eliminó subquery redundante de total_gastos (se calcula en TS)
   * Se usa parámetro posicional para la fecha (previene SQL injection)
   */
  private static async obtenerCreditosConValores(): Promise<CreditoConValores[]> {
    try {
      const datos = await prismaMainService.$queryRawUnsafe<CreditoConValores[]>(
        `
        SELECT 
          dc.prestamo_ID as prestamo_id,
          dc.documento,
          dc.estado,
          dc.valor_prestamo,
          dc.numero_cuotas,
          
          COALESCE((
            SELECT COUNT(*)
            FROM amortizacion am
            WHERE am.prestamoID = dc.prestamo_ID
          ), 0) as cuotas_en_tabla,
          
          COALESCE((
            SELECT SUM(COALESCE(am.total_cuota, 0))
            FROM amortizacion am
            WHERE am.prestamoID = dc.prestamo_ID
          ), 0) as total_cuota,
          
          COALESCE((
            SELECT SUM(COALESCE(am.sancion, 0))
            FROM amortizacion am
            WHERE am.prestamoID = dc.prestamo_ID
          ), 0) as total_sanciones,
          
          COALESCE((
            SELECT SUM(COALESCE(gc.prejuridico, 0))
            FROM gastos_cartera gc
            WHERE gc.prestamo_id = dc.prestamo_ID
          ), 0) as total_prejuridico,
          
          COALESCE((
            SELECT SUM(COALESCE(gc.juridico, 0))
            FROM gastos_cartera gc
            WHERE gc.prestamo_id = dc.prestamo_ID
          ), 0) as total_juridico

        FROM detalle_credito dc
        WHERE dc.estado IN ('ACTIVO','JURIDICO','PREJURIDICO')
          AND dc.fecha_actualizacion >= ?
        ORDER BY dc.prestamo_ID ASC
        `,
        FECHA_FILTRO
      );

      return datos.map(row => {
        const prejuridico = Number(row.total_prejuridico);
        const juridico = Number(row.total_juridico);

        return {
          prestamo_id: Number(row.prestamo_id),
          documento: String(row.documento),
          estado: String(row.estado),
          valor_prestamo: String(row.valor_prestamo),
          numero_cuotas: String(row.numero_cuotas),
          cuotas_en_tabla: Number(row.cuotas_en_tabla),
          total_cuota: Number(row.total_cuota),
          total_sanciones: Number(row.total_sanciones),
          total_prejuridico: prejuridico,
          total_juridico: juridico,
          total_gastos: prejuridico + juridico,
          total_general: Number(row.total_cuota) + Number(row.total_sanciones) + prejuridico + juridico,
        };
      });
    } catch (error) {
      console.error('Error al obtener créditos con valores:', error);
      throw new Error('Error al consultar los créditos activos');
    }
  }

  /**
   * Calcula el resumen agrupado por estado de crédito
   * Permite ver totales de ACTIVO, JURIDICO, PREJURIDICO por separado
   */
  private static calcularResumenPorEstado(
    creditos: CreditoConValores[]
  ): Record<string, ResumenEstado> {
    const resumen: Record<string, ResumenEstado> = {};

    for (const credito of creditos) {
      if (!resumen[credito.estado]) {
        resumen[credito.estado] = {
          cantidad_creditos: 0,
          total_cuota: 0,
          total_sanciones: 0,
          total_prejuridico: 0,
          total_juridico: 0,
          total_gastos: 0,
          gran_total: 0,
        };
      }

      const grupo = resumen[credito.estado];
      grupo.cantidad_creditos += 1;
      grupo.total_cuota += credito.total_cuota;
      grupo.total_sanciones += credito.total_sanciones;
      grupo.total_prejuridico += credito.total_prejuridico;
      grupo.total_juridico += credito.total_juridico;
      grupo.total_gastos += credito.total_gastos;
      grupo.gran_total += credito.total_cuota + credito.total_sanciones + credito.total_gastos;
    }

    return resumen;
  }

  /**
   * Calcula los totales globales del reporte
   */
  private static calcularTotales(
    creditos: CreditoConValores[]
  ): ReporteCredítosActivos['totales'] {
    const totales = creditos.reduce(
      (acc, credito) => ({
        cantidad_creditos: acc.cantidad_creditos + 1,
        total_cuota: acc.total_cuota + credito.total_cuota,
        total_sanciones: acc.total_sanciones + credito.total_sanciones,
        total_prejuridico: acc.total_prejuridico + credito.total_prejuridico,
        total_juridico: acc.total_juridico + credito.total_juridico,
        total_gastos: acc.total_gastos + credito.total_gastos,
        gran_total:
          acc.gran_total +
          credito.total_cuota +
          credito.total_sanciones +
          credito.total_gastos,
      }),
      {
        cantidad_creditos: 0,
        total_cuota: 0,
        total_sanciones: 0,
        total_prejuridico: 0,
        total_juridico: 0,
        total_gastos: 0,
        gran_total: 0,
      }
    );

    return totales;
  }

  /**
   * Formatea los números como moneda en COP
   */
  static formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(valor);
  }
}
