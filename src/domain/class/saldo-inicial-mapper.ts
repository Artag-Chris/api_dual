/**
 * PHASE 13: Saldo Inicial Mapper
 * Creates saldo_inicial records to track initial and current balances
 */

import WinstonAdapter from '../../config/adapters/winstonAdapter';
import { SaldoInicialCreateDto } from '../dtos/migrate-cliente.dto';
import { DatosCreditoActivo } from './creditos-integration-mapper';

export class SaldoInicialMapper {
  constructor(private readonly logger: typeof WinstonAdapter) {}

  /**
   * Creates SaldoInicialCreateDto from credit data
   */
  crearSaldoInicial(
    prestamoIDMain: number,
    documentoCliente: string,
    valorPrestamo: number,
    datosCreditoActivo: DatosCreditoActivo | null
  ): SaldoInicialCreateDto | null {
    try {
      let saldoInicial: number;
      let saldoActual: number;

      if (datosCreditoActivo) {
        // Credit with payments
        saldoInicial = datosCreditoActivo.valor_credito;
        saldoActual = datosCreditoActivo.saldo;
      } else {
        // New credit
        saldoInicial = valorPrestamo;
        saldoActual = valorPrestamo;
      }

      const [error, saldoDto] = SaldoInicialCreateDto.create({
        prestamoID: prestamoIDMain,
        documento: documentoCliente,
        saldo_Inicial: Math.round(saldoInicial),
        saldo_actual: Math.round(saldoActual),
      });

      if (error || !saldoDto) {
        this.logger.error(`Error creating saldo inicial DTO: ${error}`);
        return null;
      }

      return saldoDto;
    } catch (error) {
      this.logger.error('Error creating saldo inicial:', error);
      return null;
    }
  }
}
