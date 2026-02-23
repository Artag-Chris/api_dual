/**
 * Clase Amortización
 * Responsable de encapsular la lógica de cálculo de amortizaciones
 * Utiliza el sistema francés para el cálculo de cuotas
 */

export interface AmortizationItem {
  prestamoId: string | number;
  documento: string;
  numeroCuota: number;
  valorPrestamo: number;
  cuotaTotal: number;
  interes: number;
  aval: number;
  iva: number;
  capital: number;
  saldo: number;
  pablok: number;
  seguro: number;
  fechaPago: string;
}

export interface AmortizacionParams {
  prestamo: number;
  plazo: number;
  periocidad: 'mensual' | 'quincenal';
  documento: string;
  prestamoId: number | string;
  pablok: number;
  seguro: number; // Aval (%)
  iva_aval?: number;
  seguro_add?: number; // Seguro adicional
  tasa?: number;
  diasPago?: string | number[];
  fechaDesembolso?: Date;
}

export class Amortizacion {
  /**
   * Redondea un número al decimal más cercano (sin decimales)
   */
  private static redondearEntero(valor: number): number {
    return Math.round(valor);
  }

  /**
   * Obtiene la fecha actual en Colombia
   */
  private static getFechaColombia(): Date {
    const ahora = new Date();
    const offset = ahora.getTimezoneOffset();
    const colombiaOffset = -5 * 60; // UTC -5
    const difMs = (colombiaOffset - offset) * 60 * 1000;
    return new Date(ahora.getTime() + difMs);
  }

  /**
   * Procesa días de pago para periocidad quincenal
   */
  private static procesarDiasPagoQuincenal(diasPago?: string | number[]): number[] {
    if (Array.isArray(diasPago)) {
      // Para quincenal, validar y mantener los días originales
      const diasValidos = diasPago
        .filter(d => typeof d === 'number' && !isNaN(d) && d >= 1 && d <= 31);
      
      // Remover duplicados y retornar
      return [...new Set(diasValidos)];
    } else if (typeof diasPago === 'string') {
      return diasPago.split('-')
        .map(d => {
          const num = parseInt(d.trim());
          return isNaN(num) || num < 1 || num > 31 ? null : num;
        })
        .filter((d): d is number => d !== null)
        .filter((d, idx, arr) => arr.indexOf(d) === idx); // Quitar duplicados
    }
    // Por defecto para quincenal: días 5 y 20
    return [5, 20];
  }

  /**
   * Calcula la siguiente fecha de pago según la periodicidad
   */
  private static calcularSiguienteFechaPago(
    fechaBase: Date,
    diasPago: number[],
    periocidad: 'mensual' | 'quincenal',
    cuotaIndex: number
  ): Date {
    const fecha = new Date(fechaBase);
    
    if (periocidad === 'quincenal') {
      // Para quincenal, alternamos entre los días especificados
      const diaActual = fecha.getDate();
      const diaProximo = diasPago[cuotaIndex % diasPago.length];
      
      if (diaActual < diaProximo) {
        fecha.setDate(diaProximo);
      } else {
        fecha.setMonth(fecha.getMonth() + 1);
        fecha.setDate(diaProximo);
      }
    } else {
      // Para mensual, sumamos un mes
      fecha.setMonth(fecha.getMonth() + 1);
      const diaProximo = diasPago[0] || 1;
      
      // Ajustar si el día no existe en el mes (ej: 31 de febrero)
      const ultimoDiaDelMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
      fecha.setDate(Math.min(diaProximo, ultimoDiaDelMes));
    }
    
    return fecha;
  }

