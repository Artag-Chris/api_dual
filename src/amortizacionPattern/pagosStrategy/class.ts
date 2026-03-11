/**
 * FASE 2: Strategy de Pagos
 * 
 * Procesa tabla `pagos` de legacy y actualiza la amortización base (de Fase 1).
 * LÓGICA PURA: Solo lee datos y retorna resultado. NO hace INSERT/UPDATE.
 * 
 * Reglas clave:
 * - REGLA 0: cuotas_faltantes de legacy es LA VERDAD
 * - REGLA 1: pago.num_cuota EXISTS → validar SUM(abono) ≤ cuotaTotal
 * - REGLA 2: pago.num_cuota IS NULL → agrupar por concepto y asignar automáticamente
 * - REGLA 3: Conceptos mezclados → sumar todos, validar ≤ valor_cuota
 * - amortizacion_final.length DEBE = cuotas_faltantes exactamente
 */

import { FechaUtils } from '../amortizacionFactory/class';
import {
  RefinanciamientoItem,
  PagoRegistro,
  SancionRegistro,
  InfoPagosProcessados,
  ResultadoPagos,
  CategorizadorConceptos,
} from '../interfaces';

export class PagosStrategy {

  // ═══════════════════════════════════════════════════════════════
  // UTILIDADES INTERNAS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Normaliza valores "debe" negativos a 0
   */
  private static normalizarDebeNegativo(pago: PagoRegistro): PagoRegistro {
    return { ...pago, debe: pago.debe < 0 ? 0 : pago.debe };
  }

