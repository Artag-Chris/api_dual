/**
 * Clase Amortización Refinanciamiento
 * Sistema para reestructuración de créditos en mora
 * Capital distribuido equitativamente + Aval fijo por cuota
 */

/**
 * Tipos de conceptos de pagos
 * Categoriza diferentes tipos de transacciones registradas
 */
export enum TipoConceptoPago {
  // Pagos que aplican a cuotas
  CUOTA = 'Cuota',
  CUOTA_PARCIAL = 'Cuota Parcial',
  AVAL = 'Aval',
  
  // Pagos de sanciones/mora
  MORA = 'Mora',
  
  // Pagos jurídicos (NO aplican a cuotas)
  PREJURIDICO = 'Prejuridico',
  JURIDICO = 'Juridico',
  
  // Saldo a favor (reportar separado)
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

/**
 * Utilidad para categorizar conceptos
 */
export class CategorizadorConceptos {
  private static readonly CONCEPTOS_CUOTA = ['Cuota', 'Cuota Parcial', 'Aval'];
  private static readonly CONCEPTOS_SANCION = ['Mora'];
  private static readonly CONCEPTOS_JURIDICO = ['Prejuridico', 'Juridico'];
  private static readonly CONCEPTOS_SALDO_FAVOR = ['Saldo a Favor'];

  /**
   * Categoriza un concepto de pago
   */
  static categorizar(concepto: string): CategoriaConcepto {
    const conceptoNormalizado = String(concepto).trim();
    
    if (this.CONCEPTOS_CUOTA.includes(conceptoNormalizado)) {
      return CategoriaConcepto.CUOTA;
    }
    if (this.CONCEPTOS_SANCION.includes(conceptoNormalizado)) {
      return CategoriaConcepto.SANCION;
    }
    if (this.CONCEPTOS_JURIDICO.includes(conceptoNormalizado)) {
      return CategoriaConcepto.JURIDICO;
    }
    if (this.CONCEPTOS_SALDO_FAVOR.includes(conceptoNormalizado)) {
      return CategoriaConcepto.SALDO_FAVOR;
    }
    
    return CategoriaConcepto.CUOTA; // Default
  }

  /**
   * Verifica si un concepto aplica a cuotas
   */
  static aplicaACuota(concepto: string): boolean {
    return this.categorizar(concepto) === CategoriaConcepto.CUOTA;
  }

  /**
   * Verifica si es un pago de sanción
   */
  static esSancion(concepto: string): boolean {
    return this.categorizar(concepto) === CategoriaConcepto.SANCION;
  }

  /**
   * Verifica si es jurídico
   */
  static esJuridico(concepto: string): boolean {
    return this.categorizar(concepto) === CategoriaConcepto.JURIDICO;
  }

  /**
   * Verifica si es saldo a favor
   */
  static esSaldoAFavor(concepto: string): boolean {
    return this.categorizar(concepto) === CategoriaConcepto.SALDO_FAVOR;
  }
}

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

export interface SancionRegistro {
  id: number;
  credito_id: number;
  valor: number;
  estado: 'Ok' | 'Debe' | 'Exonerada';
  pago_id?: number | null;
  created_at: string;
}

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

export interface InfoCreditoData {
  documento: string;
  valor_prestamo: number;
  valor_cuota: number;
  periodicidad: 'Mensual' | 'Quincenal' | 'mensual' | 'quincenal';
  cantidad_meses: number;
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
  // NUEVOS CAMPOS
  pagosJuridicos: {
    totalPrejuridico: number;
    totalJuridico: number;
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

export class AmortizacionRefinanciamiento {
  /**
   * Obtiene la fecha actual en Colombia
   */
  private static getFechaColombia(): Date {
    const ahora = new Date();
    const offset = ahora.getTimezoneOffset();
    const colombiaOffset = -5 * 60;
    const difMs = (colombiaOffset - offset) * 60 * 1000;
    return new Date(ahora.getTime() + difMs);
  }

  /**
   * Calcula la fecha del primer pago basado en la fecha de creación
   * 
   * QUINCENAL: 
   *   - Recibe 2 números en diasPago: [día1, día2]
   *   - Verifica si día1 cae dentro de los 7 días después de fechaCreacion
   *   - Si SÍ: primer pago = día2 del próximo mes
   *   - Si NO: primer pago = día2 del mes actual
   * 
   * MENSUAL:
   *   - Recibe 1 número en diasPago: [día]
   *   - Verifica si ese día cae dentro de los 14 días después de fechaCreacion
   *   - Si SÍ: primer pago = ese día del mes siguiente
   *   - Si NO: primer pago = ese día del mes actual
   * 
   * @example
   * // Quincenal: fecha 2026-02-23, pagos [25, 10]
   * // El 25 de feb cae en rango 2026-02-23 a 2026-03-02 → primer pago = 2026-03-10
   * calcularFechaPrimerPago(new Date('2026-02-23'), 'quincenal', [25, 10])
   * 
   * @example
   * // Mensual: fecha 2026-02-23, pagos [3]
   * // El 3 de marzo NO cae en rango 2026-02-23 a 2026-03-09 → primer pago = 2026-04-03
   * calcularFechaPrimerPago(new Date('2026-02-23'), 'mensual', [3])
   */
  public static calcularFechaPrimerPago(
    fechaCreacion: Date,
    periocidad: 'mensual' | 'quincenal',
    diasPago: number[]
  ): Date {
    const fechaBase = new Date(fechaCreacion);

    if (periocidad === 'quincenal') {
      // Rango de verificación: 7 días después de la fecha de creación
      const rangoInicio = new Date(fechaBase);
      const rangoFin = new Date(fechaBase);
      rangoFin.setDate(rangoFin.getDate() + 7);

      const primerDiaPago = diasPago[0]; // Ej: 25
      const segundoDiaPago = diasPago[1]; // Ej: 10

      // Crear fecha del primer día de pago en el mes actual
      let fechaPrimeraOpcion = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), primerDiaPago);

      // Si el primer día ya pasó en el mes actual, ir al siguiente mes
      if (fechaPrimeraOpcion < fechaBase) {
        fechaPrimeraOpcion = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + 1, primerDiaPago);
      }

      // Verificar si está dentro del rango
      if (fechaPrimeraOpcion >= rangoInicio && fechaPrimeraOpcion <= rangoFin) {
        // Usar el segundo día de pago en el próximo mes
        // IMPORTANTE: Usar constructor directo para evitar bug de setMonth()
        const proximoMes = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + 1, segundoDiaPago);
        return proximoMes;
      } else {
        // Si no está en el rango, usar el segundo día de pago en el mes actual
        let fechaAlternativa = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), segundoDiaPago);
        
