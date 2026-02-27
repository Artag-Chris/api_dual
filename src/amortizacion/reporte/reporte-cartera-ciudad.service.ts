import { prismaMainService } from '../../database/main/prisma-main.service';

/**
 * Interface para los datos crudos de la query
 */
interface DatosRawCartera {
  ciudad: string;
  nombre_cartera: string;
  id_cartera: number;
  cantidad_creditos: bigint;
  total_cuota: bigint;
}

/**
 * Interface para un grupo de cartera en una ciudad
 */
interface CarteraGrupo {
  cantidad: number;
  total: number;
}

/**
 * Interface para el reporte pivoteado
 */
interface ReportePivot {
  ciudad: string;
  carteras: {
    [nombreCartera: string]: CarteraGrupo;
  };
  totalCiudad: {
    cantidad: number;
    total: number;
  };
}

/**
 * Interface para el reporte final completo
 */
interface ReporteFinal {
  datos: ReportePivot[];
  grandTotal: {
    cantidad: number;
    total: number;
  };
  carterasUniques: string[];
  timestamp: Date;
}

/**
 * Estados válidos para filtrar créditos
 */
const ESTADOS_VALIDOS = ['ACTIVO', 'JURIDICO', 'PREJURIDICO', 'REFINANCIADO'];

export class ReporteCarteraCiudadService {
  /**
   * Obtiene los datos crudos de la base de datos
   * Agrupa por ciudad y cartera
   */
  private static async obtenerDatosRaw(): Promise<DatosRawCartera[]> {
    try {
      const datos = await prismaMainService.$queryRawUnsafe<DatosRawCartera[]>(
        `
        SELECT 
          COALESCE(ic.ciudad, 'SIN DATO') as ciudad,
          COALESCE(c.nombre, 'SIN CARTERA') as nombre_cartera,
          COALESCE(dc.id_cartera, 0) as id_cartera,
          COUNT(DISTINCT dc.prestamo_ID) as cantidad_creditos,
          COALESCE(SUM(CAST(am.total_cuota AS UNSIGNED)), 0) as total_cuota
        FROM detalle_credito dc
        INNER JOIN amortizacion am ON dc.prestamo_ID = am.prestamoID
        LEFT JOIN info_contacto ic ON dc.documento = ic.documento
        LEFT JOIN cartera c ON dc.id_cartera = c.id
        WHERE dc.estado IN ('ACTIVO', 'JURIDICO', 'PREJURIDICO', 'REFINANCIADO')
        GROUP BY ic.ciudad, dc.id_cartera, c.nombre
        ORDER BY ic.ciudad ASC, c.nombre ASC
        `
      );

      return datos;
    } catch (error) {
      console.error('Error al obtener datos raw:', error);
      throw new Error('Error al consultar los datos de cartera y ciudad');
    }
  }

  /**
   * Pivotea los datos para obtener un formato de tabla dinámica
   * Agrupa por ciudad y crea columnas por cartera
   */
  private static pivotarDatos(datos: DatosRawCartera[]): ReporteFinal {
    const mapaCaras = new Map<string, ReportePivot>();
    const carterasSet = new Set<string>();

    // Agrupar por ciudad
    datos.forEach((row) => {
      const ciudadKey = row.ciudad;
      carterasSet.add(row.nombre_cartera);

      if (!mapaCaras.has(ciudadKey)) {
        mapaCaras.set(ciudadKey, {
          ciudad: ciudadKey,
          carteras: {},
          totalCiudad: { cantidad: 0, total: 0 },
        });
      }

      const reporteCiudad = mapaCaras.get(ciudadKey)!;

      // Asignar datos de la cartera
      reporteCiudad.carteras[row.nombre_cartera] = {
        cantidad: Number(row.cantidad_creditos),
        total: Number(row.total_cuota),
      };

      // Sumar al total de la ciudad
      reporteCiudad.totalCiudad.cantidad += Number(row.cantidad_creditos);
      reporteCiudad.totalCiudad.total += Number(row.total_cuota);
    });

    // Calcular gran total
    let grandTotalCantidad = 0;
    let grandTotalSum = 0;

    const reporteArray = Array.from(mapaCaras.values());
    reporteArray.forEach((reporte) => {
      grandTotalCantidad += reporte.totalCiudad.cantidad;
      grandTotalSum += reporte.totalCiudad.total;
    });

    return {
      datos: reporteArray,
      grandTotal: {
        cantidad: grandTotalCantidad,
        total: grandTotalSum,
      },
      carterasUniques: Array.from(carterasSet).sort(),
      timestamp: new Date(),
    };
  }

