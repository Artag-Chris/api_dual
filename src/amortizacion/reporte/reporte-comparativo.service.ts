import { prismaMainService } from '../../database/main/prisma-main.service';

const FACILITO = 'FACILITO2';

// ═══════════════════════════════════════════════════════════════
// INTERFACES INTERNAS
// ═══════════════════════════════════════════════════════════════

interface LegacyCreditoRow {
  credito_id: number;
  documento: string;
  estado: string;
  saldo_legacy: number;
  vlr_cuota: number;
  cuotas_faltantes: number;
  deuda_cuotas: number;
  sanciones_debe: number;
  extras_prejuridico: number;
  extras_juridico: number;
  total_calculado_legacy: number;
}

interface MainCreditoRow {
  credito_id: number;
  estado_main: string;
  cuotas_en_tabla: number;
  total_cuota_amort: number;
  total_sancion_amort: number;
  total_prejuridico_gc: number;
  total_juridico_gc: number;
}

// ═══════════════════════════════════════════════════════════════
// INTERFACES PÚBLICAS — Comparativo 1
// ═══════════════════════════════════════════════════════════════

export interface ComparativoCredito {
  credito_id: number;
  documento: string;

  // ── LEGACY ──
  estado_legacy: string;

  // Análisis 1: saldo directo del campo creditos.saldo
  saldo_legacy: number;

  // Análisis 2: calculado desde legacy
  // = (cuotas_faltantes × vlr_cuota)
  //   + SUM(sanciones WHERE estado='Debe')
  //   + SUM(extras WHERE concepto IN ('Prejuridico','Juridico') AND estado='Debe')
  vlr_cuota: number;
  cuotas_faltantes: number;
  deuda_cuotas: number;
  sanciones_debe: number;
  extras_prejuridico: number;
  extras_juridico: number;
  total_calculado_legacy: number;

  // ── MAIN ──
  tiene_main: boolean;
  estado_main: string | null;

  // Análisis 3: calculado desde main
  // = SUM(amortizacion.total_cuota)
  //   + SUM(amortizacion.sancion)      ← columna separada, no está en total_cuota
  //   + SUM(gastos_cartera.prejuridico + juridico)
  cuotas_en_tabla_main: number;
  total_cuota_amort: number;
  total_sancion_amort: number;
  total_prejuridico_gc: number;
  total_juridico_gc: number;
  gran_total_main: number;

  // ── Diferencias ──
  dif_saldo_vs_calculado: number;   // (1) vs (2): inconsistencia interna legacy
  dif_saldo_vs_main: number;        // (1) vs (3): saldo legacy vs total main
  dif_calculado_vs_main: number;    // (2) vs (3): calculado legacy vs total main
}

export interface ResultadoComparativo1 {
  titulo: string;
  fecha_generacion: Date;
  descripcion: string;
  creditos: ComparativoCredito[];
  resumen: {
    total_creditos_legacy: number;
    creditos_con_main: number;
    creditos_sin_main: number;
    total_saldo_legacy: number;
    total_calculado_legacy: number;
    total_gran_total_main: number;
    dif_total_saldo_vs_calculado: number;
    dif_total_saldo_vs_main: number;
    dif_total_calculado_vs_main: number;
    por_estado: {
      estado: string;
      cantidad: number;
      total_saldo_legacy: number;
      total_calculado_legacy: number;
      total_gran_total_main: number;
    }[];
  };
}

// ═══════════════════════════════════════════════════════════════
// INTERFACES PÚBLICAS — Comparativo 2
// ═══════════════════════════════════════════════════════════════

export interface ResumenPorEstado {
  estado_legacy: string;
  cantidad: number;
  total_saldo_legacy: number;
  total_calculado_legacy: number;
  total_gran_total_main: number;
  diferencia_saldo_vs_main: number;
  diferencia_calculado_vs_main: number;
  creditos_con_main: number;
  creditos_sin_main: number;
}

export interface CreditoHuerfano {
  id: number;
  origen: 'SOLO_EN_LEGACY' | 'SOLO_EN_MAIN';
  documento: string;
  estado: string;
  valor_estimado: number;
}

export interface AnalisisBrechas {
  categoria: string;
  cantidad_creditos: number;
  rango_diferencia: string;
  porcentaje_del_total: number;
  suma_diferencias: number;
}

