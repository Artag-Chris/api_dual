/**
 * Servicio de Amortización Refinanciamiento
 */

import { AmortizacionRefinanciamiento, RefinanciamientoItem, RefinanciamientoParams, InfoCreditoData, PagoRegistro, SancionRegistro, ResultadoRefinanciamientoConPagos } from './amortizacion-refinanciamiento.class';
import WinstonAdapter from '../config/adapters/winstonAdapter';
import { prismaLegacyService } from '../database/legacy/prisma-legacy.service';

class RefinanciamientoService {
  private static instance: RefinanciamientoService;
  private logger = WinstonAdapter;

  private constructor() {}

  public static getInstance(): RefinanciamientoService {
    if (!RefinanciamientoService.instance) {
      RefinanciamientoService.instance = new RefinanciamientoService();
    }
    return RefinanciamientoService.instance;
  }

  /**
   * Normaliza infoCredito convirtiendo todos los BigInt a Number
   * Necesario para serialización JSON
   */
  private normalizarInfoCredito(infoCredito: InfoCreditoData): InfoCreditoData {
    // Normaliza periodicidad a uno de los valores esperados
    const periodoPeriodo = String(infoCredito.periodicidad).trim().toLowerCase();
    const periodicidadNormalizada: 'Mensual' | 'Quincenal' | 'mensual' | 'quincenal' = 
      (periodoPeriodo === 'mensual') ? 'mensual' :
      (periodoPeriodo === 'quincenal') ? 'quincenal' :
      (infoCredito.periodicidad as 'Mensual' | 'Quincenal' | 'mensual' | 'quincenal');

    return {
      ...infoCredito,
      cantidad_meses: Number(infoCredito.cantidad_meses),
      credito_id: Number(infoCredito.credito_id),
      valor_prestamo: Number(infoCredito.valor_prestamo),
      valor_cuota: Number(infoCredito.valor_cuota),
      cuotas_faltantes: Number(infoCredito.cuotas_faltantes),
      documento: String(infoCredito.documento),
      periodicidad: periodicidadNormalizada,
      fecha_pago1: infoCredito.fecha_pago1 ? Number(infoCredito.fecha_pago1) : undefined,
      fecha_pago2: infoCredito.fecha_pago2 ? Number(infoCredito.fecha_pago2) : undefined,
      cta_aval: infoCredito.cta_aval ? Number(infoCredito.cta_aval) : undefined,
      cta_iva_aval: infoCredito.cta_iva_aval ? Number(infoCredito.cta_iva_aval) : undefined,
    };
  }

  /**
   * Genera una amortización vacía (cuotas en 0) para créditos cancelados
   * @param infoCredito Información del crédito cancelado
   * @returns Array de items de amortización con todos los valores en 0
   */
  private generarAmortizacionCancelada(infoCredito: InfoCreditoData): RefinanciamientoItem[] {
    const numeroCuotas = Number(infoCredito.cantidad_meses);
    const prestamoId = Number(infoCredito.credito_id);
    const amortizacion: RefinanciamientoItem[] = [];

    for (let i = 0; i < numeroCuotas; i++) {
      amortizacion.push({
        prestamoId,
        documento: String(infoCredito.documento),
        numeroCuota: i + 1,
        capitalEnMora: 0,
        capital: 0,
        interes: 0,
        aval: 0,
        iva: 0,
        cuotaTotal: 0,
        saldo: 0,
        fechaPago: new Date().toISOString().split('T')[0],
      });
    }

    return amortizacion;
  }