  /**
   * Valida estructura de los registros de pagos
   */
  private static validarEstructuraPagos(pagos: PagoRegistro[]): { valido: boolean; errores: string[] } {
    const errores: string[] = [];

    if (!Array.isArray(pagos)) {
      return { valido: false, errores: ['Los pagos deben ser un array'] };
    }

    if (pagos.length === 0) {
      return { valido: true, errores: [] };
    }

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
   * Filtra pagos que aplican a cuotas (Cuota, Cuota Parcial, Aval)
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
   * REGLA 2: Asigna números de cuota a pagos con num_cuota = NULL
   * Solo para conceptos: 'Cuota', 'Cuota Parcial', 'Aval'
   * Agrupa múltiples pagos que juntos sumen el valor de la cuota
   */
  private static asignarCuotasANullPayments(pagos: PagoRegistro[], valorCuota: number): PagoRegistro[] {
    const pagosModificados = [...pagos];

    const pagosNullNumCuota = pagosModificados.filter(
      p => p.num_cuota === null && ['Cuota', 'Cuota Parcial', 'Aval'].includes(p.concepto)
    );

    if (pagosNullNumCuota.length === 0) return pagosModificados;

    // Ordenar cronológicamente
    pagosNullNumCuota.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let numeroCuotaActual = 1;
    let abonoAcumulado = 0;

    pagosNullNumCuota.forEach(pago => {
      abonoAcumulado += pago.abono;

      const indexEnModificados = pagosModificados.findIndex(p => p.id === pago.id);
      if (indexEnModificados !== -1) {
        pagosModificados[indexEnModificados].num_cuota = numeroCuotaActual;
      }

      if (abonoAcumulado >= valorCuota) {
        numeroCuotaActual++;
        abonoAcumulado = 0;
      }
    });

    return pagosModificados;
  }

  /**
   * Calcula el desglose de pagos por cuota
   * Agrupa TODOS los abonos por número de cuota sin importar concepto
   */
  private static calcularDesglosePagos(pagos: PagoRegistro[]): {
    [key: number]: {
      totalAbonado: number;
      totalDebe: number;
      estado: 'Ok' | 'Debe' | 'parcial';
      registros: PagoRegistro[];
    };
  } {
    const desglose: {
      [key: number]: {
        totalAbonado: number;
        totalDebe: number;
        estado: 'Ok' | 'Debe' | 'parcial';
        registros: PagoRegistro[];
      };
    } = {};

    pagos.forEach(pago => {
      if (pago.num_cuota === null) return;

      const numCuota = pago.num_cuota;

      if (!desglose[numCuota]) {
        desglose[numCuota] = { totalAbonado: 0, totalDebe: 0, estado: 'Ok', registros: [] };
      }

      desglose[numCuota].totalAbonado += pago.abono;
      desglose[numCuota].totalDebe += pago.debe;
      desglose[numCuota].registros.push(pago);

      if (pago.estado === 'Debe') {
        desglose[numCuota].estado = 'parcial';
      }
    });

    return desglose;
  }

  /**
   * Procesa sanciones exoneradas para extraer condonaciones
   */
  private static procesarSancionesExoneradas(sancionesExoneradas: SancionRegistro[]): {
    sanciones_condonadas: number;
    dias_sanciones_condonadas: number;
  } {
    if (!sancionesExoneradas || sancionesExoneradas.length === 0) {
      return { sanciones_condonadas: 0, dias_sanciones_condonadas: 0 };
    }
    return {
      sanciones_condonadas: sancionesExoneradas.reduce((sum, s) => sum + s.valor, 0),
      dias_sanciones_condonadas: sancionesExoneradas.length,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // MÉTODO CORE: Procesar pagos y extraer InfoPagosProcessados
  // ═══════════════════════════════════════════════════════════════

  /**
   * Procesa y valida los pagos, extrayendo información relevante.
   * Agrupa por número de cuota e identifica cuotas pagadas vs parciales.
   * 
   * REGLA 1: pago.num_cuota EXISTS → validar abono ≤ cuotaTotal
   * REGLA 2: pago.num_cuota IS NULL → asignar automáticamente
   * REGLA 3: Conceptos mezclados → sumar y validar
   */
  static procesarPagos(
    pagos: PagoRegistro[],
    valorCuota: number,
    sancionesExoneradas?: SancionRegistro[],
    sancionesPagadas?: SancionRegistro[]
  ): { valido: boolean; errores: string[]; infoPagos?: InfoPagosProcessados } {
    // Normalizar "debe" negativos
    const pagosNormalizados = pagos.map(p => this.normalizarDebeNegativo(p));

    // Validar estructura
    const validacion = this.validarEstructuraPagos(pagosNormalizados);
    if (!validacion.valido) {
      return { valido: false, errores: validacion.errores };
    }

    // CASO ESPECIAL: Sin pagos (crédito nuevo)
    if (pagosNormalizados.length === 0) {
      return {
        valido: true,
        errores: [],
        infoPagos: {
          cuotaMaximaPagada: 0,
          tieneCuotaParciall: false,
          montoPagadoCuotaParcial: 0,
          montoDebe: 0,
          sanciones_condonadas: 0,
          dias_sanciones_condonadas: 0,
          desglosePagos: {},
          pagosJuridicos: { totalPrejuridico: 0, totalJuridico: 0, debePrejuridico: 0, debeJuridico: 0, cantidadPagosJuridicos: 0 },
          saldoAFavor: { total: 0, cantidadRegistros: 0 },
          pagosEnMora: { totalPagadoEnMora: 0, cantidadSancionesPagadas: 0 },
        },
      };
    }

    // Separar pagos por categoría
    const pagosCuota = this.filtrarPagosCuota(pagosNormalizados);
    const pagosSanciones = this.filtrarPagosSanciones(pagosNormalizados);
    const pagosJuridicos = this.filtrarPagosJuridico(pagosNormalizados);
    const pagosAlFavor = this.filtrarSaldoAFavor(pagosNormalizados);

    // REGLA 2: Asignar cuotas a pagos con num_cuota = NULL
    const pagosConCuotasAsignadas = this.asignarCuotasANullPayments(pagosCuota, valorCuota);

    // Calcular desglose completo
    const desglosePagosCompleto = this.calcularDesglosePagos(pagosConCuotasAsignadas);

    // Obtener cuota máxima COMPLETAMENTE pagada (estado = 'Ok')
    let cuotaMaximaPagada = 0;
    Object.entries(desglosePagosCompleto).forEach(([numCuotaStr, desglose]) => {
      if (desglose.estado === 'Ok') {
        cuotaMaximaPagada = Math.max(cuotaMaximaPagada, parseInt(numCuotaStr));
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

    // Pagos de sanciones (mora)
    const totalPagadoEnMora = pagosSanciones.reduce((sum, p) => sum + p.abono, 0);
    const cantidadSancionesPagadas = sancionesPagadas?.length || 0;

    // Pagos jurídicos: sumar abonos (total pagado) y debe (saldo pendiente en pagos parciales)
    const totalPrejuridico = pagosJuridicos.filter(p => p.concepto === 'Prejuridico').reduce((sum, p) => sum + p.abono, 0);
    const totalJuridico = pagosJuridicos.filter(p => p.concepto === 'Juridico').reduce((sum, p) => sum + p.abono, 0);

    // Capturar 'debe' de pagos con estado='Debe' (saldo pendiente según legacy)
    // Si hay pagos con estado='Debe', su columna 'debe' refleja el saldo real pendiente
    const debePrejuridico = pagosJuridicos
      .filter(p => p.concepto === 'Prejuridico' && p.estado === 'Debe')
      .reduce((sum, p) => sum + p.debe, 0);
    const debeJuridico = pagosJuridicos
      .filter(p => p.concepto === 'Juridico' && p.estado === 'Debe')
      .reduce((sum, p) => sum + p.debe, 0);

    // Saldo a favor
    const totalSaldoAFavor = pagosAlFavor.reduce((sum, p) => sum + p.abono, 0);

    // Sanciones exoneradas
    const { sanciones_condonadas, dias_sanciones_condonadas } = this.procesarSancionesExoneradas(sancionesExoneradas || []);

    // Convertir desglose a formato final
    const desglosePagos: { [key: number]: { capital: number; interes: number; aval: number; iva: number; totalAbonado: number } } = {};
    Object.entries(desglosePagosCompleto).forEach(([numCuotaStr, desglose]) => {
      const numCuota = parseInt(numCuotaStr);
      let avalPagado = 0;
      let cuotaPagada = 0;

      desglose.registros.forEach(pago => {
        if (pago.concepto === 'Aval') avalPagado += pago.abono;
        else if (pago.concepto === 'Cuota' || pago.concepto === 'Cuota Parcial') cuotaPagada += pago.abono;
      });

      let capitalPagado = 0;
      let interesPagado = 0;
      if (cuotaPagada > 0) {
        capitalPagado = Math.round(cuotaPagada * 0.894);
        interesPagado = Math.round(cuotaPagada * 0.106);
      }

      desglosePagos[numCuota] = {
        capital: capitalPagado,
        interes: interesPagado,
        aval: avalPagado,
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
      pagosJuridicos: { totalPrejuridico, totalJuridico, debePrejuridico, debeJuridico, cantidadPagosJuridicos: pagosJuridicos.length },
      saldoAFavor: { total: totalSaldoAFavor, cantidadRegistros: pagosAlFavor.length },
      pagosEnMora: { totalPagadoEnMora, cantidadSancionesPagadas },
    };

    return { valido: true, errores: [], infoPagos };
  }

  // ═══════════════════════════════════════════════════════════════
  // MÉTODO CORE: Actualizar amortización eliminando cuotas pagadas
  // ═══════════════════════════════════════════════════════════════

  /**
   * REGLA 0: cuotas_faltantes de legacy es LA VERDAD.
   * Elimina cuotas pagadas, ajusta parciales, recalcula saldos.
   * 
   * @param amortizacion Amortización base de Fase 1
   * @param infoPagos Resultado de procesarPagos()
   * @param proxima_fecha_pago Fecha del próximo pago (para recalcular fechas)
   * @param diasPago Días de pago configurados
   * @param periocidad Período del crédito
   * @param numero_cuotas Total real de cuotas del crédito (ya incluye quincenal×2, fuente: precreditos.cuotas)
   * @param cuotas_faltantes Cuotas faltantes según legacy (LA VERDAD)
   */
  static actualizarAmortizacionPorPagos(
    amortizacion: RefinanciamientoItem[],
    infoPagos: InfoPagosProcessados,
    proxima_fecha_pago?: string | Date,
    diasPago?: number[],
    periocidad?: 'mensual' | 'quincenal',
    numero_cuotas?: number,
    cuotas_faltantes?: number
  ): RefinanciamientoItem[] {
    if (!amortizacion || amortizacion.length === 0) return [];

    let amortizacionActualizada = [...amortizacion];

    // ═══════════════════════════════════════════════════════════
    // PASO 1: SINCRONIZAR CON CUOTAS COMPLETAMENTE PAGADAS
    // REGLA 0: cuotas_faltantes = VERDAD
    // NOTA: numero_cuotas viene de precreditos.cuotas (ya incluye quincenal×2)
    //       Fallback: amortizacion.length (generado por Factory con la misma conversión)
    // ═══════════════════════════════════════════════════════════
    let cuotasAMarcaEnCero = infoPagos.cuotaMaximaPagada;

    const totalCuotasReal = numero_cuotas ?? amortizacion.length;
    const cuotasPagadasSegunCuotasFaltantes = (totalCuotasReal > 0 && cuotas_faltantes !== undefined)
      ? Math.max(0, totalCuotasReal - cuotas_faltantes)
      : cuotasAMarcaEnCero;

    const hayAsincronizacion = cuotasAMarcaEnCero !== cuotasPagadasSegunCuotasFaltantes;

    if (hayAsincronizacion && cuotasPagadasSegunCuotasFaltantes > 0) {
      cuotasAMarcaEnCero = cuotasPagadasSegunCuotasFaltantes;
    }

    // Marcar cuotas como pagadas
    for (let i = 0; i < amortizacionActualizada.length; i++) {
      const cuota = amortizacionActualizada[i];
      if (cuota.numeroCuota <= cuotasAMarcaEnCero) {
        amortizacionActualizada[i] = {
          ...cuota,
          capital: 0, interes: 0, aval: 0, iva: 0, cuotaTotal: 0,
        };
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 2: PROCESAR CUOTA PARCIAL
    // ═══════════════════════════════════════════════════════════
    if (infoPagos.tieneCuotaParciall && infoPagos.montoPagadoCuotaParcial > 0) {
      const numeroCuotaParcial = cuotasAMarcaEnCero + 1;
      const indexCuotaParcial = amortizacionActualizada.findIndex(c => c.numeroCuota === numeroCuotaParcial);

      if (indexCuotaParcial !== -1) {
        const cuotaParcial = amortizacionActualizada[indexCuotaParcial];
        const montoPagado = infoPagos.montoPagadoCuotaParcial;

        // Restar secuencialmente: Aval → IVA → Interés → Capital
        let restoPorRestar = montoPagado;
        let nuevoAval = cuotaParcial.aval;
        let nuevoIva = cuotaParcial.iva;
        let nuevoInteres = cuotaParcial.interes;
        let nuevoCapital = cuotaParcial.capital;

        if (restoPorRestar > 0 && nuevoAval > 0) {
          const r = Math.min(restoPorRestar, nuevoAval);
          nuevoAval -= r; restoPorRestar -= r;
        }
        if (restoPorRestar > 0 && nuevoIva > 0) {
          const r = Math.min(restoPorRestar, nuevoIva);
          nuevoIva -= r; restoPorRestar -= r;
        }
        if (restoPorRestar > 0 && nuevoInteres > 0) {
          const r = Math.min(restoPorRestar, nuevoInteres);
          nuevoInteres -= r; restoPorRestar -= r;
        }
        if (restoPorRestar > 0 && nuevoCapital > 0) {
          const r = Math.min(restoPorRestar, nuevoCapital);
          nuevoCapital -= r; restoPorRestar -= r;
        }

        const capitalFinal = Math.max(0, nuevoCapital);
        const interesFinal = Math.max(0, nuevoInteres);
        const avalFinal = Math.max(0, nuevoAval);
        const ivaFinal = Math.max(0, nuevoIva);

        amortizacionActualizada[indexCuotaParcial] = {
          ...cuotaParcial,
          capital: capitalFinal,
          interes: interesFinal,
          aval: avalFinal,
          iva: ivaFinal,
          cuotaTotal: capitalFinal + interesFinal + avalFinal + ivaFinal,
        };
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 3: RECALCULAR FECHAS DE PAGO
    // ═══════════════════════════════════════════════════════════
    if (proxima_fecha_pago && diasPago && diasPago.length > 0 && periocidad) {
      let primeraConSaldoEncontrada = false;
      let fechaAnterior: Date | null = null;

      for (let i = 0; i < amortizacionActualizada.length; i++) {
        const cuota = amortizacionActualizada[i];

        if (!primeraConSaldoEncontrada && cuota.capital > 0) {
          const fechaProxima = new Date(proxima_fecha_pago);
          amortizacionActualizada[i] = { ...cuota, fechaPago: fechaProxima.toISOString().split('T')[0] };
          fechaAnterior = fechaProxima;
          primeraConSaldoEncontrada = true;
        } else if (primeraConSaldoEncontrada && cuota.capital > 0 && fechaAnterior) {
          const proximaFecha = FechaUtils.calcularSiguienteFechaPago(fechaAnterior, periocidad, i, diasPago);
          amortizacionActualizada[i] = { ...cuota, fechaPago: proximaFecha.toISOString().split('T')[0] };
          fechaAnterior = proximaFecha;
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 4: RECALCULAR SALDOS (de atrás hacia adelante)
    // Las cuotas NO pagadas conservan sus valores originales de Fase 1
    // ═══════════════════════════════════════════════════════════
    let saldoAcumuladoDesdeAtras = 0;
    for (let i = amortizacionActualizada.length - 1; i >= 0; i--) {
      const cuota = amortizacionActualizada[i];
      saldoAcumuladoDesdeAtras += cuota.capital;
      amortizacionActualizada[i] = { ...cuota, saldo: saldoAcumuladoDesdeAtras };
    }

    return amortizacionActualizada;
  }

  // ═══════════════════════════════════════════════════════════════
  // MÉTODO PRINCIPAL: Aplicar pagos a amortización
  // ═══════════════════════════════════════════════════════════════

  /**
   * Ejecuta la Fase 2 completa.
   * LÓGICA PURA: Lee amortización base + pagos, retorna amortización actualizada.
   * NO hace INSERT/UPDATE.
   * 
   * @param amortizacion Amortización base de Fase 1
   * @param pagos Pagos del crédito (de legacy)
   * @param valorCuota Valor de cada cuota
   * @param cuotas_faltantes Cuotas faltantes según legacy (REGLA 0: LA VERDAD)
   * @param numero_cuotas Total real de cuotas del crédito (ya incluye quincenal×2, fuente: precreditos.cuotas)
   * @param sancionesExoneradas Sanciones exoneradas (para info)
   * @param sancionesPagadas Sanciones pagadas (para info)
   * @param proxima_fecha_pago Fecha del próximo pago
   * @param diasPago Días de pago configurados
   * @param periocidad Período del crédito
   */
  static aplicar(
    amortizacion: RefinanciamientoItem[],
    pagos: PagoRegistro[],
    valorCuota: number,
    cuotas_faltantes: number,
    numero_cuotas: number,
    sancionesExoneradas?: SancionRegistro[],
    sancionesPagadas?: SancionRegistro[],
    proxima_fecha_pago?: string | Date,
    diasPago?: number[],
    periocidad?: 'mensual' | 'quincenal'
  ): ResultadoPagos {
    const resultado: ResultadoPagos = {
      exitoso: false,
      mensaje: '',
      errores: [],
    };

    try {
      // 1. Procesar pagos
      const procesoPagos = this.procesarPagos(pagos, valorCuota, sancionesExoneradas, sancionesPagadas);
      if (!procesoPagos.valido || !procesoPagos.infoPagos) {
        resultado.errores = procesoPagos.errores;
        resultado.mensaje = 'Información de pagos inválida';
        return resultado;
      }

      resultado.infoPagos = procesoPagos.infoPagos;

      // 2. Actualizar amortización con pagos
      const amortizacionConPagos = this.actualizarAmortizacionPorPagos(
        amortizacion,
        procesoPagos.infoPagos,
        proxima_fecha_pago,
        diasPago,
        periocidad,
        numero_cuotas,
        cuotas_faltantes
      );

      // 3. Sanitizar valores negativos
      const amortizacionSanitizada = amortizacionConPagos.map(item => {
        let { interes, aval, iva, cuotaTotal, saldo } = item;
        if (interes < 0) interes = 0;
        if (aval < 0) aval = 0;
        if (iva < 0) iva = 0;
        if (saldo < 0) saldo = 0;
        cuotaTotal = item.capital + interes + aval + iva;
        return { ...item, interes, aval, iva, cuotaTotal, saldo };
      });

      resultado.amortizacionConPagos = amortizacionSanitizada;
      resultado.exitoso = true;
      resultado.mensaje = `Pagos aplicados exitosamente. Cuotas pendientes: ${amortizacionSanitizada.filter(c => c.capital > 0).length}`;

      return resultado;
    } catch (error) {
      resultado.exitoso = false;
      resultado.mensaje = 'Error al aplicar pagos';
      resultado.errores.push(error instanceof Error ? error.message : 'Error desconocido');
      return resultado;
    }
  }
}
