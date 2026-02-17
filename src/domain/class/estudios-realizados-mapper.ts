/**
 * PHASE 10: Estudios Realizados Mapper
 * Creates estudios_realizados records from legacy estudios
 */

import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';
import { EstudiosRealizadosCreateDto } from '../dtos/migrate-cliente.dto';

export class EstudiosRealizadosMapper {
  constructor(
    private readonly prismaLegacy: typeof prismaLegacyService,
    private readonly logger: typeof WinstonAdapter
  ) {}

  /**
   * Creates EstudiosRealizadosCreateDto from legacy estudios
   */
  async crearEstudioRealizado(
    documentoCliente: string,
    precreditoId?: number
  ): Promise<EstudiosRealizadosCreateDto | null> {
    try {
      // Try to get estudio from legacy via cliente
      const cliente = await this.prismaLegacy.clientes.findUnique({
        where: { num_doc: documentoCliente },
        select: { id: true },
      });
      
      if (!cliente) {
        return this.crearEstudioPorDefecto(documentoCliente);
      }

      const estudio = await this.prismaLegacy.estudios.findFirst({
        where: {
          cliente_id: cliente.id,
        },
        orderBy: {
          id: 'desc',
        },
      });

      if (!estudio) {
        // Create default estudio if none exists
        return this.crearEstudioPorDefecto(documentoCliente);
      }

      // Get active credits count
      const creditosActivos = await this.contarCreditosActivos(cliente.id);

      // Extract data - estudios table doesn't have these fields, use defaults
      const cupo = 2000000; // Default cupo
      const tasa = 3.0; // Default tasa
      const plazo = 12; // Default plazo

      const [error, estudiosDto] = EstudiosRealizadosCreateDto.create({
        documento: documentoCliente,
        cupo: String(cupo),
        cupoDisponible: String(cupo),
        tasa: tasa,
        plazo: plazo,
        creditos_activos: creditosActivos,
        creditos_maximos: 2,
        observacion: (estudio?.observaciones || 'Migrado desde FACILITO'),
      });

      if (error || !estudiosDto) {
        this.logger.error(`Error creating estudios DTO for ${documentoCliente}: ${error}`);
        return null;
      }

      return estudiosDto;
    } catch (error) {
      this.logger.error(`Error fetching estudio for ${documentoCliente}:`, error);
      return this.crearEstudioPorDefecto(documentoCliente);
    }
  }

  /**
   * Creates default estudio when none exists in legacy
   */
  private crearEstudioPorDefecto(documentoCliente: string): EstudiosRealizadosCreateDto | null {
    const [error, estudiosDto] = EstudiosRealizadosCreateDto.create({
      documento: documentoCliente,
      cupo: '2000000',
      cupoDisponible: '2000000',
      tasa: 3.0,
      plazo: 12,
      creditos_activos: 0,
      creditos_maximos: 2,
      observacion: 'Estudio generado automáticamente - Migración',
    });

    if (error || !estudiosDto) {
      this.logger.error(`Error creating default estudio for ${documentoCliente}: ${error}`);
      return null;
    }

    return estudiosDto;
  }

  /**
   * Counts active credits for a client
   */
  private async contarCreditosActivos(clienteId: number): Promise<number> {
    try {
      const count = await this.prismaLegacy.creditos.count({
        where: {
          precreditos: {
            cliente_id: clienteId,
          },
          estado: {
            in: ['Al_dia', 'Mora', 'Prejuridico', 'Juridico'],
          },
        },
      });

      return count;
    } catch (error) {
      this.logger.error(`Error counting active credits for cliente ${clienteId}:`, error);
      return 0;
    }
  }
}