  /**
   * Obtiene la información del crédito desde la BD
   * Ejecuta la consulta para obtener datos del cliente y crédito
   */
  async obtenerInfoCredito(creditoId: number): Promise<InfoCreditoData | null> {
    try {
      this.logger.info(`[REFINANCIAMIENTO-SVC] Obteniendo información del crédito ${creditoId}`);

      const resultado = (await prismaLegacyService.$queryRaw`
        SELECT 
          clientes.num_doc AS documento,
          precreditos.vlr_fin AS valor_prestamo,
          precreditos.vlr_cuota AS valor_cuota,
          precreditos.periodo AS periodicidad,
          precreditos.meses AS cantidad_meses,
          precreditos.created_at AS fecha_creacion,
          precreditos.p_fecha AS fecha_pago1,
          precreditos.s_fecha AS fecha_pago2,
          creditos.estado,
          fc.fecha_pago AS proxima_fecha_pago,
			    amortizaciones.cta_aval,
		      amortizaciones.cta_iva_aval,
    	    creditos.cuotas_faltantes,
          creditos.id AS credito_id
        FROM clientes
        LEFT JOIN codeudores 
          ON clientes.codeudor_id = codeudores.id
        INNER JOIN precreditos
          ON clientes.id = precreditos.cliente_id 
        LEFT JOIN estudios
          ON clientes.id = estudios.cliente_id 
        INNER JOIN creditos
          ON precreditos.id = creditos.precredito_id 
        LEFT JOIN amortizaciones
          ON precreditos.id = amortizaciones.precredito_id
        INNER JOIN users AS creator
          ON precreditos.user_create_id = creator.id
        INNER JOIN users AS updator
          ON creditos.user_update_id = updator.id
        LEFT JOIN fecha_cobros fc 
          ON creditos.id = fc.credito_id
        INNER JOIN carteras 
          ON precreditos.cartera_id = carteras.id
        LEFT JOIN est_datacreditos
          ON estudios.estDatacredito_id = est_datacreditos.id
        WHERE creditos.id = ${creditoId}
        ORDER BY precreditos.id DESC
        LIMIT 1
      `) as any[];

      if (!resultado || resultado.length === 0) {
        this.logger.warn(`[REFINANCIAMIENTO-SVC] No se encontró información para crédito ${creditoId}`);
        return null;
      }

      return resultado[0] as InfoCreditoData;
    } catch (error) {
      this.logger.error(
        `[REFINANCIAMIENTO-SVC] Error al obtener info crédito: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
      throw error;
    }
  }

  /**
   * Obtiene los pagos registrados para un crédito
   */
  async obtenerPagos(creditoId: number): Promise<PagoRegistro[]> {
    try {
      this.logger.info(`[REFINANCIAMIENTO-SVC] Obteniendo pagos del crédito ${creditoId}`);

      const pagos = (await prismaLegacyService.$queryRaw`
        SELECT 
          p.id,
          p.credito_id,
          p.concepto,
          p.abono,
          p.debe,
          p.estado,
          p.num_cuota,
          p.created_at,
          p.descripcion
        FROM pagos p
        INNER JOIN creditos c ON p.credito_id = c.id
        WHERE p.credito_id = ${creditoId}
        ORDER BY p.created_at ASC
      `) as PagoRegistro[];

      this.logger.info(`[REFINANCIAMIENTO-SVC] OK Se encontraron ${pagos.length} pagos`);
      return pagos;
    } catch (error) {
      this.logger.error(
        `[REFINANCIAMIENTO-SVC] Error al obtener pagos: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
      throw error;
    }
  }

  /**
   * Obtiene las sanciones pendientes (estado = 'Debe') para un crédito
   * 
   * @param creditoId ID del crédito
   * @returns Array de sanciones pendientes ordenado por fecha de creación
   */
  async obtenerSancionesPendientes(creditoId: number): Promise<SancionRegistro[]> {
    try {
      this.logger.info(`[REFINANCIAMIENTO-SVC] Obteniendo sanciones pendientes del crédito ${creditoId}`);

      const sanciones = (await prismaLegacyService.$queryRaw`
        SELECT 
          s.id,
          s.credito_id,
          s.valor,
          s.estado,
          s.pago_id,
          s.created_at
        FROM sanciones s
        WHERE s.credito_id = ${creditoId}
        AND s.estado = 'Debe'
        ORDER BY s.created_at ASC
      `) as SancionRegistro[];

      this.logger.info(`[REFINANCIAMIENTO-SVC] OK Se encontraron ${sanciones.length} sanciones pendientes`);
      return sanciones;
    } catch (error) {
      this.logger.error(
        `[REFINANCIAMIENTO-SVC] Error al obtener sanciones pendientes: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
      throw error;
    }
  }

  /**
   * Obtiene las sanciones exoneradas (estado = 'Exonerada') para un crédito
   * 
   * @param creditoId ID del crédito
   * @returns Array de sanciones exoneradas ordenado por fecha de creación
   */
  async obtenerSancionesExoneradas(creditoId: number): Promise<SancionRegistro[]> {
    try {
      this.logger.info(`[REFINANCIAMIENTO-SVC] Obteniendo sanciones exoneradas del crédito ${creditoId}`);

      const sanciones = (await prismaLegacyService.$queryRaw`
        SELECT 
          s.id,
          s.credito_id,
          s.valor,
          s.estado,
          s.pago_id,
          s.created_at
        FROM sanciones s
        WHERE s.credito_id = ${creditoId}
        AND s.estado = 'Exonerada'
        ORDER BY s.created_at ASC
      `) as SancionRegistro[];

      this.logger.info(`[REFINANCIAMIENTO-SVC] OK Se encontraron ${sanciones.length} sanciones exoneradas`);
      return sanciones;
    } catch (error) {
      this.logger.error(
        `[REFINANCIAMIENTO-SVC] Error al obtener sanciones exoneradas: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
      throw error;
    }
  }

  /**

  /**
   * Calcula refinanciamiento con información de pagos desde BD
   * 
   * FLUJO COMPLETO:
   * 1. Obtiene información del crédito (documento, valor préstamo, periodicidad, etc)
   *    usando creditoId de la consulta principal
   * 
   * 2. Calcula la amortización inicial con el método de refinanciamiento
   *    (capital distribuido equitativamente + aval fijo)
   * 
   * 3. Obtiene los pagos registrados para ese crédito
   * 
   * 4. Valida y procesa los pagos:
   *    - Encuentra el número máximo de cuota con estado 'Ok' (completamente pagadas)
   *    - Elimina esas cuotas de la amortización
   *    - Si existe una cuota en estado 'Debe' (parcialmente pagada):
   *      * Calcula lo que falta por pagar
   *      * Ajusta proporcionalmente capital, interés, aval e IVA
   * 
   * 5. Retorna amortización actualizada sin cuotas pagadas
   */
  async calcularRefinanciamientoConPagos(
    creditoId: number
  ): Promise<ResultadoRefinanciamientoConPagos> {
    try {
      this.logger.info(`[REFINANCIAMIENTO-SVC] Iniciando cálculo de refinanciamiento para crédito ${creditoId}`);

      // ═══════════════════════════════════════════════════════════════════════════
      // PASO 1: OBTENER INFORMACIÓN DEL CRÉDITO
      // ═══════════════════════════════════════════════════════════════════════════
      this.logger.info(`[REFINANCIAMIENTO-SVC] PASO 1: Obteniendo información del crédito ${creditoId}`);
      
      const infoCredito = await this.obtenerInfoCredito(creditoId);
      if (!infoCredito) {
        this.logger.error(`[REFINANCIAMIENTO-SVC] Crédito ${creditoId} no encontrado`);
        return {
          exitoso: false,
          mensaje: `No se encontró información para el crédito ${creditoId}`,
          errores: ['Crédito no encontrado'],
        };
      }

      this.logger.info(
        `[REFINANCIAMIENTO-SVC] ✅ Información obtenida: ${infoCredito.documento}, ${infoCredito.valor_prestamo}, ${infoCredito.periodicidad}`
      );

      // ═══════════════════════════════════════════════════════════════════════════
      // VALIDACIÓN: VERIFICAR SI EL CRÉDITO ESTÁ CANCELADO
      // ═══════════════════════════════════════════════════════════════════════════
      const estadoNormalizado = String(infoCredito.estado).toUpperCase().trim();
      if (estadoNormalizado === 'CANCELADO') {
        this.logger.warn(`[REFINANCIAMIENTO-SVC] ⚠️ Crédito ${creditoId} está CANCELADO`);
        
        const infoCreditoNormalizado = this.normalizarInfoCredito(infoCredito);
        const amortizacionCancelada = this.generarAmortizacionCancelada(infoCreditoNormalizado);
        
        return {
          exitoso: true,
          mensaje: `Crédito ${creditoId} está completamente cancelado. Todas las cuotas han sido pagadas.`,
          errores: [],
          infoCredito: infoCreditoNormalizado,
          infoPagos: {
            cuotaMaximaPagada: infoCreditoNormalizado.cantidad_meses,
            tieneCuotaParciall: false,
            montoPagadoCuotaParcial: 0,
            montoDebe: 0,
            sanciones_condonadas: 0,
            dias_sanciones_condonadas: 0,
            desglosePagos: {},
          },
          amortizacionOriginal: amortizacionCancelada,
          amortizacionActualizada: amortizacionCancelada,
          estadisticas: {
            totalCuotas: infoCreditoNormalizado.cantidad_meses,
            cuotaTotal: 0,
            totalCapital: 0,
            totalInteres: 0,
            totalAval: 0,
            totalIVA: 0,
          },
        };
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // PASO 2: OBTENER PAGOS DEL CRÉDITO
      // ═══════════════════════════════════════════════════════════════════════════
      this.logger.info(`[REFINANCIAMIENTO-SVC] PASO 2: Obteniendo pagos del crédito ${creditoId}`);
      
      const pagos = await this.obtenerPagos(creditoId);

      if (pagos.length === 0) {
        this.logger.warn(`[REFINANCIAMIENTO-SVC] No hay pagos registrados para crédito ${creditoId}`);
      } else {
        this.logger.info(`[REFINANCIAMIENTO-SVC] ✅ Se encontraron ${pagos.length} pagos`);
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // PASO 3: OBTENER SANCIONES PENDIENTES DEL CRÉDITO
      // ═══════════════════════════════════════════════════════════════════════════
      this.logger.info(`[REFINANCIAMIENTO-SVC] PASO 3: Obteniendo sanciones pendientes del crédito ${creditoId}`);
      
      const sanciones = await this.obtenerSancionesPendientes(creditoId);

      if (sanciones.length === 0) {
        this.logger.warn(`[REFINANCIAMIENTO-SVC] No hay sanciones pendientes para crédito ${creditoId}`);
      } else {
        this.logger.info(`[REFINANCIAMIENTO-SVC] ✅ Se encontraron ${sanciones.length} sanciones pendientes`);
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // PASO 4: OBTENER SANCIONES EXONERADAS DEL CRÉDITO
      // ═══════════════════════════════════════════════════════════════════════════
      this.logger.info(`[REFINANCIAMIENTO-SVC] PASO 4: Obteniendo sanciones exoneradas del crédito ${creditoId}`);
      
      const sancionesExoneradas = await this.obtenerSancionesExoneradas(creditoId);

      if (sancionesExoneradas.length === 0) {
        this.logger.warn(`[REFINANCIAMIENTO-SVC] No hay sanciones exoneradas para crédito ${creditoId}`);
      } else {
        this.logger.info(`[REFINANCIAMIENTO-SVC] ✅ Se encontraron ${sancionesExoneradas.length} sanciones exoneradas`);
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // PASO 5: CALCULAR REFINANCIAMIENTO Y PROCESAR PAGOS Y SANCIONES
      // ═══════════════════════════════════════════════════════════════════════════
      this.logger.info(`[REFINANCIAMIENTO-SVC] PASO 5: Calculando refinanciamiento, procesando pagos y sanciones`);
      
      const resultado = AmortizacionRefinanciamiento.calcularRefinanciamientoConPagos(infoCredito, pagos, sanciones, sancionesExoneradas);

      if (resultado.exitoso) {
        this.logger.info(
          `[REFINANCIAMIENTO-SVC] ✅ ${resultado.mensaje} - Cuotas pendientes: ${resultado.amortizacionActualizada?.length || 0}`
        );
        
        // Log adicional para debug
        if (resultado.infoPagos) {
          this.logger.info(
            `[REFINANCIAMIENTO-SVC] Cuota máxima pagada: ${resultado.infoPagos.cuotaMaximaPagada}, ` +
            `Cuota parcial: ${resultado.infoPagos.tieneCuotaParciall ? 'Sí' : 'No'}, ` +
            `Monto aún debe: ${resultado.infoPagos.montoDebe}`
          );
        }
      } else {
        this.logger.error(
          `[REFINANCIAMIENTO-SVC] ❌ Error: ${resultado.mensaje} - Errores: ${resultado.errores.join(', ')}`
        );
      }

      return resultado;
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`[REFINANCIAMIENTO-SVC] Error fatal: ${mensaje}`);

      return {
        exitoso: false,
        mensaje: 'Error al procesar refinanciamiento',
        errores: [mensaje],
      };
    }
  }

  async calcularRefinanciamiento(params: RefinanciamientoParams): Promise<RefinanciamientoItem[]> {
    try {
      this.logger.info(
        `[REFINANCIAMIENTO] Calculando refinanciamiento para ${params.documento} - Capital: $${params.capitalEnMora}, Cuotas: ${params.cantidadMeses}, Valor cuota: $${params.valorCuotaAcordada}`
      );

      const resultado = AmortizacionRefinanciamiento.calcularRefinanciamiento(params);

      this.logger.info(
        `[REFINANCIAMIENTO] ✅ Refinanciamiento calculado. Total cuotas: ${resultado.length}`
      );

      return resultado;
    } catch (error) {
      this.logger.error(
        `[REFINANCIAMIENTO] ❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
      throw error;
    }
  }

  getEstadisticas(amortizaciones: RefinanciamientoItem[]) {
    if (amortizaciones.length === 0) {
      return {
        totalCuotas: 0,
        cuotaTotal: 0,
        totalCapital: 0,
        totalInteres: 0,
        totalAval: 0,
        totalIVA: 0,
        capitalEnMora: 0,
      };
    }

    const totalCuotas = amortizaciones.length;
    const totalCapital = amortizaciones.reduce((sum, item) => sum + item.capital, 0);
    const totalInteres = amortizaciones.reduce((sum, item) => sum + item.interes, 0);
    const totalAval = amortizaciones.reduce((sum, item) => sum + item.aval, 0);
    const totalIVA = amortizaciones.reduce((sum, item) => sum + item.iva, 0);
    const cuotaTotal = amortizaciones[0].cuotaTotal;
    const capitalEnMora = amortizaciones[0].capitalEnMora;

    return {
      totalCuotas,
      cuotaTotal,
      totalCapital,
      totalInteres,
      totalAval,
      totalIVA,
      capitalEnMora,
    };
  }

  validarParametros(params: Partial<RefinanciamientoParams>): string[] {
    const errores: string[] = [];

    if (!params.documento) {
      errores.push('El documento es requerido');
    }

    if (!params.prestamoId) {
      errores.push('El ID del préstamo es requerido');
    }

    if ((params.capitalEnMora ?? 0) <= 0) {
      errores.push('El capital en mora debe ser mayor a cero');
    }

    if ((params.cantidadMeses ?? 0) <= 0) {
      errores.push('La cantidad de meses debe ser mayor a cero');
    }

    if ((params.valorCuotaAcordada ?? 0) <= 0) {
      errores.push('El valor de la cuota debe ser mayor a cero');
    }

    if (params.periocidad && !['mensual', 'quincenal'].includes(params.periocidad)) {
      errores.push('La periocidad debe ser "mensual" o "quincenal"');
    }

    return errores;
  }
}

export default RefinanciamientoService;
