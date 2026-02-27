import { Request, Response } from 'express';
import { ReporteCarteraCiudadService } from './reporte-cartera-ciudad.service';

export class ReporteCarteraCiudadController {
  /**
   * Obtiene el reporte pivoteado (formato JSON)
   * GET /api/reportes/cartera-ciudad/pivot
   */
  static async obtenerReportePivot(req: Request, res: Response): Promise<void> {
    try {
      const reporte = await ReporteCarteraCiudadService.obtenerReporteCompleto();

      res.json({
        success: true,
        message: 'Reporte pivoteado obtenido correctamente',
        data: reporte,
      });
    } catch (error) {
      console.error('Error en obtenerReportePivot:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener el reporte pivoteado',
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  /**
   * Obtiene el reporte en formato tabla
   * Útil para Excel o tablas HTML
   * GET /api/reportes/cartera-ciudad/tabla
   */
  static async obtenerReporteTabla(req: Request, res: Response): Promise<void> {
    try {
      const reporte = await ReporteCarteraCiudadService.obtenerReporteTabla();

      res.json({
        success: true,
        message: 'Reporte en formato tabla obtenido correctamente',
        data: reporte,
      });
    } catch (error) {
      console.error('Error en obtenerReporteTabla:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener el reporte en formato tabla',
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  /**
   * Obtiene el reporte con formato visual/presentación
   * GET /api/reportes/cartera-ciudad/visual
   */
  static async obtenerReporteVisual(req: Request, res: Response): Promise<void> {
    try {
      const reporte = await ReporteCarteraCiudadService.obtenerReporteVisual();

      res.json({
        success: true,
        message: 'Reporte visual obtenido correctamente',
        data: reporte,
      });
    } catch (error) {
      console.error('Error en obtenerReporteVisual:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener el reporte visual',
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  /**
   * Obtiene el reporte por defecto (visual)
   * GET /api/reportes/cartera-ciudad
   */
  static async obtenerReporte(req: Request, res: Response): Promise<void> {
    try {
      const formato = req.query.formato as string || 'visual';

      let reporte;

      switch (formato.toLowerCase()) {
        case 'pivot':
          reporte = await ReporteCarteraCiudadService.obtenerReporteCompleto();
          break;
        case 'tabla':
          reporte = await ReporteCarteraCiudadService.obtenerReporteTabla();
          break;
        case 'visual':
        default:
          reporte = await ReporteCarteraCiudadService.obtenerReporteVisual();
      }

      res.json({
        success: true,
        message: `Reporte en formato ${formato} obtenido correctamente`,
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
