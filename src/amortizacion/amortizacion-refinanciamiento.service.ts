/**
 * Servicio de Amortización Refinanciamiento
 */

import { AmortizacionRefinanciamiento, RefinanciamientoItem, RefinanciamientoParams } from './amortizacion-refinanciamiento.class';
import WinstonAdapter from '../config/adapters/winstonAdapter';

class RefinanciamientoService {
  private static instance: RefinanciamientoService;
  private logger = WinstonAdapter;

  private constructor() {}

  public static getInstance(): RefinanciamientoService {
    if (!RefinanciamientoService.instance) {
      RefinanciamientoService.instance = new RefinanciamientoService();
    }
    return RefinanciamientoService.instance;
  }

  async calcularRefinanciamiento(params: RefinanciamientoParams): Promise<RefinanciamientoItem[]> {
    try {
      this.logger.info(
        `[REFINANCIAMIENTO] Calculando refinanciamiento para ${params.documento} - Capital: $${params.capitalEnMora}, Cuotas: ${params.cantidadMeses}, Valor cuota: $${params.valorCuotaAcordada}`
      );

      const resultado = AmortizacionRefinanciamiento.calcularRefinanciamiento(params);

      this.logger.info(
        `[REFINANCIAMIENTO] ✅ Refinanciamiento calculado. Total cuotas: ${resultado.length}`
      );

      return resultado;
    } catch (error) {
      this.logger.error(
        `[REFINANCIAMIENTO] ❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
      throw error;
    }
  }

  getEstadisticas(amortizaciones: RefinanciamientoItem[]) {
    if (amortizaciones.length === 0) {
      return {
        totalCuotas: 0,
        cuotaTotal: 0,
        totalCapital: 0,
        totalInteres: 0,
        totalAval: 0,
        totalIVA: 0,
        capitalEnMora: 0,
      };
    }

    const totalCuotas = amortizaciones.length;
    const totalCapital = amortizaciones.reduce((sum, item) => sum + item.capital, 0);
    const totalInteres = amortizaciones.reduce((sum, item) => sum + item.interes, 0);
    const totalAval = amortizaciones.reduce((sum, item) => sum + item.aval, 0);
    const totalIVA = amortizaciones.reduce((sum, item) => sum + item.iva, 0);
    const cuotaTotal = amortizaciones[0].cuotaTotal;
    const capitalEnMora = amortizaciones[0].capitalEnMora;

    return {
      totalCuotas,
      cuotaTotal,
      totalCapital,
      totalInteres,
      totalAval,
      totalIVA,
      capitalEnMora,
    };
  }

  validarParametros(params: Partial<RefinanciamientoParams>): string[] {
    const errores: string[] = [];

    if (!params.documento) {
      errores.push('El documento es requerido');
    }

    if (!params.prestamoId) {
      errores.push('El ID del préstamo es requerido');
    }

    if ((params.capitalEnMora ?? 0) <= 0) {
      errores.push('El capital en mora debe ser mayor a cero');
    }

    if ((params.cantidadMeses ?? 0) <= 0) {
      errores.push('La cantidad de meses debe ser mayor a cero');
    }

    if ((params.valorCuotaAcordada ?? 0) <= 0) {
      errores.push('El valor de la cuota debe ser mayor a cero');
    }

    if (params.periocidad && !['mensual', 'quincenal'].includes(params.periocidad)) {
      errores.push('La periocidad debe ser "mensual" o "quincenal"');
    }

    return errores;
  }
}

export default RefinanciamientoService;
