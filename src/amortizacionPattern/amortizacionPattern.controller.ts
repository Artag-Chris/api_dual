/**
 * Controlador del Patrón de Amortización (3 Fases)
 * 
 * Expone endpoints para ejecutar cada fase de forma individual
 * o las 3 fases encadenadas a partir de un creditoId.
 * 
 * Fases:
 *   1. Factory → Crea amortización base (lee LEGACY, retorna datos)
 *   2. Pagos  → Lee amortización de MAIN + pagos de LEGACY, aplica pagos
 *   3. Sanciones → Lee amortización de MAIN + sanciones de LEGACY, aplica sanciones
 * 
 * IMPORTANTE: Estas rutas retornan datos calculados (lógica pura).
 * La persistencia en MAIN es responsabilidad del QueueProcessor.
 */

import { Request, Response } from 'express';
import AmortizacionFactoryService from './amortizacionFactory/service';
import PagosStrategyService from './pagosStrategy/service';
import SancionesService from './Sanciones/service';
import AmortizacionPatternService from './amortizacionPattern.service';
import WinstonAdapter from '../config/adapters/winstonAdapter';

class AmortizacionPatternController {
  private factoryService = AmortizacionFactoryService.getInstance();
  private pagosService = PagosStrategyService.getInstance();
  private sancionesService = SancionesService.getInstance();
  private patternService = AmortizacionPatternService.getInstance();
  private logger = WinstonAdapter;

  // ═══════════════════════════════════════════════════════════════
  // FASE 1: Factory - Crear amortización base
  // ═══════════════════════════════════════════════════════════════

