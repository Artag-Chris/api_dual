import { prismaMainService } from '../../database/main/prisma-main.service';

/**
 * Interface para los datos crudos de la query
 */
interface DatosRawCartera {
  ciudad: string;
  nombre_cartera: string;
  id_cartera: number;
  franja_dias: string;
  cantidad_creditos: bigint;
  total_cuota: bigint;
  total_sanciones: bigint;
  total_gastos_cartera: bigint;
}

/**
 * Interface para un grupo de cartera con porcentaje y desglose
 */
interface CarteraGrupo {
  cantidad: number;
  total: number;
  desglose: {
    total_cuota: number;
    total_sanciones: number;
    total_gastos_cartera: number;
  };
  porcentaje: number;
}

/**
 * Interface para los datos pivoteados por ciudad
 */
interface DatosCiudad {
  ciudad: string;
  carteras: {
    [nombreCartera: string]: CarteraGrupo;
  };
  totalCiudad: {
    cantidad: number;
    total: number;
    desglose: {
      total_cuota: number;
      total_sanciones: number;
      total_gastos_cartera: number;
    };
  };
}

/**
 * Interface para el reporte final
 */
interface ReporteFinal {
  titulo: string;
  fecha_generacion: Date;
  datos: DatosCiudad[];
  grandTotal: {
    cantidad: number;
    total: number;
    desglose: {
      total_cuota: number;
      total_sanciones: number;
      total_gastos_cartera: number;
    };
  };
  carterasUniques: string[];
  estadisticas: {
    totalCiudades: number;
    totalCarteras: number;
    totalCreditos: number;
    totalValor: number;
    creditosSinCartera: number;
    observacion: string;
  };
}

/**
 * Estados válidos para filtrar créditos
 */
const ESTADOS_VALIDOS = ['ACTIVO', 'JURIDICO', 'PREJURIDICO', 'REFINANCIADO'];

/**
 * Franja de días para clasificar como CASTIGADA
 */
const FRANJA_CASTIGADA = '150';

export class ReporteCarteraCiudadService {
  /**
   * Obtiene los datos crudos de la base de datos (SOLO CON CARTERA)
   * Agrupa por ciudad, cartera y franja_dias
   * Las carteras con franja_dias='150' se clasifican como CASTIGADA
   * Excluye créditos sin cartera asignada
   * INCLUYE: total_cuota, sanciones y gastos_cartera (prejuridico + juridico)
   */
  private static async obtenerDatosRaw(): Promise<DatosRawCartera[]> {
    try {
      const datos = await prismaMainService.$queryRawUnsafe<DatosRawCartera[]>(
        `
        SELECT 
          COALESCE(ic.ciudad, 'SIN DATO') as ciudad,
          CASE 
            WHEN c.franja_dias = '150' THEN 'CASTIGADA'
            ELSE COALESCE(c.nombre, 'SIN CARTERA')
          END as nombre_cartera,
          COALESCE(c.id, 0) as id_cartera,
          COALESCE(c.franja_dias, '') as franja_dias,
          COUNT(DISTINCT dc.prestamo_ID) as cantidad_creditos,
          COALESCE((
            SELECT SUM(CAST(am.total_cuota AS UNSIGNED))
            FROM amortizacion am
            WHERE am.prestamoID = dc.prestamo_ID
          ), 0) as total_cuota,
          COALESCE((
            SELECT SUM(CAST(COALESCE(am.sancion, 0) AS UNSIGNED))
            FROM amortizacion am
            WHERE am.prestamoID = dc.prestamo_ID
          ), 0) as total_sanciones,
          COALESCE((
            SELECT SUM(CAST(COALESCE(gc.prejuridico, 0) AS UNSIGNED)) +
                   SUM(CAST(COALESCE(gc.juridico, 0) AS UNSIGNED))
            FROM gastos_cartera gc
            WHERE gc.prestamo_id = dc.prestamo_ID
          ), 0) as total_gastos_cartera
        FROM detalle_credito dc
        LEFT JOIN info_contacto ic ON dc.documento = ic.documento
        LEFT JOIN cartera c ON dc.id_cartera = c.id
        WHERE dc.estado IN ('ACTIVO', 'JURIDICO', 'PREJURIDICO', 'REFINANCIADO')
        AND dc.id_cartera IS NOT NULL
        AND c.id IS NOT NULL
        GROUP BY ic.ciudad, c.id, c.nombre, c.franja_dias
        ORDER BY ic.ciudad ASC, nombre_cartera ASC
        `
      );

      return datos;
    } catch (error) {
      console.error('Error al obtener datos raw:', error);
      throw new Error('Error al consultar los datos de cartera y ciudad');
    }
  }

  /**
   * Obtiene el conteo de créditos SIN CARTERA asignada
   */
  private static async obtenerCreditosSinCartera(): Promise<number> {
    try {
      const resultado = await prismaMainService.$queryRawUnsafe<
        Array<{ cantidad: bigint }>
      >(
        `
        SELECT COUNT(DISTINCT dc.prestamo_ID) as cantidad
        FROM detalle_credito dc
        INNER JOIN amortizacion am ON dc.prestamo_ID = am.prestamoID
        WHERE dc.estado IN ('ACTIVO', 'JURIDICO', 'PREJURIDICO', 'REFINANCIADO')
        AND (dc.id_cartera IS NULL OR dc.id_cartera = 0)
        `
      );

      return resultado.length > 0 ? Number(resultado[0].cantidad) : 0;
    } catch (error) {
      console.error('Error al obtener créditos sin cartera:', error);
      return 0;
    }
  }

