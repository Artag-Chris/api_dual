/**
 * FASE 4: Reconciliación contra Saldo Legacy
 * 
 * Compara la amortización calculada (post Fase 3) contra creditos.saldo de legacy.
 * Si la diferencia supera la tolerancia (100,000), redistribuye las cuotas de abajo
 * hacia arriba usando el saldo neto (saldo - sanciones - gastos cartera).
 * 
 * LÓGICA PURA: Solo lee datos y retorna resultado. NO hace INSERT/UPDATE.
 * 
 * Reglas clave:
 * - creditos.saldo es LA VERDAD
 * - Tolerancia: ±100,000
 * - Si |diferencia| ≤ 100,000 → no redistribuir
 * - Si |diferencia| > 100,000 → redistribuir usando saldo neto
 * - Redistribución: de abajo hacia arriba con valores originales de Fase 1
 * - Cuota parcial: Capital → IVA → Aval → Interés (en ese orden)
 * - Post-redistribución: re-distribuir sanciones entre cuotas sobrevivientes
 *   (max 15k quincenal / 30k mensual por cuota, última sin límite)
 */

import {
  RefinanciamientoItem,
  GastosCartera,
  ResultadoReconciliacion,
} from '../interfaces';

/** Tolerancia en pesos para la comparación saldo vs sumatoria */
const TOLERANCIA_SALDO = 100000;

export class ReconciliacionSaldoStrategy {

  // ═══════════════════════════════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════════════════════════════

  
  /**
   * Suma cuotaTotal de las cuotas pendientes (capital > 0)
   */
  private static sumarCuotasPendientes(amortizacion: RefinanciamientoItem[]): number {
    return amortizacion
      .filter(c => c.capital > 0)
      .reduce((sum, c) => sum + c.cuotaTotal, 0);
  }

  /**
   * Suma sanciones de las cuotas pendientes
   */
  private static sumarSanciones(amortizacion: RefinanciamientoItem[]): number {
    return amortizacion
      .filter(c => c.capital > 0)
      .reduce((sum, c) => sum + (c.sancion || 0), 0);
  }

  /**
   * Suma total de gastos cartera
   */
  private static sumarGastosCartera(gastosCartera?: GastosCartera): number {
    if (!gastosCartera) return 0;
    return gastosCartera.prejuridico.total + gastosCartera.juridico.total;
  }

  /**
   * Obtiene los valores originales de una cuota completa desde la amortización de Fase 1.
   * Busca la primera cuota con capital > 0 (no pagada) como plantilla.
   * Retorna capital, interes, aval, iva, cuotaTotal originales.
   */
  private static obtenerPlantillaCuota(
    amortizacionOriginal: RefinanciamientoItem[]
  ): { capital: number; interes: number; aval: number; iva: number; cuotaTotal: number } {
    // Usar la primera cuota con valores válidos como plantilla
    const plantilla = amortizacionOriginal.find(c => c.capital > 0 && c.cuotaTotal > 0);
    if (!plantilla) {
      return { capital: 0, interes: 0, aval: 0, iva: 0, cuotaTotal: 0 };
    }
    return {
      capital: plantilla.capital,
      interes: plantilla.interes,
      aval: plantilla.aval,
      iva: plantilla.iva,
      cuotaTotal: plantilla.cuotaTotal,
    };
  }

