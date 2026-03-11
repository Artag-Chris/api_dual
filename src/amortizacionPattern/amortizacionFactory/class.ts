/**
 * FASE 1: Factory de Amortización
 * 
 * Identifica el TIPO de crédito y crea la amortización base.
 * LÓGICA PURA: Solo lee datos y retorna resultado. NO hace INSERT/UPDATE.
 * 
 * Decisión en cascada:
 *   1. ¿CANCELADO? → AmortizacionCanceladaStrategy
 *   2. Calcular capital_distribuido y excedente
 *   3. ¿cta_aval/cta_iva_aval null/0 Y excedente > 0? → AmortizacionAlternativaStrategy (porcentajes)
 *   4. ¿CAPITAL_PURO? (excedente < 1000) → AmortizacionCapitalPuroStrategy
 *   5. ¿DEFICIT_AVAL? (excedente < cta_aval + cta_iva_aval) → AmortizacionDeficitAvalStrategy
 *   6. Default → AmortizacionSimpleStrategy
 */

import {
  TipoAmortizacion,
  RefinanciamientoItem,
  RefinanciamientoParams,
  InfoCreditoData,
  ResultadoFactory,
} from '../interfaces';

// ═══════════════════════════════════════════════════════════════
// INTERFACE STRATEGY
// ═══════════════════════════════════════════════════════════════

interface IAmortizacionStrategy {
  execute(params: RefinanciamientoParams): RefinanciamientoItem[];
}

// ═══════════════════════════════════════════════════════════════
// UTILIDADES DE FECHA (extraídas del monolito)
// ═══════════════════════════════════════════════════════════════

class FechaUtils {
  /**
   * Obtiene la fecha actual en Colombia (UTC-5)
   */
  static getFechaColombia(): Date {
    const ahora = new Date();
    const offset = ahora.getTimezoneOffset();
    const colombiaOffset = -5 * 60;
    const difMs = (colombiaOffset - offset) * 60 * 1000;
    return new Date(ahora.getTime() + difMs);
  }

  /**
   * Calcula la fecha del primer pago según periodicidad y días de pago
   */
  static calcularFechaPrimerPago(
    fechaCreacion: Date,
    periocidad: 'mensual' | 'quincenal',
    diasPago: number[]
  ): Date {
    const fechaBase = new Date(fechaCreacion);

    if (periocidad === 'quincenal') {
      const rangoFin = new Date(fechaBase);
      rangoFin.setDate(rangoFin.getDate() + 7);

      const primerDiaPago = diasPago[0];
      const segundoDiaPago = diasPago[1];

      let fechaPrimeraOpcion = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), primerDiaPago);
      if (fechaPrimeraOpcion < fechaBase) {
        fechaPrimeraOpcion = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + 1, primerDiaPago);
      }

      if (fechaPrimeraOpcion >= fechaBase && fechaPrimeraOpcion <= rangoFin) {
        return new Date(fechaBase.getFullYear(), fechaBase.getMonth() + 1, segundoDiaPago);
      } else {
        let fechaAlternativa = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), segundoDiaPago);
        if (fechaAlternativa < fechaBase) {
          fechaAlternativa = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + 1, segundoDiaPago);
        }
        return fechaAlternativa;
      }
    } else {
      const rangoFin = new Date(fechaBase);
      rangoFin.setDate(rangoFin.getDate() + 14);

      const diaPago = diasPago[0];
      let fechaPrimeraOpcion = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), diaPago);
      if (fechaPrimeraOpcion < fechaBase) {
        fechaPrimeraOpcion = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + 1, diaPago);
      }

      if (fechaPrimeraOpcion >= fechaBase && fechaPrimeraOpcion <= rangoFin) {
        return new Date(rangoFin.getFullYear(), rangoFin.getMonth() + 1, diaPago);
      } else {
        return fechaPrimeraOpcion;
      }
    }
  }

  /**
   * Calcula la siguiente fecha de pago alternando entre diasPago[0] y diasPago[1]
   */
  static calcularSiguienteFechaPago(
    fechaBase: Date,
    periocidad: 'mensual' | 'quincenal',
    cuotaIndex: number,
    diasPago: number[] = []
  ): Date {
    if (cuotaIndex === 0) return new Date(fechaBase);

    if (periocidad === 'quincenal') {
      const diaAnterior = fechaBase.getDate();
      const diaSeleccionado = diaAnterior === diasPago[0] ? diasPago[1] : diasPago[0];
      const proximaFecha = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + 1, diaSeleccionado);
      return this.ajustarFechaFebrero(proximaFecha);
    } else {
      const diaSeleccionado = diasPago[0] || 1;
      const proximaFecha = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + 1, diaSeleccionado);
      return this.ajustarFechaFebrero(proximaFecha);
    }
  }

  /**
   * Si la fecha cae en febrero 29 o 30, pasa a 1 de marzo
   */
  static ajustarFechaFebrero(fecha: Date): Date {
    if (fecha.getMonth() === 1 && fecha.getDate() >= 29) {
      return new Date(fecha.getFullYear(), 2, 1);
    }
    return fecha;
  }
}