  /**
   * Método principal para calcular la amortización completa
   * Sistema Francés: Capital + Interés variable, cuota fija
   * Aval e IVA calculados sobre (Capital + Interés) por cuota
   * Fórmula: Aval = (Capital + Interés) × %Aval / 100; IVA = Aval × %IVA / 100
   */
  public static calcularAmortizacion(params: AmortizacionParams): AmortizationItem[] {
    const {
      prestamo,
      plazo,
      periocidad,
      documento,
      prestamoId,
      pablok,
      seguro,
      iva_aval = 19,
      seguro_add = 0,
      tasa = 0,
      diasPago,
      fechaDesembolso = this.getFechaColombia(),
    } = params;

    // Validaciones
    if (prestamo <= 0) throw new Error('El monto del préstamo debe ser mayor a cero');
    if (plazo <= 0) throw new Error('El plazo debe ser mayor a cero');
    if (!['mensual', 'quincenal'].includes(periocidad)) throw new Error('Periocidad inválida');

    // Procesar días de pago
    let diasPagoArray: number[];
    if (periocidad === 'quincenal') {
      diasPagoArray = this.procesarDiasPagoQuincenal(diasPago);
      if (diasPagoArray.length > 2) diasPagoArray = diasPagoArray.slice(0, 2);
    } else {
      if (Array.isArray(diasPago)) {
        diasPagoArray = diasPago.filter(d => typeof d === 'number' && !isNaN(d) && d >= 1 && d <= 31);
      } else if (typeof diasPago === 'string') {
        diasPagoArray = diasPago.split('-')
          .map(d => {
            const num = parseInt(d.trim());
            return isNaN(num) ? 1 : num;
          })
          .filter(d => d >= 1 && d <= 31);
      } else {
        const num = Number(diasPago);
        diasPagoArray = [isNaN(num) ? 1 : num];
      }
    }

    if (diasPagoArray.length === 0) {
      diasPagoArray = periocidad === 'quincenal' ? [1, 16] : [1];
    }

    // Tasa
    const tasaMensual = (tasa >= 0 ? tasa : 0) / 100;
    const tasaPeriodica = periocidad === 'quincenal' ? tasaMensual / 2 : tasaMensual;
    const numeroCuotas = periocidad === 'quincenal' ? plazo * 2 : plazo;

    // Cuota fija del sistema francés (capital + interés)
    let cuotaFija: number;
    if (Math.abs(tasaPeriodica) < 0.000001) {
      cuotaFija = prestamo / numeroCuotas;
    } else {
      cuotaFija = (prestamo * tasaPeriodica) / (1 - Math.pow(1 + tasaPeriodica, -numeroCuotas));
    }

    const amortizacion: AmortizationItem[] = [];
    let saldo = prestamo;

    // Cargos fijos
    const pablokPorCuota = periocidad === 'mensual' ? pablok : Math.ceil(pablok / 2);
    const seguroPorCuota = periocidad === 'quincenal' ? (seguro_add || 0) / 2 : (seguro_add || 0);
    const avalPorcentaje = seguro / 100;
    const ivaPorcentaje = iva_aval / 100;

    for (let i = 0; i < numeroCuotas; i++) {
      // Calcular capitales e interés usando sistema francés
      let interesCuota: number;
      let capitalCuota: number;

      if (i === numeroCuotas - 1) {
        // Última cuota: capital = saldo restante
        capitalCuota = saldo;
        interesCuota = cuotaFija - capitalCuota;
      } else {
        // Cuotas normales
        interesCuota = saldo * tasaPeriodica;
        capitalCuota = cuotaFija - interesCuota;
      }

      // Redondear capital e interés
      const capitalRedondeado = Math.round(capitalCuota);
      const interesRedondeado = Math.round(interesCuota);

      // NUEVO: Aval e IVA calculados sobre (Capital + Interés)
      const capitalMasInteres = capitalRedondeado + interesRedondeado;
      const avalCuota = Math.round(capitalMasInteres * avalPorcentaje);
      const ivaCuota = Math.round(avalCuota * ivaPorcentaje);

      // Cuota total = Capital + Interés + Aval + IVA + Pablok + Seguro
      const cuotaTotalCuota = capitalRedondeado + interesRedondeado + avalCuota + ivaCuota + pablokPorCuota + seguroPorCuota;

      // Actualizar saldo
      saldo -= capitalRedondeado;
      saldo = Math.max(0, saldo);

      // Fecha de pago
      const fechaCuota = this.calcularSiguienteFechaPago(
        i === 0 ? fechaDesembolso : new Date(amortizacion[i - 1]?.fechaPago || fechaDesembolso),
        diasPagoArray,
        periocidad,
        i
      );

      amortizacion.push({
        prestamoId,
        documento,
        numeroCuota: i + 1,
        valorPrestamo: this.redondearEntero(prestamo),
        cuotaTotal: cuotaTotalCuota,
        interes: interesRedondeado,
        aval: avalCuota,
        iva: ivaCuota,
        capital: capitalRedondeado,
        saldo: Math.round(saldo),
        pablok: pablokPorCuota,
        seguro: seguroPorCuota,
        fechaPago: fechaCuota.toISOString().split('T')[0],
      });
    }

    return amortizacion;
  }
}
