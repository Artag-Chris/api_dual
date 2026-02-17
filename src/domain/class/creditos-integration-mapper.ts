/**
 * PHASE 9: Creditos Integration Mapper
 * Extracts REAL debt data from legacy creditos table
 * Maps active credit status to detalle_credito
 */

import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

/**
 * Interface for active credit data extracted from legacy
 */
export interface DatosCreditoActivo {
  credito_id: number;
  precredito_id: number;
  cuotas_faltantes: number;
  saldo: number;
  valor_credito: number;
  estado: string;
  fecha_creacion: Date | null;
}

export class CreditosIntegrationMapper {
  constructor(
    private readonly prismaLegacy: typeof prismaLegacyService,
    private readonly logger: typeof WinstonAdapter
  ) {}

  /**
   * Gets active credit data for a given precredito_id
   * Returns real debt information from creditos table
   */
  async obtenerDatosCreditoActivo(precreditoId: number): Promise<DatosCreditoActivo | null> {
    try {
      // Find active credit for this precredito
      const credito = await this.prismaLegacy.creditos.findFirst({
        where: {
          precredito_id: precreditoId,
          // Only get active credits (not canceled, not paid off)
          estado: {
            in: ['Al_dia', 'Mora', 'Prejuridico', 'Juridico'],
          },
        },
        select: {
          id: true,
          precredito_id: true,
          cuotas_faltantes: true,
          saldo: true,
          valor_credito: true,
          estado: true,
          created_at: true,
        },
        orderBy: {
          id: 'desc', // Get most recent credit
        },
      });

      if (!credito) {
        return null;
      }

      return {
        credito_id: credito.id,
        precredito_id: credito.precredito_id,
        cuotas_faltantes: credito.cuotas_faltantes,
        saldo: credito.saldo || 0,
        valor_credito: credito.valor_credito,
        estado: this.mapearEstadoCredito(credito.estado),
        fecha_creacion: credito.created_at,
      };
    } catch (error) {
      this.logger.error(`Error getting active credit for precredito ${precreditoId}:`, error);
      return null;
    }
  }

  /**
   * Maps legacy credit status to main credit status
   */
  private mapearEstadoCredito(estadoLegacy: string): string {
    const estadoMap: Record<string, string> = {
      Al_dia: 'ACTIVO',
      Mora: 'ACTIVO', // Still active, just in arrears
      Prejuridico: 'ACTIVO',
      Juridico: 'ACTIVO',
      Cancelado: 'PAGADO',
      Cancelado_por_refinanciacion: 'REFINANCIADO',
    };

    return estadoMap[estadoLegacy] || 'ACTIVO';
  }

  /**
   * Determines if credit should generate amortization
   * Only generate for credits with pending cuotas
   */
  shouldGenerateAmortization(datosCreditoActivo: DatosCreditoActivo | null): boolean {
    if (!datosCreditoActivo) return true; // New credit, generate all cuotas

    // Generate only if there are pending cuotas
    return datosCreditoActivo.cuotas_faltantes > 0;
  }

  /**
   * Calculates which cuota number to start generating from
   */
  calcularCuotaInicial(
    numeroCuotasTotal: number,
    datosCreditoActivo: DatosCreditoActivo | null
  ): number {
    if (!datosCreditoActivo) return 1; // Start from first cuota

    // Start from next cuota after the ones already paid
    const cuotasPagadas = numeroCuotasTotal - datosCreditoActivo.cuotas_faltantes;
    return cuotasPagadas + 1;
  }

  /**
   * Gets number of cuotas to generate
   */
  getCuotasAGenerar(
    numeroCuotasTotal: number,
    datosCreditoActivo: DatosCreditoActivo | null
  ): number {
    if (!datosCreditoActivo) return numeroCuotasTotal;
    return datosCreditoActivo.cuotas_faltantes;
  }

  /**
   * Gets the starting balance for amortization
   */
  getSaldoInicial(valorPrestamo: number, datosCreditoActivo: DatosCreditoActivo | null): number {
    if (!datosCreditoActivo) return valorPrestamo;
    return datosCreditoActivo.saldo;
  }

  /**
   * Batch fetch active credits for multiple precreditos
   */
  async obtenerDatosCreditoActivoLote(
    precreditoIds: number[]
  ): Promise<Map<number, DatosCreditoActivo>> {
    const mapa = new Map<number, DatosCreditoActivo>();

    try {
      const creditos = await this.prismaLegacy.creditos.findMany({
        where: {
          precredito_id: {
            in: precreditoIds,
          },
          estado: {
            in: ['Al_dia', 'Mora', 'Prejuridico', 'Juridico'],
          },
        },
        select: {
          id: true,
          precredito_id: true,
          cuotas_faltantes: true,
          saldo: true,
          valor_credito: true,
          estado: true,
          created_at: true,
        },
      });

      for (const credito of creditos) {
        mapa.set(credito.precredito_id, {
          credito_id: credito.id,
          precredito_id: credito.precredito_id,
          cuotas_faltantes: credito.cuotas_faltantes,
          saldo: credito.saldo || 0,
          valor_credito: credito.valor_credito,
          estado: this.mapearEstadoCredito(credito.estado),
          fecha_creacion: credito.created_at,
        });
      }

      this.logger.info(`Loaded active credit data for ${mapa.size} precreditos`);
      return mapa;
    } catch (error) {
      this.logger.error('Error getting active credits batch:', error);
      return mapa;
    }
  }
}
