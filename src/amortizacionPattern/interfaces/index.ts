/**
 * Interfaces y tipos compartidos para el patrón de amortización
 * Extraídos de amortizacion-refinanciamiento.class.ts para uso en las 3 fases
 */

// ═══════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════

/**
 * Tipo de amortización identificado por el Factory (Fase 1)
 */
export enum TipoAmortizacion {
  CANCELADO = 'CANCELADO',
  SIMPLE = 'SIMPLE',
  DEFICIT_AVAL = 'DEFICIT_AVAL',
  CAPITAL_PURO = 'CAPITAL_PURO',
  ALTERNATIVA = 'ALTERNATIVA',
}

/**
 * Tipos de conceptos de pagos
 */
export enum TipoConceptoPago {
  CUOTA = 'Cuota',
  CUOTA_PARCIAL = 'Cuota Parcial',
  AVAL = 'Aval',
  MORA = 'Mora',
  PREJURIDICO = 'Prejuridico',
  JURIDICO = 'Juridico',
  SALDO_A_FAVOR = 'Saldo a Favor',
}

/**
 * Categoría de un concepto de pago
 */
export enum CategoriaConcepto {
  CUOTA = 'CUOTA',
  SANCION = 'SANCION',
  JURIDICO = 'JURIDICO',
  SALDO_FAVOR = 'SALDO_FAVOR',
}

// ═══════════════════════════════════════════════════════════════
// INTERFACES DE DATOS
// ═══════════════════════════════════════════════════════════════

/**
 * Item individual de la tabla de amortización
 */
export interface RefinanciamientoItem {
  prestamoId: string | number;
  documento: string;
  numeroCuota: number;
  capitalEnMora: number;
  capital: number;
  interes: number;
  aval: number;
  iva: number;
  cuotaTotal: number;
  saldo: number;
  fechaPago: string;
  sancion?: number;
}

/**
 * Parámetros para calcular refinanciamiento base
 */
export interface RefinanciamientoParams {
  capitalEnMora: number;
  cantidadMeses: number;
  periocidad: 'mensual' | 'quincenal';
  valorCuotaAcordada: number;
  documento: string;
  prestamoId: number | string;
  iva_aval?: number;
  fechaPrimerPago?: Date;
  cta_aval?: number;
  cta_iva_aval?: number;
  diasPago?: number[];
}

/**
 * Registro de pago (fuente: legacy.pagos)
 */
