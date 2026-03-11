import { prismaMainService } from '../../database/main/prisma-main.service';
import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import { ReporteCredítosActivosService } from './reporte-creditos-activos.service';

// Base de datos legacy (tiene guiones, requiere backticks en SQL)
const LEGACY_DB = '`FACIL-2026-03-06`';

// ═══════════════════════════════════════════════════════════════
// INTERFACES COMPARATIVO 1 — Detalle por crédito
// ═══════════════════════════════════════════════════════════════

export interface ComparativoCredito {
  credito_id: number;
  // ── MAIN (FACILCREDITOS) — datos de obtenerReporte ──
  documento_main: string;
  estado_main: string;
  valor_prestamo: string;
  numero_cuotas: string;
  cuotas_en_tabla: number;
  total_cuota: number;
  total_sanciones: number;
  total_prejuridico: number;
  total_juridico: number;
  total_gastos: number;
  gran_total_main: number;
  // ── LEGACY (FACIL-2026-03-06) — solo creditos.saldo ──
  documento_legacy: string | null;
  estado_legacy: string | null;
  saldo_legacy: number;
  vlr_cuota_legacy: number;
  cuotas_faltantes_legacy: number;
  // ── Comparación ──
  estado_concuerda: 'OK' | 'DIFERENTE' | 'SIN_LEGACY';
  diferencia_total: number;
  diferencia_total_abs: number;
}