// ═══════════════════════════════════════════════════════════════
// STRATEGIES DE AMORTIZACIÓN (Fase 1)
// ═══════════════════════════════════════════════════════════════

/**
 * CASO 1: CANCELADO
 * estado IN ('CANCELADO', 'CANCELADO_REFINANCIAMIENTO', 'Cancelado', 'Cancelado por refinanciacion')
 * Genera todas las cuotas con valores = 0
 */
class AmortizacionCanceladaStrategy implements IAmortizacionStrategy {
  execute(params: RefinanciamientoParams): RefinanciamientoItem[] {
    const { cantidadMeses, documento, prestamoId, periocidad } = params;
    const numeroCuotas = periocidad === 'quincenal' ? cantidadMeses * 2 : cantidadMeses;
    const amortizacion: RefinanciamientoItem[] = [];

    for (let i = 0; i < numeroCuotas; i++) {
      amortizacion.push({
        prestamoId,
        documento,
        numeroCuota: i + 1,
        capitalEnMora: 0,
        capital: 0,
        interes: 0,
        aval: 0,
        iva: 0,
        cuotaTotal: 0,
        saldo: 0,
        fechaPago: new Date().toISOString().split('T')[0],
      });
    }

    return amortizacion;
  }
}

/**
 * CASO 2: CAPITAL PURO
 * capital_distribuido ≈ valor_cuota (excedente < 1000)
 * Solo capital, sin aval/iva/interes
 */
class AmortizacionCapitalPuroStrategy implements IAmortizacionStrategy {
  execute(params: RefinanciamientoParams): RefinanciamientoItem[] {
    const {
      capitalEnMora, cantidadMeses, periocidad, valorCuotaAcordada,
      documento, prestamoId, fechaPrimerPago = FechaUtils.getFechaColombia(),
      diasPago = periocidad === 'quincenal' ? [5, 20] : [1],
    } = params;

    const numeroCuotas = periocidad === 'quincenal' ? cantidadMeses * 2 : cantidadMeses;
    const capitalPorCuota = Math.floor(capitalEnMora / numeroCuotas);
    const residuoCapital = capitalEnMora % numeroCuotas;
    const capitalUltimaCuota = capitalPorCuota + residuoCapital;

    const amortizacion: RefinanciamientoItem[] = [];
    let saldoPendiente = capitalEnMora;
    let fechaAnterior = fechaPrimerPago;

    for (let i = 0; i < numeroCuotas; i++) {
      const esUltimaCuota = i === numeroCuotas - 1;
      const capitalCuota = esUltimaCuota ? capitalUltimaCuota : capitalPorCuota;

      saldoPendiente -= capitalCuota;
      saldoPendiente = Math.max(0, saldoPendiente);

      const fechaCuota = i === 0
        ? fechaPrimerPago
        : FechaUtils.calcularSiguienteFechaPago(fechaAnterior, periocidad, i, diasPago);
      fechaAnterior = fechaCuota;

      amortizacion.push({
        prestamoId,
        documento,
        numeroCuota: i + 1,
        capitalEnMora,
        capital: capitalCuota,
        interes: 0,
        aval: 0,
        iva: 0,
        cuotaTotal: capitalCuota,
        saldo: saldoPendiente,
        fechaPago: fechaCuota.toISOString().split('T')[0],
      });
    }

    return amortizacion;
  }
}