export interface PagoRegistro {
  id: number;
  factura_id: number;
  credito_id: number;
  concepto: 'Cuota' | 'Cuota Parcial' | 'Mora' | 'Prejuridico' | 'Juridico' | 'Saldo a Favor' | 'Aval';
  abono: number;
  debe: number;
  descripcion?: string;
  estado: 'Debe' | 'Ok' | 'Finalizado';
  num_cuota: number | null;
  pago_desde?: string;
  pago_hasta?: string;
  abono_pago_id?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Registro de sanción (fuente: legacy.sanciones)
 */
export interface SancionRegistro {
  id: number;
  credito_id: number;
  valor: number;
  estado: 'Ok' | 'Debe' | 'Exonerada';
  pago_id?: number | null;
  created_at: string;
}

/**
 * Registro de extras/gastos cartera (fuente: legacy.extras)
 */
export interface ExtraRegistro {
  id: number;
  credito_id: number;
  concepto: 'Prejuridico' | 'Juridico';
  estado: 'Ok' | 'Debe' | 'Finalizado';
  valor: number;
  fecha: string;
  descripcion?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Información del crédito (fuente: legacy query JOIN)
 */
export interface InfoCreditoData {
  documento: string;
  valor_prestamo: number;
  valor_cuota: number;
  periodicidad: 'Mensual' | 'Quincenal' | 'mensual' | 'quincenal';
  cantidad_meses: number;
  /** Total real de cuotas (ya incluye quincenal×2). Fuente: precreditos.cuotas */
  numero_cuotas?: number;
  fecha_creacion: Date | string;
  cuotas_faltantes: number;
  credito_id: number;
  fecha_pago1?: number;
  fecha_pago2?: number;
  cta_aval?: number;
  cta_iva_aval?: number;
  proxima_fecha_pago?: string | Date;
  estado?: string;
}

/**
 * Información procesada de pagos (salida de Fase 2)
 */
export interface InfoPagosProcessados {
  cuotaMaximaPagada: number;
  tieneCuotaParciall: boolean;
  montoPagadoCuotaParcial: number;
  montoDebe: number;
  sanciones_condonadas: number;
  dias_sanciones_condonadas: number;
  desglosePagos: {
    [key: number]: {
      capital: number;
      interes: number;
      aval: number;
      iva: number;
      totalAbonado: number;
    };
  };
  pagosJuridicos: {
    totalPrejuridico: number;
    totalJuridico: number;
    /** Suma de 'debe' de pagos Prejuridico con estado='Debe' (saldo pendiente según legacy) */
    debePrejuridico: number;
    /** Suma de 'debe' de pagos Juridico con estado='Debe' (saldo pendiente según legacy) */
    debeJuridico: number;
    cantidadPagosJuridicos: number;
  };
  saldoAFavor: {
    total: number;
    cantidadRegistros: number;
  };
  pagosEnMora: {
    totalPagadoEnMora: number;
    cantidadSancionesPagadas: number;
  };
}

/**
 * Gastos de cartera procesados
 */
export interface GastosCartera {
  prejuridico: {
    total: number;
    cantidad: number;
  };
  juridico: {
    total: number;
    cantidad: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// INTERFACES DE RESULTADO POR FASE
// ═══════════════════════════════════════════════════════════════

/**
 * Resultado de Fase 1 (Factory)
 */
export interface ResultadoFactory {
  exitoso: boolean;
  tipo: TipoAmortizacion;
  mensaje: string;
  errores: string[];
  infoCredito?: InfoCreditoData;
  amortizacionBase?: RefinanciamientoItem[];
  diasPago?: number[];
}

/**
 * Resultado de Fase 2 (Pagos Strategy)
 */
export interface ResultadoPagos {
  exitoso: boolean;
  mensaje: string;
  errores: string[];
  infoPagos?: InfoPagosProcessados;
  amortizacionConPagos?: RefinanciamientoItem[];
}

/**
 * Resultado de Fase 3 (Sanciones Strategy)
 */
export interface ResultadoSanciones {
  exitoso: boolean;
  mensaje: string;
  errores: string[];
  amortizacionFinal?: RefinanciamientoItem[];
  gastosCartera?: GastosCartera;
  estadisticas?: {
    totalCuotas: number;
    cuotaTotal: number;
    totalCapital: number;
    totalInteres: number;
    totalAval: number;
    totalIVA: number;
    totalSanciones: number;
    totalGastosCartera: number;
  };
}

/**
 * Resultado de Fase 4 (Reconciliación contra Saldo Legacy)
 */
export interface ResultadoReconciliacion {
  exitoso: boolean;
  mensaje: string;
  errores: string[];
  /** true si se ejecutó redistribución (diferencia > tolerancia) */
  redistribucionAplicada: boolean;
  /** Saldo leído de creditos.saldo en legacy */
  saldoLegacy: number;
  /** Sumatoria de cuotaTotal de cuotas pendientes (post Fase 3) */
  sumaCuotasCalculada: number;
  /** Total sanciones en la amortización */
  totalSanciones: number;
  /** Total gastos cartera (prejuridico + juridico) */
  totalGastosCartera: number;
  /** Diferencia absoluta entre sumaCuotas y saldoLegacy */
  diferencia: number;
  /** Tolerancia usada para la comparación */
  tolerancia: number;
  /** Saldo neto para cuotas (saldoLegacy - sanciones - gastosCartera) */
  saldoNetoCuotas?: number;
  /** Cuotas completas que alcanzó el saldo neto */
  cuotasCompletasRedistribuidas?: number;
  /** Valor del excedente parcial (si no alcanzó cuota completa) */
  excedenteParcial?: number;
  /** Amortización reconciliada (solo si hubo redistribución) */
  amortizacionReconciliada?: RefinanciamientoItem[];
}

/**
 * Resultado final completo (3 fases)
 */
export interface ResultadoRefinanciamientoConPagos {
  exitoso: boolean;
  mensaje: string;
  errores: string[];
  infoCredito?: InfoCreditoData;
  infoPagos?: InfoPagosProcessados;
  gastosCartera?: GastosCartera;
  amortizacionOriginal?: RefinanciamientoItem[];
  amortizacionActualizada?: RefinanciamientoItem[];
  estadisticas?: {
    totalCuotas: number;
    cuotaTotal: number;
    totalCapital: number;
    totalInteres: number;
    totalAval: number;
    totalIVA: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════

/**
 * Utilidad para categorizar conceptos de pago
 */
export class CategorizadorConceptos {
  private static readonly CONCEPTOS_CUOTA = ['Cuota', 'Cuota Parcial', 'Aval'];
  private static readonly CONCEPTOS_SANCION = ['Mora'];
  private static readonly CONCEPTOS_JURIDICO = ['Prejuridico', 'Juridico'];
  private static readonly CONCEPTOS_SALDO_FAVOR = ['Saldo a Favor'];

  static categorizar(concepto: string): CategoriaConcepto {
    const conceptoNormalizado = String(concepto).trim();
    if (this.CONCEPTOS_CUOTA.includes(conceptoNormalizado)) return CategoriaConcepto.CUOTA;
    if (this.CONCEPTOS_SANCION.includes(conceptoNormalizado)) return CategoriaConcepto.SANCION;
    if (this.CONCEPTOS_JURIDICO.includes(conceptoNormalizado)) return CategoriaConcepto.JURIDICO;
    if (this.CONCEPTOS_SALDO_FAVOR.includes(conceptoNormalizado)) return CategoriaConcepto.SALDO_FAVOR;
    return CategoriaConcepto.CUOTA;
  }

  static aplicaACuota(concepto: string): boolean {
    return this.categorizar(concepto) === CategoriaConcepto.CUOTA;
  }

  static esSancion(concepto: string): boolean {
    return this.categorizar(concepto) === CategoriaConcepto.SANCION;
  }

  static esJuridico(concepto: string): boolean {
    return this.categorizar(concepto) === CategoriaConcepto.JURIDICO;
  }

  static esSaldoAFavor(concepto: string): boolean {
    return this.categorizar(concepto) === CategoriaConcepto.SALDO_FAVOR;
  }
}
