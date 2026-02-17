/**
 * PHASE 0: Bodega Mapper
 * Maps legacy puntos (warehouses) to main bodega  
 * Creates mapping between punto_id -> almacen for product allocation
 */

import { prismaMainService } from '../../database/main/prisma-main.service';
import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

export class BodegaMapper {
  private static readonly DEFAULT_ALMACEN = 100; // Default warehouse if punto not found

  constructor(
    private readonly prismaMain: typeof prismaMainService,
    private readonly prismaLegacy: typeof prismaLegacyService,
    private readonly logger: typeof WinstonAdapter
  ) {}

  /**
   * Creates a map of punto_id -> almacen for product allocation
   * Ensures all puntos exist in main.bodega table
   */
  async crearMapeoBodegas(): Promise<Map<number, number>> {
    const mapeoBodegas = new Map<number, number>();

    try {
      // Fetch all puntos from legacy
      const puntosLegacy = await this.prismaLegacy.puntos.findMany({
        where: {
          estado: 'Activo',
        },
        select: {
          id: true,
          nombre: true,
          zona_id: true,
          prefijo: true,
        },
      });

      this.logger.info(`Found ${puntosLegacy.length} active puntos in legacy database`);

      // Process each punto
      for (const punto of puntosLegacy) {
        const almacenId = punto.id; // Use punto.id as almacen number

        // Check if bodega already exists in main
        const bodegaExistente = await this.prismaMain.bodega.findUnique({
          where: { almacen: almacenId },
        });

        if (!bodegaExistente) {
          // Create bodega in main database
          await this.prismaMain.bodega.create({
            data: {
              almacen: almacenId,
              nombre: punto.nombre || `Bodega ${almacenId}`,
              id_sucursal: punto.zona_id || null,
              activo: true,
            },
          });

          this.logger.info(`Created bodega: ${almacenId} - ${punto.nombre}`);
        }

        // Add to mapping
        mapeoBodegas.set(punto.id, almacenId);
      }

      // Ensure default bodega exists
      const defaultBodega = await this.prismaMain.bodega.findUnique({
        where: { almacen: BodegaMapper.DEFAULT_ALMACEN },
      });

      if (!defaultBodega) {
        await this.prismaMain.bodega.create({
          data: {
            almacen: BodegaMapper.DEFAULT_ALMACEN,
            nombre: 'BODEGA PRINCIPAL',
            activo: true,
          },
        });
        this.logger.info(`Created default bodega: ${BodegaMapper.DEFAULT_ALMACEN}`);
      }

      this.logger.info(`Bodega mapping completed: ${mapeoBodegas.size} entries`);
      return mapeoBodegas;
    } catch (error) {
      this.logger.error('Error creating bodega mapping:', error);
      throw error;
    }
  }

  /**
   * Gets almacen ID for a given punto_id
   * Returns default almacen if punto not found
   */
  static getAlmacen(mapeoBodegas: Map<number, number>, puntoId: number | null): number {
    if (!puntoId) return BodegaMapper.DEFAULT_ALMACEN;
    return mapeoBodegas.get(puntoId) || BodegaMapper.DEFAULT_ALMACEN;
  }

  /**
   * Gets almacen for a user based on their punto_id
   */
  async getAlmacenForUser(userId: number, mapeoBodegas: Map<number, number>): Promise<number> {
    try {
      const user = await this.prismaLegacy.users.findUnique({
        where: { id: userId },
        select: { punto_id: true },
      });

      if (!user) {
        this.logger.warn(`User ${userId} not found, using default almacen`);
        return BodegaMapper.DEFAULT_ALMACEN;
      }

      return BodegaMapper.getAlmacen(mapeoBodegas, user.punto_id);
    } catch (error) {
      this.logger.error(`Error getting almacen for user ${userId}:`, error);
      return BodegaMapper.DEFAULT_ALMACEN;
    }
  }
}
