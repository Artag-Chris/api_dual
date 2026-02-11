import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import { prismaMainService } from '../../database/main/prisma-main.service';
import LegacyDataService from '../legacy-data/legacy-data.service';
import MainDataService from '../main-data/main-data.service';

/**************************************************************************************************
 * Servicio de Migración
 * 
 * Este servicio se encarga de migrar y transformar datos desde la base de datos legacy
 * a la base de datos principal. Implementa el patrón Singleton.
 ***************************************************************************************************/

class MigrationService {
  private static instance: MigrationService;
  private legacyDataService = LegacyDataService.getInstance();
  private mainDataService = MainDataService.getInstance();

  constructor() {}

  public static getInstance(): MigrationService {
    if (!MigrationService.instance) {
      MigrationService.instance = new MigrationService();
    }
    return MigrationService.instance;
  }

  /**
   * Obtiene estadísticas generales de migración
   */
  async getMigrationStatistics() {
    try {
      const legacyStats = await this.legacyDataService.getEstadisticasGenerales();
      const mainStats = await this.mainDataService.getEstadisticasGenerales();

      return {
        success: true,
        legacy: legacyStats,
        main: mainStats,
        comparison: {
          clientesVsUsuarios: {
            legacy: legacyStats.clientes,
            main: mainStats.usuarios
          },
          creditosVsEstudios: {
            legacy: legacyStats.creditos,
            main: mainStats.productos
          },
          pagos: {
            legacy: legacyStats.pagos,
            main: mainStats.pagos
          }
        }
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }

  /**
   * Valida consistencia de datos entre aplicaciones
   */
  async validateDataConsistency() {
    try {
      const [legacyClientes, legacyCreditos, mainUsuarios, mainPagos] = await Promise.all([
        this.legacyDataService.getAllClientes(0, 5),
        this.legacyDataService.getAllCreditos(0, 5),
        this.mainDataService.getAllUserClientes(0, 5),
        this.mainDataService.getAllPagos(0, 5)
      ]);

      return {
        success: true,
        dataValidation: {
          legacyClientsCount: legacyClientes.length,
          legacyCreditosCount: legacyCreditos.length,
          mainUsuariosCount: mainUsuarios.length,
          mainPagosCount: mainPagos.length,
          status: 'Data retrieved successfully'
        }
      };
    } catch (error) {
      console.error('Error validando consistencia:', error);
      throw error;
    }
  }

  /**
   * Pre-visualización de datos para migración
   */
  async previewMigration(skip: number = 0, take: number = 10) {
    try {
      const [clientes, creditos, usuarios] = await Promise.all([
        this.legacyDataService.getAllClientes(skip, take),
        this.legacyDataService.getAllCreditos(skip, take),
        this.mainDataService.getAllUserClientes(skip, take)
      ]);

      return {
        success: true,
        preview: {
          legacyClientes: clientes,
          legacyCreditos: creditos,
          mainUsuarios: usuarios
        }
      };
    } catch (error) {
      console.error('Error en pre-visualización:', error);
      throw error;
    }
  }
}

export default MigrationService;