/**
 * CASO 3: SIMPLE (La Mayoría)
 * excedente >= (cta_aval + cta_iva_aval)
 * capital + aval fijo + iva fijo + interes = excedente - aval - iva
 */
class AmortizacionSimpleStrategy implements IAmortizacionStrategy {
  execute(params: RefinanciamientoParams): RefinanciamientoItem[] {
    const {
      capitalEnMora, cantidadMeses, periocidad, valorCuotaAcordada,
      documento, prestamoId, fechaPrimerPago = FechaUtils.getFechaColombia(),
      cta_aval = 0, cta_iva_aval = 0,
      diasPago = periocidad === 'quincenal' ? [5, 20] : [1],
    } = params;

    const numeroCuotas = periocidad === 'quincenal' ? cantidadMeses * 2 : cantidadMeses;
    const capitalPorCuota = Math.floor(capitalEnMora / numeroCuotas);
    const residuoCapital = capitalEnMora % numeroCuotas;
    const capitalUltimaCuota = capitalPorCuota + residuoCapital;

    const excedentePorCuota = valorCuotaAcordada - capitalPorCuota;
    const avalPorCuota = cta_aval;
    const ivaPorCuota = cta_iva_aval;
    const interesPorCuota = excedentePorCuota - avalPorCuota - ivaPorCuota;

    const amortizacion: RefinanciamientoItem[] = [];
    let saldoPendiente = capitalEnMora;
    let fechaAnterior = fechaPrimerPago;

    for (let i = 0; i < numeroCuotas; i++) {
      const esUltimaCuota = i === numeroCuotas - 1;
      const capitalCuota = esUltimaCuota ? capitalUltimaCuota : capitalPorCuota;

      saldoPendiente -= capitalCuota;
      saldoPendiente = Math.max(0, saldoPendiente);

      const fechaCuota = i === 0
        ? fechaPrimerPago
        : FechaUtils.calcularSiguienteFechaPago(fechaAnterior, periocidad, i, diasPago);
      fechaAnterior = fechaCuota;

      amortizacion.push({
        prestamoId,
        documento,
        numeroCuota: i + 1,
        capitalEnMora,
        capital: capitalCuota,
        interes: interesPorCuota,
        aval: avalPorCuota,
        iva: ivaPorCuota,
        cuotaTotal: capitalCuota + interesPorCuota + avalPorCuota + ivaPorCuota,
        saldo: saldoPendiente,
        fechaPago: fechaCuota.toISOString().split('T')[0],
      });
    }

    return amortizacion;
  }
}

/**
 * CASO 4: DEFICIT DE AVAL
 * excedente < (cta_aval + cta_iva_aval)
 * aval = round(excedente / 1.19, -1) (redondeado a decena)
 * iva = excedente - aval
 * interes = 0
 */
