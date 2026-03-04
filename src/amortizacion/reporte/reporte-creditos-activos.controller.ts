import { Request, Response } from 'express';
import { ReporteCredítosActivosService } from './reporte-creditos-activos.service';

export class ReporteCredítosActivosController {
  /**
   * Obtiene el reporte de créditos activos desde una fecha específica
   * GET /api/amortizacion/reporte/creditos-activos
   */
  static async obtenerReporte(req: Request, res: Response): Promise<void> {
    try {
      const reporte = await ReporteCredítosActivosService.obtenerReporte();

      res.json({
        success: true,
        message: 'Reporte de créditos activos obtenido correctamente',
        data: reporte,
      });
    } catch (error) {
      console.error('Error en obtenerReporte:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener el reporte de créditos activos',
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }
}
