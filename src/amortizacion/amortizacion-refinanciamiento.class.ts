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

export interface InfoCreditoData {
  documento: string;
  valor_prestamo: number;
  valor_cuota: number;
  periodicidad: 'Mensual' | 'Quincenal' | 'mensual' | 'quincenal';
  cantidad_meses: number;
  fecha_creacion: Date | string;
  cuotas_faltantes: number;
  credito_id: number;
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
   * Para QUINCENAL: verifica si el primer día del array está en los 7 días siguientes
   * Para MENSUAL: verifica si el día está en los 14 días siguientes
   */
  private static calcularFechaPrimerPago(
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
      const fechaPrimeraOpcion = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), primerDiaPago);

      // Verificar si está dentro del rango
      if (fechaPrimeraOpcion >= rangoInicio && fechaPrimeraOpcion <= rangoFin) {
        // Usar el segundo día de pago en el próximo mes
        let proximoMes = new Date(fechaBase);
        proximoMes.setMonth(proximoMes.getMonth() + 1);
        proximoMes.setDate(segundoDiaPago);
        return proximoMes;
      } else {
        // Si no está en el rango, usar el segundo día de pago en el mes actual
        const fechaAlternativa = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), segundoDiaPago);
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
      const fechaPrimeraOpcion = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), diaPago);

      // Verificar si está dentro del rango
      if (fechaPrimeraOpcion >= rangoInicio && fechaPrimeraOpcion <= rangoFin) {
        // Usar el mismo día de pago en el mes siguiente después del rango
        let proximoMes = new Date(fechaBase);
        proximoMes.setMonth(proximoMes.getMonth() + 1);
        proximoMes.setDate(diaPago);
        return proximoMes;
      } else {
        // Si no está en el rango, usar ese día en el mes actual
        return fechaPrimeraOpcion;
      }
    }
  }

  /**
   * Calcula la siguiente fecha de pago
   */
  private static calcularSiguienteFechaPago(
    fechaBase: Date,
    periocidad: 'mensual' | 'quincenal',
    cuotaIndex: number
  ): Date {
    const fecha = new Date(fechaBase);

    if (periocidad === 'quincenal') {
      const diasAPasar = cuotaIndex * 15;
      fecha.setDate(fecha.getDate() + diasAPasar);
    } else {
      const diasAPasar = cuotaIndex * 30;
      fecha.setDate(fecha.getDate() + diasAPasar);
    }

    return fecha;
  }

  /**
   * Valida que los registros de pagos tengan la estructura correcta
   */
  private static validarEstructuraPagos(pagos: PagoRegistro[]): { valido: boolean; errores: string[] } {
    const errores: string[] = [];

    if (!Array.isArray(pagos)) {
      errores.push('Los pagos deben ser un array');
      return { valido: false, errores };
    }

    if (pagos.length === 0) {
      errores.push('El array de pagos está vacío');
      return { valido: false, errores };
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
   * Agrupa abonos, avales e IVA por cada número de cuota
   */
  private static calcularDesglosePagos(pagos: PagoRegistro[]): { [key: number]: { capital: number; interes: number; aval: number; iva: number; totalAbonado: number } } {
    const desglose: { [key: number]: { capital: number; interes: number; aval: number; iva: number; totalAbonado: number } } = {};

    pagos.forEach(pago => {
      const numCuota = pago.num_cuota || 0;

      if (!desglose[numCuota]) {
        desglose[numCuota] = {
          capital: 0,
          interes: 0,
          aval: 0,
          iva: 0,
          totalAbonado: 0,
        };
      }

      // Clasificar según concepto
      if (pago.concepto === 'Cuota') {
        desglose[numCuota].capital += pago.abono;
      } else if (pago.concepto === 'Aval') {
        desglose[numCuota].aval += pago.abono;
      }
      // Nota: interes e iva se deducirían del total de la cuota

      desglose[numCuota].totalAbonado += pago.abono;
    });

    return desglose;
  }

  /**
   * Procesa y valida los pagos, extrayendo información relevante
   */
  public static procesarPagos(pagos: PagoRegistro[]): { valido: boolean; errores: string[]; infoPagos?: InfoPagosProcessados } {
    // Validar estructura
    const validacion = this.validarEstructuraPagos(pagos);
    if (!validacion.valido) {
      return { valido: false, errores: validacion.errores };
    }

    // Obtener cuota máxima pagada
    const cuotaMaximaPagada = this.obtenerCuotaMaximaPagada(pagos);

    // Detectar cuota parcial
    const { existe: tieneCuotaParcial, infoCuota: cuotaParcialInfo } = this.detectarCuotaParcial(pagos);

    // Calcular desglose de pagos
    const desglosePagos = this.calcularDesglosePagos(pagos);

    // Calcular monto debe si hay cuota parcial
    let montoPagadoCuotaParcial = 0;
    let montoDebe = 0;
    if (tieneCuotaParcial && cuotaParcialInfo) {
      montoPagadoCuotaParcial = cuotaParcialInfo.abono;
      montoDebe = cuotaParcialInfo.debe;
    }

    const infoPagos: InfoPagosProcessados = {
      cuotaMaximaPagada,
      tieneCuotaParciall: tieneCuotaParcial,
      montoPagadoCuotaParcial,
      montoDebe,
      desglosePagos,
    };

    return { valido: true, errores: [], infoPagos };
  }

  /**
   * Actualiza la amortización eliminando cuotas pagadas y ajustando la cuota parcial
   */
  public static actualizarAmortizacionPorPagos(
    amortizacion: RefinanciamientoItem[],
    infoPagos: InfoPagosProcessados
  ): RefinanciamientoItem[] {
    if (!amortizacion || amortizacion.length === 0) {
      return [];
    }

    // Hacer una copia para no mutar el original
    let amortizacionActualizada = [...amortizacion];

    // Paso 1: Eliminar cuotas que están completamente pagadas
    const cuotasAPagar = amortizacionActualizada.filter(cuota => cuota.numeroCuota > infoPagos.cuotaMaximaPagada);

    // Paso 2: Procesar cuota parcial si existe
    if (infoPagos.tieneCuotaParciall && infoPagos.montoPagadoCuotaParcial > 0) {
      const numeroCuotaParcial = infoPagos.cuotaMaximaPagada + 1;
      const indexCuotaParcial = cuotasAPagar.findIndex(c => c.numeroCuota === numeroCuotaParcial);

      if (indexCuotaParcial !== -1) {
        const cuotaParcial = cuotasAPagar[indexCuotaParcial];
        const totalCuota = cuotaParcial.cuotaTotal;
        const restante = infoPagos.montoDebe;

        // Calcular proporción de pago por concepto
        const proporcion = (totalCuota - restante) / totalCuota;

        // Distribuir la reducción proporcionalmente
        const capitalReducido = Math.round(cuotaParcial.capital * proporcion);
        const interesReducido = Math.round(cuotaParcial.interes * proporcion);
        const avalReducido = Math.round(cuotaParcial.aval * proporcion);
        const ivaReducido = Math.round(cuotaParcial.iva * proporcion);

        // Actualizar valores de la cuota parcial
        cuotasAPagar[indexCuotaParcial] = {
          ...cuotaParcial,
          capital: cuotaParcial.capital - capitalReducido,
          interes: cuotaParcial.interes - interesReducido,
          aval: cuotaParcial.aval - avalReducido,
          iva: cuotaParcial.iva - ivaReducido,
          cuotaTotal: restante,
        };
      }
    }

    // Paso 3: Recalcular saldos
    let saldoAcumulado = 0;
    cuotasAPagar.forEach((cuota, index) => {
      saldoAcumulado += cuota.capital;
      cuotasAPagar[index] = {
        ...cuota,
        saldo: saldoAcumulado,
      };
    });

    return cuotasAPagar;
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

    // Calcular restante (excedente sobre el capital)
    const restanteTotal = valorCuotaAcordada * numeroCuotas - capitalEnMora;

    // Distribuir el restante: 30% interés, 50% aval, 20% iva_aval
    const interesPorcentaje = 0.30;
    const avalPorcentaje = 0.50;
    const ivaPorcentaje = 0.20;

    const interesTotal = Math.floor(restanteTotal * interesPorcentaje);
    const avalTotalBase = Math.floor(restanteTotal * avalPorcentaje);
    const ivaTotal = Math.floor(restanteTotal * ivaPorcentaje);

    // Distribuir equitativamente por cuota
    const interesPorCuota = Math.floor(interesTotal / numeroCuotas);
    const interesUltimaCuota = interesTotal - interesPorCuota * (numeroCuotas - 1);

    const avalPorCuota = Math.floor(avalTotalBase / numeroCuotas);
    const avalUltimaCuota = avalTotalBase - avalPorCuota * (numeroCuotas - 1);

    const ivaPorCuota = Math.floor(ivaTotal / numeroCuotas);
    const ivaUltimaCuota = ivaTotal - ivaPorCuota * (numeroCuotas - 1);

    const amortizacion: RefinanciamientoItem[] = [];
    let saldoPendiente = capitalEnMora;

    for (let i = 0; i < numeroCuotas; i++) {
      const esUltimaCuota = i === numeroCuotas - 1;

      // Capital, Interés, Aval e IVA para esta cuota
      const capitalCuota = esUltimaCuota ? capitalUltimaCuota : capitalPorCuota;
      const interesCuota = esUltimaCuota ? interesUltimaCuota : interesPorCuota;
      const avalCuota = esUltimaCuota ? avalUltimaCuota : avalPorCuota;
      const ivaCuota = esUltimaCuota ? ivaUltimaCuota : ivaPorCuota;

      // Actualizar saldo
      saldoPendiente -= capitalCuota;
      saldoPendiente = Math.max(0, saldoPendiente);

      // Calcular fecha de pago
      const fechaCuota = this.calcularSiguienteFechaPago(fechaPrimerPago, periocidad, i);

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