  /**
   * Distribuye un monto parcial (que no alcanza para cuota completa)
   * en los componentes de la cuota, siguiendo el orden:
   *   Capital → IVA → Aval → Interés
   * 
   * Cada componente se llena hasta su valor original antes de pasar al siguiente.
   */
  private static distribuirCuotaParcial(
    montoDisponible: number,
    plantilla: { capital: number; interes: number; aval: number; iva: number }
  ): { capital: number; interes: number; aval: number; iva: number; cuotaTotal: number } {
    let restante = montoDisponible;

    // 1. Capital (primero)
    const capital = Math.min(restante, plantilla.capital);
    restante -= capital;

    // 2. IVA
    const iva = Math.min(restante, plantilla.iva);
    restante -= iva;

    // 3. Aval
    const aval = Math.min(restante, plantilla.aval);
    restante -= aval;

    // 4. Interés (último)
    const interes = Math.min(restante, plantilla.interes);
    restante -= interes;

    return {
      capital,
      interes,
      aval,
      iva,
      cuotaTotal: capital + interes + aval + iva,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // REDISTRIBUCIÓN DE ABAJO HACIA ARRIBA
  // ═══════════════════════════════════════════════════════════════

  /**
   * Redistribuye la amortización de abajo hacia arriba usando el saldo neto.
   * 
   * Algoritmo:
   * 1. Obtener cuotas pendientes (capital > 0) ordenadas por numeroCuota ASC
   * 2. Obtener plantilla de cuota completa desde amortización original (Fase 1)
   * 3. Recorrer cuotas DE ABAJO HACIA ARRIBA (última cuota primero)
   * 4. Cada cuota completa: usar valores originales, restar cuotaTotal del saldo
   * 5. Cuando saldo < cuotaTotal: distribuir parcial (Capital→IVA→Aval→Interés)
   * 6. Cuotas restantes (más arriba): quedan en 0
   * 7. Recalcular saldos de arriba hacia abajo
   * 
   * @param amortizacionPostFase3 Amortización con pagos+sanciones aplicadas
   * @param amortizacionOriginal Amortización de Fase 1 (valores originales)
   * @param saldoNeto Saldo neto disponible para cuotas (saldo - sanciones - gastos)
   */
  private static redistribuir(
    amortizacionPostFase3: RefinanciamientoItem[],
    amortizacionOriginal: RefinanciamientoItem[],
    saldoNeto: number
  ): { amortizacion: RefinanciamientoItem[]; cuotasCompletas: number; excedenteParcial: number } {
    // Clonar para no mutar
    const amortizacion = amortizacionPostFase3.map(c => ({ ...c }));
    const plantilla = this.obtenerPlantillaCuota(amortizacionOriginal);

    if (plantilla.cuotaTotal <= 0) {
      return { amortizacion, cuotasCompletas: 0, excedenteParcial: 0 };
    }

    // Identificar cuotas pendientes (capital > 0)
    const indicesPendientes = amortizacion
      .map((c, i) => ({ index: i, numeroCuota: c.numeroCuota, capital: c.capital }))
      .filter(c => c.capital > 0)
      .sort((a, b) => a.numeroCuota - b.numeroCuota);

    if (indicesPendientes.length === 0) {
      return { amortizacion, cuotasCompletas: 0, excedenteParcial: 0 };
    }

    // Primero: poner TODAS las cuotas pendientes en 0
    for (const { index } of indicesPendientes) {
      amortizacion[index] = {
        ...amortizacion[index],
        capital: 0,
        interes: 0,
        aval: 0,
        iva: 0,
        cuotaTotal: 0,
        sancion: amortizacion[index].sancion, // mantener sanciones
      };
    }

    // Recorrer DE ABAJO HACIA ARRIBA
    let saldoRestante = saldoNeto;
    let cuotasCompletas = 0;
    let excedenteParcial = 0;

    for (let i = indicesPendientes.length - 1; i >= 0 && saldoRestante > 0; i--) {
      const idx = indicesPendientes[i].index;

      if (saldoRestante >= plantilla.cuotaTotal) {
        // Cuota completa: usar valores originales de Fase 1
        amortizacion[idx] = {
          ...amortizacion[idx],
          capital: plantilla.capital,
          interes: plantilla.interes,
          aval: plantilla.aval,
          iva: plantilla.iva,
          cuotaTotal: plantilla.cuotaTotal,
        };
        saldoRestante -= plantilla.cuotaTotal;
        cuotasCompletas++;
      } else {
        // Cuota parcial: distribuir lo que queda
        const parcial = this.distribuirCuotaParcial(saldoRestante, plantilla);
        amortizacion[idx] = {
          ...amortizacion[idx],
          capital: parcial.capital,
          interes: parcial.interes,
          aval: parcial.aval,
          iva: parcial.iva,
          cuotaTotal: parcial.cuotaTotal,
        };
        excedenteParcial = saldoRestante;
        saldoRestante = 0;
      }
    }

    // Recalcular saldos de arriba hacia abajo
    // El saldo de la primera cuota pendiente = saldoNeto (lo que se distribuyó)
    // Luego cada cuota resta su capital al saldo anterior
    let saldoAcumulado = saldoNeto;
    for (const { index } of indicesPendientes) {
      amortizacion[index].saldo = Math.round(saldoAcumulado);
      saldoAcumulado -= amortizacion[index].capital;
      if (saldoAcumulado < 0) saldoAcumulado = 0;
    }

    return { amortizacion, cuotasCompletas, excedenteParcial };
  }

  // ═══════════════════════════════════════════════════════════════
  // REDISTRIBUCIÓN DE SANCIONES POST-RECONCILIACIÓN
  // ═══════════════════════════════════════════════════════════════

  /**
   * Calcula el máximo de sanciones permitidas por cuota según período.
   * Misma regla que Fase 3: quincenal=15,000, mensual=30,000
   */
  private static calcularMaximoSancionPorPeriodo(periocidad: 'mensual' | 'quincenal'): number {
    return periocidad === 'quincenal' ? 15000 : 30000;
  }

  /**
   * Re-distribuye las sanciones entre las cuotas que sobrevivieron la redistribución.
   * 
   * Después de redistribuir cuotas (de abajo hacia arriba), algunas cuotas que tenían
   * sanciones quedaron en 0. Las sanciones deben re-asignarse SOLO a las cuotas con
   * capital > 0 (las que tienen valor después de la redistribución).
   * 
   * Algoritmo (idéntico a Fase 3):
   * 1. Sumar TODAS las sanciones de la amortización post-Fase 3 (antes de redistribuir cuotas)
   * 2. Limpiar sanciones de TODAS las cuotas
   * 3. Identificar cuotas sobrevivientes (capital > 0 post-redistribución)
   * 4. Distribuir de la PRIMERA a la ÚLTIMA cuota sobreviviente:
   *    - Max por cuota: 15,000 (quincenal) o 30,000 (mensual)
   *    - ÚLTIMA cuota sobreviviente: recibe TODO el restante (sin límite)
   * 5. Cuotas con capital=0 NO reciben sanciones
   * 
   * @param amortizacion Amortización ya redistribuida (cuotas de abajo→arriba)
   * @param totalSanciones Total de sanciones a distribuir (suma de Fase 3)
   * @param periocidad Periodicidad del crédito
   */
  private static redistribuirSanciones(
    amortizacion: RefinanciamientoItem[],
    totalSanciones: number,
    periocidad: 'mensual' | 'quincenal'
  ): RefinanciamientoItem[] {
    // Limpiar TODAS las sanciones
    const resultado: RefinanciamientoItem[] = amortizacion.map(c => {
      const { sancion, ...rest } = c;
      return rest;
    });

    if (totalSanciones <= 0) return resultado;

    // Identificar cuotas sobrevivientes (con capital > 0) ordenadas por numeroCuota ASC
    const cuotasSobrevivientes = resultado
      .map((c, i) => ({ index: i, numeroCuota: c.numeroCuota }))
      .filter(({ index }) => resultado[index].capital > 0)
      .sort((a, b) => a.numeroCuota - b.numeroCuota);

    if (cuotasSobrevivientes.length === 0) return resultado;

    const maximoPorCuota = this.calcularMaximoSancionPorPeriodo(periocidad);
    let sancionesRestantes = totalSanciones;

    for (let i = 0; i < cuotasSobrevivientes.length && sancionesRestantes > 0; i++) {
      const idx = cuotasSobrevivientes[i].index;
      const esUltimaCuota = i === cuotasSobrevivientes.length - 1;

      if (esUltimaCuota) {
        // Última cuota sobreviviente: TODO lo restante (sin límite)
        resultado[idx].sancion = sancionesRestantes;
        sancionesRestantes = 0;
      } else {
        // Cuotas intermedias: hasta el máximo por período
        const aAsignar = Math.min(sancionesRestantes, maximoPorCuota);
        resultado[idx].sancion = aAsignar;
        sancionesRestantes -= aAsignar;
      }
    }

    return resultado;
  }

  // ═══════════════════════════════════════════════════════════════
  // MÉTODO PRINCIPAL: Aplicar reconciliación
  // ═══════════════════════════════════════════════════════════════

  /**
   * Ejecuta la Fase 4 completa.
   * 
   * 1. Calcula sumatoria de cuotas pendientes + sanciones + gastos cartera
   * 2. Compara contra saldoLegacy (creditos.saldo)
   * 3. Si |diferencia| ≤ 100,000 → retorna sin cambios
   * 4. Si |diferencia| > 100,000 → redistribuye de abajo hacia arriba
   * 
   * @param amortizacionPostFase3 Amortización final de Fase 3
   * @param amortizacionOriginal Amortización de Fase 1 (valores originales de cuota)
   * @param saldoLegacy Valor de creditos.saldo en legacy (LA VERDAD)
   * @param gastosCartera Gastos cartera procesados en Fase 3
   * @param periocidad Periodicidad del crédito (para redistribución de sanciones)
   */
  static aplicar(
    amortizacionPostFase3: RefinanciamientoItem[],
    amortizacionOriginal: RefinanciamientoItem[],
    saldoLegacy: number,
    gastosCartera?: GastosCartera,
    periocidad: 'mensual' | 'quincenal' = 'mensual'
  ): ResultadoReconciliacion {
    const resultado: ResultadoReconciliacion = {
      exitoso: false,
      mensaje: '',
      errores: [],
      redistribucionAplicada: false,
      saldoLegacy,
      sumaCuotasCalculada: 0,
      totalSanciones: 0,
      totalGastosCartera: 0,
      diferencia: 0,
      tolerancia: TOLERANCIA_SALDO,
    };

    try {
      // ─── PASO 1: Calcular sumatorias ─────────────────────
      const sumaCuotas = this.sumarCuotasPendientes(amortizacionPostFase3);
      const totalSanciones = this.sumarSanciones(amortizacionPostFase3);
      const totalGastosCartera = this.sumarGastosCartera(gastosCartera);

      resultado.sumaCuotasCalculada = sumaCuotas;
      resultado.totalSanciones = totalSanciones;
      resultado.totalGastosCartera = totalGastosCartera;

      const totalCalculado = sumaCuotas + totalSanciones + totalGastosCartera;
      const diferencia = Math.abs(totalCalculado - saldoLegacy);
      resultado.diferencia = diferencia;

      // ─── PASO 2: Comparar contra tolerancia ──────────────
      if (diferencia <= TOLERANCIA_SALDO) {
        // Dentro de tolerancia → no redistribuir
        resultado.exitoso = true;
        resultado.redistribucionAplicada = false;
        resultado.amortizacionReconciliada = amortizacionPostFase3;
        resultado.mensaje = `Diferencia de ${diferencia.toLocaleString()} está dentro de la tolerancia (±${TOLERANCIA_SALDO.toLocaleString()}). No se requiere redistribución.`;
        return resultado;
      }

      // ─── PASO 3: Calcular saldo neto para cuotas ────────
      // saldoNeto = creditos.saldo - sanciones - gastosCartera
      const saldoNeto = Math.max(0, saldoLegacy - totalSanciones - totalGastosCartera);
      resultado.saldoNetoCuotas = saldoNeto;

      // ─── PASO 4: Redistribuir cuotas de abajo hacia arriba ─────
      const redistribucion = this.redistribuir(
        amortizacionPostFase3,
        amortizacionOriginal,
        saldoNeto
      );

      // ─── PASO 5: Re-distribuir sanciones entre cuotas sobrevivientes ─────
      const amortizacionConSanciones = this.redistribuirSanciones(
        redistribucion.amortizacion,
        totalSanciones,
        periocidad
      );

      resultado.amortizacionReconciliada = amortizacionConSanciones;
      resultado.cuotasCompletasRedistribuidas = redistribucion.cuotasCompletas;
      resultado.excedenteParcial = redistribucion.excedenteParcial;
      resultado.redistribucionAplicada = true;
      resultado.exitoso = true;
      resultado.mensaje = `Redistribución aplicada. Diferencia: ${diferencia.toLocaleString()} (>${TOLERANCIA_SALDO.toLocaleString()}). ` +
        `Saldo legacy: ${saldoLegacy.toLocaleString()}, Saldo neto cuotas: ${saldoNeto.toLocaleString()}. ` +
        `Cuotas completas: ${redistribucion.cuotasCompletas}, Excedente parcial: ${redistribucion.excedenteParcial.toLocaleString()}.`;

      return resultado;
    } catch (error) {
      resultado.exitoso = false;
      resultado.mensaje = 'Error al ejecutar reconciliación contra saldo legacy';
      resultado.errores.push(error instanceof Error ? error.message : 'Error desconocido');
      return resultado;
    }
  }
}