class AmortizacionDeficitAvalStrategy implements IAmortizacionStrategy {
  execute(params: RefinanciamientoParams): RefinanciamientoItem[] {
    const {
      capitalEnMora, cantidadMeses, periocidad, valorCuotaAcordada,
      documento, prestamoId, fechaPrimerPago = FechaUtils.getFechaColombia(),
      diasPago = periocidad === 'quincenal' ? [5, 20] : [1],
    } = params;

    const numeroCuotas = periocidad === 'quincenal' ? cantidadMeses * 2 : cantidadMeses;
    const capitalPorCuota = Math.floor(capitalEnMora / numeroCuotas);
    const residuoCapital = capitalEnMora % numeroCuotas;
    const capitalUltimaCuota = capitalPorCuota + residuoCapital;

    const excedentePorCuota = valorCuotaAcordada - capitalPorCuota;

    // DEFICIT_AVAL: aval = round(excedente / 1.19, -1), iva = excedente - aval
    const avalPorCuota = Math.round((excedentePorCuota / 1.19) / 10) * 10;
    const ivaPorCuota = excedentePorCuota - avalPorCuota;
    const interesPorCuota = 0;

    const amortizacion: RefinanciamientoItem[] = [];
    let saldoPendiente = capitalEnMora;
    let fechaAnterior = fechaPrimerPago;

    for (let i = 0; i < numeroCuotas; i++) {
      const esUltimaCuota = i === numeroCuotas - 1;
      const capitalCuota = esUltimaCuota ? capitalUltimaCuota : capitalPorCuota;

      saldoPendiente -= capitalCuota;
      saldoPendiente = Math.max(0, saldoPendiente);

      const fechaCuota = i === 0
        ? fechaPrimerPago
        : FechaUtils.calcularSiguienteFechaPago(fechaAnterior, periocidad, i, diasPago);
      fechaAnterior = fechaCuota;

      amortizacion.push({
        prestamoId,
        documento,
        numeroCuota: i + 1,
        capitalEnMora,
        capital: capitalCuota,
        interes: interesPorCuota,
        aval: avalPorCuota,
        iva: ivaPorCuota,
        cuotaTotal: capitalCuota + interesPorCuota + avalPorCuota + ivaPorCuota,
        saldo: saldoPendiente,
        fechaPago: fechaCuota.toISOString().split('T')[0],
      });
    }

    return amortizacion;
  }
}

/**
 * CASO 5: ALTERNATIVA (cta_aval y cta_iva_aval son null/0/undefined)
 * Distribuye excedente por porcentajes:
 *   - 60% → aval
 *   - 10% → iva
 *   - 30% → interés
 * 
 * Se usa cuando NO hay datos de aval del precredito pero SÍ hay excedente.
 * Ejemplo: valor_cuota=49700, capital=48750 → excedente=950
 *   aval = round(950*0.6) = 570
 *   iva  = round(950*0.1) = 95
 *   int  = 950 - 570 - 95 = 285
 *   cuotaTotal = 48750 + 570 + 95 + 285 = 49700 ✓
 */
class AmortizacionAlternativaStrategy implements IAmortizacionStrategy {
  execute(params: RefinanciamientoParams): RefinanciamientoItem[] {
    const {
      capitalEnMora, cantidadMeses, periocidad, valorCuotaAcordada,
      documento, prestamoId, fechaPrimerPago = FechaUtils.getFechaColombia(),
      diasPago = periocidad === 'quincenal' ? [5, 20] : [1],
    } = params;

    const numeroCuotas = periocidad === 'quincenal' ? cantidadMeses * 2 : cantidadMeses;
    const capitalPorCuota = (capitalEnMora / numeroCuotas);
    const excedente = valorCuotaAcordada - capitalPorCuota;

    // Distribución por porcentajes
    const avalPorCuota = (excedente * 0.60);
    const ivaPorCuota = (excedente * 0.10);
    const interesPorCuota = excedente - avalPorCuota - ivaPorCuota; // Residuo va a interés

    const amortizacion: RefinanciamientoItem[] = [];
    let saldoPendiente = capitalEnMora;
    let fechaAnterior = fechaPrimerPago;

    for (let i = 0; i < numeroCuotas; i++) {
      const esUltimaCuota = i === numeroCuotas - 1;
      const capitalCuota = esUltimaCuota
        ? saldoPendiente // Última cuota: saldo restante exacto
        : capitalPorCuota;

      saldoPendiente -= capitalCuota;
      saldoPendiente = Math.max(0, saldoPendiente);

      const fechaCuota = i === 0
        ? fechaPrimerPago
        : FechaUtils.calcularSiguienteFechaPago(fechaAnterior, periocidad, i, diasPago);
      fechaAnterior = fechaCuota;

      amortizacion.push({
        prestamoId,
        documento,
        numeroCuota: i + 1,
        capitalEnMora,
        capital: capitalCuota,
        interes: interesPorCuota,
        aval: avalPorCuota,
        iva: ivaPorCuota,
        cuotaTotal: capitalCuota + interesPorCuota + avalPorCuota + ivaPorCuota,
        saldo: saldoPendiente,
        fechaPago: fechaCuota.toISOString().split('T')[0],
      });
    }

    return amortizacion;
  }
}

