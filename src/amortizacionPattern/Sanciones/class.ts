/**
 * FASE 3: Strategy de Sanciones y Gastos Cartera
 * 
 * Distribuye sanciones pendientes y gastos cartera en la amortización.
 * LÓGICA PURA: Solo lee datos y retorna resultado. NO hace INSERT/UPDATE.
 * 
 * Reglas clave:
 * - Distribuir SIN mirar fechas (proporcional entre cuotas)
 * - Máximo por período: mensual=30,000, quincenal=15,000
 * - Última cuota acumula el restante (sin límite)
 * - Sanciones exoneradas: restar antes de distribuir
 * - Sanciones pagadas: NO incluir
 * - Gastos cartera: prejuridico + juridico (extras - pagos)
 */

import {
  RefinanciamientoItem,
  SancionRegistro,
  ExtraRegistro,
  InfoPagosProcessados,
  GastosCartera,
  ResultadoSanciones,
} from '../interfaces';

export class SancionesStrategy {

  // ═══════════════════════════════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════════════════════════════

  /**
   * Calcula el máximo de sanciones permitidas por cuota según período
   * - Quincenal: 1000 × 15 días = 15,000
   * - Mensual: 1000 × 30 días = 30,000
   */
  private static calcularMaximoSancionPorPeriodo(periocidad: 'mensual' | 'quincenal'): number {
    return periocidad === 'quincenal' ? 15000 : 30000;
  }

  // ═══════════════════════════════════════════════════════════════
  // DISTRIBUCIÓN DE SANCIONES (SIN FECHA)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Mapea y distribuye sanciones pendientes a cuotas SIN mirar fechas.
   * 
   * Algoritmo:
   * 1. Sumar total de sanciones pendientes (estado='Debe')
   * 2. Dividir entre cuotas pendientes (con capital > 0)
   * 3. Cada cuota recibe MIN(porción, máximo_por_período)
   * 4. Última cuota recibe TODO el restante (sin límite)
   * 
   * @param sancionesPendientes Sanciones con estado 'Debe'
   * @param amortizacion Amortización con pagos ya aplicados
   * @param periocidad Período del crédito
   * @param cuotaMaximaPagada Última cuota completamente pagada
   * @returns Mapa de numeroCuota → totalSancion
   */
  static distribuirSanciones(
    sancionesPendientes: SancionRegistro[],
    amortizacion: RefinanciamientoItem[],
    periocidad: 'mensual' | 'quincenal',
    cuotaMaximaPagada: number = 0
  ): Map<number, number> {
    const sancionPorCuota = new Map<number, number>();

    // Obtener cuotas pendientes (con capital > 0, después de las pagadas)
    const cuotasPendientes = amortizacion.filter(
      cuota => cuota.numeroCuota > cuotaMaximaPagada && cuota.capital > 0
    );

    // Inicializar en 0
    cuotasPendientes.forEach(cuota => {
      sancionPorCuota.set(cuota.numeroCuota, 0);
    });

    // Si no hay sanciones o cuotas pendientes, retornar vacío
    if (!sancionesPendientes || sancionesPendientes.length === 0 || cuotasPendientes.length === 0) {
      return sancionPorCuota;
    }

    // Calcular total a distribuir
    const totalSanciones = sancionesPendientes.reduce((sum, s) => sum + s.valor, 0);
    const maximoSancionPorCuota = this.calcularMaximoSancionPorPeriodo(periocidad);

    // Distribuir: llenar cada cuota hasta el máximo, restante a la última
    let sancionesRestantes = totalSanciones;
    const cuotasNumeradas = Array.from(sancionPorCuota.keys()).sort((a, b) => a - b);

    for (let i = 0; i < cuotasNumeradas.length && sancionesRestantes > 0; i++) {
      const numeroCuota = cuotasNumeradas[i];
      const esUltimaCuota = i === cuotasNumeradas.length - 1;

      if (esUltimaCuota) {
        // Última cuota: TODO lo restante (sin límite)
        sancionPorCuota.set(numeroCuota, sancionesRestantes);
        sancionesRestantes = 0;
      } else {
        // Cuotas intermedias: hasta el máximo
        const aAsignar = Math.min(sancionesRestantes, maximoSancionPorCuota);
        sancionPorCuota.set(numeroCuota, aAsignar);
        sancionesRestantes -= aAsignar;
      }
    }

    return sancionPorCuota;
  }

