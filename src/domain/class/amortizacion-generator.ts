/**
 * PHASE 11: Amortization Generator
 * Generates intelligent amortization schedules based on credit status
 * - For new credits: generates ALL cuotas
 * - For credits with payments: generates ONLY remaining cuotas
 */

import WinstonAdapter from '../../config/adapters/winstonAdapter';
import { AmortizacionCreateDto } from '../dtos/migrate-cliente.dto';
import { DatosCreditoActivo } from './creditos-integration-mapper';

interface AmortizacionParams {
  prestamo_ID: number;
  valor_prestamo: number;
  numero_cuotas: number;
  tasa_mensual: number;
  periocidad: string;
  fecha_inicial: Date;
  datosCreditoActivo: DatosCreditoActivo | null;
}

export class AmortizacionGenerator {
  constructor(private readonly logger: typeof WinstonAdapter) {}

  /**
   * Generates complete amortization schedule
   * Intelligently determines which cuotas to generate based on payment history
   */
  generarAmortizacion(params: AmortizacionParams): AmortizacionCreateDto[] {
    const {
      prestamo_ID,
      valor_prestamo,
      numero_cuotas,
      tasa_mensual,
      periocidad,
      fecha_inicial,
      datosCreditoActivo,
    } = params;

    const cuotas: AmortizacionCreateDto[] = [];

    // Determine starting parameters
    let cuotaInicial: number;
    let cuotasAGenerar: number;
    let saldoPendiente: number;

    if (datosCreditoActivo && datosCreditoActivo.cuotas_faltantes > 0) {
      // CASE: Credit with payments already made
      const cuotasPagadas = numero_cuotas - datosCreditoActivo.cuotas_faltantes;
      cuotaInicial = cuotasPagadas + 1;
      cuotasAGenerar = datosCreditoActivo.cuotas_faltantes;
      saldoPendiente = datosCreditoActivo.saldo;

      this.logger.info(
        `Generating ${cuotasAGenerar} remaining cuotas (${cuotasPagadas} already paid) starting from cuota ${cuotaInicial}`
      );
    } else {
      // CASE: New credit (no payments)
      cuotaInicial = 1;
      cuotasAGenerar = numero_cuotas;
      saldoPendiente = valor_prestamo;

      this.logger.info(`Generating ${cuotasAGenerar} cuotas for new credit`);
    }

    // Calculate capital per cuota (evenly distributed)
    const capitalPorCuota = Math.round(saldoPendiente / cuotasAGenerar);

    // Generate each cuota
    let fechaPago = new Date(fecha_inicial);
    let saldoActual = saldoPendiente;

    for (let i = 0; i < cuotasAGenerar; i++) {
      const numeroCuota = cuotaInicial + i;
      const esUltimaCuota = i === cuotasAGenerar - 1;

      // Calculate cuota components
      let capital: number;
      if (esUltimaCuota) {
        // Last cuota pays remaining balance
        capital = saldoActual;
      } else {
        capital = capitalPorCuota;
      }

      // Interest calculation: saldo × tasa
      const interes = Math.round(saldoActual * (tasa_mensual / 100));

      // Aval: 10% of capital
      const aval = Math.round(capital * 0.1);

      // IVA: 19% of aval
      const iva = Math.round(aval  * 0.19);

      // Total cuota
      const totalCuota = capital + interes + aval + iva;

      // Subtract capital from saldo
      saldoActual -= capital;

      // Ensure saldo doesn't go negative
      if (saldoActual < 0) saldoActual = 0;

      // Create amortizacion DTO
      const [error, amortizacionDto] = AmortizacionCreateDto.create({
        prestamo_ID,
        numero_cuota: numeroCuota,
        capital,
        interes,
        aval,
        IVA: iva,
        total_cuota: totalCuota,
        saldo: saldoActual,
        fecha_pago: fechaPago,
        estado: 'PENDIENTE',
      });

      if (error || !amortizacionDto) {
        this.logger.error(`Error creating amortizacion for cuota ${numeroCuota}: ${error}`);
        continue;
      }

      cuotas.push(amortizacionDto);

      // Calculate next payment date
      fechaPago = this.calcularSiguienteFechaPago(fechaPago, periocidad);
    }

    this.logger.info(
      `Generated ${cuotas.length} amortization entries for prestamo ${prestamo_ID}`
    );

    return cuotas;
  }

  /**
   * Calculates next payment date based on periodicity
   */
  private calcularSiguienteFechaPago(fechaActual: Date, periocidad: string): Date {
    const siguienteFecha = new Date(fechaActual);

    switch (periocidad) {
      case 'SEMANAL':
        siguienteFecha.setDate(siguienteFecha.getDate() + 7);
        break;
      case 'QUINCENAL':
      case 'DECADAL':
        siguienteFecha.setDate(siguienteFecha.getDate() + 15);
        break;
      case 'MENSUAL':
        siguienteFecha.setMonth(siguienteFecha.getMonth() + 1);
        break;
      default:
        // Default to monthly
        siguienteFecha.setMonth(siguienteFecha.getMonth() + 1);
    }

    return siguienteFecha;
  }

  /**
   * Validates generated amortization
   * Ensures capital sum equals original debt
   */
  validarAmortizacion(
    cuotas: AmortizacionCreateDto[],
    saldoEsperado: number
  ): { valida: boolean; diferencia: number } {
    if (cuotas.length === 0) {
      return { valida: false, diferencia: saldoEsperado };
    }

    const totalCapital = cuotas.reduce((sum, cuota) => sum + cuota.capital, 0);
    const diferencia = totalCapital - saldoEsperado;

    const valida = Math.abs(diferencia) <= 100; // Allow small rounding difference

    if (!valida) {
      this.logger.warn(
        `Amortization validation failed: expected ${saldoEsperado}, got ${totalCapital}, difference: ${diferencia}`
      );
    }

    return { valida, diferencia };
  }

  /**
   * Gets summary of amortization schedule
   */
  obtenerResumenAmortizacion(cuotas: AmortizacionCreateDto[]): {
    totalCapital: number;
    totalInteres: number;
    totalAval: number;
    totalIVA: number;
    totalAPagar: number;
    numeroCuotas: number;
  } {
    const totalCapital = cuotas.reduce((sum, c) => sum + c.capital, 0);
    const totalInteres = cuotas.reduce((sum, c) => sum + c.interes, 0);
    const totalAval = cuotas.reduce((sum, c) => sum + c.aval, 0);
    const totalIVA = cuotas.reduce((sum, c) => sum + c.IVA, 0);
    const totalAPagar = cuotas.reduce((sum, c) => sum + c.total_cuota, 0);

    return {
      totalCapital,
      totalInteres,
      totalAval,
      totalIVA,
      totalAPagar,
      numeroCuotas: cuotas.length,
    };
  }
}