// ═══════════════════════════════════════════════════════════════
// FACTORY PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export class AmortizacionFactory {

  // ─── Strategies ────────────────────────────────────────────
  private static readonly strategies: Record<TipoAmortizacion, IAmortizacionStrategy> = {
    [TipoAmortizacion.CANCELADO]: new AmortizacionCanceladaStrategy(),
    [TipoAmortizacion.CAPITAL_PURO]: new AmortizacionCapitalPuroStrategy(),
    [TipoAmortizacion.SIMPLE]: new AmortizacionSimpleStrategy(),
    [TipoAmortizacion.DEFICIT_AVAL]: new AmortizacionDeficitAvalStrategy(),
    [TipoAmortizacion.ALTERNATIVA]: new AmortizacionAlternativaStrategy(),
  };

  // ─── Identificar tipo de amortización (decisión en cascada) ──
  /**
   * Identifica el tipo de amortización a partir de la info del crédito.
   * 
   * PASO 1: ¿CANCELADO?
   * PASO 2: Calcular capital_distribuido y excedente
   * PASO 3: ¿cta_aval y cta_iva_aval son null/0? Y excedente > 0? → ALTERNATIVA (porcentajes)
   * PASO 4: ¿CAPITAL_PURO? (excedente < 1000)
   * PASO 5: ¿DEFICIT_AVAL? (excedente < cta_aval + cta_iva_aval)
   * PASO 6: Default → SIMPLE
   */
  static identificarTipo(infoCredito: InfoCreditoData): TipoAmortizacion {
    // PASO 1: ¿Cancelado?
    const estadoNormalizado = String(infoCredito.estado || '').toUpperCase().trim();
    if (
      estadoNormalizado === 'CANCELADO' ||
      estadoNormalizado === 'CANCELADO_REFINANCIAMIENTO' ||
      estadoNormalizado === 'CANCELADO POR REFINANCIACION'
    ) {
      return TipoAmortizacion.CANCELADO;
    }

    // PASO 2: Calcular capital_distribuido y excedente
    const periocidadNorm = String(infoCredito.periodicidad).toLowerCase();
    const numeroCuotas = periocidadNorm === 'quincenal'
      ? Number(infoCredito.cantidad_meses) * 2
      : Number(infoCredito.cantidad_meses);
    const capitalDistribuido = Math.floor(Number(infoCredito.valor_prestamo) / numeroCuotas);
    const excedente = Number(infoCredito.valor_cuota) - capitalDistribuido;

    // PASO 3: ¿cta_aval y cta_iva_aval son ambos null/undefined/0?
    // Si NO tienen valores de aval Y hay excedente → ALTERNATIVA (distribuir por porcentajes)
    // Esto replica el `calcularAmortizacionAlternativa` original que se usaba cuando
    // NO existían cta_aval y cta_iva_aval en la tabla amortizaciones.
    const ctaAval = Number(infoCredito.cta_aval) || 0;
    const ctaIvaAval = Number(infoCredito.cta_iva_aval) || 0;
    const sinDatosAval = (ctaAval === 0 && ctaIvaAval === 0);

    if (sinDatosAval && excedente > 0) {
      return TipoAmortizacion.ALTERNATIVA;
    }

    // PASO 4: ¿Capital Puro? (excedente menor a 1000 = margen de redondeo)
    // Solo aplica cuando SÍ hay datos de aval (si no, se fue por ALTERNATIVA arriba)
    if (Math.abs(excedente) < 1000) {
      return TipoAmortizacion.CAPITAL_PURO;
    }

    // PASO 5: ¿Deficit de Aval? (excedente < suma aval + iva)
    const sumaAvalIva = ctaAval + ctaIvaAval;
    if (excedente < sumaAvalIva) {
      return TipoAmortizacion.DEFICIT_AVAL;
    }

    // PASO 6: Default → SIMPLE
    return TipoAmortizacion.SIMPLE;
  }

  // ─── Validar precondiciones ──────────────────────────────────
  static validarPrecondiciones(infoCredito: Partial<InfoCreditoData>): { valido: boolean; errores: string[] } {
    const errores: string[] = [];

    if (!infoCredito.documento || typeof infoCredito.documento !== 'string') {
      errores.push('Documento inválido o ausente');
    }
    if (!infoCredito.credito_id || infoCredito.credito_id <= 0) {
      errores.push('ID del crédito inválido');
    }
    if (!infoCredito.valor_prestamo || infoCredito.valor_prestamo <= 0) {
      errores.push('Valor del préstamo inválido');
    }
    if (!infoCredito.valor_cuota || infoCredito.valor_cuota <= 0) {
      errores.push('Valor de la cuota inválido');
    }
    if (!infoCredito.periodicidad) {
      errores.push('Periodicidad ausente');
    } else {
      const periodoNormalizado = String(infoCredito.periodicidad).toLowerCase();
      if (!['mensual', 'quincenal'].includes(periodoNormalizado)) {
        errores.push('Periodicidad inválida. Debe ser "Mensual" o "Quincenal"');
      }
    }
    if (!infoCredito.cantidad_meses || infoCredito.cantidad_meses <= 0) {
      errores.push('Cantidad de meses inválida');
    }
    if (!infoCredito.fecha_creacion) {
      errores.push('Fecha de creación ausente');
    }

    return { valido: errores.length === 0, errores };
  }

  // ─── Normalizar InfoCredito ──────────────────────────────────
  static normalizarInfoCredito(infoCredito: InfoCreditoData): InfoCreditoData {
    return {
      ...infoCredito,
      periodicidad: String(infoCredito.periodicidad).toLowerCase() === 'mensual' ? 'mensual' : 'quincenal',
      valor_prestamo: Number(infoCredito.valor_prestamo),
      valor_cuota: Number(infoCredito.valor_cuota),
      cantidad_meses: Number(infoCredito.cantidad_meses),
      numero_cuotas: infoCredito.numero_cuotas ? Number(infoCredito.numero_cuotas) : undefined,
      credito_id: Number(infoCredito.credito_id),
      cuotas_faltantes: Number(infoCredito.cuotas_faltantes),
      documento: String(infoCredito.documento),
      fecha_pago1: infoCredito.fecha_pago1 ? Number(infoCredito.fecha_pago1) : undefined,
      fecha_pago2: infoCredito.fecha_pago2 ? Number(infoCredito.fecha_pago2) : undefined,
      cta_aval: infoCredito.cta_aval ? Number(infoCredito.cta_aval) : undefined,
      cta_iva_aval: infoCredito.cta_iva_aval ? Number(infoCredito.cta_iva_aval) : undefined,
      fecha_creacion: typeof infoCredito.fecha_creacion === 'string'
        ? new Date(infoCredito.fecha_creacion)
        : infoCredito.fecha_creacion,
    };
  }

  // ─── Construir parámetros de refinanciamiento ─────────────────
  private static crearParametros(infoCredito: InfoCreditoData): RefinanciamientoParams {
    const periocidad = (String(infoCredito.periodicidad).toLowerCase() === 'mensual' ? 'mensual' : 'quincenal') as 'mensual' | 'quincenal';

    const diasPago: number[] = [];
    if (periocidad === 'quincenal') {
      if (infoCredito.fecha_pago1) diasPago.push(Number(infoCredito.fecha_pago1));
      if (infoCredito.fecha_pago2) diasPago.push(Number(infoCredito.fecha_pago2));
    } else {
      if (infoCredito.fecha_pago1) diasPago.push(Number(infoCredito.fecha_pago1));
    }

    const fechaPrimerPago = diasPago.length > 0
      ? FechaUtils.calcularFechaPrimerPago(new Date(infoCredito.fecha_creacion), periocidad, diasPago)
      : new Date(infoCredito.fecha_creacion);

    return {
      capitalEnMora: Number(infoCredito.valor_prestamo),
      cantidadMeses: Number(infoCredito.cantidad_meses),
      periocidad,
      valorCuotaAcordada: Number(infoCredito.valor_cuota),
      documento: String(infoCredito.documento),
      prestamoId: Number(infoCredito.credito_id),
      iva_aval: 19,
      fechaPrimerPago,
      cta_aval: infoCredito.cta_aval ? Number(infoCredito.cta_aval) : 0,
      cta_iva_aval: infoCredito.cta_iva_aval ? Number(infoCredito.cta_iva_aval) : 0,
      diasPago,
    };
  }

  // ─── Sanitizar resultados ────────────────────────────────────
  private static sanitizar(amortizacion: RefinanciamientoItem[]): RefinanciamientoItem[] {
    return amortizacion.map(item => {
      let { interes, aval, iva, cuotaTotal, saldo } = item;

      if (interes < 0) interes = 0;
      if (aval < 0) aval = 0;
      if (iva < 0) iva = 0;
      if (saldo < 0) saldo = 0;

      cuotaTotal = item.capital + interes + aval + iva;

      return { ...item, interes, aval, iva, cuotaTotal, saldo };
    });
  }

  // ─── MÉTODO PRINCIPAL: Crear amortización base ────────────────
  /**
   * Crea la amortización base según el tipo de crédito.
   * LÓGICA PURA: Solo lee InfoCreditoData y retorna RefinanciamientoItem[].
   * NO hace INSERT/UPDATE. La persistencia es responsabilidad del QueueProcessor.
   * 
   * @param infoCredito Información del crédito desde legacy
   * @returns ResultadoFactory con amortización base y metadata
   */
  static crear(infoCredito: InfoCreditoData): ResultadoFactory {
    const resultado: ResultadoFactory = {
      exitoso: false,
      tipo: TipoAmortizacion.SIMPLE,
      mensaje: '',
      errores: [],
    };

    try {
      // 1. Validar precondiciones
      const validacion = this.validarPrecondiciones(infoCredito);
      if (!validacion.valido) {
        resultado.errores = validacion.errores;
        resultado.mensaje = 'Información del crédito inválida';
        return resultado;
      }

      // 2. Normalizar
      const creditoNormalizado = this.normalizarInfoCredito(infoCredito);
      resultado.infoCredito = creditoNormalizado;

      // 3. Identificar tipo
      const tipo = this.identificarTipo(creditoNormalizado);
      resultado.tipo = tipo;

      // 4. Crear parámetros
      const params = this.crearParametros(creditoNormalizado);
      resultado.diasPago = params.diasPago;

      // 5. Ejecutar strategy correspondiente
      const strategy = this.strategies[tipo];
      let amortizacionBase = strategy.execute(params);

      // 6. Sanitizar resultados
      amortizacionBase = this.sanitizar(amortizacionBase);

      resultado.amortizacionBase = amortizacionBase;
      resultado.exitoso = true;
      resultado.mensaje = `Amortización tipo ${tipo} creada exitosamente. Total cuotas: ${amortizacionBase.length}`;

      return resultado;
    } catch (error) {
      resultado.exitoso = false;
      resultado.mensaje = 'Error al crear amortización base';
      resultado.errores.push(error instanceof Error ? error.message : 'Error desconocido');
      return resultado;
    }
  }
}

// Exportar utilidades para uso en otras fases
export { FechaUtils };