export interface ResultadoComparativo1 {
  titulo: string;
  fecha_generacion: Date;
  descripcion: string;
  creditos: ComparativoCredito[];
  resumen: {
    total_creditos: number;
    creditos_con_legacy: number;
    creditos_sin_legacy: number;
    creditos_estado_ok: number;
    creditos_estado_diferente: number;
    gran_total_main: number;
    total_saldo_legacy: number;
    diferencia_total: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// INTERFACES COMPARATIVO 2 — Análisis por estado y huérfanos
// ═══════════════════════════════════════════════════════════════

export interface ResumenPorEstado {
  estado_main: string;
  cantidad: number;
  gran_total_main: number;
  total_saldo_legacy: number;
  diferencia: number;
  creditos_con_legacy: number;
  creditos_sin_legacy: number;
}

export interface CreditoHuerfano {
  id: number;
  origen: 'SOLO_EN_MAIN' | 'SOLO_EN_LEGACY';
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
    solo_en_main: CreditoHuerfano[];
    solo_en_legacy: CreditoHuerfano[];
  };
  analisis_brechas: AnalisisBrechas[];
  top_discrepancias: {
    top10_mayor_diferencia: ComparativoCredito[];
    creditos_sin_amortizacion_main: ComparativoCredito[];
  };
  totales_globales: {
    gran_total_main: number;
    total_saldo_legacy: number;
    diferencia_neta: number;
    porcentaje_diferencia: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// Tipo interno para la query legacy
// ═══════════════════════════════════════════════════════════════

interface LegacyCreditoRow {
  credito_id: number;
  documento: string;
  estado: string;
  saldo: number;
  vlr_cuota: number;
  cuotas_faltantes: number;
}

// ═══════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════

export class ReporteComparativoService {
  // ─────────────────────────────────────────────────────────────
  // COMPARATIVO 1: Detalle crédito por crédito
  // Usa obtenerReporte() de creditos-activos para MAIN
  // y creditos.saldo directo de FACIL-2026-03-06 para LEGACY
  // ─────────────────────────────────────────────────────────────

  static async obtenerComparativo1(): Promise<ResultadoComparativo1> {
    // Paso 1: Datos MAIN desde el reporte de créditos activos
    const reporteMain = await ReporteCredítosActivosService.obtenerReporte();
    const creditosMain = reporteMain.creditos;

    if (creditosMain.length === 0) {
      return {
        titulo: 'Comparativo 1 — FACILCREDITOS vs FACIL-2026-03-06',
        fecha_generacion: new Date(),
        descripcion: 'Sin créditos activos en MAIN.',
        creditos: [],
        resumen: {
          total_creditos: 0,
          creditos_con_legacy: 0,
          creditos_sin_legacy: 0,
          creditos_estado_ok: 0,
          creditos_estado_diferente: 0,
          gran_total_main: 0,
          total_saldo_legacy: 0,
          diferencia_total: 0,
        },
      };
    }

    // Paso 2: Obtener datos legacy de FACIL-2026-03-06 para los mismos créditos
    const ids = creditosMain.map(c => c.prestamo_id);
    const legacyMap = await this.obtenerDatosLegacy(ids);

    // Paso 3: Cruzar datos MAIN vs LEGACY
    const creditos: ComparativoCredito[] = creditosMain.map(main => {
      const leg = legacyMap.get(main.prestamo_id);
      const gran_total_main =
        main.total_cuota + main.total_sanciones + main.total_gastos;
      const saldo_legacy = leg ? leg.saldo : 0;
      const diferencia = gran_total_main - saldo_legacy;

      let estado_concuerda: ComparativoCredito['estado_concuerda'] = 'SIN_LEGACY';
      if (leg) {
        const mainEst = main.estado;
        const legEst = leg.estado;
        if (
          (mainEst === 'ACTIVO' && (legEst === 'Al dia' || legEst === 'Mora')) ||
          (mainEst === 'PREJURIDICO' && legEst === 'Prejuridico') ||
          (mainEst === 'JURIDICO' && legEst === 'Juridico')
        ) {
          estado_concuerda = 'OK';
        } else {
          estado_concuerda = 'DIFERENTE';
        }
      }

      return {
        credito_id: main.prestamo_id,
        documento_main: main.documento,
        estado_main: main.estado,
        valor_prestamo: main.valor_prestamo,
        numero_cuotas: main.numero_cuotas,
        cuotas_en_tabla: main.cuotas_en_tabla,
        total_cuota: main.total_cuota,
        total_sanciones: main.total_sanciones,
        total_prejuridico: main.total_prejuridico,
        total_juridico: main.total_juridico,
        total_gastos: main.total_gastos,
        gran_total_main,
        documento_legacy: leg?.documento ?? null,
        estado_legacy: leg?.estado ?? null,
        saldo_legacy,
        vlr_cuota_legacy: leg?.vlr_cuota ?? 0,
        cuotas_faltantes_legacy: leg?.cuotas_faltantes ?? 0,
        estado_concuerda,
        diferencia_total: diferencia,
        diferencia_total_abs: Math.abs(diferencia),
      };
    });

    // Ordenar por diferencia absoluta DESC (más discrepantes primero)
    creditos.sort((a, b) => b.diferencia_total_abs - a.diferencia_total_abs);

    const resumen = this.calcularResumen1(creditos);

    return {
      titulo: 'Comparativo 1 — Detalle por Crédito: FACILCREDITOS vs FACIL-2026-03-06',
      fecha_generacion: new Date(),
      descripcion:
        'Compara gran_total de MAIN (cuotas + sanciones + gastos) contra ' +
        'creditos.saldo de FACIL-2026-03-06. Ordenado por diferencia absoluta DESC.',
      creditos,
      resumen,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Query a FACIL-2026-03-06: documento, saldo, vlr_cuota, cuotas_faltantes
  // ─────────────────────────────────────────────────────────────

  private static async obtenerDatosLegacy(
    ids: number[]
  ): Promise<Map<number, LegacyCreditoRow>> {
    const validIds = ids.filter(id => Number.isFinite(id) && id > 0);
    if (validIds.length === 0) return new Map();

    const idsList = validIds.join(',');
    const rows = await prismaMainService.$queryRawUnsafe<LegacyCreditoRow[]>(`
      SELECT
          leg.id                                    AS credito_id,
          leg_cli.num_doc                           AS documento,
          leg.estado,
          COALESCE(leg.saldo, 0)                    AS saldo,
          COALESCE(leg_p.vlr_cuota, 0)              AS vlr_cuota,
          COALESCE(leg.cuotas_faltantes, 0)         AS cuotas_faltantes
      FROM ${LEGACY_DB}.creditos leg
      INNER JOIN ${LEGACY_DB}.precreditos leg_p
          ON leg_p.id = leg.precredito_id
      INNER JOIN ${LEGACY_DB}.clientes leg_cli
          ON leg_cli.id = leg_p.cliente_id
      WHERE leg.id IN (${idsList})
    `);

    const map = new Map<number, LegacyCreditoRow>();
    for (const r of rows) {
      map.set(Number(r.credito_id), {
        credito_id: Number(r.credito_id),
        documento: String(r.documento),
        estado: String(r.estado),
        saldo: Number(r.saldo),
        vlr_cuota: Number(r.vlr_cuota),
        cuotas_faltantes: Number(r.cuotas_faltantes),
      });
    }
    return map;
  }

  // ─────────────────────────────────────────────────────────────
  // Resumen del Comparativo 1
  // ─────────────────────────────────────────────────────────────

  private static calcularResumen1(
    creditos: ComparativoCredito[]
  ): ResultadoComparativo1['resumen'] {
    let creditos_con_legacy = 0;
    let creditos_sin_legacy = 0;
    let creditos_estado_ok = 0;
    let creditos_estado_diferente = 0;
    let gran_total_main = 0;
    let total_saldo_legacy = 0;

    for (const c of creditos) {
      if (c.estado_concuerda === 'SIN_LEGACY') {
        creditos_sin_legacy++;
      } else {
        creditos_con_legacy++;
        if (c.estado_concuerda === 'OK') creditos_estado_ok++;
        else creditos_estado_diferente++;
      }
      gran_total_main += c.gran_total_main;
      total_saldo_legacy += c.saldo_legacy;
    }

    return {
      total_creditos: creditos.length,
      creditos_con_legacy,
      creditos_sin_legacy,
      creditos_estado_ok,
      creditos_estado_diferente,
      gran_total_main,
      total_saldo_legacy,
      diferencia_total: gran_total_main - total_saldo_legacy,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // COMPARATIVO 2: Análisis por estado + huérfanos + brechas
  // ─────────────────────────────────────────────────────────────

  static async obtenerComparativo2(): Promise<ResultadoComparativo2> {
    // Ejecutar comparativo base y huérfanos legacy en paralelo
    const [comparativoBase, huerfanosLegacyRows] = await Promise.all([
      this.obtenerComparativo1(),
      this.queryHuerfanosLegacy(),
    ]);

    const creditos = comparativoBase.creditos;

    // Resumen por estado — calculado desde los datos ya cruzados
    const resumen_por_estado = this.calcularResumenPorEstado(creditos);

    // Huérfanos MAIN: créditos que están en MAIN pero no en FACIL-2026-03-06
    const solo_en_main: CreditoHuerfano[] = creditos
      .filter(c => c.estado_concuerda === 'SIN_LEGACY')
      .map(c => ({
        id: c.credito_id,
        origen: 'SOLO_EN_MAIN' as const,
        documento: c.documento_main,
        estado: c.estado_main,
        valor_estimado: c.gran_total_main,
      }));

    // Huérfanos LEGACY: créditos activos en FACIL-2026-03-06 sin registro en MAIN
    const solo_en_legacy: CreditoHuerfano[] = huerfanosLegacyRows.map(r => ({
      id: Number(r.id),
      origen: 'SOLO_EN_LEGACY' as const,
      documento: String(r.documento),
      estado: String(r.estado),
      valor_estimado: Number(r.valor_estimado),
    }));

    const analisis_brechas = this.calcularBrechas(creditos);
    const top_discrepancias = this.calcularTopDiscrepancias(creditos);
    const totales_globales = this.calcularTotalesGlobales(comparativoBase.resumen);

    return {
      titulo: 'Comparativo 2 — Análisis Multidimensional: FACILCREDITOS vs FACIL-2026-03-06',
      fecha_generacion: new Date(),
      descripcion:
        'Análisis por estado, créditos huérfanos, distribución de brechas y top discrepancias. ' +
        'Legacy usa creditos.saldo directo de FACIL-2026-03-06.',
      resumen_por_estado,
      creditos_huerfanos: { solo_en_main, solo_en_legacy },
      analisis_brechas,
      top_discrepancias,
      totales_globales,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Resumen por estado (calculado en TS desde datos cruzados)
  // ─────────────────────────────────────────────────────────────

  private static calcularResumenPorEstado(
    creditos: ComparativoCredito[]
  ): ResumenPorEstado[] {
    const map = new Map<string, ResumenPorEstado>();

    for (const c of creditos) {
      let grupo = map.get(c.estado_main);
      if (!grupo) {
        grupo = {
          estado_main: c.estado_main,
          cantidad: 0,
          gran_total_main: 0,
          total_saldo_legacy: 0,
          diferencia: 0,
          creditos_con_legacy: 0,
          creditos_sin_legacy: 0,
        };
        map.set(c.estado_main, grupo);
      }
      grupo.cantidad++;
      grupo.gran_total_main += c.gran_total_main;
      grupo.total_saldo_legacy += c.saldo_legacy;
      if (c.estado_concuerda === 'SIN_LEGACY') grupo.creditos_sin_legacy++;
      else grupo.creditos_con_legacy++;
    }

    for (const g of map.values()) {
      g.diferencia = g.gran_total_main - g.total_saldo_legacy;
    }

    return Array.from(map.values()).sort((a, b) =>
      a.estado_main.localeCompare(b.estado_main)
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Huérfanos Legacy: créditos activos en FACIL-2026-03-06
  //                   que NO existen en FACILCREDITOS
  // ─────────────────────────────────────────────────────────────

  private static async queryHuerfanosLegacy() {
    return prismaMainService.$queryRawUnsafe<
      { id: bigint; documento: string; estado: string; valor_estimado: number }[]
    >(`
      SELECT
          leg.id,
          leg_cli.num_doc                     AS documento,
          leg.estado,
          COALESCE(leg.saldo, 0)              AS valor_estimado
      FROM ${LEGACY_DB}.creditos leg
      INNER JOIN ${LEGACY_DB}.precreditos leg_p
          ON leg_p.id = leg.precredito_id
      INNER JOIN ${LEGACY_DB}.clientes leg_cli
          ON leg_cli.id = leg_p.cliente_id
      LEFT JOIN FACILCREDITOS.detalle_credito main
          ON main.prestamo_ID = leg.id
      WHERE leg.estado IN ('Al dia', 'Mora', 'Prejuridico', 'Juridico')
        AND main.prestamo_ID IS NULL
      ORDER BY valor_estimado DESC
    `);
  }

  // ─────────────────────────────────────────────────────────────
  // Análisis de brechas por rango de diferencia
  // ─────────────────────────────────────────────────────────────

  private static calcularBrechas(
    creditos: ComparativoCredito[]
  ): AnalisisBrechas[] {
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
      const grupo = creditos.filter(
        c => c.diferencia_total_abs >= rango.min && c.diferencia_total_abs <= rango.max
      );
      return {
        categoria: rango.label,
        cantidad_creditos: grupo.length,
        rango_diferencia: rango.label,
        porcentaje_del_total:
          total > 0 ? Math.round((grupo.length / total) * 1000) / 10 : 0,
        suma_diferencias: grupo.reduce((s, c) => s + c.diferencia_total_abs, 0),
      };
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Top discrepancias
  // ─────────────────────────────────────────────────────────────

  private static calcularTopDiscrepancias(
    creditos: ComparativoCredito[]
  ): ResultadoComparativo2['top_discrepancias'] {
    const sorted = [...creditos].sort(
      (a, b) => b.diferencia_total_abs - a.diferencia_total_abs
    );

    return {
      top10_mayor_diferencia: sorted.slice(0, 10),
      // Créditos donde MAIN no tiene cuotas en amortización pero Legacy sí tiene saldo
      creditos_sin_amortizacion_main: creditos.filter(
        c => c.total_cuota === 0 && c.saldo_legacy > 0
      ),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Totales globales
  // ─────────────────────────────────────────────────────────────

  private static calcularTotalesGlobales(
    resumen: ResultadoComparativo1['resumen']
  ): ResultadoComparativo2['totales_globales'] {
    const diferencia_neta = resumen.gran_total_main - resumen.total_saldo_legacy;
    const porcentaje_diferencia =
      resumen.total_saldo_legacy > 0
        ? Math.round(
            (Math.abs(diferencia_neta) / resumen.total_saldo_legacy) * 10000
          ) / 100
        : 0;

    return {
      gran_total_main: resumen.gran_total_main,
      total_saldo_legacy: resumen.total_saldo_legacy,
      diferencia_neta,
      porcentaje_diferencia,
    };
  }
}