export interface ResultadoComparativo2 {
  titulo: string;
  fecha_generacion: Date;
  descripcion: string;
  resumen_por_estado: ResumenPorEstado[];
  creditos_huerfanos: {
    solo_en_legacy: CreditoHuerfano[];
    solo_en_main: CreditoHuerfano[];
  };
  analisis_brechas: AnalisisBrechas[];
  top_discrepancias: {
    top10_saldo_vs_main: ComparativoCredito[];
    top10_calculado_vs_main: ComparativoCredito[];
    inconsistencias_internas: ComparativoCredito[];
  };
  totales_globales: {
    total_saldo_legacy: number;
    total_calculado_legacy: number;
    total_gran_total_main: number;
    dif_saldo_vs_main: number;
    dif_calculado_vs_main: number;
    porcentaje_dif_saldo_vs_main: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════

export class ReporteComparativoService {
  // ─────────────────────────────────────────────────────────────
  // COMPARATIVO 1: Detalle crédito por crédito
  //
  // Base: TODOS los créditos FACILITO con:
  //   estado IN ('Al dia','Mora','Prejuridico','Juridico')
  //   AND creditos.saldo > 0
  //
  // Por crédito, 3 valores:
  //   (1) saldo_legacy       = creditos.saldo (campo directo)
  //   (2) total_calculado_legacy
  //       = cuotas_faltantes × vlr_cuota
  //         + SUM(sanciones.valor WHERE estado='Debe')
  //         + SUM(extras.valor WHERE concepto='Prejuridico' AND estado='Debe')
  //         + SUM(extras.valor WHERE concepto='Juridico'    AND estado='Debe')
  //   (3) gran_total_main
  //       = SUM(amortizacion.total_cuota)
  //         + SUM(amortizacion.sancion)
  //         + SUM(gastos_cartera.prejuridico)
  //         + SUM(gastos_cartera.juridico)
  // ─────────────────────────────────────────────────────────────

  static async obtenerComparativo1(): Promise<ResultadoComparativo1> {
    const legacyRows = await this.obtenerTodosLegacyActivos();

    if (legacyRows.length === 0) {
      return {
        titulo: 'Comparativo 1 — FACILITO vs FACILCREDITOS',
        fecha_generacion: new Date(),
        descripcion: 'Sin créditos activos con saldo > 0 en FACILITO.',
        creditos: [],
        resumen: {
          total_creditos_legacy: 0,
          creditos_con_main: 0,
          creditos_sin_main: 0,
          total_saldo_legacy: 0,
          total_calculado_legacy: 0,
          total_gran_total_main: 0,
          dif_total_saldo_vs_calculado: 0,
          dif_total_saldo_vs_main: 0,
          dif_total_calculado_vs_main: 0,
          por_estado: [],
        },
      };
    }

    const ids = legacyRows.map(r => r.credito_id);
    const mainMap = await this.obtenerDatosMain(ids);

    const creditos: ComparativoCredito[] = legacyRows.map(leg => {
      const main = mainMap.get(leg.credito_id);
      const gran_total_main = main
        ? main.total_cuota_amort +
          main.total_sancion_amort +
          main.total_prejuridico_gc +
          main.total_juridico_gc
        : 0;

      return {
        credito_id: leg.credito_id,
        documento: leg.documento,
        estado_legacy: leg.estado,
        saldo_legacy: leg.saldo_legacy,
        vlr_cuota: leg.vlr_cuota,
        cuotas_faltantes: leg.cuotas_faltantes,
        deuda_cuotas: leg.deuda_cuotas,
        sanciones_debe: leg.sanciones_debe,
        extras_prejuridico: leg.extras_prejuridico,
        extras_juridico: leg.extras_juridico,
        total_calculado_legacy: leg.total_calculado_legacy,
        tiene_main: !!main,
        estado_main: main?.estado_main ?? null,
        cuotas_en_tabla_main: main?.cuotas_en_tabla ?? 0,
        total_cuota_amort: main?.total_cuota_amort ?? 0,
        total_sancion_amort: main?.total_sancion_amort ?? 0,
        total_prejuridico_gc: main?.total_prejuridico_gc ?? 0,
        total_juridico_gc: main?.total_juridico_gc ?? 0,
        gran_total_main,
        dif_saldo_vs_calculado: leg.saldo_legacy - leg.total_calculado_legacy,
        dif_saldo_vs_main: leg.saldo_legacy - gran_total_main,
        dif_calculado_vs_main: leg.total_calculado_legacy - gran_total_main,
      };
    });

    creditos.sort(
      (a, b) => Math.abs(b.dif_saldo_vs_main) - Math.abs(a.dif_saldo_vs_main)
    );

    return {
      titulo: 'Comparativo 1 — Detalle por Crédito: FACILITO vs FACILCREDITOS',
      fecha_generacion: new Date(),
      descripcion:
        'Base: créditos FACILITO (Al dia/Mora/Prejuridico/Juridico) con saldo > 0. ' +
        'Por crédito: (1) saldo_legacy, (2) calculado legacy, (3) calculado main. ' +
        'Ordenado por |dif_saldo_vs_main| DESC.',
      creditos,
      resumen: this.calcularResumen1(creditos),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Query FACILITO: todos los créditos activos con saldo > 0
  //
  // sanciones: tabla sanciones, WHERE estado='Debe'
  // extras:    tabla extras, WHERE concepto IN ('Prejuridico','Juridico')
  //            AND estado='Debe'
  // ─────────────────────────────────────────────────────────────

  private static async obtenerTodosLegacyActivos(): Promise<LegacyCreditoRow[]> {
    const rows = await prismaMainService.$queryRawUnsafe<LegacyCreditoRow[]>(`
      SELECT
          leg.id                                                                       AS credito_id,
          leg_cli.num_doc                                                              AS documento,
          leg.estado,
          COALESCE(leg.saldo, 0)                                                       AS saldo_legacy,
          COALESCE(leg_p.vlr_cuota, 0)                                                 AS vlr_cuota,
          COALESCE(leg.cuotas_faltantes, 0)                                            AS cuotas_faltantes,
          (COALESCE(leg.cuotas_faltantes, 0) * COALESCE(leg_p.vlr_cuota, 0))          AS deuda_cuotas,
          COALESCE(san.total_sanciones, 0)                                             AS sanciones_debe,
          COALESCE(ext_pre.total_prejuridico, 0)                                       AS extras_prejuridico,
          COALESCE(ext_jur.total_juridico, 0)                                          AS extras_juridico,
          (COALESCE(leg.cuotas_faltantes, 0) * COALESCE(leg_p.vlr_cuota, 0))
              + COALESCE(san.total_sanciones, 0)
              + COALESCE(ext_pre.total_prejuridico, 0)
              + COALESCE(ext_jur.total_juridico, 0)                                    AS total_calculado_legacy
      FROM ${FACILITO}.creditos leg
      INNER JOIN ${FACILITO}.precreditos leg_p
          ON leg_p.id = leg.precredito_id
      INNER JOIN ${FACILITO}.clientes leg_cli
          ON leg_cli.id = leg_p.cliente_id
      LEFT JOIN (
          SELECT credito_id, SUM(valor) AS total_sanciones
          FROM ${FACILITO}.sanciones
          WHERE estado = 'Debe'
          GROUP BY credito_id
      ) san ON san.credito_id = leg.id
      LEFT JOIN (
          SELECT credito_id, SUM(valor) AS total_prejuridico
          FROM ${FACILITO}.extras
          WHERE concepto = 'Prejuridico' AND estado = 'Debe'
          GROUP BY credito_id
      ) ext_pre ON ext_pre.credito_id = leg.id
      LEFT JOIN (
          SELECT credito_id, SUM(valor) AS total_juridico
          FROM ${FACILITO}.extras
          WHERE concepto = 'Juridico' AND estado = 'Debe'
          GROUP BY credito_id
      ) ext_jur ON ext_jur.credito_id = leg.id
      WHERE leg.estado IN ('Al dia', 'Mora', 'Prejuridico', 'Juridico')
        AND COALESCE(leg.saldo, 0) > 0
      ORDER BY leg.id ASC
    `);

    return rows.map(r => ({
      credito_id: Number(r.credito_id),
      documento: String(r.documento),
      estado: String(r.estado),
      saldo_legacy: Number(r.saldo_legacy),
      vlr_cuota: Number(r.vlr_cuota),
      cuotas_faltantes: Number(r.cuotas_faltantes),
      deuda_cuotas: Number(r.deuda_cuotas),
      sanciones_debe: Number(r.sanciones_debe),
      extras_prejuridico: Number(r.extras_prejuridico),
      extras_juridico: Number(r.extras_juridico),
      total_calculado_legacy: Number(r.total_calculado_legacy),
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // Query FACILCREDITOS: datos main para IDs específicos
  //
  // total_cuota_amort   = SUM(amortizacion.total_cuota)
  // total_sancion_amort = SUM(amortizacion.sancion)
  //                       columna separada, no suma en total_cuota
  // ─────────────────────────────────────────────────────────────

  private static async obtenerDatosMain(
    ids: number[]
  ): Promise<Map<number, MainCreditoRow>> {
    const validIds = ids.filter(id => Number.isFinite(id) && id > 0);
    if (validIds.length === 0) return new Map();

    const idsList = validIds.join(',');
    const rows = await prismaMainService.$queryRawUnsafe<MainCreditoRow[]>(`
      SELECT
          dc.prestamo_ID                                                              AS credito_id,
          dc.estado                                                                   AS estado_main,
          COALESCE((
              SELECT COUNT(*)
              FROM amortizacion am
              WHERE am.prestamoID = dc.prestamo_ID
          ), 0)                                                                       AS cuotas_en_tabla,
          COALESCE((
              SELECT SUM(COALESCE(am.total_cuota, 0))
              FROM amortizacion am
              WHERE am.prestamoID = dc.prestamo_ID
          ), 0)                                                                       AS total_cuota_amort,
          COALESCE((
              SELECT SUM(COALESCE(am.sancion, 0))
              FROM amortizacion am
              WHERE am.prestamoID = dc.prestamo_ID
          ), 0)                                                                       AS total_sancion_amort,
          COALESCE((
              SELECT SUM(COALESCE(gc.prejuridico, 0))
              FROM gastos_cartera gc
              WHERE gc.prestamo_id = dc.prestamo_ID
          ), 0)                                                                       AS total_prejuridico_gc,
          COALESCE((
              SELECT SUM(COALESCE(gc.juridico, 0))
              FROM gastos_cartera gc
              WHERE gc.prestamo_id = dc.prestamo_ID
          ), 0)                                                                       AS total_juridico_gc
      FROM detalle_credito dc
      WHERE dc.prestamo_ID IN (${idsList})
    `);

    const map = new Map<number, MainCreditoRow>();
    for (const r of rows) {
      map.set(Number(r.credito_id), {
        credito_id: Number(r.credito_id),
        estado_main: String(r.estado_main),
        cuotas_en_tabla: Number(r.cuotas_en_tabla),
        total_cuota_amort: Number(r.total_cuota_amort),
        total_sancion_amort: Number(r.total_sancion_amort),
        total_prejuridico_gc: Number(r.total_prejuridico_gc),
        total_juridico_gc: Number(r.total_juridico_gc),
      });
    }
    return map;
  }

  // ─────────────────────────────────────────────────────────────
  // Resumen Comparativo 1
  // ─────────────────────────────────────────────────────────────

  private static calcularResumen1(
    creditos: ComparativoCredito[]
  ): ResultadoComparativo1['resumen'] {
    const estadoMap = new Map<
      string,
      {
        cantidad: number;
        total_saldo_legacy: number;
        total_calculado_legacy: number;
        total_gran_total_main: number;
      }
    >();

    let creditos_con_main = 0;
    let creditos_sin_main = 0;
    let total_saldo_legacy = 0;
    let total_calculado_legacy = 0;
    let total_gran_total_main = 0;

    for (const c of creditos) {
      if (c.tiene_main) creditos_con_main++;
      else creditos_sin_main++;

      total_saldo_legacy += c.saldo_legacy;
      total_calculado_legacy += c.total_calculado_legacy;
      total_gran_total_main += c.gran_total_main;

      let grupo = estadoMap.get(c.estado_legacy);
      if (!grupo) {
        grupo = {
          cantidad: 0,
          total_saldo_legacy: 0,
          total_calculado_legacy: 0,
          total_gran_total_main: 0,
        };
        estadoMap.set(c.estado_legacy, grupo);
      }
      grupo.cantidad++;
      grupo.total_saldo_legacy += c.saldo_legacy;
      grupo.total_calculado_legacy += c.total_calculado_legacy;
      grupo.total_gran_total_main += c.gran_total_main;
    }

    const por_estado = Array.from(estadoMap.entries()).map(([estado, v]) => ({
      estado,
      ...v,
    }));

    return {
      total_creditos_legacy: creditos.length,
      creditos_con_main,
      creditos_sin_main,
      total_saldo_legacy,
      total_calculado_legacy,
      total_gran_total_main,
      dif_total_saldo_vs_calculado: total_saldo_legacy - total_calculado_legacy,
      dif_total_saldo_vs_main: total_saldo_legacy - total_gran_total_main,
      dif_total_calculado_vs_main: total_calculado_legacy - total_gran_total_main,
      por_estado,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // COMPARATIVO 2: Análisis multidimensional
  // ─────────────────────────────────────────────────────────────

  static async obtenerComparativo2(): Promise<ResultadoComparativo2> {
    const [comparativoBase, huerfanosMainRows] = await Promise.all([
      this.obtenerComparativo1(),
      this.queryHuerfanosMain(),
    ]);

    const creditos = comparativoBase.creditos;

    const resumen_por_estado = this.calcularResumenPorEstado(creditos);

    const solo_en_legacy: CreditoHuerfano[] = creditos
      .filter(c => !c.tiene_main)
      .map(c => ({
        id: c.credito_id,
        origen: 'SOLO_EN_LEGACY' as const,
        documento: c.documento,
        estado: c.estado_legacy,
        valor_estimado: c.saldo_legacy,
      }));

    const solo_en_main: CreditoHuerfano[] = huerfanosMainRows.map(r => ({
      id: Number(r.id),
      origen: 'SOLO_EN_MAIN' as const,
      documento: String(r.documento),
      estado: String(r.estado),
      valor_estimado: Number(r.valor_estimado),
    }));

    const analisis_brechas = this.calcularBrechas(creditos);
    const top_discrepancias = this.calcularTopDiscrepancias(creditos);
    const totales_globales = this.calcularTotalesGlobales(comparativoBase.resumen);

    return {
      titulo: 'Comparativo 2 — Análisis Multidimensional: FACILITO vs FACILCREDITOS',
      fecha_generacion: new Date(),
      descripcion:
        'Resumen por estado, créditos huérfanos, distribución de brechas y top discrepancias. ' +
        '3 métricas por crédito: saldo_legacy, total_calculado_legacy, gran_total_main.',
      resumen_por_estado,
      creditos_huerfanos: { solo_en_legacy, solo_en_main },
      analisis_brechas,
      top_discrepancias,
      totales_globales,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Créditos activos en MAIN sin match en FACILITO con saldo > 0
  // ─────────────────────────────────────────────────────────────

  private static async queryHuerfanosMain() {
    return prismaMainService.$queryRawUnsafe<
      { id: bigint; documento: string; estado: string; valor_estimado: number }[]
    >(`
      SELECT
          dc.prestamo_ID                                                              AS id,
          dc.documento,
          dc.estado,
          COALESCE((
              SELECT SUM(COALESCE(am.total_cuota, 0)) + SUM(COALESCE(am.sancion, 0))
              FROM amortizacion am
              WHERE am.prestamoID = dc.prestamo_ID
          ), 0)                                                                       AS valor_estimado
      FROM detalle_credito dc
      LEFT JOIN ${FACILITO}.creditos leg
          ON leg.id = dc.prestamo_ID
         AND leg.estado IN ('Al dia', 'Mora', 'Prejuridico', 'Juridico')
         AND COALESCE(leg.saldo, 0) > 0
      WHERE dc.estado IN ('ACTIVO', 'PREJURIDICO', 'JURIDICO')
        AND leg.id IS NULL
      ORDER BY valor_estimado DESC
    `);
  }

  // ─────────────────────────────────────────────────────────────
  // Resumen por estado legacy
  // ─────────────────────────────────────────────────────────────

  private static calcularResumenPorEstado(
    creditos: ComparativoCredito[]
  ): ResumenPorEstado[] {
    const map = new Map<string, ResumenPorEstado>();

    for (const c of creditos) {
      let grupo = map.get(c.estado_legacy);
      if (!grupo) {
        grupo = {
          estado_legacy: c.estado_legacy,
          cantidad: 0,
          total_saldo_legacy: 0,
          total_calculado_legacy: 0,
          total_gran_total_main: 0,
          diferencia_saldo_vs_main: 0,
          diferencia_calculado_vs_main: 0,
          creditos_con_main: 0,
          creditos_sin_main: 0,
        };
        map.set(c.estado_legacy, grupo);
      }
      grupo.cantidad++;
      grupo.total_saldo_legacy += c.saldo_legacy;
      grupo.total_calculado_legacy += c.total_calculado_legacy;
      grupo.total_gran_total_main += c.gran_total_main;
      if (c.tiene_main) grupo.creditos_con_main++;
      else grupo.creditos_sin_main++;
    }

    for (const g of map.values()) {
      g.diferencia_saldo_vs_main = g.total_saldo_legacy - g.total_gran_total_main;
      g.diferencia_calculado_vs_main = g.total_calculado_legacy - g.total_gran_total_main;
    }

    return Array.from(map.values()).sort((a, b) =>
      a.estado_legacy.localeCompare(b.estado_legacy)
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Análisis de brechas (sobre |dif_saldo_vs_main|)
  // ─────────────────────────────────────────────────────────────

  private static calcularBrechas(creditos: ComparativoCredito[]): AnalisisBrechas[] {
    const total = creditos.length;
    if (total === 0) return [];

    const rangos = [
      { label: 'Sin diferencia (= 0)', min: 0, max: 0 },
      { label: 'Diferencia menor ($1 - $50.000)', min: 1, max: 50_000 },
      { label: 'Diferencia baja ($50.001 - $500.000)', min: 50_001, max: 500_000 },
      { label: 'Diferencia media ($500.001 - $5.000.000)', min: 500_001, max: 5_000_000 },
      { label: 'Diferencia alta ($5.000.001 - $50.000.000)', min: 5_000_001, max: 50_000_000 },
      { label: 'Diferencia muy alta (> $50.000.000)', min: 50_000_001, max: Infinity },
    ];

    return rangos.map(rango => {
      const grupo = creditos.filter(c => {
        const abs = Math.abs(c.dif_saldo_vs_main);
        return abs >= rango.min && abs <= rango.max;
      });
      return {
        categoria: rango.label,
        cantidad_creditos: grupo.length,
        rango_diferencia: rango.label,
        porcentaje_del_total:
          total > 0 ? Math.round((grupo.length / total) * 1000) / 10 : 0,
        suma_diferencias: grupo.reduce((s, c) => s + Math.abs(c.dif_saldo_vs_main), 0),
      };
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Top discrepancias — 3 rankings
  // ─────────────────────────────────────────────────────────────

  private static calcularTopDiscrepancias(
    creditos: ComparativoCredito[]
  ): ResultadoComparativo2['top_discrepancias'] {
    const byDifSaldoMain = [...creditos].sort(
      (a, b) => Math.abs(b.dif_saldo_vs_main) - Math.abs(a.dif_saldo_vs_main)
    );

    const byDifCalcMain = [...creditos].sort(
      (a, b) => Math.abs(b.dif_calculado_vs_main) - Math.abs(a.dif_calculado_vs_main)
    );

    const inconsistencias_internas = creditos
      .filter(c => Math.abs(c.dif_saldo_vs_calculado) > 0)
      .sort(
        (a, b) => Math.abs(b.dif_saldo_vs_calculado) - Math.abs(a.dif_saldo_vs_calculado)
      );

    return {
      top10_saldo_vs_main: byDifSaldoMain.slice(0, 10),
      top10_calculado_vs_main: byDifCalcMain.slice(0, 10),
      inconsistencias_internas,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Totales globales
  // ─────────────────────────────────────────────────────────────

  private static calcularTotalesGlobales(
    resumen: ResultadoComparativo1['resumen']
  ): ResultadoComparativo2['totales_globales'] {
    const dif_saldo_vs_main =
      resumen.total_saldo_legacy - resumen.total_gran_total_main;
    const dif_calculado_vs_main =
      resumen.total_calculado_legacy - resumen.total_gran_total_main;
    const porcentaje_dif_saldo_vs_main =
      resumen.total_saldo_legacy > 0
        ? Math.round(
            (Math.abs(dif_saldo_vs_main) / resumen.total_saldo_legacy) * 10_000
          ) / 100
        : 0;

    return {
      total_saldo_legacy: resumen.total_saldo_legacy,
      total_calculado_legacy: resumen.total_calculado_legacy,
      total_gran_total_main: resumen.total_gran_total_main,
      dif_saldo_vs_main,
      dif_calculado_vs_main,
      porcentaje_dif_saldo_vs_main,
    };
  }
}