  /**
   * POST /fase1/factory
   * 
   * Ejecuta solo la Fase 1: consulta LEGACY y crea la amortización base.
   * Body: { "creditoId": 26122 }
   */
  async ejecutarFase1(req: Request, res: Response): Promise<void> {
    try {
      const { creditoId } = req.body;

      if (!creditoId || creditoId <= 0) {
        res.status(400).json({
          success: false,
          message: 'creditoId es requerido y debe ser un número positivo',
        });
        return;
      }

      this.logger.info(`[PATTERN-CTRL] POST /fase1/factory - creditoId: ${creditoId}`);

      const resultado = await this.factoryService.ejecutarFase1(creditoId);

      if (resultado.exitoso) {
        res.status(200).json({ success: true, fase: 1, ...resultado });
      } else {
        res.status(400).json({ success: false, fase: 1, ...resultado });
      }
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`[PATTERN-CTRL] Error en /fase1/factory: ${mensaje}`);
      res.status(500).json({ success: false, message: 'Error al ejecutar Fase 1', error: mensaje });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // FASE 2: Pagos - Leer MAIN + aplicar pagos
  // ═══════════════════════════════════════════════════════════════

  /**
   * POST /fase2/pagos
   * 
   * Ejecuta solo la Fase 2: lee amortización de MAIN, consulta pagos de LEGACY, aplica.
   * Body: { "creditoId": 26122, "prestamoId": 12345 }
   * 
   * Requiere que Fase 1 ya haya sido ejecutada y persistida en MAIN.
   */
  async ejecutarFase2(req: Request, res: Response): Promise<void> {
    try {
      const { creditoId, prestamoId } = req.body;

      if (!creditoId || creditoId <= 0) {
        res.status(400).json({
          success: false,
          message: 'creditoId es requerido y debe ser un número positivo',
        });
        return;
      }
      if (!prestamoId || prestamoId <= 0) {
        res.status(400).json({
          success: false,
          message: 'prestamoId es requerido y debe ser un número positivo',
        });
        return;
      }

      this.logger.info(`[PATTERN-CTRL] POST /fase2/pagos - creditoId: ${creditoId}, prestamoId: ${prestamoId}`);

      // Obtener infoCredito de LEGACY (necesaria para cuotas_faltantes, valor_cuota, etc.)
      const infoCredito = await this.factoryService.obtenerInfoCredito(creditoId);
      if (!infoCredito) {
        res.status(404).json({
          success: false,
          message: `No se encontró información del crédito ${creditoId} en legacy`,
        });
        return;
      }

      const resultado = await this.pagosService.ejecutarFase2(prestamoId, infoCredito, creditoId);

      if (resultado.exitoso) {
        res.status(200).json({ success: true, fase: 2, ...resultado });
      } else {
        res.status(400).json({ success: false, fase: 2, ...resultado });
      }
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`[PATTERN-CTRL] Error en /fase2/pagos: ${mensaje}`);
      res.status(500).json({ success: false, message: 'Error al ejecutar Fase 2', error: mensaje });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // FASE 3: Sanciones - Leer MAIN + aplicar sanciones y gastos
  // ═══════════════════════════════════════════════════════════════

  /**
   * POST /fase3/sanciones
   * 
   * Ejecuta solo la Fase 3: lee amortización de MAIN, consulta sanciones de LEGACY, aplica.
   * Body: { "creditoId": 26122, "prestamoId": 12345, "cuotaMaximaPagada": 5 }
   * 
   * Requiere que Fases 1 y 2 ya hayan sido ejecutadas y persistidas en MAIN.
   */
  async ejecutarFase3(req: Request, res: Response): Promise<void> {
    try {
      const { creditoId, prestamoId, cuotaMaximaPagada } = req.body;

      if (!creditoId || creditoId <= 0) {
        res.status(400).json({
          success: false,
          message: 'creditoId es requerido y debe ser un número positivo',
        });
        return;
      }
      if (!prestamoId || prestamoId <= 0) {
        res.status(400).json({
          success: false,
          message: 'prestamoId es requerido y debe ser un número positivo',
        });
        return;
      }

      this.logger.info(`[PATTERN-CTRL] POST /fase3/sanciones - creditoId: ${creditoId}, prestamoId: ${prestamoId}`);

      // Obtener infoCredito de LEGACY (necesaria para periodicidad)
      const infoCredito = await this.factoryService.obtenerInfoCredito(creditoId);
      if (!infoCredito) {
        res.status(404).json({
          success: false,
          message: `No se encontró información del crédito ${creditoId} en legacy`,
        });
        return;
      }

      const resultado = await this.sancionesService.ejecutarFase3(
        prestamoId,
        infoCredito,
        creditoId,
        cuotaMaximaPagada || 0
      );

      if (resultado.exitoso) {
        res.status(200).json({ success: true, fase: 3, ...resultado });
      } else {
        res.status(400).json({ success: false, fase: 3, ...resultado });
      }
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`[PATTERN-CTRL] Error en /fase3/sanciones: ${mensaje}`);
      res.status(500).json({ success: false, message: 'Error al ejecutar Fase 3', error: mensaje });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // COMPLETO: Las 3 fases encadenadas (sin persistencia intermedia)
  // ═══════════════════════════════════════════════════════════════

  /**
   * POST /completo
   * 
   * Ejecuta las 3 fases encadenadas usando solo el creditoId.
   * NO requiere persistencia intermedia en MAIN — pasa datos en memoria entre fases.
   * 
   * Body: { "creditoId": 26122 }
   * 
   * Flujo:
   *   1. Fase 1: Factory → amortización base (desde LEGACY)
   *   2. Fase 2: PagosStrategy → aplica pagos sobre amortización base
   *   3. Fase 3: SancionesStrategy → aplica sanciones sobre amortización con pagos
   *   4. Retorna resultado completo
   */
  async ejecutarCompleto(req: Request, res: Response): Promise<void> {
    try {
      const { creditoId } = req.body;

      if (!creditoId || creditoId <= 0) {
        res.status(400).json({
          success: false,
          message: 'creditoId es requerido y debe ser un número positivo',
        });
        return;
      }

      this.logger.info(`[PATTERN-CTRL] POST /completo - creditoId: ${creditoId}`);

      const resultado = await this.patternService.ejecutarCompleto(creditoId);

      if (resultado.success) {
        res.status(200).json(resultado);
      } else {
        res.status(400).json(resultado);
      }
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`[PATTERN-CTRL] Error en /completo: ${mensaje}`);
      res.status(500).json({
        success: false,
        message: 'Error al ejecutar las 3 fases',
        error: mensaje,
      });
    }
  }
}

export default AmortizacionPatternController;
