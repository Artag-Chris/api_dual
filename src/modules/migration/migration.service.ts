import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import { prismaMainService } from '../../database/main/prisma-main.service';

/**************************************************************************************************
 * Servicio de Migración
 * 
 * Este servicio se encarga de migrar y transformar datos desde la base de datos legacy
 * a la base de datos principal. Implementa el patrón Singleton.
 ***************************************************************************************************/

class MigrationService {
  private static instance: MigrationService;

  constructor() {}

  public static getInstance(): MigrationService {
    if (!MigrationService.instance) {
      MigrationService.instance = new MigrationService();
    }
    return MigrationService.instance;
  }

  /**
   * Migra datos de la tabla 'something' de legacy a 'TransformedData' en main
   * Aplica transformaciones necesarias durante el proceso
   */
  async migrateSomething() {
    try {
      // 1. Leer datos de la base de datos legacy
      const legacyData = await prismaLegacyService.something.findMany();

      if (legacyData.length === 0) {
        return {
          success: true,
          message: 'No hay datos para migrar',
          migrated: 0
        };
      }

      // 2. Transformar los datos
      const transformedData = legacyData.map(item => ({
        id: item.id, // Usar el mismo ID o generar uno nuevo con uuid()
        content: item.message, // Transformación: message -> content
        // createdAt y updatedAt se generarán automáticamente
      }));

      // 3. Insertar en la base de datos principal
      const result = await prismaMainService.transformedData.createMany({
        data: transformedData,
        skipDuplicates: true // Evita errores si ya existen registros con el mismo ID
      });

      return {
        success: true,
        message: 'Migración completada exitosamente',
        migrated: result.count
      };
    } catch (error) {
      console.error('Error durante la migración:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de ambas bases de datos
   */
  async getStatistics() {
    try {
      const [legacyCount, mainCount] = await Promise.all([
        prismaLegacyService.something.count(),
        prismaMainService.transformedData.count()
      ]);

      return {
        legacy: {
          something: legacyCount
        },
        main: {
          transformedData: mainCount
        }
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }

  /**
   * Compara un registro específico entre ambas bases de datos
   */
  async compareRecord(id: string) {
    try {
      const [legacyRecord, mainRecord] = await Promise.all([
        prismaLegacyService.something.findUnique({ where: { id } }),
        prismaMainService.transformedData.findUnique({ where: { id } })
      ]);

      return {
        legacy: legacyRecord,
        main: mainRecord,
        exists: {
          inLegacy: !!legacyRecord,
          inMain: !!mainRecord
        }
      };
    } catch (error) {
      console.error('Error comparando registro:', error);
      throw error;
    }
  }
}

export default MigrationService;
