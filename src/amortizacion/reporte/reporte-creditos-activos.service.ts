import { prismaMainService } from '../../database/main/prisma-main.service';

/**
 * Interface para datos de cada crédito en el reporte
 */
interface CreditoConValores {
  prestamo_id: number;
  documento: string;
  estado: string;
  total_cuota: number;
  total_sanciones: number;
  total_prejuridico: number;
  total_juridico: number;
  total_gastos: number;
}

/**
 * Interface para el reporte final
 */
interface ReporteCredítosActivos {
  titulo: string;
  fecha_generacion: Date;
  fecha_filtro: string;
  creditos: CreditoConValores[];
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
   * 1. Obtiene todos los créditos en estados ACTIVO, JURIDICO, PREJURIDICO, REFINANCIADO
   * 2. Filtra por fecha_actualizacion >= FECHA_FILTRO
   * 3. Para cada crédito:
   *    - Suma todas las cuotas (total_cuota) de amortizaciones
   *    - Suma todas las sanciones de amortizaciones
   *    - Suma gastos prejuridico
   *    - Suma gastos juridico
   * 4. Retorna detalle y totales
   */
  static async obtenerReporte(): Promise<ReporteCredítosActivos> {
    try {
      // Paso 1: Obtener todos los créditos activos con fecha >= FECHA_FILTRO
      const creditosConValores = await this.obtenerCreditosConValores();

      // Paso 2: Calcular totales
      const totales = this.calcularTotales(creditosConValores);

      return {
        titulo: 'Reporte de Créditos Activos - Amortizaciones y Gastos',
        fecha_generacion: new Date(),
        fecha_filtro: FECHA_FILTRO,
        creditos: creditosConValores,
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
   * Usa subqueries para evitar multiplicación de valores debido a múltiples registros
   * en amortizacion y gastos_cartera
   */
  private static async obtenerCreditosConValores(): Promise<CreditoConValores[]> {
    try {
      const datos = await prismaMainService.$queryRawUnsafe<CreditoConValores[]>(
        `
        SELECT 
          dc.prestamo_ID as prestamo_id,
          dc.documento,
          dc.estado,
          COALESCE((
            SELECT SUM(CAST(am.total_cuota AS UNSIGNED))
            FROM amortizacion am
            WHERE am.prestamoID = dc.prestamo_ID
          ), 0) as total_cuota,
          COALESCE((
            SELECT SUM(CAST(COALESCE(am.sancion, 0) AS UNSIGNED))
            FROM amortizacion am
            WHERE am.prestamoID = dc.prestamo_ID
          ), 0) as total_sanciones,
          COALESCE((
            SELECT SUM(CAST(COALESCE(gc.prejuridico, 0) AS UNSIGNED))
            FROM gastos_cartera gc
            WHERE gc.prestamo_id = dc.prestamo_ID
          ), 0) as total_prejuridico,
          COALESCE((
            SELECT SUM(CAST(COALESCE(gc.juridico, 0) AS UNSIGNED))
            FROM gastos_cartera gc
            WHERE gc.prestamo_id = dc.prestamo_ID
          ), 0) as total_juridico,
          COALESCE((
            SELECT SUM(CAST(COALESCE(gc.prejuridico, 0) AS UNSIGNED)) +
                   SUM(CAST(COALESCE(gc.juridico, 0) AS UNSIGNED))
            FROM gastos_cartera gc
            WHERE gc.prestamo_id = dc.prestamo_ID
          ), 0) as total_gastos
        FROM detalle_credito dc
        WHERE dc.estado IN ('ACTIVO', 'JURIDICO', 'PREJURIDICO')
        AND dc.fecha_actualizacion >= '${FECHA_FILTRO}'
        ORDER BY dc.prestamo_ID ASC
        `
      );

      return datos.map(row => ({
        prestamo_id: Number(row.prestamo_id),
        documento: String(row.documento),
        estado: String(row.estado),
        total_cuota: Number(row.total_cuota),
        total_sanciones: Number(row.total_sanciones),
        total_prejuridico: Number(row.total_prejuridico),
        total_juridico: Number(row.total_juridico),
        total_gastos: Number(row.total_gastos),
      }));
    } catch (error) {
      console.error('Error al obtener créditos con valores:', error);
      throw new Error('Error al consultar los créditos activos');
    }
  }

  /**
   * Calcula los totales del reporte
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
