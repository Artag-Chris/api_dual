import { Request, Response } from 'express';
import LegacyDataService from './legacy-data.service';

export class LegacyDataController {
  constructor(
    private readonly legacyDataService = LegacyDataService.getInstance()
  ) {}

  // ==================== CLIENTES ====================

  getAllClientes = async (req: Request, res: Response) => {
    try {
      const { skip, take } = req.query;
      const data = await this.legacyDataService.getAllClientes(
        skip ? parseInt(skip as string) : 0,
        take ? parseInt(take as string) : 100
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  getClienteById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = await this.legacyDataService.getClienteById(parseInt(id));
      if (!data) {
        res.status(404).json({ success: false, error: 'Cliente no encontrado' });
        return;
      }
      res.status(200).json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  getClienteByDocumento = async (req: Request, res: Response) => {
    try {
      const { num_doc } = req.params;
      const data = await this.legacyDataService.getClienteByDocumento(num_doc);
      if (!data) {
        res.status(404).json({ success: false, error: 'Cliente no encontrado' });
        return;
      }
      res.status(200).json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ==================== CRÉDITOS ====================

  getAllCreditos = async (req: Request, res: Response) => {
    try {
      const { skip, take } = req.query;
      const data = await this.legacyDataService.getAllCreditos(
        skip ? parseInt(skip as string) : 0,
        take ? parseInt(take as string) : 100
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  getCreditoById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = await this.legacyDataService.getCreditoById(parseInt(id));
      if (!data) {
        res.status(404).json({ success: false, error: 'Crédito no encontrado' });
        return;
      }
      res.status(200).json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  getCreditosByCliente = async (req: Request, res: Response) => {
    try {
      const { cliente_id } = req.params;
      const data = await this.legacyDataService.getCreditosByCliente(parseInt(cliente_id));
      res.status(200).json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ==================== CODEUDORES ====================

  getAllCodeudores = async (req: Request, res: Response) => {
    try {
      const { skip, take } = req.query;
      const data = await this.legacyDataService.getAllCodeudores(
        skip ? parseInt(skip as string) : 0,
        take ? parseInt(take as string) : 100
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ==================== FACTURAS ====================

  getAllFacturas = async (req: Request, res: Response) => {
    try {
      const { skip, take } = req.query;
      const data = await this.legacyDataService.getAllFacturas(
        skip ? parseInt(skip as string) : 0,
        take ? parseInt(take as string) : 100
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ==================== PAGOS ====================

  getAllPagos = async (req: Request, res: Response) => {
    try {
      const { skip, take } = req.query;
      const data = await this.legacyDataService.getAllPagos(
        skip ? parseInt(skip as string) : 0,
        take ? parseInt(take as string) : 100
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ==================== PRECREDITOS ====================

  getAllPrecreditos = async (req: Request, res: Response) => {
    try {
      const { skip, take } = req.query;
      const data = await this.legacyDataService.getAllPrecreditos(
        skip ? parseInt(skip as string) : 0,
        take ? parseInt(take as string) : 100
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ==================== ESTADÍSTICAS ====================

  getEstadisticas = async (req: Request, res: Response) => {
    try {
      const data = await this.legacyDataService.getEstadisticasGenerales();
      res.status(200).json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
