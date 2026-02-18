import { Request, Response } from 'express';
import MainDataService from './main-data.service';
import { BulkMigrationParser } from '../../domain/dtos/bulk-migration.dto';

export class MainDataController {
  constructor(
    private readonly mainDataService = MainDataService.getInstance()
  ) {}

  // ==================== USER CLIENTE ====================

  getAllUserClientes = async (req: Request, res: Response) => {
    try {
      const { skip, take } = req.query;
      const data = await this.mainDataService.getAllUserClientes(
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

  getUserClienteById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = await this.mainDataService.getUserClienteById(parseInt(id));
      if (!data) {
        res.status(404).json({ success: false, error: 'Usuario cliente no encontrado' });
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

  // ==================== INFO PERSONAL ====================

  getAllInfoPersonal = async (req: Request, res: Response) => {
    try {
      const { skip, take } = req.query;
      const data = await this.mainDataService.getAllInfoPersonal(
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

  // ==================== INFO CONTACTO ====================

  getAllInfoContacto = async (req: Request, res: Response) => {
    try {
      const { skip, take } = req.query;
      const data = await this.mainDataService.getAllInfoContacto(
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

  // ==================== INFO LABORAL ====================

  getAllInfoLaboral = async (req: Request, res: Response) => {
    try {
      const { skip, take } = req.query;
      const data = await this.mainDataService.getAllInfoLaboral(
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

  // ==================== INFO REFERENCIAS ====================

  getAllInfoReferencias = async (req: Request, res: Response) => {
    try {
      const { skip, take } = req.query;
      const data = await this.mainDataService.getAllInfoReferencias(
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
      const data = await this.mainDataService.getAllPagos(
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

  // ==================== PRODUCTOS ====================

  getAllProductos = async (req: Request, res: Response) => {
    try {
      const { skip, take } = req.query;
      const data = await this.mainDataService.getAllProductos(
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

  // ==================== INVENTARIO ====================

  getAllInventario = async (req: Request, res: Response) => {
    try {
      const { skip, take } = req.query;
      const data = await this.mainDataService.getAllInventario(
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

  // ==================== PEDIDOS ====================

  getAllPedidos = async (req: Request, res: Response) => {
    try {
      const { skip, take } = req.query;
      const data = await this.mainDataService.getAllPedidos(
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

  // ==================== ESTUDIOS CRÉDITO ====================

  getAllEstudiosCredito = async (req: Request, res: Response) => {
    try {
      const { skip, take } = req.query;
      const data = await this.mainDataService.getAllEstudiosCredito(
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

  // ==================== HISTORIAL PAGOS ====================

  getAllHistorialPagos = async (req: Request, res: Response) => {
    try {
      const { skip, take } = req.query;
      const data = await this.mainDataService.getAllHistorialPagos(
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
      const data = await this.mainDataService.getEstadisticasGenerales();
      res.status(200).json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ==================== MIGRACIÓN ====================

  migrateClienteFromLegacy = async (req: Request, res: Response) => {
    try {
      const { documento } = req.params;

      // Validaciones básicas
      if (!documento || documento.trim() === '') {
        res.status(400).json({
          success: false,
          error: 'Documento es requerido y no puede estar vacío'
        });
        return;
      }

      // Llamar al servicio de migración
      const result = await this.mainDataService.migrateClienteFromLegacy(documento);

      // Retornar resultado exitoso
      res.status(201).json({
        success: true,
        message: `Cliente ${documento} migrado exitosamente de Legacy a Main`,
        data: result
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Determinar el código de estado HTTP basado en el error
      let statusCode = 500;
      if (errorMessage.includes('no encontrado')) {
        statusCode = 404;
      } else if (errorMessage.includes('ya existe')) {
        statusCode = 409;
      }

      res.status(statusCode).json({
        success: false,
        error: errorMessage
      });
    }
  }

  // ==================== AMORTIZACIONES CON ESTADO ====================

  getAmortizacionesConEstado = async (req: Request, res: Response) => {
    try {
      const { prestamoID } = req.params;
      const data = await this.mainDataService.getAmortizacionesConEstado(parseInt(prestamoID));
      
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  }

  // ==================== BULK MIGRATION ====================

  bulkMigrateFromExcel = async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file provided. Please upload an Excel file.'
        });
        return;
      }

      // Validate file type (accept .xlsx and .csv)
      const isValidType = req.file.originalname.endsWith('.xlsx') || req.file.originalname.endsWith('.csv');
      if (!isValidType) {
        res.status(400).json({
          success: false,
          error: 'Invalid file type. Please upload an Excel (.xlsx) or CSV (.csv) file.'
        });
        return;
      }

      // Parse file
      const parser = new BulkMigrationParser();
      const rows = await parser.parseFile(req.file.buffer, req.file.originalname);

      // Extract documentos
      const documentos = rows.map((row) => row.documento);

      // Process bulk migration
      const resultado = await this.mainDataService.procesarBulkMigracionExcel(documentos);

      res.status(200).json({
        success: true,
        message: `Migración masiva completada: ${resultado.exitosos} exitosos, ${resultado.errores} errores`,
        data: resultado
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  }
}