  /**
   * Obtiene el reporte completo en formato pivot
   * @returns Reporte pivoteado con datos por ciudad y cartera
   */
  static async obtenerReporteCompleto(): Promise<ReporteFinal> {
    const datosRaw = await this.obtenerDatosRaw();
    return this.pivotarDatos(datosRaw);
  }

  /**
   * Obtiene el reporte en formato "tabla" listo para renderizar
   * Útil para Excel o visualización en tabla HTML
   */
  static async obtenerReporteTabla(): Promise<any[]> {
    const reporte = await this.obtenerReporteCompleto();
    const resultado = [];

    // Agregar filas de datos
    reporte.datos.forEach((fila) => {
      const filaDatos: any = {
        ciudad: fila.ciudad,
      };

      // Agregar cada cartera como columna
      reporte.carterasUniques.forEach((cartera) => {
        const grupo = fila.carteras[cartera];
        if (grupo) {
          filaDatos[`${cartera}_cantidad`] = grupo.cantidad;
          filaDatos[`${cartera}_total`] = grupo.total;
        } else {
          filaDatos[`${cartera}_cantidad`] = 0;
          filaDatos[`${cartera}_total`] = 0;
        }
      });

      // Total de la ciudad
      filaDatos['TOTAL_CIUDAD_cantidad'] = fila.totalCiudad.cantidad;
      filaDatos['TOTAL_CIUDAD_total'] = fila.totalCiudad.total;

      resultado.push(filaDatos);
    });

    // Agregar fila de gran total
    const filaGrandTotal: any = {
      ciudad: 'GRAN TOTAL',
    };

    reporte.carterasUniques.forEach((cartera) => {
      let cantidadTotal = 0;
      let totalSum = 0;

      reporte.datos.forEach((fila) => {
        const grupo = fila.carteras[cartera];
        if (grupo) {
          cantidadTotal += grupo.cantidad;
          totalSum += grupo.total;
        }
      });

      filaGrandTotal[`${cartera}_cantidad`] = cantidadTotal;
      filaGrandTotal[`${cartera}_total`] = totalSum;
    });

    filaGrandTotal['TOTAL_CIUDAD_cantidad'] = reporte.grandTotal.cantidad;
    filaGrandTotal['TOTAL_CIUDAD_total'] = reporte.grandTotal.total;

    resultado.push(filaGrandTotal);

    return resultado;
  }

  /**
   * Formatea los números como moneda
   * @param valor Valor a formatear
   * @returns String formateado con separadores de miles
   */
  static formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(valor);
  }

  /**
   * Obtiene el reporte con formato visual para presentación
   */
  static async obtenerReporteVisual(): Promise<any> {
    const reporte = await this.obtenerReporteCompleto();

    return {
      titulo: 'Reporte de Créditos por Cartera y Ciudad',
      fecha_generacion: reporte.timestamp,
      estadisticas_generales: {
        total_ciudades: reporte.datos.length,
        total_carteras: reporte.carterasUniques.length,
        total_creditos: reporte.grandTotal.cantidad,
        total_valor: this.formatearMoneda(reporte.grandTotal.total),
        total_valor_numero: reporte.grandTotal.total,
      },
      carteras: reporte.carterasUniques,
      datos: reporte.datos.map((fila) => ({
        ciudad: fila.ciudad,
        carteras_desglose: reporte.carterasUniques.map((cartera) => {
          const grupo = fila.carteras[cartera];
          return {
            nombre: cartera,
            cantidad: grupo?.cantidad || 0,
            total: grupo?.total || 0,
            total_formateado: this.formatearMoneda(grupo?.total || 0),
          };
        }),
        total_ciudad: {
          cantidad: fila.totalCiudad.cantidad,
          total: fila.totalCiudad.total,
          total_formateado: this.formatearMoneda(fila.totalCiudad.total),
        },
      })),
      gran_total: {
        total_creditos: reporte.grandTotal.cantidad,
        total_valor: reporte.grandTotal.total,
        total_valor_formateado: this.formatearMoneda(reporte.grandTotal.total),
      },
    };
  }
}