  /**
   * Pivotea los datos agrupados por ciudad y cartera
   * Calcula totales, desglose y porcentajes por ciudad
   */
  private static pivotarDatos(datos: DatosRawCartera[]): {
    datos: DatosCiudad[];
    carterasUniques: string[];
    grandTotal: { cantidad: number; total: number; desglose: { total_cuota: number; total_sanciones: number; total_gastos_cartera: number } };
  } {
    const mapaCiudades = new Map<string, DatosCiudad>();
    const carterasSet = new Set<string>();

    // Agrupar por ciudad y cartera
    datos.forEach((row) => {
      const ciudadKey = row.ciudad;
      const carteraKey = row.nombre_cartera;
      const totalCuota = Number(row.total_cuota);
      const totalSanciones = Number(row.total_sanciones);
      const totalGastosCartera = Number(row.total_gastos_cartera);
      const totalGrupo = totalCuota + totalSanciones + totalGastosCartera;

      carterasSet.add(carteraKey);

      if (!mapaCiudades.has(ciudadKey)) {
        mapaCiudades.set(ciudadKey, {
          ciudad: ciudadKey,
          carteras: {},
          totalCiudad: { 
            cantidad: 0, 
            total: 0,
            desglose: {
              total_cuota: 0,
              total_sanciones: 0,
              total_gastos_cartera: 0
            }
          },
        });
      }

      const datosCiudad = mapaCiudades.get(ciudadKey)!;

      // Almacenar datos con desglose
      datosCiudad.carteras[carteraKey] = {
        cantidad: Number(row.cantidad_creditos),
        total: totalGrupo,
        desglose: {
          total_cuota: totalCuota,
          total_sanciones: totalSanciones,
          total_gastos_cartera: totalGastosCartera
        },
        porcentaje: 0, // Se calcula después
      };

      // Sumar al total de la ciudad
      datosCiudad.totalCiudad.cantidad += Number(row.cantidad_creditos);
      datosCiudad.totalCiudad.total += totalGrupo;
      datosCiudad.totalCiudad.desglose.total_cuota += totalCuota;
      datosCiudad.totalCiudad.desglose.total_sanciones += totalSanciones;
      datosCiudad.totalCiudad.desglose.total_gastos_cartera += totalGastosCartera;
    });

    // Calcular porcentajes por ciudad
    const datosArray = Array.from(mapaCiudades.values());
    datosArray.forEach((datosCiudad) => {
      const totalCiudad = datosCiudad.totalCiudad.total;

      Object.keys(datosCiudad.carteras).forEach((cartera) => {
        const grupo = datosCiudad.carteras[cartera];
        grupo.porcentaje = totalCiudad > 0 ? (grupo.total / totalCiudad) * 100 : 0;
      });
    });

    // Calcular grand total
    let grandTotalCantidad = 0;
    let grandTotalSum = 0;
    let grandTotalCuota = 0;
    let grandTotalSanciones = 0;
    let grandTotalGastosCartera = 0;

    datosArray.forEach((datosCiudad) => {
      grandTotalCantidad += datosCiudad.totalCiudad.cantidad;
      grandTotalSum += datosCiudad.totalCiudad.total;
      grandTotalCuota += datosCiudad.totalCiudad.desglose.total_cuota;
      grandTotalSanciones += datosCiudad.totalCiudad.desglose.total_sanciones;
      grandTotalGastosCartera += datosCiudad.totalCiudad.desglose.total_gastos_cartera;
    });

    return {
      datos: datosArray,
      carterasUniques: Array.from(carterasSet).sort(),
      grandTotal: {
        cantidad: grandTotalCantidad,
        total: grandTotalSum,
        desglose: {
          total_cuota: grandTotalCuota,
          total_sanciones: grandTotalSanciones,
          total_gastos_cartera: grandTotalGastosCartera
        }
      },
    };
  }

  /**
   * Obtiene el reporte completo con todo detalle
   * @returns Reporte con ciudades, carteras, totales y porcentajes
   */
  static async obtenerReporte(): Promise<ReporteFinal> {
    const datosRaw = await this.obtenerDatosRaw();
    const creditosSinCartera = await this.obtenerCreditosSinCartera();
    const { datos, carterasUniques, grandTotal } = this.pivotarDatos(datosRaw);

    return {
      titulo: 'Reporte de Créditos por Cartera y Ciudad',
      fecha_generacion: new Date(),
      datos,
      grandTotal,
      carterasUniques,
      estadisticas: {
        totalCiudades: datos.length,
        totalCarteras: carterasUniques.length,
        totalCreditos: grandTotal.cantidad,
        totalValor: grandTotal.total,
        creditosSinCartera,
        observacion: `Se han excluido ${creditosSinCartera} crédito(s) sin cartera asignada del reporte. Solo se muestran créditos con cartera válida.`,
      },
    };
  }

  /**
   * Formatea los números como moneda en COP
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
   * Formatea un porcentaje a 2 decimales con símbolo %
   */
  static formatearPorcentaje(porcentaje: number): string {
    return `${porcentaje.toFixed(2)}%`;
  }
}
