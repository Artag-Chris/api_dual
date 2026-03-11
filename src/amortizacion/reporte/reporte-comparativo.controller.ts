import { Request, Response } from 'express';
import { ReporteComparativoService } from './reporte-comparativo.service';

export class ReporteComparativoController {
  /**
   * GET /api/amortizacion/reporte/comparativo-1
   *
   * Comparativo detallado crédito por crédito entre FACILCREDITOS y FACILITO.
   * Compara cuotas pendientes, sanciones y gastos cartera (prejurídico + jurídico).
   * Ordenado por diferencia absoluta total descendente (los más discrepantes primero).
   */
  static async obtenerComparativo1(req: Request, res: Response): Promise<void> {
    try {
      const reporte = await ReporteComparativoService.obtenerComparativo1();
      res.json({
        success: true,
        message: 'Comparativo 1 obtenido correctamente',
        data: reporte,
      });
    } catch (error) {
      console.error('Error en obtenerComparativo1:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener el comparativo 1',
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  /**
   * GET /api/amortizacion/reporte/comparativo-2
   *
   * Análisis multidimensional:
   * - Resumen por estado (cantidad y totales Main vs Legacy)
   * - Créditos huérfanos (solo en una BD)
   * - Distribución de brechas por rango de diferencia
   * - Top 10 más discrepantes
   * - Casos especiales (cuotas=0 en MAIN, sanciones sin legacy, etc.)
   */
  static async obtenerComparativo2(req: Request, res: Response): Promise<void> {
    try {
      const reporte = await ReporteComparativoService.obtenerComparativo2();
      res.json({
        success: true,
        message: 'Comparativo 2 obtenido correctamente',
        data: reporte,
      });
    } catch (error) {
      console.error('Error en obtenerComparativo2:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener el comparativo 2',
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }
}
