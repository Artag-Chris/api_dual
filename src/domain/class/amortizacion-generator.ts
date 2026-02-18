/**
 * PHASE 11: Amortization Generator
 * Generates COMPLETE amortization schedules for all credits
 * - Generates ALL cuotas (1 to numero_cuotas)
 * - Marks already-paid cuotas with estado='PAGADO'
 * - Marks pending cuotas with estado='PENDIENTE'
 * This ensures payment history can be properly linked to amortization
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
  valor_cuota_fija?: number;
  seguro?: number;        // ✅ Aval (%)
  iva_aval?: number;      // ✅ IVA sobre aval (%)
  seguro_add?: number;    // ✅ Seguro adicional
  pablok?: number;        // ✅ Pablok
}

export class AmortizacionGenerator {
  constructor(private readonly logger: typeof WinstonAdapter) {}

  /**
   * Generates complete amortization schedule using SISTEMA FRANCÉS
   * Matches the exact algorithm from the production backend
   * - Calculates cuotaFija using French formula
   * - Aval & IVA: exact decimals divided per cuota
   * - Capital: truncated (exact)
   * - Interés: adjustable field that absorbs all rounding differences
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
      valor_cuota_fija,
      seguro = 0.1,      // 10% default aval
      iva_aval = 0.19,   // 19% default IVA
      seguro_add = 0,    // Seguro adicional
      pablok = 0,        // Pablok
    } = params;

    // CRITICAL VALIDATION: Interest rate must be > 0
    if (tasa_mensual <= 0) {
      this.logger.error(
        `❌ Tasa de interés inválida (${tasa_mensual}%) para prestamo ${prestamo_ID}.`
      );
      return [];
    }

    // 🔧 ADJUST TASA BY PERIODICIDAD
    const tasaPorPeriodo = this.ajustarTasaPorPeriodicidad(tasa_mensual, periocidad);
    const tasaPeriodica = tasaPorPeriodo / 100;

    // Determine how many cuotas are already paid
    let cuotasPagadas = 0;
    if (datosCreditoActivo && datosCreditoActivo.cuotas_faltantes > 0) {
      cuotasPagadas = numero_cuotas - datosCreditoActivo.cuotas_faltantes;
    }

    this.logger.info(
      `[PRESTAMO ${prestamo_ID}] Generando ${numero_cuotas} cuotas, ` +
      `Tasa período: ${tasaPorPeriodo.toFixed(4)}%, ` +
      `Aval: ${(seguro * 100).toFixed(1)}%, ` +
      `IVA: ${(iva_aval * 100).toFixed(1)}%`
    );

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 1: Calculate EXACT fixed components per cuota
    // ════════════════════════════════════════════════════════════════════════

    // ✅ Aval: EXACT with decimals - divided by number of cuotas
    const avalExacto = (valor_prestamo * seguro) / numero_cuotas;

    // ✅ IVA: EXACT with decimals
    const ivaExacto = avalExacto * iva_aval;

    // ✅ Pablok y Seguro: EXACT values
    const pablokExacto = pablok;
    const seguroExacto = seguro_add;

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 2: Determine cuota fija (from legacy OR calculate)
    // ════════════════════════════════════════════════════════════════════════

    let cuotaFija: number;
    
    if (valor_cuota_fija && valor_cuota_fija > 0) {
      // ✅ USE VALUE FROM LEGACY (most trustworthy source)
      cuotaFija = valor_cuota_fija;
      this.logger.info(
        `[FASE 2] ✅ Using valor_cuota_fija from legacy: $${cuotaFija.toLocaleString()}`
      );
    } else {
      // Calculate using French formula only if no legacy value
      if (Math.abs(tasaPeriodica) < 0.000001) {
        cuotaFija = valor_prestamo / numero_cuotas;
      } else {
        // French formula: cuotaFija = (prestamo * tasa) / (1 - (1 + tasa)^-n)
        cuotaFija = (valor_prestamo * tasaPeriodica) / 
                    (1 - Math.pow(1 + tasaPeriodica, -numero_cuotas));
      }
      this.logger.info(
        `[FASE 2] Calculated cuota francesa: $${cuotaFija.toFixed(2)}`
      );
    }

    this.logger.info(
      `[FASE 1] Cargos exactos por cuota: Aval=$${avalExacto.toFixed(2)}, IVA=$${ivaExacto.toFixed(2)}, ` +
      `Pablok=$${pablokExacto}, Seguro=$${seguroExacto}`
    );

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 3: Generate amortization schedule
    // ════════════════════════════════════════════════════════════════════════

    const cuotas: AmortizacionCreateDto[] = [];
    let saldo = valor_prestamo;
    let fechaPago = new Date(fecha_inicial);
    let cuotaTotalFija: number | null = null;

    for (let i = 0; i < numero_cuotas; i++) {
      const numeroCuota = i + 1;
      const esUltimaCuota = i === numero_cuotas - 1;

      // ✅ Calculate capital: cuotaFija - interés teórico
      let capitalFijo: number;
      if (esUltimaCuota) {
        // Last cuota: pay exactly remaining balance
        capitalFijo = saldo;
      } else {
        // Regular cuota: capital = cuotaFija - interest
        const interesTeorico = saldo * tasaPeriodica;
        capitalFijo = cuotaFija - interesTeorico;
      }

      // ✅ Calculate theoretical interest
      const interesTeorico = saldo * tasaPeriodica;

      // ✅ FIRST CUOTA: Set fixed cuota total
      if (i === 0) {
        // Sum all components with exact decimals
        const sumaComponentes = capitalFijo + interesTeorico + avalExacto + ivaExacto + 
                               pablokExacto + seguroExacto;
        // Round only the total cuota to 100
        cuotaTotalFija = Math.round(sumaComponentes / 100) * 100;

        this.logger.info(
          `[PRIMERA CUOTA] Componentes exactos: Capital=$${capitalFijo.toFixed(2)}, ` +
          `Interés=$${interesTeorico.toFixed(2)}, Total sin redondear=$${sumaComponentes.toFixed(2)}, ` +
          `Total redondeado=$${cuotaTotalFija}`
        );
      }

      // ✅ Calculate truncated values (NO rounding)
      const capitalTruncado = Math.trunc(capitalFijo);
      const avalTruncado = Math.trunc(avalExacto);
      const ivaTruncado = Math.trunc(ivaExacto);

      // ✅ Calculate decimals lost
      const decimalesCapital = capitalFijo - capitalTruncado;
      const decimalesAval = avalExacto - avalTruncado;
      const decimalesIva = ivaExacto - ivaTruncado;

      // ✅ Adjust interest to absorb ALL rounding differences
      // Sum of truncated values
      const sumaTruncada = capitalTruncado + Math.trunc(interesTeorico) + 
                          avalTruncado + ivaTruncado + pablokExacto + seguroExacto;
      const diferenciaFinal = cuotaTotalFija! - sumaTruncada;

      // Interest with compensation
      const interesConCompensacion = Math.trunc(interesTeorico) + Math.round(diferenciaFinal);

      // ✅ Update saldo with TRUNCATED capital (this ensures last cuota is exact)
      saldo -= capitalTruncado;

      // ✅ Determine estado
      const estado: 'PAGADO' | 'PENDIENTE' | 'VENCIDO' = 
        numeroCuota <= cuotasPagadas ? 'PAGADO' : 'PENDIENTE';

      // ✅ Calculate remaining balance
      const saldoRestante = Math.max(0, saldo);

      // ✅ Create amortizacion DTO
      const [error, amortizacionDto] = AmortizacionCreateDto.create({
        prestamo_ID,
        numero_cuota: numeroCuota,
        capital: capitalTruncado,
        interes: interesConCompensacion,
        aval: avalTruncado,
        IVA: ivaTruncado,
        total_cuota: cuotaTotalFija!,
        saldo: saldoRestante,
        fecha_pago: fechaPago,
        estado,
      });

      if (error || !amortizacionDto) {
        this.logger.error(`Error creating amortizacion for cuota ${numeroCuota}: ${error}`);
        continue;
      }

      cuotas.push(amortizacionDto);
      fechaPago = this.calcularSiguienteFechaPago(fechaPago, periocidad);
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 4: FINAL VERIFICATION
    // ════════════════════════════════════════════════════════════════════════

    const sumCapitales = cuotas.reduce((sum, c) => sum + c.capital, 0);
    const diferencialCapital = valor_prestamo - sumCapitales;

    if (Math.abs(diferencialCapital) > 0) {
      this.logger.warn(
        `⚠️  Capital mismatch: Expected $${valor_prestamo.toLocaleString()}, ` +
        `Got $${sumCapitales.toLocaleString()}, Difference: $${diferencialCapital}`
      );
      // Note: The algorithm should prevent this with proper truncation and interest adjustment
    }

    const sumInteres = cuotas.reduce((sum, c) => sum + c.interes, 0);
    const sumAval = cuotas.reduce((sum, c) => sum + c.aval, 0);
    const sumIVA = cuotas.reduce((sum, c) => sum + c.IVA, 0);
    const sumTotal = cuotas.reduce((sum, c) => sum + c.total_cuota, 0);

    this.logger.info(
      `✅ [GENERACIÓN COMPLETADA] Prestamo ${prestamo_ID}: ${cuotas.length} cuotas, ` +
      `Capital: $${sumCapitales.toLocaleString()}, Interés: $${sumInteres.toLocaleString()}, ` +
      `Total: $${sumTotal.toLocaleString()}`
    );

    return cuotas;
  }

  /**
   * Ajusta la tasa mensual según la periodicidad del crédito
   * La tasa viene en formato MENSUAL pero debe aplicarse según el período de las cuotas
   * 
   * @param tasa_mensual - Tasa de interés mensual (%)
   * @param periocidad - Periodicidad del crédito (SEMANAL, QUINCENAL, MENSUAL)
   * @returns Tasa ajustada al período de pago
   */
  private ajustarTasaPorPeriodicidad(tasa_mensual: number, periocidad: string): number {
    const periodicidadNorm = periocidad.toUpperCase();
    
    switch (periodicidadNorm) {
      case 'SEMANAL':
        // Un mes tiene ~4.33 semanas
        // Tasa semanal = tasa mensual / 4.33
        return tasa_mensual / 4.33;
        
      case 'QUINCENAL':
      case 'DECADAL':
        // Un mes tiene 2 quincenas
        // Tasa quincenal = tasa mensual / 2
        return tasa_mensual / 2;
        
      case 'MENSUAL':
        // Tasa mensual se usa directamente
        return tasa_mensual;
        
      default:
        // Default: asumir mensual
        console.warn(
          `[AMORTIZACION] Periodicidad desconocida: ${periocidad}. Usando tasa mensual directamente.`
        );
        return tasa_mensual;
    }
  }

  /**
   * Calculates next payment date based on periodicity
   */
  private calcularSiguienteFechaPago(fechaActual: Date, periocidad: string): Date {
    const siguienteFecha = new Date(fechaActual);

    // ✅ Normalizar a MAYÚSCULAS para comparación correcta
    const periodicidadNorm = periocidad.toUpperCase();

    switch (periodicidadNorm) {
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
