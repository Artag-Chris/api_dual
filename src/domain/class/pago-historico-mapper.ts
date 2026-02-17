/**
 * PHASE 14: Payment History Mapper
 * Migrates payment history from legacy pagos to main pagos
 */

import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';
import { PagoHistoricoCreateDto } from '../dtos/migrate-cliente.dto';

export class PagoHistoricoMapper {
  constructor(
    private readonly prismaLegacy: typeof prismaLegacyService,
    private readonly logger: typeof WinstonAdapter
  ) {}

  /**
   * Migrates payment history for a given credito_id
   */
  async migrarHistorialPagos(
    creditoIdLegacy: number,
    prestamoIDMain: number,
    tx: any
  ): Promise<number> {
    try {
      // Fetch all payments for this credito
      const pagosLegacy = await this.prismaLegacy.pagos.findMany({
        where: {
          credito_id: creditoIdLegacy,
        },
        orderBy: {
          created_at: 'asc',
        },
      });

      if (pagosLegacy.length === 0) {
        this.logger.info(`No payment history found for credito ${creditoIdLegacy}`);
        return 0;
      }

      let pagosMigrados = 0;

      for (const pagoLegacy of pagosLegacy) {
        // Map payment data
        const [error, pagoDto] = PagoHistoricoCreateDto.create({
          prestamo_id: prestamoIDMain,
          valor_pago: Math.round(pagoLegacy.abono || 0),
          fecha_pago: pagoLegacy.created_at || new Date(),
          hora_pago: '00:00:00',
          canal_pago: 'MANUAL',
          medio_pago: 'EFECTIVO',
          tipo_pago: this.mapearTipoPago(pagoLegacy.concepto),
          numero_cuota: this.extraerNumeroCuota(pagoLegacy.num_cuota),
          origen: 'MIGRADO',
          estado_pago: this.mapearEstadoPago(pagoLegacy.estado),
          usuario_aplicacion: 'MIGRACION_AUTOMATICA',
          fecha_aplicacion: pagoLegacy.created_at || new Date(),
          observacion: pagoLegacy.descripcion || 'Pago migrado desde FACILITO',
          referencia_id_transaccion: pagoLegacy.abono_pago_id || undefined,
        });

        if (error || !pagoDto) {
          this.logger.error(`Error creating pago DTO for legacy pago ${pagoLegacy.id}: ${error}`);
          continue;
        }

        // Create payment record in main
        await tx.pagos.create({
          data: {
            prestamo_id: pagoDto.prestamo_id,
            valor_pago: pagoDto.valor_pago,
            fecha_pago: pagoDto.fecha_pago,
            hora_pago: pagoDto.hora_pago,
            canal_pago: pagoDto.canal_pago,
            medio_pago: pagoDto.medio_pago,
            tipo_pago: pagoDto.tipo_pago,
            numero_cuota: pagoDto.numero_cuota,
            origen: pagoDto.origen,
            estado_pago: pagoDto.estado_pago,
            usuario_aplicacion: pagoDto.usuario_aplicacion,
            fecha_aplicacion: pagoDto.fecha_aplicacion,
            observacion: pagoDto.observacion,
            referencia_id_transaccion: pagoDto.referencia_id_transaccion,
          },
        });

        pagosMigrados++;
      }

      this.logger.info(
        `Migrated ${pagosMigrados} payments for credito ${creditoIdLegacy} → prestamo ${prestamoIDMain}`
      );

      return pagosMigrados;
    } catch (error) {
      this.logger.error(`Error migrating payment history for credito ${creditoIdLegacy}:`, error);
      return 0;
    }
  }

  /**
   * Extracts numero_cuota from JSON field
   */
  private extraerNumeroCuota(numCuotaJson: any): number | null {
    if (!numCuotaJson) return null;
    
    try {
      // If it's already a number
      if (typeof numCuotaJson === 'number') return numCuotaJson;
      
      // If it's a JSON object or string, try to parse
      if (typeof numCuotaJson === 'string') {
        const parsed = JSON.parse(numCuotaJson);
        return typeof parsed === 'number' ? parsed : null;
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Maps legacy concepto to main tipo_pago enum
   */
  private mapearTipoPago(conceptoLegacy: string): 'CUOTA' | 'PAGO_TOTAL' | 'CUOTA_INICIAL' {
    const conceptoMap: Record<string, 'CUOTA' | 'PAGO_TOTAL' | 'CUOTA_INICIAL'> = {
      Cuota: 'CUOTA',
      Cuota_Parcial: 'CUOTA',
      Mora: 'CUOTA',
      Prejuridico: 'CUOTA',
      Juridico: 'CUOTA',
      Saldo_a_Favor: 'PAGO_TOTAL',
      Aval: 'CUOTA',
    };

    return conceptoMap[conceptoLegacy] || 'CUOTA';
  }

  /**
   * Maps legacy estado to main estado_pago enum
   */
  private mapearEstadoPago(
    estadoLegacy: string
  ): 'PENDIENTE' | 'APLICADO' | 'REVERSADO' {
    const estadoMap: Record<string, 'PENDIENTE' | 'APLICADO' | 'REVERSADO'> = {
      Debe: 'PENDIENTE',
      Ok: 'APLICADO',
      Finalizado: 'APLICADO',
    };

    return estadoMap[estadoLegacy] || 'APLICADO';
  }

  /**
   * Gets total amount paid for a credit
   */
  async obtenerTotalPagado(creditoIdLegacy: number): Promise<number> {
    try {
      const resultado = await this.prismaLegacy.pagos.aggregate({
        where: {
          credito_id: creditoIdLegacy,
        },
        _sum: {
          abono: true,
        },
      });

      return Math.round(resultado._sum?.abono || 0);
    } catch (error) {
      this.logger.error(`Error getting total paid for credito ${creditoIdLegacy}:`, error);
      return 0;
    }
  }
}