  // ═══════════════════════════════════════════════════════════════
  // APLICAR SANCIONES A AMORTIZACIÓN
  // ═══════════════════════════════════════════════════════════════

  /**
   * Aplica el mapa de sanciones a la amortización.
   * Agrega campo `sancion` a cada cuota. NO modifica cuotaTotal.
   * cuotaTotal sigue siendo capital + interes + aval + iva (sin sanción).
   */
  static aplicarSancionesAAmortizacion(
    amortizacion: RefinanciamientoItem[],
    sancionPorCuota: Map<number, number>,
    cuotaMaximaPagada: number = 0
  ): RefinanciamientoItem[] {
    return amortizacion.map(cuota => {
      const sancionCuota = sancionPorCuota.get(cuota.numeroCuota);

      if (sancionCuota && sancionCuota > 0 && cuota.numeroCuota > cuotaMaximaPagada) {
        return {
          ...cuota,
          sancion: sancionCuota,
          // cuotaTotal NO se modifica — sanción va solo en campo `sancion`
        };
      }

      return cuota;
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PROCESAMIENTO DE SANCIONES EXONERADAS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Procesa sanciones exoneradas: restar del total antes de distribuir
   */
  static procesarExoneradas(sancionesExoneradas: SancionRegistro[]): {
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
  // PROCESAMIENTO DE GASTOS CARTERA (FASE 3b)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Procesa gastos de cartera (prejuridico + juridico).
   * Determina el saldo pendiente restando pagos jurídicos.
   * 
   * Fuente: extras (legacy) con concepto IN ('Prejuridico', 'Juridico'), estado = 'Debe'
   * 
   * LÓGICA DE RESTA:
   * 1. Si hay pagos con estado='Debe' (parciales):
   *    → Usar la columna 'debe' del pago como saldo pendiente real
   *    → Es el valor calculado por el sistema legacy en tiempo real
   * 2. Si todos los pagos son estado='Ok' (completados):
   *    → Restar sum(abono) de extras.valor → Math.max(0, resultado)
   * 3. Si no hay pagos para ese concepto:
   *    → Mantener extras.valor completo como saldo pendiente
   * 
   * Ejemplo con pago parcial:
   * - Extras Prejuridico: 1,000,000
   * - Pago Prejuridico: abono=100,000, debe=900,000, estado='Debe'
   * - Gastos Cartera Final: 900,000 (usa 'debe' del pago)
   * 
   * @param extras Array de extras pendientes
   * @param infoPagos Info de pagos procesados (para restar pagos jurídicos)
   */
  static procesarGastosCartera(
    extras: ExtraRegistro[],
    infoPagos?: InfoPagosProcessados
  ): GastosCartera {
    const gastosCartera: GastosCartera = {
      prejuridico: { total: 0, cantidad: 0 },
      juridico: { total: 0, cantidad: 0 },
    };

    if (!extras || extras.length === 0) return gastosCartera;

    // Filtrar solo gastos pendientes con valor > 0
    const extrasValidos = extras.filter(extra => extra.estado === 'Debe' && extra.valor > 0);

    extrasValidos.forEach(extra => {
      if (extra.concepto === 'Prejuridico') {
        gastosCartera.prejuridico.total += extra.valor;
        gastosCartera.prejuridico.cantidad += 1;
      } else if (extra.concepto === 'Juridico') {
        gastosCartera.juridico.total += extra.valor;
        gastosCartera.juridico.cantidad += 1;
      }
    });

    // ─── DETERMINAR SALDO PENDIENTE DE GASTOS CARTERA ────────────────
    // LÓGICA CLAVE:
    //   Los extras con estado='Debe' representan cargos NUEVOS pendientes.
    //   Los pagos con estado='Ok' fueron para extras ANTERIORES (ya marcados Ok/Finalizado).
    //   → NO restar pagos Ok de extras pendientes (son de cargos diferentes).
    //   → Solo usar 'debe' de pagos con estado='Debe' (pago parcial contra extra actual).
    //
    // Ejemplo creditoId 24283:
    //   Extra 5139: Prejuridico, Ok, 80500 → ya pagado, no es pendiente
    //   Extra 5546: Prejuridico, Debe, 74350 → carga NUEVA pendiente
    //   Pago: Prejuridico, Ok, abono=80500 → fue para extra 5139, NO restar
    //   Resultado correcto: gastosCartera.prejuridico.total = 74350
    if (infoPagos?.pagosJuridicos) {
      // ── PREJURIDICO ──
      if (gastosCartera.prejuridico.total > 0 && infoPagos.pagosJuridicos.debePrejuridico > 0) {
        // Hay un pago parcial con estado='Debe' contra el extra pendiente actual
        // → usar 'debe' del pago como saldo real (legacy lo calcula en tiempo real)
        gastosCartera.prejuridico.total = infoPagos.pagosJuridicos.debePrejuridico;
      }
      // Si NO hay pagos Debe (debePrejuridico === 0):
      //   → extras.valor ya es el saldo pendiente correcto, NO restar pagos Ok

      // ── JURIDICO ──
      if (gastosCartera.juridico.total > 0 && infoPagos.pagosJuridicos.debeJuridico > 0) {
        // Hay un pago parcial con estado='Debe' contra el extra pendiente actual
        gastosCartera.juridico.total = infoPagos.pagosJuridicos.debeJuridico;
      }
      // Si NO hay pagos Debe: extras.valor es el saldo correcto
    }

    return gastosCartera;
  }

  /**
   * Gastos cartera NO se suman a cuotaTotal.
   * Se reportan únicamente en gastosCartera del resultado y en estadísticas.
   * cuotaTotal sigue siendo capital + interes + aval + iva.
   * Este método se mantiene por compatibilidad pero no modifica la amortización.
   */
  static aplicarGastosCarteraAAmortizacion(
    amortizacion: RefinanciamientoItem[],
    _gastosCartera: GastosCartera
  ): RefinanciamientoItem[] {
    return amortizacion;
  }

  // ═══════════════════════════════════════════════════════════════
  // CALCULAR ESTADÍSTICAS
  // ═══════════════════════════════════════════════════════════════

  private static calcularEstadisticas(
    amortizacion: RefinanciamientoItem[],
    gastosCartera: GastosCartera
  ): ResultadoSanciones['estadisticas'] {
    if (amortizacion.length === 0) {
      return {
        totalCuotas: 0,
        cuotaTotal: 0,
        totalCapital: 0,
        totalInteres: 0,
        totalAval: 0,
        totalIVA: 0,
        totalSanciones: 0,
        totalGastosCartera: 0,
      };
    }

    return {
      totalCuotas: amortizacion.length,
      cuotaTotal: amortizacion.length > 0 ? amortizacion[0].cuotaTotal : 0,
      totalCapital: amortizacion.reduce((sum, item) => sum + item.capital, 0),
      totalInteres: amortizacion.reduce((sum, item) => sum + item.interes, 0),
      totalAval: amortizacion.reduce((sum, item) => sum + item.aval, 0),
      totalIVA: amortizacion.reduce((sum, item) => sum + item.iva, 0),
      totalSanciones: amortizacion.reduce((sum, item) => sum + (item.sancion || 0), 0),
      totalGastosCartera: gastosCartera.prejuridico.total + gastosCartera.juridico.total,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // MÉTODO PRINCIPAL: Aplicar sanciones y gastos a amortización
  // ═══════════════════════════════════════════════════════════════

  /**
   * Ejecuta la Fase 3 completa.
   * LÓGICA PURA: Lee amortización con pagos + sanciones + extras, retorna amortización final.
   * NO hace INSERT/UPDATE.
   * 
   * @param amortizacion Amortización con pagos aplicados (de Fase 2)
   * @param sancionesPendientes Sanciones con estado 'Debe' (de legacy)
   * @param sancionesExoneradas Sanciones con estado 'Exonerada' (de legacy)
   * @param extras Gastos cartera pendientes (de legacy)
   * @param periocidad Período del crédito
   * @param cuotaMaximaPagada Última cuota completamente pagada (de Fase 2)
   * @param infoPagos Info de pagos (para restar pagos jurídicos de gastos)
   */
  static aplicar(
    amortizacion: RefinanciamientoItem[],
    sancionesPendientes: SancionRegistro[],
    sancionesExoneradas: SancionRegistro[],
    extras: ExtraRegistro[],
    periocidad: 'mensual' | 'quincenal',
    cuotaMaximaPagada: number = 0,
    infoPagos?: InfoPagosProcessados
  ): ResultadoSanciones {
    const resultado: ResultadoSanciones = {
      exitoso: false,
      mensaje: '',
      errores: [],
    };

    try {
      let amortizacionFinal = [...amortizacion];

      // ─── PASO 1: Distribuir sanciones pendientes ──────────
      // Algoritmo idéntico al original mapearSancionesACuotas:
      //   1. Sumar TODAS las sanciones pendientes (estado='Debe')
      //   2. Filtrar cuotas pendientes (numeroCuota > cuotaMaximaPagada && capital > 0)
      //   3. Llenar cada cuota hasta el máximo por período:
      //      - Quincenal: máx 15,000 por cuota
      //      - Mensual: máx 30,000 por cuota
      //   4. ÚLTIMA cuota pendiente: acumula TODO el restante (sin límite)
      //   5. Cuotas ya pagadas (capital=0) NO reciben sanciones
      if (sancionesPendientes && sancionesPendientes.length > 0) {
        const sancionPorCuota = this.distribuirSanciones(
          sancionesPendientes,
          amortizacionFinal,
          periocidad,
          cuotaMaximaPagada
        );

        amortizacionFinal = this.aplicarSancionesAAmortizacion(
          amortizacionFinal,
          sancionPorCuota,
          cuotaMaximaPagada
        );
      }

      // ─── PASO 2: Sanitizar valores ───────────────────────
      // Solo clamp negativos a 0. cuotaTotal NO se recalcula:
      // se mantiene tal cual viene de Fase 2 (capital + interes + aval + iva).
      // Las sanciones van SOLO en el campo `sancion`, separadas.
      amortizacionFinal = amortizacionFinal.map(item => {
        let { interes, aval, iva, saldo } = item;
        if (interes < 0) interes = 0;
        if (aval < 0) aval = 0;
        if (iva < 0) iva = 0;
        if (saldo < 0) saldo = 0;
        // cuotaTotal = capital + interes + aval + iva (SIN sancion, SIN gastos)
        const cuotaTotal = item.capital + interes + aval + iva;
        return { ...item, interes, aval, iva, cuotaTotal, saldo };
      });

      // ─── PASO 3: Procesar gastos cartera (DESPUÉS de sanitizar) ──
      // Se aplica después de sanitización para que los gastos NO se pierdan
      // al recalcular cuotaTotal desde componentes.
      const gastosCartera = this.procesarGastosCartera(extras || [], infoPagos);
      resultado.gastosCartera = gastosCartera;

      if (gastosCartera.prejuridico.total > 0 || gastosCartera.juridico.total > 0) {
        amortizacionFinal = this.aplicarGastosCarteraAAmortizacion(amortizacionFinal, gastosCartera);
      }

      // ─── PASO 4: Procesar sanciones exoneradas (estadísticas) ──
      const exoneradasInfo = this.procesarExoneradas(sancionesExoneradas);

      // ─── PASO 5: Estadísticas ────────────────────────────
      resultado.estadisticas = this.calcularEstadisticas(amortizacionFinal, gastosCartera);

      resultado.amortizacionFinal = amortizacionFinal;
      resultado.exitoso = true;
      resultado.mensaje = `Sanciones y gastos cartera aplicados. Cuotas: ${amortizacionFinal.length}, Sanciones totales: ${resultado.estadisticas?.totalSanciones || 0}, Condonadas: ${exoneradasInfo.sanciones_condonadas}`;

      return resultado;
    } catch (error) {
      resultado.exitoso = false;
      resultado.mensaje = 'Error al aplicar sanciones y gastos cartera';
      resultado.errores.push(error instanceof Error ? error.message : 'Error desconocido');
      return resultado;
    }
  }
}