        // Si el segundo día ya pasó en el mes actual, ir al siguiente mes
        if (fechaAlternativa < fechaBase) {
          fechaAlternativa = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + 1, segundoDiaPago);
        }
        
        return fechaAlternativa;
      }
    } else {
      // Periocidad MENSUAL
      // Rango de verificación: 14 días después de la fecha de creación
      const rangoInicio = new Date(fechaBase);
      const rangoFin = new Date(fechaBase);
      rangoFin.setDate(rangoFin.getDate() + 14);

      const diaPago = diasPago[0]; // Ej: 3

      // Crear fecha del día de pago en el mes actual
      let fechaPrimeraOpcion = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), diaPago);

      // Si el día ya pasó en el mes actual, ir al siguiente mes
      if (fechaPrimeraOpcion < fechaBase) {
        fechaPrimeraOpcion = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + 1, diaPago);
      }

      // Verificar si está dentro del rango
      if (fechaPrimeraOpcion >= rangoInicio && fechaPrimeraOpcion <= rangoFin) {
        // Usar el mismo día de pago en el mes siguiente después del rango fin
        // IMPORTANTE: Usar constructor directo para evitar bug de setMonth() con enero 30/31
        const proximoMes = new Date(rangoFin.getFullYear(), rangoFin.getMonth() + 1, diaPago);
        return proximoMes;
      } else {
        // Si no está en el rango, usar esa fecha
        return fechaPrimeraOpcion;
      }
    }
  }

  /**
   * Calcula la siguiente fecha de pago
   */
  /**
   * Calcula la siguiente fecha de pago alternando entre diasPago[0] y diasPago[1]
   * 
   * Para la cuota 0: retorna fechaBase tal cual
   * Para cuotas posteriores: alterna entre los días de pago
   * 
   * Excepción especial: Si la fecha cae en febrero con día 29 o 30, pasa al 1 de marzo
   */
  private static calcularSiguienteFechaPago(
    fechaBase: Date,
    periocidad: 'mensual' | 'quincenal',
    cuotaIndex: number,
    diasPago: number[] = []
  ): Date {
    // Primera cuota: retornar la fecha base tal cual
    if (cuotaIndex === 0) {
      return new Date(fechaBase);
    }

    // Para quincenal: alternar entre diasPago[0] y diasPago[1]
    if (periocidad === 'quincenal') {
      // Obtener el día de la cuota anterior
      const diaAnterior = fechaBase.getDate();
      // Alternar al otro día
      const diaSeleccionado = diaAnterior === diasPago[0] ? diasPago[1] : diasPago[0];
      
      // Crear fecha en el próximo mes con el día seleccionado
      const proximaFecha = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + 1, diaSeleccionado);
      
      return this.ajustarFechaFebrero(proximaFecha);
    } else {
      // Para mensual: usar siempre diasPago[0]
      const diaSeleccionado = diasPago[0] || 1;
      
      // Crear fecha en el próximo mes con el día seleccionado
      const proximaFecha = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + 1, diaSeleccionado);
      
      return this.ajustarFechaFebrero(proximaFecha);
    }
  }

  /**
   * Ajusta la fecha si cae en febrero con día 29 o 30
   * Cambia a 1 de marzo en esos casos
   */
  private static ajustarFechaFebrero(fecha: Date): Date {
    if (fecha.getMonth() === 1) { // Febrero (mes 1)
      if (fecha.getDate() >= 29) {
        // Cambiar a 1 de marzo
        return new Date(fecha.getFullYear(), 2, 1);
      }
    }
    return fecha;
  }

  /**
   * Valida que los registros de pagos tengan la estructura correcta
   * Nota: Arrays vacíos son válidos (créditos sin pagos registrados aún)
   */
  private static validarEstructuraPagos(pagos: PagoRegistro[]): { valido: boolean; errores: string[] } {
    const errores: string[] = [];

    if (!Array.isArray(pagos)) {
      errores.push('Los pagos deben ser un array');
      return { valido: false, errores };
    }

    // Arrays vacíos son válidos → crédito sin pagos (recién creado)
    if (pagos.length === 0) {
      return { valido: true, errores: [] };
    }

    // Validar cada registro
    pagos.forEach((pago, index) => {
      if (!pago.credito_id || pago.credito_id <= 0) {
        errores.push(`Pago ${index}: credito_id inválido`);
      }
      if (typeof pago.abono !== 'number' || pago.abono < 0) {
        errores.push(`Pago ${index}: abono debe ser número >= 0`);
      }
      if (typeof pago.debe !== 'number' || pago.debe < 0) {
        errores.push(`Pago ${index}: debe debe ser número >= 0`);
      }
      if (!['Debe', 'Ok', 'Finalizado'].includes(pago.estado)) {
        errores.push(`Pago ${index}: estado inválido`);
      }
      if (!['Cuota', 'Cuota Parcial', 'Mora', 'Prejuridico', 'Juridico', 'Saldo a Favor', 'Aval'].includes(pago.concepto)) {
        errores.push(`Pago ${index}: concepto inválido`);
      }
    });

    return { valido: errores.length === 0, errores };
  }

  /**
   * Obtiene el máximo número de cuota pagada (estado = 'Ok')
   */
  private static obtenerCuotaMaximaPagada(pagos: PagoRegistro[]): number {
    const cuotasPagadas = pagos
      .filter(p => p.estado === 'Ok' && p.num_cuota !== null && p.concepto === 'Cuota')
      .map(p => p.num_cuota as number);

    return cuotasPagadas.length > 0 ? Math.max(...cuotasPagadas) : 0;
  }

  /**
   * Normaliza valores en "debe": Si son negativos, asigna 0
   * Evita problemas con pagos parciales
   */
  private static normalizarDebeNegativo(pago: PagoRegistro): PagoRegistro {
    return {
      ...pago,
      debe: pago.debe < 0 ? 0 : pago.debe,
    };
  }

  /**
   * Filtra pagos por categoría (solo aquellos que aplican a cuotas)
   */
  private static filtrarPagosCuota(pagos: PagoRegistro[]): PagoRegistro[] {
    return pagos.filter(p => CategorizadorConceptos.aplicaACuota(p.concepto));
  }

  /**
   * Filtra pagos de sanciones/mora
   */
  private static filtrarPagosSanciones(pagos: PagoRegistro[]): PagoRegistro[] {
    return pagos.filter(p => CategorizadorConceptos.esSancion(p.concepto));
  }

  /**
   * Filtra pagos jurídicos (NO aplican a cuotas)
   */
  private static filtrarPagosJuridico(pagos: PagoRegistro[]): PagoRegistro[] {
    return pagos.filter(p => CategorizadorConceptos.esJuridico(p.concepto));
  }

  /**
   * Filtra pagos de saldo a favor
   */
  private static filtrarSaldoAFavor(pagos: PagoRegistro[]): PagoRegistro[] {
    return pagos.filter(p => CategorizadorConceptos.esSaldoAFavor(p.concepto));
  }

  /**
   * Calcula el máximo de sanciones permitidas por cuota según el período
   * - Quincenal: 1000 x 15 días = 15,000
   * - Mensual: 1000 x 30 días = 30,000
   */
  private static calcularMaximoSancionPorPeriodo(periocidad: 'mensual' | 'quincenal'): number {
    if (periocidad === 'quincenal') {
      return 1000 * 15; // 15,000
    } else {
      return 1000 * 30; // 30,000
    }
  }

  /**
   * Verifica si una sanción coincide con la fecha de una cuota
   * Considera que la sanción es de la cuota si fue creada después de la fecha de pago
   * de la cuota anterior y antes o en la fecha de pago de la cuota actual
   */
  private static sancionCoincideConCuota(
    fechaSancion: Date,
    cuotaActual: RefinanciamientoItem,
    cuotaAnterior?: RefinanciamientoItem
  ): boolean {
    const fechaActual = new Date(cuotaActual.fechaPago);
    
    if (cuotaAnterior) {
      const fechaAnterior = new Date(cuotaAnterior.fechaPago);
      // Sanción entre la cuota anterior y la actual
      return fechaSancion > fechaAnterior && fechaSancion <= fechaActual;
    } else {
      // Para la primera cuota, cualquier sanción anterior o en la fecha es válida
      return fechaSancion <= fechaActual;
    }
  }

  /**
   * Intenta emparejar sanciones con cuotas por fecha
   * Retorna un mapa de cuota -> total de sanciones que coinciden por fecha
   */
  private static emparejarSancionesPorFecha(
    sanciones: SancionRegistro[],
    amortizacion: RefinanciamientoItem[]
  ): { emparejadas: Map<number, number>; sinEmparejar: SancionRegistro[] } {
    const sancionesEmparejadas = new Map<number, number>();
    const sancionesSinEmparejar: SancionRegistro[] = [];

    // Inicializar todas las cuotas
    amortizacion.forEach(cuota => {
      sancionesEmparejadas.set(cuota.numeroCuota, 0);
    });

    // Intentar emparejar cada sanción
    sanciones.forEach(sancion => {
      const fechaSancion = new Date(sancion.created_at);
      let encontrada = false;

      // Buscar la cuota que corresponde a esta sanción
      for (let i = 0; i < amortizacion.length; i++) {
        const cuotaActual = amortizacion[i];
        const cuotaAnterior = i > 0 ? amortizacion[i - 1] : undefined;

        if (this.sancionCoincideConCuota(fechaSancion, cuotaActual, cuotaAnterior)) {
          // Sanción coincide con esta cuota
          const actual = sancionesEmparejadas.get(cuotaActual.numeroCuota) || 0;
          sancionesEmparejadas.set(cuotaActual.numeroCuota, actual + sancion.valor);
          encontrada = true;
          break;
        }
      }

      // Si no se encontró coincidencia de fecha, agregarlo a sin emparejar
      if (!encontrada) {
        sancionesSinEmparejar.push(sancion);
      }
    });

    return { emparejadas: sancionesEmparejadas, sinEmparejar: sancionesSinEmparejar };
  }

  /**
   * Encuentra la cuota más morosa (con mayor índice de morosidad)
   * Se usa para asignar sanciones pendientes
   * 
   * La cuota más morosa es la primera cuota pendiente de pago (num_cuota más alta sin completar)
   */
  private static encontrarCuotaMasMoresa(pagos: PagoRegistro[]): number {
    // Si no hay pagos, la cuota más morosa es la 1
    if (!pagos || pagos.length === 0) {
      return 1;
    }

    // Obtener el máximo número de cuota con estado 'Ok' (completamente pagada)
    const cuotasOk = pagos
      .filter(p => p.estado === 'Ok' && p.num_cuota !== null && p.num_cuota !== undefined)
      .map(p => p.num_cuota as number);

    if (cuotasOk.length === 0) {
      // Ninguna cuota está completamente pagada, la más morosa es la 1
      return 1;
    }

    // La cuota más morosa es la siguiente después de la máxima pagada
    const maxPagada = Math.max(...cuotasOk);
    return maxPagada + 1;
  }

  /**
   * Asigna números de cuota a pagos con num_cuota = NULL
   * Solo procesa conceptos: 'Cuota', 'Cuota Parcial', 'Aval'
   * Agrupa múltiples pagos que juntos sumen el valor de la cuota
   * 
   * @param pagos Array de pagos
   * @param valorCuota Valor de cada cuota (para agrupar pagos correctamente)
   */
  private static asignarCuotasANullPayments(pagos: PagoRegistro[], valorCuota: number): PagoRegistro[] {
    // Hacer copia para no mutar el original
    const pagosModificados = [...pagos];

    // Extraer pagos con num_cuota = null y concepto válido
    const pagosNullNumCuota = pagosModificados.filter(
      p => p.num_cuota === null && ['Cuota', 'Cuota Parcial', 'Aval'].includes(p.concepto)
    );

  //  console.log(`[DEBUG] Pagos con num_cuota = null encontrados: ${pagosNullNumCuota.length}`);
  //  console.log(`[DEBUG] valorCuota: ${valorCuota}`);

    // Si no hay pagos null, retornar sin modificar
    if (pagosNullNumCuota.length === 0) {
    //  console.log(`[DEBUG] No hay pagos con num_cuota = null para asignar`);
      return pagosModificados;
    }

    // Ordenar cronológicamente por fecha de creación
    pagosNullNumCuota.sort((a, b) => {
      const fechaA = new Date(a.created_at).getTime();
      const fechaB = new Date(b.created_at).getTime();
      return fechaA - fechaB;
    });

    // Agrupar pagos por cuota: varios pagos pueden formar una sola cuota
    let numeroCuotaActual = 1;
    let abonoAcumulado = 0;

    pagosNullNumCuota.forEach((pago, index) => {
      abonoAcumulado += pago.abono;

      // Asignar el número de cuota actual a este pago
      const indexEnModificados = pagosModificados.findIndex(p => p.id === pago.id);
      if (indexEnModificados !== -1) {
        pagosModificados[indexEnModificados].num_cuota = numeroCuotaActual;
      //  console.log(`[DEBUG] Pago ${pago.id} asignado a cuota ${numeroCuotaActual} (abono: ${pago.abono}, acumulado: ${abonoAcumulado})`);
      }

      // Si el acumulado alcanzó o pasó el valor de la cuota, pasar a la siguiente cuota
      if (abonoAcumulado >= valorCuota) {
     //   console.log(`[DEBUG] Acumulado ${abonoAcumulado} >= ${valorCuota}, pasando a cuota ${numeroCuotaActual + 1}`);
        numeroCuotaActual++;
        abonoAcumulado = 0;
      }
    });

    return pagosModificados;
  }

  /**
   * Verifica si existe una cuota parcial (debe pero con abonos)
   */
  private static detectarCuotaParcial(pagos: PagoRegistro[]): { existe: boolean; infoCuota: PagoRegistro | null } {
    const cuotaParcial = pagos.find(
      p => p.estado === 'Debe' && p.concepto === 'Cuota' && p.abono > 0 && p.num_cuota !== null
    );

    return { existe: !!cuotaParcial, infoCuota: cuotaParcial || null };
  }

  /**
   * Calcula el desglose de pagos por cuota
   * Agrupa TODOS los abonos por número de cuota sin importar concepto
   * NOTA: Excluye pagos con num_cuota = null (deberían haber sido asignados antes)
   * Detecta si la cuota está completamente pagada (todos='Ok') o parcial (alguno='Debe')
   */
  private static calcularDesglosePagos(pagos: PagoRegistro[]): { 
    [key: number]: { 
      totalAbonado: number; 
      totalDebe: number;
      estado: 'Ok' | 'Debe' | 'parcial';
      registros: PagoRegistro[];
    } 
  } {
    const desglose: { 
      [key: number]: { 
        totalAbonado: number; 
        totalDebe: number;
        estado: 'Ok' | 'Debe' | 'parcial';
        registros: PagoRegistro[];
      } 
    } = {};

    pagos.forEach(pago => {
      // IMPORTANTE: Solo procesar pagos que ya tienen num_cuota asignado
      if (pago.num_cuota === null) {
      
        return;
      }

      const numCuota = pago.num_cuota;

      if (!desglose[numCuota]) {
        desglose[numCuota] = {
          totalAbonado: 0,
          totalDebe: 0,
          estado: 'Ok',
          registros: [],
        };
      }

      // Sumar TODOS los abonos sin importar concepto
      desglose[numCuota].totalAbonado += pago.abono;
      desglose[numCuota].totalDebe += pago.debe;
      desglose[numCuota].registros.push(pago);

      // Determinar estado de la cuota:
      // - Si TODOS son 'Ok' -> completamente pagada
      // - Si hay algún 'Debe' -> parcialmente pagada
      if (pago.estado === 'Debe') {
        desglose[numCuota].estado = 'parcial';
      }
    });

    return desglose;
  }

  /**
   * Procesa sanciones exoneradas para extraer información de condonaciones
   * 
   * @param sancionesExoneradas Array de sanciones con estado 'Exonerado'
   * @returns Objeto con sanciones_condonadas (suma) y dias_sanciones_condonadas (cantidad)
   */
  private static procesarSancionesExoneradas(sancionesExoneradas: SancionRegistro[]): { sanciones_condonadas: number; dias_sanciones_condonadas: number } {
    if (!sancionesExoneradas || sancionesExoneradas.length === 0) {
      return { sanciones_condonadas: 0, dias_sanciones_condonadas: 0 };
    }

    const sanciones_condonadas = sancionesExoneradas.reduce((sum, sancion) => sum + sancion.valor, 0);
    const dias_sanciones_condonadas = sancionesExoneradas.length;

    return { sanciones_condonadas, dias_sanciones_condonadas };
  }

  /**
   * Procesa gastos de cartera (prejuridico y juridico) de la tabla extras
   * Filtra solo los gastos con estado 'Debe' (pendientes de pagar)
   * RESTA los pagos jurídicos ya realizados para obtener el saldo pendiente
   * 
   * Ejemplo:
   * - Extras Prejuridico: 1,000,000
   * - Pagos Prejuridico: 100,000
   * - Gastos Cartera Final: 900,000
   * 
   * @param extras Array de registros extras del crédito
   * @param infoPagos Información de pagos procesados (para restar pagos jurídicos)
   * @returns Objeto con totales y cantidades netas de prejuridico y juridico
   */
  private static procesarGastosCartera(extras: ExtraRegistro[], infoPagos?: InfoPagosProcessados): GastosCartera {
    const gastosCartera: GastosCartera = {
      prejuridico: { total: 0, cantidad: 0 },
      juridico: { total: 0, cantidad: 0 }
    };

    if (!extras || extras.length === 0) {
      return gastosCartera;
    }

    // Filtrar solo los gastos pendientes (estado='Debe') y agrupar por concepto
    extras.forEach(extra => {
      if (extra.estado === 'Debe') {
        if (extra.concepto === 'Prejuridico') {
          gastosCartera.prejuridico.total += extra.valor;
          gastosCartera.prejuridico.cantidad += 1;
        } else if (extra.concepto === 'Juridico') {
          gastosCartera.juridico.total += extra.valor;
          gastosCartera.juridico.cantidad += 1;
        }
      }
    });

    // RESTAR los pagos jurídicos ya realizados del total de extras
    // Esto da el saldo PENDIENTE de gastos cartera
    if (infoPagos?.pagosJuridicos) {
      gastosCartera.prejuridico.total = Math.max(0, gastosCartera.prejuridico.total - infoPagos.pagosJuridicos.totalPrejuridico);
      gastosCartera.juridico.total = Math.max(0, gastosCartera.juridico.total - infoPagos.pagosJuridicos.totalJuridico);
    }

    return gastosCartera;
  }

  /**
   * Procesa y valida los pagos, extrayendo información relevante
   * Agrupa por número de cuota e identifica cuotas pagadas vs parciales
   * 
   * Caso especial: Si no hay pagos (array vacío), retorna infoPagos con valores por defecto
   * indicando que no hay cuotas pagadas y se generará amortización completa
   */
  public static procesarPagos(
    pagos: PagoRegistro[], 
    valorCuota: number, 
    sancionesExoneradas?: SancionRegistro[],
    sancionesPagadas?: SancionRegistro[]
  ): { valido: boolean; errores: string[]; infoPagos?: InfoPagosProcessados } {
    // PASO 1: Normalizar todos los pagos PRIMERO (convertir "debe" negativo a 0)
    // Esto debe ocurrir antes de la validación para que no falle por valores negativos
    const pagosNormalizados = pagos.map(p => this.normalizarDebeNegativo(p));

    // PASO 2: Validar estructura de pagos ya normalizados
    const validacion = this.validarEstructuraPagos(pagosNormalizados);
    if (!validacion.valido) {
      return { valido: false, errores: validacion.errores };
    }

    // CASO ESPECIAL: Sin pagos registrados (crédito nuevo)
    if (pagosNormalizados.length === 0) {
      const infoPagos: InfoPagosProcessados = {
        cuotaMaximaPagada: 0,
        tieneCuotaParciall: false,
        montoPagadoCuotaParcial: 0,
        montoDebe: 0,
        sanciones_condonadas: 0,
        dias_sanciones_condonadas: 0,
        desglosePagos: {},
        pagosJuridicos: {
          totalPrejuridico: 0,
          totalJuridico: 0,
          cantidadPagosJuridicos: 0,
        },
        saldoAFavor: {
          total: 0,
          cantidadRegistros: 0,
        },
        pagosEnMora: {
          totalPagadoEnMora: 0,
          cantidadSancionesPagadas: 0,
        },
      };
      return { valido: true, errores: [], infoPagos };
    }

    // ═════════════════════════════════════════════════════════════════════
    // SEPARAR PAGOS POR CATEGORÍA
    // ═════════════════════════════════════════════════════════════════════
    const pagosCuota = this.filtrarPagosCuota(pagosNormalizados);
    const pagosSanciones = this.filtrarPagosSanciones(pagosNormalizados);
    const pagosJuridicos = this.filtrarPagosJuridico(pagosNormalizados);
    const pagosAlFavor = this.filtrarSaldoAFavor(pagosNormalizados);

    // ═════════════════════════════════════════════════════════════════════
    // PROCESAR PAGOS DE CUOTA (aplican a amortización)
    // ═════════════════════════════════════════════════════════════════════
    
    // Asignar cuota numbers a pagos con num_cuota = NULL
    const pagosConCuotasAsignadas = this.asignarCuotasANullPayments(pagosCuota, valorCuota);

    // Calcular desglose completo de pagos
    const desglosePagosCompleto = this.calcularDesglosePagos(pagosConCuotasAsignadas);

    // Obtener cuota máxima COMPLETAMENTE pagada
    let cuotaMaximaPagada = 0;
    Object.entries(desglosePagosCompleto).forEach(([numCuotaStr, desglose]) => {
      if (desglose.estado === 'Ok') {
        const numCuota = parseInt(numCuotaStr);
        cuotaMaximaPagada = Math.max(cuotaMaximaPagada, numCuota);
      }
    });

    // Detectar cuota parcial
    let tieneCuotaParcial = false;
    let montoPagadoCuotaParcial = 0;
    let montoDebe = 0;

    const numeroCuotaParcialPosible = cuotaMaximaPagada + 1;
    if (desglosePagosCompleto[numeroCuotaParcialPosible]) {
      const desglose = desglosePagosCompleto[numeroCuotaParcialPosible];
      if (desglose.estado === 'parcial') {
        tieneCuotaParcial = true;
        montoPagadoCuotaParcial = desglose.totalAbonado;
        montoDebe = desglose.totalDebe;
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    // PROCESAR PAGOS DE SANCIONES (MORA)
    // ═════════════════════════════════════════════════════════════════════
    const totalPagadoEnMora = pagosSanciones.reduce((sum, p) => sum + p.abono, 0);
    // Contar sanciones pagadas desde el registro de sanciones (estado='Ok'), no desde los abonos de pago
    const cantidadSancionesPagadas = (sancionesPagadas && sancionesPagadas.length > 0) ? sancionesPagadas.length : 0;

    // ═════════════════════════════════════════════════════════════════════
    // PROCESAR PAGOS JURÍDICOS (NO APLICAN A CUOTAS)
    // ═════════════════════════════════════════════════════════════════════
    const totalPrejuridico = pagosJuridicos
      .filter(p => p.concepto === 'Prejuridico')
      .reduce((sum, p) => sum + p.abono, 0);

    const totalJuridico = pagosJuridicos
      .filter(p => p.concepto === 'Juridico')
      .reduce((sum, p) => sum + p.abono, 0);

    // ═════════════════════════════════════════════════════════════════════
    // PROCESAR SALDO A FAVOR (REPORTAR SEPARADO)
    // ═════════════════════════════════════════════════════════════════════
    const totalSaldoAFavor = pagosAlFavor.reduce((sum, p) => sum + p.abono, 0);

    // ═════════════════════════════════════════════════════════════════════
    // PROCESAR SANCIONES EXONERADAS
    // ═════════════════════════════════════════════════════════════════════
    const { sanciones_condonadas, dias_sanciones_condonadas } = this.procesarSancionesExoneradas(sancionesExoneradas || []);

    // ═════════════════════════════════════════════════════════════════════
    // CONVERTIR DESGLOSE A FORMATO FINAL
    // Calcular componentes basados en los pagos registrados (concepto)
    // ═════════════════════════════════════════════════════════════════════
    const desglosePagos: { [key: number]: { capital: number; interes: number; aval: number; iva: number; totalAbonado: number } } = {};
    Object.entries(desglosePagosCompleto).forEach(([numCuotaStr, desglose]) => {
      const numCuota = parseInt(numCuotaStr);
      const registrosCuota = desglose.registros;
      
      // Calcular componentes basados en conceptos de pago
      let avalPagado = 0;
      let cuotaPagada = 0;
      
      registrosCuota.forEach(pago => {
        if (pago.concepto === 'Aval') {
          avalPagado += pago.abono;
        } else if (pago.concepto === 'Cuota' || pago.concepto === 'Cuota Parcial') {
          cuotaPagada += pago.abono;
        }
      });
      
      // Calcular capital e interés basado en la proporción de la cuota
      let capitalPagado = 0;
      let interesPagado = 0;
      
      if (cuotaPagada > 0) {
        // De la estructura estándar de refinanciamiento:
        // capital: 74291, interes: 8770 (proporciones: 89.4% y 10.6%)
        const capitalPorcentaje = 0.894;
        const interesPorcentaje = 0.106;
        
        capitalPagado = Math.round(cuotaPagada * capitalPorcentaje);
        interesPagado = Math.round(cuotaPagada * interesPorcentaje);
      }
      
      desglosePagos[numCuota] = {
        capital: capitalPagado,
        interes: interesPagado,
        aval: avalPagado,
        iva: 0,  // IVA generalmente viene incluido en el aval
        totalAbonado: desglose.totalAbonado,
      };
    });

    // ═════════════════════════════════════════════════════════════════════
    // ARMAR RESPUESTA FINAL
    // ═════════════════════════════════════════════════════════════════════
    const infoPagos: InfoPagosProcessados = {
      cuotaMaximaPagada,
      tieneCuotaParciall: tieneCuotaParcial,
      montoPagadoCuotaParcial,
      montoDebe,
      sanciones_condonadas,
      dias_sanciones_condonadas,
      desglosePagos,
      pagosJuridicos: {
        totalPrejuridico,
        totalJuridico,
        cantidadPagosJuridicos: pagosJuridicos.length,
      },
      saldoAFavor: {
        total: totalSaldoAFavor,
        cantidadRegistros: pagosAlFavor.length,
      },
      pagosEnMora: {
        totalPagadoEnMora,
        cantidadSancionesPagadas,
      },
    };

    return { valido: true, errores: [], infoPagos };
  }

  /**
   * Mapea sanciones pendientes (estado='Debe') a cuotas con distribución proporcional
   * 
   * FLUJO:
   * 1. Suma TODAS las sanciones pendientes
   * 2. Distribuye entre cuotas pendientes respetando límite máximo por período
   *    - Mensual: máx 30,000 por cuota
   *    - Quincenal: máx 15,000 por cuota
   * 3. Llena cada cuota hasta el máximo
   * 4. El RESTANTE de sanciones se asigna a la ÚLTIMA cuota pendiente
   * 5. NO asigna sanciones a cuotas que ya están completamente pagadas
   * 
   * @param sanciones Array de sanciones pendientes (estado = 'Debe')
   * @param amortizacion Array de cuotas con fechaPago calculadas
   * @param pagos Array de pagos registrados (no usado en nueva lógica, mantenido por compatibilidad)
   * @param periocidad 'mensual' o 'quincenal' para validar límites
   * @param cuotaMaximaPagada Última cuota completamente pagada (no asignar sanciones antes)
   * @returns Mapa de numeroCuota -> totalSancion acumulada
   */
  public static mapearSancionesACuotas(
    sanciones: SancionRegistro[],
    amortizacion: RefinanciamientoItem[],
    pagos?: PagoRegistro[],
    periocidad?: 'mensual' | 'quincenal',
    cuotaMaximaPagada?: number
  ): Map<number, number> {
    const sancionPorCuota = new Map<number, number>();

    // Obtener cuotas pendientes
    const cuotaMaxima = cuotaMaximaPagada || 0;
    const cuotasPendientes = amortizacion.filter(cuota => cuota.numeroCuota > cuotaMaxima);

    // Inicializar map con todas las cuotas pendientes en 0
    cuotasPendientes.forEach(cuota => {
      sancionPorCuota.set(cuota.numeroCuota, 0);
    });

    // Si no hay sanciones o no hay cuotas pendientes, retornar
    if (!sanciones || sanciones.length === 0 || cuotasPendientes.length === 0) {
      return sancionPorCuota;
    }

    // ═════════════════════════════════════════════════════════════════════
    // CALCULAR TOTAL DE SANCIONES A DISTRIBUIR
    // ═════════════════════════════════════════════════════════════════════
    const totalSanciones = sanciones.reduce((sum, s) => sum + s.valor, 0);
    const maximoSancionPorCuota = this.calcularMaximoSancionPorPeriodo(periocidad || 'mensual');

    // ═════════════════════════════════════════════════════════════════════
    // DISTRIBUIR SANCIONES ENTRE CUOTAS PENDIENTES
    // Estrategia: Llenar cada cuota hasta el máximo, restante va a la última
    // ═════════════════════════════════════════════════════════════════════
    let sancionesRestantes = totalSanciones;
    const cuotasNumeradas = Array.from(sancionPorCuota.keys()).sort((a, b) => a - b);

    for (let i = 0; i < cuotasNumeradas.length && sancionesRestantes > 0; i++) {
      const numeroCuota = cuotasNumeradas[i];
      const esUltimaCuota = i === cuotasNumeradas.length - 1;

      if (esUltimaCuota) {
        // Última cuota: asignar TODO lo restante (sin límite)
        sancionPorCuota.set(numeroCuota, sancionesRestantes);
        sancionesRestantes = 0;
      } else {
        // Cuotas intermedias: asignar hasta el máximo
        const aAsignar = Math.min(sancionesRestantes, maximoSancionPorCuota);
        sancionPorCuota.set(numeroCuota, aAsignar);
        sancionesRestantes -= aAsignar;
      }
    }

    return sancionPorCuota;
  }

  /**
   * Actualiza la amortización eliminando cuotas pagadas y ajustando la cuota parcial
   * 
   * Cuota parcial: Resta el monto pagado de forma secuencial en orden: IVA → Aval → Interés → Capital
   * Los valores que no se tocan se mantienen igual a las cuotas restantes
   * 
   * Con proxima_fecha_pago: Asigna essa fecha a la primera cuota con saldo pendiente,
   * luego genera fechas subsecuentes alternando entre fecha_pago1 y fecha_pago2
   */
  public static actualizarAmortizacionPorPagos(
    amortizacion: RefinanciamientoItem[],
    infoPagos: InfoPagosProcessados,
    sancionPorCuota?: Map<number, number>,
    proxima_fecha_pago?: string | Date,
    diasPago?: number[],
    periocidad?: 'mensual' | 'quincenal',
    numero_cuotas?: number,
    cuotas_faltantes?: number
  ): RefinanciamientoItem[] {
    if (!amortizacion || amortizacion.length === 0) {
      return [];
    }

    // Hacer una copia para no mutar el original
    let amortizacionActualizada = [...amortizacion];

    // ═══════════════════════════════════════════════════════════════════════════
    // PASO 1: SINCRONIZAR CON CUOTAS COMPLETAMENTE PAGADAS
    // Marcar con capital=0 solo las cuotas completamente pagadas (estado='Ok')
    // ═══════════════════════════════════════════════════════════════════════════
    // Usar cuotaMaximaPagada como fuente de verdad (es el máximo número de cuota con estado='Ok')
    const cuotasAMarcaEnCero = infoPagos.cuotaMaximaPagada;

    // Marcar cuotas como pagadas (todas sus componentes en 0)
    for (let i = 0; i < amortizacionActualizada.length; i++) {
      const cuota = amortizacionActualizada[i];
      if (cuota.numeroCuota <= cuotasAMarcaEnCero) {
        // Cuota COMPLETAMENTE PAGADA O CONDONADA → todos los valores en 0
        amortizacionActualizada[i] = {
          ...cuota,
          capital: 0,
          interes: 0,
          aval: 0,
          iva: 0,
          cuotaTotal: 0,
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PASO 2: PROCESAR CUOTA PARCIAL SI EXISTE
    // ═══════════════════════════════════════════════════════════════════════════
    if (infoPagos.tieneCuotaParciall && infoPagos.montoPagadoCuotaParcial > 0) {
      // La cuota parcial es la siguiente después de las pagadas
      const numeroCuotaParcial = cuotasAMarcaEnCero + 1;
      const indexCuotaParcial = amortizacionActualizada.findIndex(c => c.numeroCuota === numeroCuotaParcial);

      if (indexCuotaParcial !== -1) {
        const cuotaParcial = amortizacionActualizada[indexCuotaParcial];
        const montoPagado = infoPagos.montoPagadoCuotaParcial;
        const totalCuota = cuotaParcial.cuotaTotal;
        const saldoPendiente = Math.max(0, totalCuota - montoPagado);

        // Restar el monto pagado de forma secuencial: IVA → Aval → Interés → Capital
        let restoPorRestar = montoPagado;
        let nuevoIva = cuotaParcial.iva;
        let nuevoAval = cuotaParcial.aval;
        let nuevoInteres = cuotaParcial.interes;
        let nuevoCapital = cuotaParcial.capital;

        // Restar del IVA
        if (restoPorRestar > 0 && nuevoIva > 0) {
          const ivaAResta = Math.min(restoPorRestar, nuevoIva);
          nuevoIva -= ivaAResta;
          restoPorRestar -= ivaAResta;
        }

        // Restar del Aval
        if (restoPorRestar > 0 && nuevoAval > 0) {
          const avalAResta = Math.min(restoPorRestar, nuevoAval);
          nuevoAval -= avalAResta;
          restoPorRestar -= avalAResta;
        }

        // Restar del Interés
        if (restoPorRestar > 0 && nuevoInteres > 0) {
          const interesAResta = Math.min(restoPorRestar, nuevoInteres);
          nuevoInteres -= interesAResta;
          restoPorRestar -= interesAResta;
        }

        // Restar del Capital
        if (restoPorRestar > 0 && nuevoCapital > 0) {
          const capitalAResta = Math.min(restoPorRestar, nuevoCapital);
          nuevoCapital -= capitalAResta;
          restoPorRestar -= capitalAResta;
        }

        // Construir la nueva cuota con los valores ajustados
        // El saldo pendiente es simplemente lo que falta pagar = totalCuota - montoPagado
        amortizacionActualizada[indexCuotaParcial] = {
          ...cuotaParcial,
          capital: Math.max(0, nuevoCapital),
          interes: Math.max(0, nuevoInteres),
          aval: Math.max(0, nuevoAval),
          iva: Math.max(0, nuevoIva),
          cuotaTotal: saldoPendiente,
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PASO 3: AGREGAR SANCIONES A CUOTAS PENDIENTES (INFORMATIVO)
    // ═══════════════════════════════════════════════════════════════════════════
    if (sancionPorCuota && sancionPorCuota.size > 0) {
      for (let i = 0; i < amortizacionActualizada.length; i++) {
        const cuota = amortizacionActualizada[i];
        const sancionCuota = sancionPorCuota.get(cuota.numeroCuota);

        // Agregar sanción si existe en el mapa (solo en cuotas pendientes)
        if (sancionCuota !== undefined && cuota.numeroCuota > cuotasAMarcaEnCero) {
          amortizacionActualizada[i] = {
            ...cuota,
            sancion: sancionCuota,
          };
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PASO 4-5: RECALCULAR FECHAS DE PAGO PARA CUOTAS PENDIENTES
    // Aplicar proxima_fecha_pago a la primera cuota con saldo pendiente
    // ═══════════════════════════════════════════════════════════════════════════
    if (proxima_fecha_pago && diasPago && diasPago.length > 0 && periocidad) {
      let primeraConSaldoEncontrada = false;
      let fechaAnterior: Date | null = null;

      for (let i = 0; i < amortizacionActualizada.length; i++) {
        const cuota = amortizacionActualizada[i];

        // Identificar primera cuota con capital pendiente (saldo > 0)
        if (!primeraConSaldoEncontrada && cuota.capital > 0) {
          // Esta es la primera cuota con saldo → asignar proxima_fecha_pago
          const fechaProxima = new Date(proxima_fecha_pago);
          amortizacionActualizada[i] = {
            ...cuota,
            fechaPago: fechaProxima.toISOString().split('T')[0],
          };
          fechaAnterior = fechaProxima;
          primeraConSaldoEncontrada = true;
        } else if (primeraConSaldoEncontrada && cuota.capital > 0 && fechaAnterior) {
          // Cuotas subsecuentes: generar fechas alternando entre diasPago[0] y diasPago[1]
          const proximaFecha = this.calcularSiguienteFechaPago(
            fechaAnterior,
            periocidad,
            i, // Índice usado para determinar cuál día usar (alternancia)
            diasPago
          );
          amortizacionActualizada[i] = {
            ...cuota,
            fechaPago: proximaFecha.toISOString().split('T')[0],
          };
          fechaAnterior = proximaFecha;
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PASO 6: RECALCULAR SALDOS ACUMULADOS BASADOS EN CAPITAL PENDIENTE
    // ═══════════════════════════════════════════════════════════════════════════
    // Calcular el capital REALMENTE pagado sumando capital de cuotas completamente pagadas
    // más la proporción del capital pagado en la cuota parcial
    let capitalPagado = 0;

    // Sumar capital de cuotas completamente pagadas (numeroCuota <= cuotasAMarcaEnCero)
    for (let i = 0; i < cuotasAMarcaEnCero && i < amortizacion.length; i++) {
      capitalPagado += amortizacion[i].capital;
    }

    // Para la cuota parcial, calcular la proporción de capital pagado
    if (infoPagos.tieneCuotaParciall && infoPagos.montoPagadoCuotaParcial > 0) {
      const numeroCuotaParcial = cuotasAMarcaEnCero + 1;
      const indexCuotaParcial = amortizacion.findIndex(c => c.numeroCuota === numeroCuotaParcial);
      
      if (indexCuotaParcial !== -1) {
        const cuotaParcialOrig = amortizacion[indexCuotaParcial];
        const totalCuota = cuotaParcialOrig.cuotaTotal;
        const montoPagado = infoPagos.montoPagadoCuotaParcial;
        
        // Calcular la proporción de capital pagado en esta cuota
        // Proporción: montoPagado / totalCuota
        if (totalCuota > 0) {
          const proporcion = montoPagado / totalCuota;
          const capitalParcialPagado = Math.round(cuotaParcialOrig.capital * proporcion);
          capitalPagado += capitalParcialPagado;
        }
      }
    }

    // Calcular el capital PENDIENTE
    const capitalOriginal = amortizacion[0]?.capitalEnMora || 
                           amortizacion.reduce((sum, q) => sum + q.capital, 0);
    const capitalPendiente = Math.max(0, capitalOriginal - capitalPagado);

    // Recalcular saldos acumulados con el capital PENDIENTE correctamente distribuido
    // IMPORTANTE: Usar capital de amortización ORIGINAL para calcular proporciones
    let capitalAcumuladoPendientes = 0;
    
    for (let i = cuotasAMarcaEnCero; i < amortizacion.length; i++) {
      capitalAcumuladoPendientes += amortizacion[i].capital;  // Usar ORIGINAL, no actualizada
    }

    // Distribuir el capital pendiente proporcionalmente en cuotas con saldo (solo cuotas > cuotasAMarcaEnCero)
    if (capitalAcumuladoPendientes > 0) {
      for (let i = 0; i < amortizacionActualizada.length; i++) {
        const cuota = amortizacionActualizada[i];
        
        // Si la cuota está pagada (numeroCuota <= cuotasAMarcaEnCero), capital debe ser 0
        if (cuota.numeroCuota <= cuotasAMarcaEnCero) {
          // Garantizar que capital sea 0 para cuotas pagadas
          amortizacionActualizada[i] = {
            ...cuota,
            capital: 0,
            cuotaTotal: 0,  // Cuota pagada también tiene cuotaTotal = 0
          };
        } else {
          // Cuotas pendientes: distribuir capital proporcionalmente
          const capitalOriginalCuota = amortizacion[i].capital;  // Usar ORIGINAL
          const proporcionCuota = capitalOriginalCuota / capitalAcumuladoPendientes;
          const capitalAjustado = Math.round(capitalPendiente * proporcionCuota);
          
          // Ajustar también el cuotaTotal proporcionalmente
          const cuotaTotalOriginal = amortizacion[i].cuotaTotal;  // Usar ORIGINAL
          const proporcionCuotaTotal = capitalAjustado / (capitalOriginalCuota || 1);
          const cuotaTotalAjustada = Math.round(cuotaTotalOriginal * proporcionCuotaTotal);
          
          amortizacionActualizada[i] = {
            ...cuota,
            capital: capitalAjustado,
            cuotaTotal: cuotaTotalAjustada,
          };
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PASO 7: RECALCULAR SALDOS DE ATRÁS HACIA ADELANTE
    // El saldo es la suma acumulada del capital desde esta cuota hasta el final
    // ═══════════════════════════════════════════════════════════════════════════
    let saldoAcumuladoDesdeAtras = 0;
    
    // Iterar de atrás hacia adelante para acumular saldos
    for (let i = amortizacionActualizada.length - 1; i >= 0; i--) {
      const cuota = amortizacionActualizada[i];
      saldoAcumuladoDesdeAtras += cuota.capital;
      
      amortizacionActualizada[i] = {
        ...cuota,
        saldo: saldoAcumuladoDesdeAtras,
      };
    }

    return amortizacionActualizada;
  }

  /**
   * Valida la información del crédito obtenida de la BD
   */
  private static validarInfoCredito(infoCredito: Partial<InfoCreditoData>): { valido: boolean; errores: string[] } {
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
      const periodoNormalizado = infoCredito.periodicidad.toLowerCase();
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

  /**
   * Normaliza la información del crédito para su procesamiento
   */
  private static normalizarInfoCredito(infoCredito: InfoCreditoData): InfoCreditoData {
    return {
      ...infoCredito,
      periodicidad: infoCredito.periodicidad.toLowerCase() === 'mensual' ? 'mensual' : 'quincenal',
      valor_prestamo: Number(infoCredito.valor_prestamo),
      valor_cuota: Number(infoCredito.valor_cuota),
      cantidad_meses: Number(infoCredito.cantidad_meses),
      credito_id: Number(infoCredito.credito_id),
      fecha_creacion: typeof infoCredito.fecha_creacion === 'string' 
        ? new Date(infoCredito.fecha_creacion) 
        : infoCredito.fecha_creacion,
    };
  }

  /**
   * Calcula amortización ALTERNATIVA cuando cta_aval y cta_iva_aval son null/0/undefined
   * 
   * FLUJO:
   * 1. Capital por cuota = valor_prestamo / cantidad_meses (x2 si es quincenal)
   * 2. Excedente = valor_cuota - capital
   * 3. Distribuye excedente:
   *    - 60% para aval
   *    - 10% para iva_aval
   *    - 30% para intereses
   * 4. Genera fechas de pago usando fecha_pago1 y fecha_pago2 según período
   * 
   * @param infoCredito Información del crédito normalizada
   * @returns Array de RefinanciamientoItem
   */
  private static calcularAmortizacionAlternativa(infoCredito: InfoCreditoData): RefinanciamientoItem[] {
    const {
      credito_id,
      documento,
      valor_prestamo,
      valor_cuota,
      cantidad_meses,
      periodicidad,
      fecha_creacion,
      fecha_pago1,
      fecha_pago2,
    } = infoCredito;

    // Normalizar periodicidad
    const periocidadNormalizada = String(periodicidad).toLowerCase() === 'mensual' ? 'mensual' : 'quincenal';

    // Calcular número de cuotas según período
    const numeroCuotas = periocidadNormalizada === 'quincenal' ? cantidad_meses * 2 : cantidad_meses;
    
    // Capital por cuota (distribución simple)
    const capitalPorCuota = Math.round(valor_prestamo / numeroCuotas);
    
    // Excedente entre valor_cuota y capital
    const excedente = valor_cuota - capitalPorCuota;
    
    // Distribución del excedente
    const avalExcedente = Math.round(excedente * 0.6); // 60%
    const ivaExcedente = Math.round(excedente * 0.1); // 10%
    const interesExcedente = Math.round(excedente * 0.3); // 30%
    
    // Construir array de dias de pago según período
    const diasPago: number[] = [];
    if (periocidadNormalizada === 'quincenal') {
      // Quincenal: usar fecha_pago1 y fecha_pago2
      diasPago.push(Number(fecha_pago1) || 1);
      if (fecha_pago2) {
        diasPago.push(Number(fecha_pago2) || 1);
      } else {
        // Si solo hay fecha_pago1, usar el mismo día duas veces
        diasPago.push(Number(fecha_pago1) || 1);
      }
    } else {
      // Mensual: usar solo fecha_pago1
      diasPago.push(Number(fecha_pago1) || 1);
    }
    
    // Calcular fecha del primer pago
    const fechaPrimerPago = this.calcularFechaPrimerPago(
      new Date(fecha_creacion),
      periocidadNormalizada,
      diasPago
    );

    const amortizacion: RefinanciamientoItem[] = [];
    let saldoRestante = valor_prestamo;

    for (let i = 0; i < numeroCuotas; i++) {
      // Última cuota: usar saldo restante como capital
      let capital = i === numeroCuotas - 1 ? saldoRestante : capitalPorCuota;
      
      // Cuota total
      const cuotaTotal = capital + interesExcedente + avalExcedente + ivaExcedente;

      // Actualizar saldo
      saldoRestante -= capital;
      saldoRestante = Math.max(0, saldoRestante);

      // Calcular fecha de pago para esta cuota
      const fechaPago = this.calcularSiguienteFechaPago(
        fechaPrimerPago,
        periocidadNormalizada,
        i,
        diasPago
      );

      amortizacion.push({
        prestamoId: credito_id,
        documento,
        numeroCuota: i + 1,
        capitalEnMora: valor_prestamo,
        capital,
        interes: interesExcedente,
        aval: avalExcedente,
        iva: ivaExcedente,
        cuotaTotal,
        saldo: saldoRestante,
        fechaPago: fechaPago.toISOString().split('T')[0],
      });
    }

    // Sanitizar resultados para asegurar valores positivos
    return this.sanitizarResultadosAmortizacion(amortizacion);
  }

  /**
   * Crea parámetros de refinanciamiento a partir de la información del crédito
   * Calcula automáticamente la fecha del primer pago usando los días de pago
   */
  private static crearParametrosRefinanciamiento(
    infoCredito: InfoCreditoData
  ): RefinanciamientoParams {
    const periocidad = (infoCredito.periodicidad.toLowerCase() === 'mensual' ? 'mensual' : 'quincenal') as 'mensual' | 'quincenal';

    // Construir array de días de pago
    let diasPago: number[] = [];
    if (periocidad === 'quincenal') {
      // Para quincenal: usar p_fecha (día 1) y s_fecha (día 2)
      if (infoCredito.fecha_pago1) diasPago.push(infoCredito.fecha_pago1);
      if (infoCredito.fecha_pago2) diasPago.push(infoCredito.fecha_pago2);
    } else {
      // Para mensual: usar solo p_fecha
      if (infoCredito.fecha_pago1) diasPago.push(infoCredito.fecha_pago1);
    }

    // Calcular la fecha del primer pago usando los días de pago
    const fechaPrimerPago = diasPago.length > 0 
      ? this.calcularFechaPrimerPago(
          new Date(infoCredito.fecha_creacion),
          periocidad,
          diasPago
        )
      : new Date(infoCredito.fecha_creacion);

    return {
      capitalEnMora: infoCredito.valor_prestamo,
      cantidadMeses: infoCredito.cantidad_meses,
      periocidad,
      valorCuotaAcordada: infoCredito.valor_cuota,
      documento: infoCredito.documento,
      prestamoId: infoCredito.credito_id,
      iva_aval: 19,
      fechaPrimerPago,
      cta_aval: infoCredito.cta_aval || 0,
      cta_iva_aval: infoCredito.cta_iva_aval || 0,
      diasPago,
    };
  }

  /**
   * Calcula estadísticas de la amortización
   */
  private static calcularEstadisticas(amortizacion: RefinanciamientoItem[]) {
    if (amortizacion.length === 0) {
      return {
        totalCuotas: 0,
        cuotaTotal: 0,
        totalCapital: 0,
        totalInteres: 0,
        totalAval: 0,
        totalIVA: 0,
      };
    }

    const totalCuotas = amortizacion.length;
    const totalCapital = amortizacion.reduce((sum, item) => sum + item.capital, 0);
    const totalInteres = amortizacion.reduce((sum, item) => sum + item.interes, 0);
    const totalAval = amortizacion.reduce((sum, item) => sum + item.aval, 0);
    const totalIVA = amortizacion.reduce((sum, item) => sum + item.iva, 0);
    const cuotaTotal = amortizacion.length > 0 ? amortizacion[0].cuotaTotal : 0;

    return {
      totalCuotas,
      cuotaTotal,
      totalCapital,
      totalInteres,
      totalAval,
      totalIVA,
    };
  }

  /**
   * Calcula refinanciamiento con procesamiento de pagos y sanciones
   * Función principal que integra todo el flujo
   */
  public static calcularRefinanciamientoConPagos(
    infoCredito: InfoCreditoData,
    pagos: PagoRegistro[],
    sanciones?: SancionRegistro[],
    sancionesExoneradas?: SancionRegistro[],
    sancionesPagadas?: SancionRegistro[],
    extras?: ExtraRegistro[]
  ): ResultadoRefinanciamientoConPagos {
    const resultado: ResultadoRefinanciamientoConPagos = {
      exitoso: false,
      mensaje: '',
      errores: [],
    };

    try {
      // Paso 1: Validar información del crédito
      const validacionCredito = this.validarInfoCredito(infoCredito);
      if (!validacionCredito.valido) {
        resultado.errores = validacionCredito.errores;
        resultado.mensaje = 'Información del crédito inválida';
        return resultado;
      }

      // Paso 2: Normalizar información del crédito
      const creditoNormalizado = this.normalizarInfoCredito(infoCredito);
      resultado.infoCredito = creditoNormalizado;


      // Paso 3: Validar y procesar pagos con sanciones pagadas
      const procesoPagos = this.procesarPagos(pagos, creditoNormalizado.valor_cuota, sancionesExoneradas, sancionesPagadas);
      if (!procesoPagos.valido) {
        resultado.errores = procesoPagos.errores;
        resultado.mensaje = 'Información de pagos inválida';
        return resultado;
      }

      resultado.infoPagos = procesoPagos.infoPagos;

      // Paso 4: Detectar si necesita amortización alternativa (cta_aval/cta_iva_aval nulos)
      const requiereAmortizacionAlternativa = 
        (creditoNormalizado.cta_aval === null || creditoNormalizado.cta_aval === undefined || creditoNormalizado.cta_aval === 0) &&
        (creditoNormalizado.cta_iva_aval === null || creditoNormalizado.cta_iva_aval === undefined || creditoNormalizado.cta_iva_aval === 0);

      // Paso 5: Calcular amortización original (por método alternativo o estándar)
      let amortizacionOriginal: RefinanciamientoItem[];
      let params: RefinanciamientoParams;
      
      if (requiereAmortizacionAlternativa) {
        // Usar amortización alternativa cuando no hay cta_aval/cta_iva_aval
        amortizacionOriginal = this.calcularAmortizacionAlternativa(creditoNormalizado);
        // Crear parámetros solo para obtener diasPago
        params = this.crearParametrosRefinanciamiento(creditoNormalizado);
      } else {
        // Usar amortización estándar de refinanciamiento
        params = this.crearParametrosRefinanciamiento(creditoNormalizado);
        amortizacionOriginal = this.calcularRefinanciamiento(params);
      }
      
      resultado.amortizacionOriginal = amortizacionOriginal;

      // Paso 6: Mapear sanciones a cuotas más morosas (si existen)
      // NO incluir sanciones en cuotas ya pagadas (cuotaMaximaPagada)
      let sancionPorCuota: Map<number, number> | undefined;
      if (sanciones && sanciones.length > 0) {
        const periocidadNormalizada = creditoNormalizado.periodicidad === 'Mensual' || creditoNormalizado.periodicidad === 'mensual' 
          ? 'mensual' 
          : 'quincenal';
        const cuotaMaximaPagada = resultado.infoPagos?.cuotaMaximaPagada || 0;
        sancionPorCuota = this.mapearSancionesACuotas(sanciones, amortizacionOriginal, pagos, periocidadNormalizada, cuotaMaximaPagada);
      }

      // Paso 7: Actualizar amortización con pagos realizados (y sanciones si existen)
      // Pasar número_cuotas y cuotas_faltantes para sincronizar con información de BD
      const amortizacionActualizada = this.actualizarAmortizacionPorPagos(
        amortizacionOriginal,
        procesoPagos.infoPagos!,
        sancionPorCuota,
        creditoNormalizado.proxima_fecha_pago,
        params.diasPago,
        creditoNormalizado.periodicidad === 'Mensual' || creditoNormalizado.periodicidad === 'mensual' ? 'mensual' : 'quincenal',
        Number(creditoNormalizado.cantidad_meses),
        Number(creditoNormalizado.cuotas_faltantes)
      );

      // ═══════════════════════════════════════════════════════════════════════════
      // SANITIZAR AMORTIZACIÓN (ASEGURAR VALORES POSITIVOS)
      // ═══════════════════════════════════════════════════════════════════════════
      const amortizacionActualizadaSanitizada = this.sanitizarResultadosAmortizacion(amortizacionActualizada);
      const amortizacionOriginalSanitizada = this.sanitizarResultadosAmortizacion(amortizacionOriginal);
      
      resultado.amortizacionOriginal = amortizacionOriginalSanitizada;
      resultado.amortizacionActualizada = amortizacionActualizadaSanitizada;

      // Paso 8: Calcular estadísticas
      resultado.estadisticas = this.calcularEstadisticas(amortizacionActualizadaSanitizada);

      // Paso 9: Procesar gastos de cartera (prejuridico y juridico)
      // RESTA los pagos jurídicos ya realizados para obtener el saldo pendiente
      if (extras && extras.length > 0) {
        resultado.gastosCartera = this.procesarGastosCartera(extras, procesoPagos.infoPagos);
      } else {
        resultado.gastosCartera = {
          prejuridico: { total: 0, cantidad: 0 },
          juridico: { total: 0, cantidad: 0 }
        };
      }

      // Paso 10: Establecer resultado exitoso
      resultado.exitoso = true;
      resultado.mensaje = `Refinanciamiento calculado exitosamente. Cuotas pendientes: ${amortizacionActualizadaSanitizada.length}`;

      return resultado;
    } catch (error) {
      resultado.exitoso = false;
      resultado.mensaje = 'Error al procesar refinanciamiento';
      resultado.errores.push(error instanceof Error ? error.message : 'Error desconocido');
      return resultado;
    }
  }



  /**
   * Sanitiza los resultados de amortización asegurando valores positivos
   * Reemplaza valores negativos con 0 y ajusta el capital si es necesario
   */
  private static sanitizarResultadosAmortizacion(
    amortizacion: RefinanciamientoItem[]
  ): RefinanciamientoItem[] {
    return amortizacion.map((item, index) => {
      let { interes, aval, iva, cuotaTotal, saldo } = item;

      // Validar que interes sea positivo
      if (interes < 0) {
        console.warn(`[SANITIZACION] Cuota ${item.numeroCuota}: Interés negativo (${interes}) → ajustado a 0`);
        interes = 0;
      }

      // Validar que aval sea positivo
      if (aval < 0) {
        console.warn(`[SANITIZACION] Cuota ${item.numeroCuota}: Aval negativo (${aval}) → ajustado a 0`);
        aval = 0;
      }

      // Validar que iva sea positivo
      if (iva < 0) {
        console.warn(`[SANITIZACION] Cuota ${item.numeroCuota}: IVA negativo (${iva}) → ajustado a 0`);
        iva = 0;
      }

      // Recalcular cuota total
      cuotaTotal = item.capital + interes + aval + iva;

      // Validar que saldo sea positivo
      if (saldo < 0) {
        console.warn(`[SANITIZACION] Cuota ${item.numeroCuota}: Saldo negativo (${saldo}) → ajustado a 0`);
        saldo = 0;
      }

      return {
        ...item,
        interes,
        aval,
        iva,
        cuotaTotal,
        saldo
      };
    });
  }



  /**
   * Método principal para calcular refinanciamiento
   * Implementa 3 casuísticas según parámetros de entrada
   * 
   * CASUÍSTICA 1: Si cuota == capital distribuido
   *   → Ignorar cta_aval y cta_iva_aval, solo capital
   * 
   * CASUÍSTICA 2A: Si (cta_aval + cta_iva_aval) > excedente
   *   → Calcular: aval = FLOOR(excedente/1.19), iva = excedente - aval, interes = 0
   * 
   * CASUÍSTICA 2B: Si (cta_aval + cta_iva_aval) <= excedente
   *   → Aplicar directamente: aval = cta_aval, iva = cta_iva_aval, interes = excedente - aval - iva
   * 
   * CASUÍSTICA 3: Si no existen cta_aval y cta_iva_aval
   *   → Usar porcentajes: aval = 60%, iva = 10%, interes = 30% del excedente
   */
  public static calcularRefinanciamiento(params: RefinanciamientoParams): RefinanciamientoItem[] {
    const {
      capitalEnMora,
      cantidadMeses,
      periocidad,
      valorCuotaAcordada,
      documento,
      prestamoId,
      fechaPrimerPago = this.getFechaColombia(),
      cta_aval,
      cta_iva_aval,
      diasPago = periocidad === 'quincenal' ? [5, 20] : [1],
    } = params;

    // Validaciones iniciales
    if (capitalEnMora <= 0) throw new Error('El capital en mora debe ser mayor a cero');
    if (cantidadMeses <= 0) throw new Error('La cantidad de meses debe ser mayor a cero');
    if (valorCuotaAcordada <= 0) throw new Error('La cuota acordada debe ser mayor a cero');
    if (!['mensual', 'quincenal'].includes(periocidad)) throw new Error('Periocidad inválida');

    // Calcular número de cuotas
    const numeroCuotas = periocidad === 'quincenal' ? cantidadMeses * 2 : cantidadMeses;

    // Validar cuota mínima
    const cuotaMinima = Math.ceil(capitalEnMora / numeroCuotas);
    if (valorCuotaAcordada < cuotaMinima) {
      throw new Error(`La cuota acordada ($${valorCuotaAcordada}) debe ser >= cuota mínima ($${cuotaMinima})`);
    }

    // Distribuir capital exactamente
    const capitalPorCuota = Math.floor(capitalEnMora / numeroCuotas);
    const residuoCapital = capitalEnMora % numeroCuotas;
    const capitalUltimaCuota = capitalPorCuota + residuoCapital;

    // Calcular excedente
    const excedentePorCuota = valorCuotaAcordada - capitalPorCuota;

    // Determinar casuística y calcular aval, iva, interes
    let avalPorCuota: number;
    let ivaPorCuota: number;
    let interesPorCuota: number;

    // CASUÍSTICA 1: Si cuota == capital distribuido
    if (excedentePorCuota === 0) {
      avalPorCuota = 0;
      ivaPorCuota = 0;
      interesPorCuota = 0;
    }
    // CASUÍSTICA 2: Existen cta_aval y cta_iva_aval
    else if (cta_aval !== undefined && cta_aval !== null && cta_iva_aval !== undefined && cta_iva_aval !== null) {
      const sumaAvalIva = cta_aval + cta_iva_aval;

      // CASUÍSTICA 2A: Suma mayor al excedente
      if (sumaAvalIva > excedentePorCuota) {
        avalPorCuota = Math.floor(excedentePorCuota / 1.19);
        ivaPorCuota = excedentePorCuota - avalPorCuota;
        interesPorCuota = 0;
      }
      // CASUÍSTICA 2B: Suma menor o igual al excedente
      else {
        avalPorCuota = cta_aval;
        ivaPorCuota = cta_iva_aval;
        interesPorCuota = excedentePorCuota - avalPorCuota - ivaPorCuota;
      }
    }
    // CASUÍSTICA 3: No existen cta_aval y cta_iva_aval (usar porcentajes)
    else {
      avalPorCuota = Math.floor(excedentePorCuota * 0.60);
      ivaPorCuota = Math.floor(excedentePorCuota * 0.10);
      interesPorCuota = excedentePorCuota - avalPorCuota - ivaPorCuota;
    }

    // Construir amortización
    const amortizacion: RefinanciamientoItem[] = [];
    let saldoPendiente = capitalEnMora;
    let fechaAnterior = fechaPrimerPago;

    for (let i = 0; i < numeroCuotas; i++) {
      const esUltimaCuota = i === numeroCuotas - 1;
      const capitalCuota = esUltimaCuota ? capitalUltimaCuota : capitalPorCuota;

      saldoPendiente -= capitalCuota;
      saldoPendiente = Math.max(0, saldoPendiente);

      const fechaCuota = i === 0 ? fechaPrimerPago : this.calcularSiguienteFechaPago(fechaAnterior, periocidad, i, diasPago);
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

    // Sanitizar resultados para asegurar valores positivos
    return this.sanitizarResultadosAmortizacion(amortizacion);
  }


}
