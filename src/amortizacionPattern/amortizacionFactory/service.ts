/**
 * FASE 1 - Service: Obtiene datos de LEGACY y delega al Factory
 * 
 * Responsabilidad:
 * - Consultar infoCredito desde LEGACY (query JOIN existente)
 * - Normalizar BigInt → Number
 * - Invocar AmortizacionFactory.crear()
 * - SOLO LECTURA: No hace INSERT/UPDATE
 */

import { AmortizacionFactory } from './class';
import { InfoCreditoData, ResultadoFactory } from '../interfaces';
import WinstonAdapter from '../../config/adapters/winstonAdapter';
import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';

class AmortizacionFactoryService {
  private static instance: AmortizacionFactoryService;
  private logger = WinstonAdapter;

  private constructor() {}

  public static getInstance(): AmortizacionFactoryService {
    if (!AmortizacionFactoryService.instance) {
      AmortizacionFactoryService.instance = new AmortizacionFactoryService();
    }
    return AmortizacionFactoryService.instance;
  }

  // ─── Obtener info del crédito desde LEGACY ───────────────────
  /**
   * Ejecuta la consulta principal para obtener datos del crédito.
   * Fuente: legacy DB (clientes, precreditos, creditos, amortizaciones, fecha_cobros)
   * Mantiene la consulta SQL original del service existente.
   */
  async obtenerInfoCredito(creditoId: number): Promise<InfoCreditoData | null> {
    try {
      this.logger.info(`[FACTORY-SVC] Obteniendo información del crédito ${creditoId}`);

      const resultado = (await prismaLegacyService.$queryRaw`
        SELECT 
          clientes.num_doc AS documento,
          precreditos.vlr_fin AS valor_prestamo,
          precreditos.vlr_cuota AS valor_cuota,
          precreditos.periodo AS periodicidad,
          precreditos.meses AS cantidad_meses,
          precreditos.cuotas AS numero_cuotas,
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
        this.logger.warn(`[FACTORY-SVC] No se encontró información para crédito ${creditoId}`);
        return null;
      }

      // Normalizar BigInt → Number (necesario para serialización)
      const raw = resultado[0];
      const normalizado: InfoCreditoData = {
        documento: String(raw.documento),
        valor_prestamo: Number(raw.valor_prestamo),
        valor_cuota: Number(raw.valor_cuota),
        periodicidad: raw.periodicidad,
        cantidad_meses: Number(raw.cantidad_meses),
        numero_cuotas: raw.numero_cuotas ? Number(raw.numero_cuotas) : undefined,
        fecha_creacion: raw.fecha_creacion,
        cuotas_faltantes: Number(raw.cuotas_faltantes),
        credito_id: Number(raw.credito_id),
        fecha_pago1: raw.fecha_pago1 ? Number(raw.fecha_pago1) : undefined,
        fecha_pago2: raw.fecha_pago2 ? Number(raw.fecha_pago2) : undefined,
        cta_aval: raw.cta_aval ? Number(raw.cta_aval) : undefined,
        cta_iva_aval: raw.cta_iva_aval ? Number(raw.cta_iva_aval) : undefined,
        proxima_fecha_pago: raw.proxima_fecha_pago || undefined,
        estado: raw.estado || undefined,
      };

      this.logger.info(
        `[FACTORY-SVC] OK Info obtenida: doc=${normalizado.documento}, prestamo=${normalizado.valor_prestamo}, periodo=${normalizado.periodicidad}`
      );

      return normalizado;
    } catch (error) {
      this.logger.error(
        `[FACTORY-SVC] Error al obtener info crédito: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
      throw error;
    }
  }

  // ─── MÉTODO PRINCIPAL: Ejecutar Fase 1 ─────────────────────────
  /**
   * Ejecuta la Fase 1 completa:
   * 1. Obtiene info del crédito desde LEGACY
   * 2. Delega al Factory para identificar tipo y crear amortización base
   * 3. Retorna ResultadoFactory (SOLO datos, SIN persistencia)
   * 
   * @param creditoId ID del crédito en legacy
   * @returns ResultadoFactory con amortización base
   */
  async ejecutarFase1(creditoId: number): Promise<ResultadoFactory> {
    try {
      this.logger.info(`[FACTORY-SVC] ═══ FASE 1: Creando amortización base para crédito ${creditoId} ═══`);

      // 1. Obtener info del crédito
      const infoCredito = await this.obtenerInfoCredito(creditoId);
      if (!infoCredito) {
        return {
          exitoso: false,
          tipo: undefined as any,
          mensaje: `No se encontró información para el crédito ${creditoId}`,
          errores: ['Crédito no encontrado en legacy'],
        };
      }

      // 2. Delegar al Factory (lógica pura)
      const resultado = AmortizacionFactory.crear(infoCredito);

      if (resultado.exitoso) {
        this.logger.info(
          `[FACTORY-SVC] ✅ Fase 1 completada: tipo=${resultado.tipo}, cuotas=${resultado.amortizacionBase?.length}`
        );
      } else {
        this.logger.error(
          `[FACTORY-SVC] ❌ Fase 1 fallida: ${resultado.mensaje} - Errores: ${resultado.errores.join(', ')}`
        );
      }

      return resultado;
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`[FACTORY-SVC] Error fatal en Fase 1: ${mensaje}`);
      return {
        exitoso: false,
        tipo: undefined as any,
        mensaje: 'Error al ejecutar Fase 1',
        errores: [mensaje],
      };
    }
  }

  /**
   * Ejecutar Fase 1 con InfoCreditoData ya obtenida (sin consulta a BD)
   * Útil cuando ya se obtuvo la info en un paso anterior del pipeline
   */
  ejecutarFase1ConDatos(infoCredito: InfoCreditoData): ResultadoFactory {
    this.logger.info(`[FACTORY-SVC] ═══ FASE 1 (con datos): Creando amortización base ═══`);
    return AmortizacionFactory.crear(infoCredito);
  }
}

export default AmortizacionFactoryService;
