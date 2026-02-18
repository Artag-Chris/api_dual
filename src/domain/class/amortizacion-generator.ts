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
  residual_historial?: number;  // ✅ Residual from payment history (optional override)
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
      residual_historial = null,  // ✅ Residual from payment history
    } = params;

    // ✅ DEBUG: Log residual_historial value
    this.logger.info(
      `[GENERARAMORTIZACION] residual_historial = ${residual_historial} ` +
      `(type: ${typeof residual_historial})`
    );

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
    let saldoAcumulado = 0;  // ✅ Track cumulative capital to detect residuals

    for (let i = 0; i < numero_cuotas; i++) {
      const numeroCuota = i + 1;
      const esUltimaCuota = i === numero_cuotas - 1;

      // ✅ ADJUST SALDO FOR LAST CUOTA WITH RESIDUAL BEFORE CALCULATING INTEREST
      // This ensures interest is calculated on the correct remaining balance
      if (esUltimaCuota && residual_historial !== null && residual_historial !== undefined && residual_historial > 0) {
        this.logger.info(
          `[PRE-ADJUST CHECK] Cuota ${numeroCuota}: esUltimaCuota=${esUltimaCuota}, ` +
          `residual_historial=${residual_historial}, residual > 0: ${residual_historial > 0}`
        );
        saldo = residual_historial;
        this.logger.info(
          `[ÚLTIMA CUOTA PRE-CALC] ${numeroCuota}: Saldo pre-ajustado a residual=$${saldo} antes de calcular interés`
        );
      } else {
        if (esUltimaCuota) {
          this.logger.info(
            `[PRE-ADJUST CHECK] Cuota ${numeroCuota}: esUltimaCuota=${esUltimaCuota}, ` +
            `residual_historial=${residual_historial} (type:${typeof residual_historial}), NO pre-adjustment applies`
          );
        }
      }

      // ✅ Calculate THEORETICAL interest (NEVER adjustable - derived from saldo × tasa)
      // This ensures interés ALWAYS remains positive
      const interesTeorico = saldo * tasaPeriodica;

      // ✅ FIRST CUOTA: Set fixed cuota total
      if (i === 0) {
        // For first cuota: calculate expected capital without cargos
        let capitalAproximado: number;
        if (esUltimaCuota) {
          capitalAproximado = saldo;
        } else {
          capitalAproximado = cuotaFija - interesTeorico;
        }

        // Sum all components with exact decimals
        const sumaComponentes = capitalAproximado + interesTeorico + avalExacto + ivaExacto + 
                               pablokExacto + seguroExacto;
        // Round only the total cuota to 100
        cuotaTotalFija = Math.round(sumaComponentes / 100) * 100;

        this.logger.info(
          `[PRIMERA CUOTA] Componentes exactos: Capital Aprox=$${capitalAproximado.toFixed(2)}, ` +
          `Interés=$${interesTeorico.toFixed(2)}, Total sin redondear=$${sumaComponentes.toFixed(2)}, ` +
          `Total redondeado=$${cuotaTotalFija}`
        );
      }

      // ✅ Calculate FIXED interest (truncated, NEVER adjusted to avoid negatives)
      // Interés is ALWAYS: saldo × tasaPeriodica, truncated
      const interesTruncado = Math.trunc(interesTeorico);

      // ✅ CRITICAL VALIDATION: Interés can NEVER be negative
      if (interesTruncado < 0) {
        throw new Error(
          `❌ CRÍTICO: Interés NEGATIVO en cuota ${numeroCuota}: $${interesTruncado}. ` +
          `Esto indica un error en el cálculo de tasa. Tasa: ${tasa_mensual}%, Saldo: $${saldo}`
        );
      }

      // ✅ Calculate truncated values for cargos (aval, iva) - NO rounding
      const avalTruncado = Math.trunc(avalExacto);
      const ivaTruncado = Math.trunc(ivaExacto);

      // ✅ Calculate ADJUSTABLE capital (this absorbs all rounding differences)
      // Capital = Cuota Total Fija - Interés - Cargos (fijos)
      // This ensures: capital + interes + cargos = cuota total exactly
      let capitalAjustado = cuotaTotalFija! - interesTruncado - avalTruncado - ivaTruncado - pablokExacto - seguroExacto;

      // ✅ CRITICAL FIX: Ensure capital NEVER exceeds remaining balance
      // This prevents saldo from becoming negative which would cause negative interest
      if (capitalAjustado > saldo) {
        this.logger.warn(
          `[Cuota ${numeroCuota}] Capital calculado ($${capitalAjustado}) excede saldo ($${saldo}). ` +
          `Limitando a saldo exacto para prevenir saldo negativo.`
        );
        capitalAjustado = Math.max(0, saldo);
      }

      // ✅ For LAST CUOTA: calculate residual and ensure it's not zero
      if (esUltimaCuota) {
        // ✅ PRIORITY 1: Use residual from payment history if available
        // NOTE: residual_historial is the REMAINING BALANCE, not capital to subtract
        if (residual_historial !== null && residual_historial !== undefined && residual_historial > 0) {
          // Set saldo to residual BEFORE calculating capital
          // This way, capital will be the remaining balance
          capitalAjustado = Math.max(0, saldo);  // Pay what's left in current saldo
          this.logger.info(
            `[ÚLTIMA CUOTA] ${numeroCuota}: ✅ Historial tiene residual=$${residual_historial}. ` +
            `Capital actual=$${capitalAjustado}, Saldo will become=$${residual_historial}`
          );
        } else {
          // PRIORITY 2: Calculate residual from accumulated truncation
          const capitalResidual = valor_prestamo - saldoAcumulado;
          
          if (capitalResidual <= 0) {
            // All capital was paid in previous cuotas
            capitalAjustado = 0;
            this.logger.warn(
              `[ÚLTIMA CUOTA] ${numeroCuota}: Residual ≤ 0 ($${capitalResidual}). ` +
              `Todas las cuotas anteriores pagaron la deuda exactamente.`
            );
          } else {
            // Use the residual (ensures last cuota is never $0)
            capitalAjustado = capitalResidual;
            this.logger.info(
              `[ÚLTIMA CUOTA] ${numeroCuota}: Usando residual CALCULADO=$${capitalAjustado} ` +
              `(suma anterior: $${saldoAcumulado}, total esperado: $${valor_prestamo})`
            );
          }
        }
      }

      // ✅ VALIDATION: Capital should NEVER be negative
      if (capitalAjustado < 0) {
        throw new Error(
          `❌ CRÍTICO: Capital NEGATIVO en cuota ${numeroCuota}: $${capitalAjustado}. ` +
          `Cuota fija ($${cuotaTotalFija}) es muy pequeña para cubrir interés + cargos. ` +
          `Aumentar cuota fija o reducir tasa/cargos.`
        );
      }

      const capitalTruncado = Math.trunc(Math.max(0, capitalAjustado));

      // ✅ Track cumulative capital for residual calculation in last cuota
      saldoAcumulado += capitalTruncado;

      // ✅ Update saldo with TRUNCATED capital (normal flow)
      // For last cuota with residual, saldo was already pre-adjusted at loop start
      // so we can subtract capital normally
      saldo -= capitalTruncado;

      // ✅ CRITICAL VALIDATION: Saldo should NEVER be negative (except rounding at end)
      if (saldo < -1) {  // Allow -1 for tiny rounding errors
        throw new Error(
          `❌ CRÍTICO: Saldo NEGATIVO en cuota ${numeroCuota}: $${saldo}. ` +
          `Esto indica que el capital acumulado excede el préstamo inicial. ` +
          `Revisar parámetros de entrada o cálculo de cuota fija.`
        );
      }

      // Normalize small negative saldo to 0
      saldo = Math.max(0, saldo);

      // ✅ Determine estado
      const estado: 'PAGADO' | 'PENDIENTE' | 'VENCIDO' = 
        numeroCuota <= cuotasPagadas ? 'PAGADO' : 'PENDIENTE';

      // ✅ Calculate remaining balance
      const saldoRestante = Math.max(0, saldo);

      // ✅ For last cuota: use exact capitalAjustado (residual), not truncated
      // This ensures last cuota is NEVER $0
      const capitalFinal = esUltimaCuota ? Math.max(0, capitalAjustado) : capitalTruncado;

      // ✅ Final cuota total (use cuotaTotalFija for regular cuotas, recalculate for last)
      const cuotaTotalFinal = esUltimaCuota 
        ? capitalFinal + interesTruncado + avalTruncado + ivaTruncado + pablokExacto + seguroExacto
        : cuotaTotalFija!;

      // ✅ Create amortizacion DTO
      const [error, amortizacionDto] = AmortizacionCreateDto.create({
        prestamo_ID,
        numero_cuota: numeroCuota,
        capital: capitalFinal,
        interes: interesTruncado,  // ✅ NUNCA NEGATIVO: derivado de saldo × tasa
        aval: avalTruncado,
        IVA: ivaTruncado,
        total_cuota: cuotaTotalFinal,
        saldo: saldoRestante,
        fecha_pago: fechaPago,
        estado,
      });

      if (error || !amortizacionDto) {
        this.logger.error(`Error creating amortizacion for cuota ${numeroCuota}: ${error}`);
        continue;
      }

      // ✅ TRIPLE VALIDATION before pushing
      if (amortizacionDto.interes < 0) {
        throw new Error(
          `❌ Validación: Interés NEGATIVO detectado en cuota ${numeroCuota}: $${amortizacionDto.interes}`
        );
      }
      if (amortizacionDto.capital < 0) {
        throw new Error(
          `❌ Validación: Capital NEGATIVO detectado en cuota ${numeroCuota}: $${amortizacionDto.capital}`
        );
      }
      
      // ✅ CRITICAL: Last cuota should NEVER have $0 total
      if (esUltimaCuota && amortizacionDto.total_cuota === 0) {
        throw new Error(
          `❌ Validación CRÍTICA: Cuota ${numeroCuota} (ÚLTIMA) tiene total=$0. ` +
          `Esto indica que la deuda fue pagada en cuotas anteriores. ` +
          `Revisar número de cuotas vs monto de prestamo.`
        );
      }

      cuotas.push(amortizacionDto);
      fechaPago = this.calcularSiguienteFechaPago(fechaPago, periocidad);
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 4: FINAL VERIFICATION - GUARANTEE NO NEGATIVE VALUES
    // ════════════════════════════════════════════════════════════════════════

    const sumCapitales = cuotas.reduce((sum, c) => sum + c.capital, 0);
    const diferencialCapital = valor_prestamo - sumCapitales;
    const sumInteres = cuotas.reduce((sum, c) => sum + c.interes, 0);
    const sumAval = cuotas.reduce((sum, c) => sum + c.aval, 0);
    const sumIVA = cuotas.reduce((sum, c) => sum + c.IVA, 0);
    const sumTotal = cuotas.reduce((sum, c) => sum + c.total_cuota, 0);

    // ✅ CRITICAL VALIDATION: Check for negative interest or capital
    for (let idx = 0; idx < cuotas.length; idx++) {
      const cuota = cuotas[idx];
      const esUltima = idx === cuotas.length - 1;
      
      if (cuota.interes < 0) {
        this.logger.error(
          `❌ CRÍTICO: Cuota ${cuota.numero_cuota} tiene INTERÉS NEGATIVO: $${cuota.interes}`
        );
        throw new Error(
          `Generación de amortización FALLIDA: Cuota ${cuota.numero_cuota} con interés negativo ($${cuota.interes}). ` +
          `Esto indica que la cuota fija es insuficiente. Aumentar cuota fija o reducir tasa/cargos.`
        );
      }

      if (cuota.capital < 0) {
        this.logger.error(
          `❌ CRÍTICO: Cuota ${cuota.numero_cuota} tiene CAPITAL NEGATIVO: $${cuota.capital}`
        );
        throw new Error(
          `Generación de amortización FALLIDA: Cuota ${cuota.numero_cuota} con capital negativo ($${cuota.capital}).`
        );
      }

      // ✅ CRITICAL: No cuota should have $0 total, especially the last one
      if (cuota.total_cuota === 0) {
        this.logger.error(
          `❌ CRÍTICO: Cuota ${cuota.numero_cuota} tiene total_cuota=$0${esUltima ? ' (ÚLTIMA CUOTA)' : ''}`
        );
        throw new Error(
          `Generación de amortización FALLIDA: Cuota ${cuota.numero_cuota} con total_cuota=$0. ` +
          `${esUltima ? 'La última cuota NUNCA debe ser $0.' : 'Ninguna cuota debe ser $0.'}`
        );
      }
    }

    // ✅ VALIDATION: Sum of interest should be positive
    if (sumInteres < 0) {
      throw new Error(
        `❌ CRÍTICO: Suma total de intereses NEGATIVA: $${sumInteres}. ` +
        `Esto indica un error crítico en el algoritmo.`
      );
    }

    // ⚠️ Report capital difference if any
    if (Math.abs(diferencialCapital) > 0) {
      this.logger.warn(
        `⚠️  Capital mismatch: Expected $${valor_prestamo.toLocaleString()}, ` +
        `Got $${sumCapitales.toLocaleString()}, Difference: $${diferencialCapital}`
      );
    }

    this.logger.info(
      `✅ [GENERACIÓN COMPLETADA] Prestamo ${prestamo_ID}: ${cuotas.length} cuotas\n` +
      `   💰 Capital: $${sumCapitales.toLocaleString()} (esperado: $${valor_prestamo.toLocaleString()})\n` +
      `   📊 Interés: $${sumInteres.toLocaleString()} (mínimo: $0)\n` +
      `   🤝 Aval: $${sumAval.toLocaleString()}\n` +
      `   🧾 IVA: $${sumIVA.toLocaleString()}\n` +
      `   💵 Total: $${sumTotal.toLocaleString()}`
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
