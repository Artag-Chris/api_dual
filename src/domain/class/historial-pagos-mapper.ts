/**
 * PHASE 14 (IMPROVED): Complete Payment History Mapper
 * Migrates payment history with proper linkage to amortization
 * 
 * Creates records in 3 tables:
 * 1. historial_pagos: Historical payment records for applied payments
 * 2. pagos: Payment registrations (both applied and pending)
 * 3. historial_pagos_detallado: Detailed breakdown linking pagos to amortizacion
 */

import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';
import {
  PagoHistoricoCreateDto,
  HistorialPagosCreateDto,
  HistorialPagosDetalladoCreateDto,
} from '../dtos/migrate-cliente.dto';

interface MigrationStats {
  pagosAplicados: number;
  pagosPendientes: number;
  historialCreados: number;
  detalladosCreados: number;
}

export class HistorialPagosMapper {
  constructor(
    private readonly prismaLegacy: typeof prismaLegacyService,
    private readonly logger: typeof WinstonAdapter
  ) {}

  /**
   * Migrates complete payment history for a credit
   * Links payments to amortization schedule properly
   */
  async migrarHistorialPagosCompleto(
    creditoIdLegacy: number,
    prestamoIDMain: number,
    userClienteId: number,
    documento: string,
    tx: any
  ): Promise<MigrationStats> {
    const stats: MigrationStats = {
      pagosAplicados: 0,
      pagosPendientes: 0,
      historialCreados: 0,
      detalladosCreados: 0,
    };

    try {
      // Fetch all payments from legacy
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
        return stats;
      }

      // Fetch amortization schedule to link payments correctly
      const amortizaciones = await tx.amortizacion.findMany({
        where: {
          prestamoID: prestamoIDMain,
        },
        orderBy: {
          Numero_cuota: 'asc',
        },
      });

      this.logger.info(
        `Processing ${pagosLegacy.length} payments for credito ${creditoIdLegacy} → prestamo ${prestamoIDMain}`
      );

      for (const pagoLegacy of pagosLegacy) {
        const numeroCuota = this.extraerNumeroCuota(pagoLegacy.num_cuota);
        const estadoPago = pagoLegacy.estado;

        // Find matching amortization (if numero_cuota is available)
        let amortizacion = null;
        if (numeroCuota && numeroCuota > 0) {
          amortizacion = amortizaciones.find((a: any) => parseInt(a.Numero_cuota) === numeroCuota);
        }

        if (estadoPago === 'Ok' || estadoPago === 'Finalizado') {
          // APPLIED PAYMENT: Create in all three tables
          await this.migrarPagoAplicado(
            pagoLegacy,
            prestamoIDMain,
            userClienteId,
            documento,
            numeroCuota,
            amortizacion,
            tx,
            stats
          );
        } else if (estadoPago === 'Debe') {
          // PENDING PAYMENT: Create only in pagos table
          await this.migrarPagoPendiente(
            pagoLegacy,
            prestamoIDMain,
            numeroCuota,
            tx,
            stats
          );
        }
      }

      this.logger.info(
        `Payment migration complete for credito ${creditoIdLegacy}:`,
        stats
      );

      return stats;
    } catch (error) {
      this.logger.error(
        `Error migrating payment history for credito ${creditoIdLegacy}:`,
        error
      );
      return stats;
    }
  }

  /**
   * Migrates an applied payment (estado = Ok or Finalizado)
   * Creates records in: pagos, historial_pagos, historial_pagos_detallado
   */
  private async migrarPagoAplicado(
    pagoLegacy: any,
    prestamoIDMain: number,
    userClienteId: number,
    documento: string,
    numeroCuota: number | null,
    amortizacion: any | null,
    tx: any,
    stats: MigrationStats
  ): Promise<void> {
    try {
      // Step 1: Create payment record in pagos table
      const [errorPago, pagoDto] = PagoHistoricoCreateDto.create({
        prestamo_id: prestamoIDMain,
        valor_pago: Math.round(pagoLegacy.abono || 0),
        fecha_pago: pagoLegacy.created_at || new Date(),
        hora_pago: '00:00:00',
        canal_pago: 'MANUAL',
        medio_pago: 'EFECTIVO',
        tipo_pago: this.mapearTipoPago(pagoLegacy.concepto),
        numero_cuota: numeroCuota,
        origen: 'MIGRADO',
        estado_pago: 'APLICADO',
        usuario_aplicacion: 'MIGRACION_AUTOMATICA',
        fecha_aplicacion: pagoLegacy.created_at || new Date(),
        observacion: pagoLegacy.descripcion || 'Pago migrado desde FACILITO',
        referencia_id_transaccion: pagoLegacy.abono_pago_id || undefined,
      });

      if (errorPago || !pagoDto) {
        this.logger.error(`Error creating pago DTO for legacy pago ${pagoLegacy.id}: ${errorPago}`);
        return;
      }

      // Build hora_pago as DateTime at midnight
      const horaDateTime = new Date(pagoDto.fecha_pago);
      horaDateTime.setHours(0, 0, 0, 0);

      const pagoCreado = await tx.pagos.create({
        data: {
          prestamo_id: pagoDto.prestamo_id,
          valor_pago: pagoDto.valor_pago,
          fecha_pago: pagoDto.fecha_pago,
          hora_pago: horaDateTime,
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

      stats.pagosAplicados++;

      // Step 2: Create historial_pagos record
      if (amortizacion && numeroCuota) {
        const [errorHistorial, historialDto] = HistorialPagosCreateDto.create({
          documento,
          prestamoID: prestamoIDMain,
          Numero_cuota: numeroCuota,
          capital: amortizacion.capital,
          interes: amortizacion.interes,
          aval: amortizacion.aval,
          IVA: amortizacion.IVA,
          pablok: 0,
          sanciones: 0,
          prejuridico: 0,
          juridico: 0,
          seguro: 0,
          total_pagado: amortizacion.total_cuota,
          recibo: `FACILITO-${pagoLegacy.id}`,
          agente_creador: 'MIGRACION_AUTOMATICA',
          bolsa: null,
          canal: 'MANUAL',
          tipo_pago: 'CUOTA',
          creador: 'MIGRACION',
          fecha_registro: pagoLegacy.created_at || new Date(),
        });

        if (errorHistorial || !historialDto) {
          this.logger.error(
            `Error creating historial DTO for legacy pago ${pagoLegacy.id}: ${errorHistorial}`
          );
        } else {
          await tx.historial_pagos.create({
            data: {
              documento: historialDto.documento,
              prestamoID: historialDto.prestamoID,
              Numero_cuota: historialDto.Numero_cuota,
              capital: historialDto.capital,
              interes: historialDto.interes,
              aval: historialDto.aval,
              IVA: historialDto.IVA,
              pablok: historialDto.pablok,
              sanciones: historialDto.sanciones,
              prejuridico: historialDto.prejuridico,
              juridico: historialDto.juridico,
              seguro: historialDto.seguro,
              total_pagado: historialDto.total_pagado,
              recibo: historialDto.recibo,
              agente_creador: historialDto.agente_creador,
              bolsa: historialDto.bolsa || null,
              canal: historialDto.canal,
              tipo_pago: historialDto.tipo_pago,
              creador: historialDto.creador,
              fecha_registro: historialDto.fecha_registro,
            },
          });

          stats.historialCreados++;
        }

        // Step 3: Create historial_pagos_detallado linking pago to amortizacion
        const [errorDetallado, detalladoDto] = HistorialPagosDetalladoCreateDto.create({
          id_pago: pagoCreado.id_pago,
          prestamo_id: prestamoIDMain,
          id_cliente: userClienteId,
          documento,
          numero_cuota: numeroCuota,
          capital_pagado: amortizacion.capital,
          interes_pagado: amortizacion.interes,
          aval_pagado: amortizacion.aval,
          iva_pagado: amortizacion.IVA,
          pablok: 0,
          sancion_pagada: 0,
          descuento_capital: 0,
          descuento_interes: 0,
          descuento_aval: 0,
          descuento_iva: 0,
          descuento_sancion: 0,
          total_pagado: amortizacion.total_cuota,
          total_descuento: 0,
          tipo_pago: 'CUOTA',
          id_bolsa_asignada: null,
          usuario_aplicacion: 'MIGRACION_AUTOMATICA',
          fecha_aplicacion: pagoLegacy.created_at || new Date(),
          observaciones: `Pago migrado desde FACILITO - Legacy ID: ${pagoLegacy.id}`,
        });

        if (errorDetallado || !detalladoDto) {
          this.logger.error(
            `Error creating detallado DTO for legacy pago ${pagoLegacy.id}: ${errorDetallado}`
          );
        } else {
          await tx.historial_pagos_detallado.create({
            data: {
              id_pago: detalladoDto.id_pago,
              prestamo_id: detalladoDto.prestamo_id,
              id_cliente: detalladoDto.id_cliente,
              documento: detalladoDto.documento,
              numero_cuota: detalladoDto.numero_cuota,
              capital_pagado: detalladoDto.capital_pagado,
              interes_pagado: detalladoDto.interes_pagado,
              aval_pagado: detalladoDto.aval_pagado,
              iva_pagado: detalladoDto.iva_pagado,
              pablok: detalladoDto.pablok,
              sancion_pagada: detalladoDto.sancion_pagada,
              descuento_capital: detalladoDto.descuento_capital,
              descuento_interes: detalladoDto.descuento_interes,
              descuento_aval: detalladoDto.descuento_aval,
              descuento_iva: detalladoDto.descuento_iva,
              descuento_sancion: detalladoDto.descuento_sancion,
              total_pagado: detalladoDto.total_pagado,
              total_descuento: detalladoDto.total_descuento,
              tipo_pago: detalladoDto.tipo_pago,
              id_bolsa_asignada: detalladoDto.id_bolsa_asignada,
              usuario_aplicacion: detalladoDto.usuario_aplicacion,
              fecha_aplicacion: detalladoDto.fecha_aplicacion,
              observaciones: detalladoDto.observaciones,
            },
          });

          stats.detalladosCreados++;
        }
      }
    } catch (error) {
      this.logger.error(`Error migrating applied payment ${pagoLegacy.id}:`, error);
    }
  }

  /**
   * Migrates a pending payment (estado = Debe)
   * Creates record only in pagos table with estado PENDIENTE
   */
  private async migrarPagoPendiente(
    pagoLegacy: any,
    prestamoIDMain: number,
    numeroCuota: number | null,
    tx: any,
    stats: MigrationStats
  ): Promise<void> {
    try {
      // Step 1: Create payment record in pagos table
      const [errorPago, pagoDto] = PagoHistoricoCreateDto.create({
        prestamo_id: prestamoIDMain,
        valor_pago: Math.round(pagoLegacy.abono || 0),
        fecha_pago: pagoLegacy.created_at || new Date(),
        hora_pago: '00:00:00',
        canal_pago: 'MANUAL',
        medio_pago: 'EFECTIVO',
        tipo_pago: this.mapearTipoPago(pagoLegacy.concepto),
        numero_cuota: numeroCuota,
        origen: 'MIGRADO',
        estado_pago: 'PENDIENTE',
        usuario_aplicacion: 'MIGRACION_AUTOMATICA',
        fecha_aplicacion: undefined,
        observacion: pagoLegacy.descripcion || 'Pago pendiente migrado desde FACILITO',
        referencia_id_transaccion: pagoLegacy.abono_pago_id || undefined,
      });

      if (errorPago || !pagoDto) {
        this.logger.error(`Error creating pending pago DTO for legacy pago ${pagoLegacy.id}: ${errorPago}`);
        return;
      }

      // Build hora_pago as DateTime at midnight
      const horaDateTime = new Date(pagoDto.fecha_pago);
      horaDateTime.setHours(0, 0, 0, 0);

      await tx.pagos.create({
        data: {
          prestamo_id: pagoDto.prestamo_id,
          valor_pago: pagoDto.valor_pago,
          fecha_pago: pagoDto.fecha_pago,
          hora_pago: horaDateTime,
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

      stats.pagosPendientes++;
    } catch (error) {
      this.logger.error(`Error migrating pending payment ${pagoLegacy.id}:`, error);
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
}
