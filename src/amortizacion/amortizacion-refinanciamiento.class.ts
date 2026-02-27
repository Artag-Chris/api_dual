/**
 * Clase Amortización Refinanciamiento
 * Sistema para reestructuración de créditos en mora
 * Capital distribuido equitativamente + Aval fijo por cuota
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
}

export interface ResultadoRefinanciamientoConPagos {
  exitoso: boolean;
  mensaje: string;
  errores: string[];
  infoCredito?: InfoCreditoData;
  infoPagos?: InfoPagosProcessados;
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
   * Procesa y valida los pagos, extrayendo información relevante
   * Agrupa por número de cuota e identifica cuotas pagadas vs parciales
   * 
   * Caso especial: Si no hay pagos (array vacío), retorna infoPagos con valores por defecto
   * indicando que no hay cuotas pagadas y se generará amortización completa
   */
  public static procesarPagos(pagos: PagoRegistro[], valorCuota: number, sancionesExoneradas?: SancionRegistro[]): { valido: boolean; errores: string[]; infoPagos?: InfoPagosProcessados } {
    // Validar estructura
    const validacion = this.validarEstructuraPagos(pagos);
    if (!validacion.valido) {
      return { valido: false, errores: validacion.errores };
    }

    // CASO ESPECIAL: Sin pagos registrados (crédito nuevo)
    // Retornar infoPagos con valores por defecto: no hay cuotas pagadas
    if (pagos.length === 0) {
      const infoPagos: InfoPagosProcessados = {
        cuotaMaximaPagada: 0,
        tieneCuotaParciall: false,
        montoPagadoCuotaParcial: 0,
        montoDebe: 0,
        sanciones_condonadas: 0,
        dias_sanciones_condonadas: 0,
        desglosePagos: {},
      };
      return { valido: true, errores: [], infoPagos };
    }

    // Asignar cuota numbers a pagos con num_cuota = NULL (agrupa múltiples pagos por cuota)
    const pagosConCuotasAsignadas = this.asignarCuotasANullPayments(pagos, valorCuota);

    // Calcular desglose completo de pagos por cuota
    const desglosePagosCompleto = this.calcularDesglosePagos(pagosConCuotasAsignadas);

    // Obtener cuota máxima COMPLETAMENTE pagada (estado='Ok' en todos los registros)
    let cuotaMaximaPagada = 0;
    Object.entries(desglosePagosCompleto).forEach(([numCuotaStr, desglose]) => {
      const numCuota = parseInt(numCuotaStr);
      // Una cuota está completamente pagada si su estado es 'Ok'
      if (desglose.estado === 'Ok' && numCuota > cuotaMaximaPagada) {
        cuotaMaximaPagada = numCuota;
      }
    });

    // Detectar cuota parcial (la siguiente después de la máxima pagada)
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

    // Procesar sanciones exoneradas
    const { sanciones_condonadas, dias_sanciones_condonadas } = this.procesarSancionesExoneradas(sancionesExoneradas || []);

    // Convertir desglose a formato esperado por InfoPagosProcessados
    const desglosePagos: { [key: number]: { capital: number; interes: number; aval: number; iva: number; totalAbonado: number } } = {};
    Object.entries(desglosePagosCompleto).forEach(([numCuotaStr, desglose]) => {
      const numCuota = parseInt(numCuotaStr);
      desglosePagos[numCuota] = {
        capital: 0, // No se usa en este contexto
        interes: 0,
        aval: 0,
        iva: 0,
        totalAbonado: desglose.totalAbonado,
      };
    });

    const infoPagos: InfoPagosProcessados = {
      cuotaMaximaPagada,
      tieneCuotaParciall: tieneCuotaParcial,
      montoPagadoCuotaParcial,
      montoDebe,
      sanciones_condonadas,
      dias_sanciones_condonadas,
      desglosePagos,
    };

    return { valido: true, errores: [], infoPagos };
  }

  /**
   * Mapea sanciones (penalties) a cuotas basado en rangos de fechas
   * 
   * Lógica:
   * - Para cada sanción, verifica su fecha (created_at)
   * - Encuentra la cuota cuyo rango de fecha la contiene:
   *   → Cuota N: desde fechaPago[N-1] hasta fechaPago[N]
   * - Acumula el valor de la sanción a esa cuota
   * 
   * @param sanciones Array de sanciones pendientes (estado = 'Debe')
   * @param amortizacion Array de cuotas con fechaPago calculadas
   * @returns Mapa de numeroCuota -> totalSancion acumulada
   */
  public static mapearSancionesACuotas(
    sanciones: SancionRegistro[],
    amortizacion: RefinanciamientoItem[]
  ): Map<number, number> {
    const sancionPorCuota = new Map<number, number>();

    // Inicializar todas las cuotas con sanción = 0
    amortizacion.forEach(cuota => {
      sancionPorCuota.set(cuota.numeroCuota, 0);
    });

    // Si no hay sanciones, retornar el mapa vacío
    if (!sanciones || sanciones.length === 0) {
      return sancionPorCuota;
    }

    // Para cada sanción, determinar a qué cuota pertenece
    sanciones.forEach(sancion => {
      const fechaSancion = new Date(sancion.created_at);

      // Encontrar la cuota que contiene esta sanción
      for (let i = 0; i < amortizacion.length; i++) {
        const cuota = amortizacion[i];
        const cuotaNumero = cuota.numeroCuota;
        const fechaActual = new Date(cuota.fechaPago);

        // Determinar el rango: desde la cuota anterior hasta la actual
        let fechaInicio: Date;
        
        if (cuotaNumero === 1) {
          // Primera cuota: desde el comienzo del tiempo
          fechaInicio = new Date('1900-01-01');
        } else {
          // Otras cuotas: desde la fecha de pago de la cuota anterior
          const cuotaAnterior = amortizacion[i - 1];
          fechaInicio = new Date(cuotaAnterior.fechaPago);
        }

        // Verificar si la sanción cae en este rango (fechaInicio < sancion.created_at <= fechaPago)
        if (fechaSancion > fechaInicio && fechaSancion <= fechaActual) {
          const sancionActual = sancionPorCuota.get(cuotaNumero) || 0;
          sancionPorCuota.set(cuotaNumero, sancionActual + sancion.valor);
          break; // Sanción mapeada, pasar a la siguiente
        }
      }

      // Si la sanción es posterior a todas las cuotas, asignarla a la última
      const fechaUltimaCuota = new Date(amortizacion[amortizacion.length - 1].fechaPago);
      if (fechaSancion > fechaUltimaCuota) {
        const ultimaCuota = amortizacion[amortizacion.length - 1].numeroCuota;
        const sancionActual = sancionPorCuota.get(ultimaCuota) || 0;
        sancionPorCuota.set(ultimaCuota, sancionActual + sancion.valor);
      }
    });

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
    periocidad?: 'mensual' | 'quincenal'
  ): RefinanciamientoItem[] {
    if (!amortizacion || amortizacion.length === 0) {
      return [];
    }

    // Hacer una copia para no mutar el original
    let amortizacionActualizada = [...amortizacion];

    // Paso 1: Marcar cuotas pagadas con valores en 0
    for (let i = 0; i < amortizacionActualizada.length; i++) {
      const cuota = amortizacionActualizada[i];
      if (cuota.numeroCuota <= infoPagos.cuotaMaximaPagada) {
        // Cuota COMPLETAMENTE PAGADA → todos los valores en 0
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

    // Paso 2: Procesar cuota parcial si existe
    if (infoPagos.tieneCuotaParciall && infoPagos.montoPagadoCuotaParcial > 0) {
      const numeroCuotaParcial = infoPagos.cuotaMaximaPagada + 1;
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

    // Paso 3: Agregar sanciones a las cuotas correspondientes (solo informativo)
    if (sancionPorCuota && sancionPorCuota.size > 0) {
      for (let i = 0; i < amortizacionActualizada.length; i++) {
        const cuota = amortizacionActualizada[i];
        const sancionCuota = sancionPorCuota.get(cuota.numeroCuota) || 0;

        if (sancionCuota > 0) {
          // Las sanciones se ponen solo como información, sin modificar cuotaTotal ni otros valores
          amortizacionActualizada[i] = {
            ...cuota,
            sancion: sancionCuota,
          };
        }
      }
    }

    // Paso 4: Recalcular saldos basados en capital pendiente
    // Paso 5: Aplicar proxima_fecha_pago a la primera cuota con saldo pendiente y recalcular fechas subsecuentes
    if (proxima_fecha_pago && diasPago && diasPago.length > 0 && periocidad) {
      let primeraConSaldoEncontrada = false;
      let fechaAnterior: Date | null = null;

      for (let i = 0; i < amortizacionActualizada.length; i++) {
        const cuota = amortizacionActualizada[i];

        // Identificar primera cuota con capital pendiente (saldo)
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

    // Paso 6: Recalcular saldos basados en capital pendiente
    let saldoAcumulado = 0;
    for (let i = 0; i < amortizacionActualizada.length; i++) {
      const cuota = amortizacionActualizada[i];
      // Sumar solo el capital pendiente (no incluir cuotas pagadas con capital=0)
      saldoAcumulado += cuota.capital;
      amortizacionActualizada[i] = {
        ...cuota,
        saldo: saldoAcumulado,
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
    sancionesExoneradas?: SancionRegistro[]
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

      // Paso 3: Validar y procesar pagos (pasar valor_cuota y sancionesExoneradas)
      const procesoPagos = this.procesarPagos(pagos, creditoNormalizado.valor_cuota, sancionesExoneradas);
      if (!procesoPagos.valido) {
        resultado.errores = procesoPagos.errores;
        resultado.mensaje = 'Información de pagos inválida';
        return resultado;
      }

      resultado.infoPagos = procesoPagos.infoPagos;

      // Paso 4: Crear parámetros de refinanciamiento
      const params = this.crearParametrosRefinanciamiento(creditoNormalizado);

      // Paso 5: Calcular amortización original
      const amortizacionOriginal = this.calcularRefinanciamiento(params);
      resultado.amortizacionOriginal = amortizacionOriginal;

      // Paso 6: Mapear sanciones a cuotas (si existen)
      let sancionPorCuota: Map<number, number> | undefined;
      if (sanciones && sanciones.length > 0) {
        sancionPorCuota = this.mapearSancionesACuotas(sanciones, amortizacionOriginal);
      }

      // Paso 7: Actualizar amortización con pagos realizados (y sanciones si existen)
      // Pasar proxima_fecha_pago, diasPago y periocidad para aplicar fecha correcta a primera cuota pendiente
      const amortizacionActualizada = this.actualizarAmortizacionPorPagos(
        amortizacionOriginal,
        procesoPagos.infoPagos!,
        sancionPorCuota,
        creditoNormalizado.proxima_fecha_pago,
        params.diasPago,
        creditoNormalizado.periodicidad === 'Mensual' || creditoNormalizado.periodicidad === 'mensual' ? 'mensual' : 'quincenal'
      );
      resultado.amortizacionActualizada = amortizacionActualizada;

      // Paso 8: Calcular estadísticas
      resultado.estadisticas = this.calcularEstadisticas(amortizacionActualizada);

      // Paso 9: Establecer resultado exitoso
      resultado.exitoso = true;
      resultado.mensaje = `Refinanciamiento calculado exitosamente. Cuotas pendientes: ${amortizacionActualizada.length}`;

      return resultado;
    } catch (error) {
      resultado.exitoso = false;
      resultado.mensaje = 'Error al procesar refinanciamiento';
      resultado.errores.push(error instanceof Error ? error.message : 'Error desconocido');
      return resultado;
    }
  }

  /**
   * Método principal para calcular refinanciamiento
   */
  public static calcularRefinanciamiento(params: RefinanciamientoParams): RefinanciamientoItem[] {
    const {
      capitalEnMora,
      cantidadMeses,
      periocidad,
      valorCuotaAcordada,
      documento,
      prestamoId,
      iva_aval = 19,
      fechaPrimerPago = this.getFechaColombia(),
      cta_aval = 0,
      cta_iva_aval = 0,
      diasPago = periocidad === 'quincenal' ? [5, 20] : [1],
    } = params;

    // Validaciones
    if (capitalEnMora <= 0) throw new Error('El capital en mora debe ser mayor a cero');
    if (cantidadMeses <= 0) throw new Error('La cantidad de meses debe ser mayor a cero');
    if (valorCuotaAcordada <= 0) throw new Error('La cuota acordada debe ser mayor a cero');
    if (!['mensual', 'quincenal'].includes(periocidad)) throw new Error('Periocidad inválida');

    // Calcular número de cuotas
    const numeroCuotas = periocidad === 'quincenal' ? cantidadMeses * 2 : cantidadMeses;

    // Validar cuota mínima
    const cuotaMinima = Math.ceil(capitalEnMora / numeroCuotas);
    if (valorCuotaAcordada < cuotaMinima) {
      throw new Error(
        `La cuota acordada ($${valorCuotaAcordada}) debe ser >= cuota mínima ($${cuotaMinima})`
      );
    }

    // Calcular distribución de capital
    const capitalPorCuota = Math.floor(capitalEnMora / numeroCuotas);
    const capitalUltimaCuota = capitalEnMora - capitalPorCuota * (numeroCuotas - 1);

    // Calcular excedente por cuota: excedente = valorCuota - capital/cuota
    const excedentePorCuota = valorCuotaAcordada - capitalPorCuota;

    // Distribuir el excedente: restar cta_aval y cta_iva_aval, el resto es interés
    const avalPorCuota = Math.floor(cta_aval);
    const ivaPorCuota = Math.floor(cta_iva_aval);
    const interesPorCuota = excedentePorCuota - avalPorCuota - ivaPorCuota;

    const amortizacion: RefinanciamientoItem[] = [];
    let saldoPendiente = capitalEnMora;
    let fechaAnterior = fechaPrimerPago;

    for (let i = 0; i < numeroCuotas; i++) {
      const esUltimaCuota = i === numeroCuotas - 1;

      // Capital para esta cuota
      const capitalCuota = esUltimaCuota ? capitalUltimaCuota : capitalPorCuota;
      
      // Aval e IVA son fijos (cta_aval y cta_iva_aval) para cada cuota
      const avalCuota = avalPorCuota;
      const ivaCuota = ivaPorCuota;
      
      // Interés es el excedente después de restar aval e iva (por cuota)
      const interesCuota = interesPorCuota;

      // Actualizar saldo
      saldoPendiente -= capitalCuota;
      saldoPendiente = Math.max(0, saldoPendiente);

      // Calcular fecha de pago (alterna entre fechas o mantiene la misma para mensual)
      const fechaCuota = i === 0 ? fechaPrimerPago : this.calcularSiguienteFechaPago(fechaAnterior, periocidad, i, diasPago);
      fechaAnterior = fechaCuota;

      amortizacion.push({
        prestamoId,
        documento,
        numeroCuota: i + 1,
        capitalEnMora,
        capital: capitalCuota,
        interes: interesCuota,
        aval: avalCuota,
        iva: ivaCuota,
        cuotaTotal: capitalCuota + interesCuota + avalCuota + ivaCuota,
        saldo: saldoPendiente,
        fechaPago: fechaCuota.toISOString().split('T')[0],
      });
    }

    return amortizacion;
  }


}
