import { Request, Response } from 'express';
import { ReporteCarteraCiudadService } from './reporte-cartera-ciudad.service';

export class ReporteCarteraCiudadController {
  /**
   * Obtiene el reporte completo de créditos por cartera y ciudad
   * GET /api/amortizacion/reporte
   */
  static async obtenerReporte(req: Request, res: Response): Promise<void> {
    try {
      const reporte = await ReporteCarteraCiudadService.obtenerReporte();

      res.json({
        success: true,
        message: 'Reporte de cartera obtenido correctamente',
        data: reporte,
      });
    } catch (error) {
      console.error('Error en obtenerReporte:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener el reporte',
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }
}
