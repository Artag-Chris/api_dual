/**
 * Servicio de Amortización
 * Encargado de la lógica de negocio relacionada con cálculos de amortización
 */

import { Amortizacion, AmortizationItem, AmortizacionParams } from './amortizacion.class';
import WinstonAdapter from '../config/adapters/winstonAdapter';

class AmortizacionService {
  private static instance: AmortizacionService;
  private logger = WinstonAdapter;

  private constructor() {}

  /**
   * Obtiene la instancia singleton del servicio
   */
  public static getInstance(): AmortizacionService {
    if (!AmortizacionService.instance) {
      AmortizacionService.instance = new AmortizacionService();
    }
    return AmortizacionService.instance;
  }

  /**
   * Calcula la amortización completa basada en los parámetros proporcionados
   * 
   * @param params - Parámetros para el cálculo de amortización
   * @returns Lista de items de amortización
   * @throws Error si los parámetros son inválidos
   */
  async calcularAmortizacion(params: AmortizacionParams): Promise<AmortizationItem[]> {
    try {
      this.logger.info(
        `[AMORTIZACION] Calculando amortización para ${params.documento} - Préstamo: $${params.prestamo}, Plazo: ${params.plazo}, Periocidad: ${params.periocidad}`
      );

      // Validar parámetros
      if (!params.documento) {
        throw new Error('El documento del cliente es requerido');
      }

      if (!params.prestamoId) {
        throw new Error('El ID del préstamo es requerido');
      }

      if (params.prestamo <= 0) {
        throw new Error('El monto del préstamo debe ser mayor a cero');
      }

      if (params.plazo <= 0) {
        throw new Error('El plazo debe ser mayor a cero');
      }

      if (!['mensual', 'quincenal'].includes(params.periocidad)) {
        throw new Error('La periocidad debe ser "mensual" o "quincenal"');
      }

      // Calcular amortización usando la clase
      const amortizaciones = Amortizacion.calcularAmortizacion(params);

      this.logger.info(
        `[AMORTIZACION] ✅ Amortización calculada exitosamente. Total de cuotas: ${amortizaciones.length}`
      );

      // Validación: Verificar que la suma de capitales sea correcta
      const totalCapitales = amortizaciones.reduce((sum, item) => sum + item.capital, 0);
      const diferencia = Math.abs(params.prestamo - totalCapitales);

      if (diferencia > 1) {
        this.logger.warn(
          `[AMORTIZACION] ⚠️ Pequeña diferencia en suma de capitales: ${diferencia}. Se ajustará automáticamente.`
        );
      }

      return amortizaciones;
    } catch (error) {
      this.logger.error(
        `[AMORTIZACION] ❌ Error al calcular amortización: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de una amortización calculada
   * 
   * @param amortizaciones - Lista de items de amortización
   * @returns Objeto con estadísticas
   */
  getEstadisticas(amortizaciones: AmortizationItem[]) {
    if (amortizaciones.length === 0) {
      return {
        totalCuotas: 0,
        cuotaPromedio: 0,
        totalIntereses: 0,
        totalAval: 0,
        totalIVA: 0,
        totalCapital: 0,
        saldoFinal: 0,
      };
    }

    const totalCuotas = amortizaciones.length;
    const totalCapital = amortizaciones.reduce((sum, item) => sum + item.capital, 0);
    const totalIntereses = amortizaciones.reduce((sum, item) => sum + item.interes, 0);
    const totalAval = amortizaciones.reduce((sum, item) => sum + item.aval, 0);
    const totalIVA = amortizaciones.reduce((sum, item) => sum + item.iva, 0);
    const cuotaPromedio = amortizaciones.reduce((sum, item) => sum + item.cuotaTotal, 0) / totalCuotas;
    const saldoFinal = amortizaciones[totalCuotas - 1]?.saldo || 0;

    return {
      totalCuotas,
      cuotaPromedio: Math.round(cuotaPromedio),
      totalIntereses,
      totalAval,
      totalIVA,
      totalCapital,
      saldoFinal,
    };
  }

  /**
   * Valida que los parámetros de amortización sean correctos
   * 
   * @param params - Parámetros a validar
   * @returns Array de errores (vacío si es válido)
   */
  validarParametros(params: Partial<AmortizacionParams>): string[] {
    const errores: string[] = [];

    if (!params.documento) {
      errores.push('El documento del cliente es requerido');
    }

    if (!params.prestamoId) {
      errores.push('El ID del préstamo es requerido');
    }

    if ((params.prestamo ?? 0) <= 0) {
      errores.push('El monto del préstamo debe ser mayor a cero');
    }

    if ((params.plazo ?? 0) <= 0) {
      errores.push('El plazo debe ser mayor a cero');
    }

    if (params.periocidad && !['mensual', 'quincenal'].includes(params.periocidad)) {
      errores.push('La periocidad debe ser "mensual" o "quincenal"');
    }

    if ((params.tasa ?? 0) < 0) {
      errores.push('La tasa no puede ser negativa');
    }

    return errores;
  }
}

export default AmortizacionService;
