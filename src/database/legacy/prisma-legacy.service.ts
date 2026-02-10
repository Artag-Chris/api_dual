import { PrismaClient as PrismaClientLegacy } from '@prisma/client-legacy';
import { envs } from '../../config/envs';

/**************************************************************************************************
 * Servicio Singleton para la base de datos Legacy
 * 
 * Esta clase gestiona la conexión a la base de datos legacy (antigua) que será migrada
 * progresivamente a la nueva base de datos principal.
 * 
 * El patrón Singleton garantiza que solo exista una única instancia de conexión
 * a la base de datos legacy durante toda la ejecución de la aplicación.
 ***************************************************************************************************/

class PrismaLegacyService extends PrismaClientLegacy {
  private static instance: PrismaLegacyService;

  constructor() {
    super({
      log: ['warn', 'error'],
      datasources: {
        dbLegacy: {
          url: envs.DATABASE_URL_LEGACY ? envs.DATABASE_URL_LEGACY : "",
        },
      },
    });

    this.init();
  }

  /**
   * Obtiene la instancia singleton del servicio
   * Si no existe, la crea; si ya existe, retorna la existente
   */
  public static getInstance(): PrismaLegacyService {
    if (!PrismaLegacyService.instance) {
      PrismaLegacyService.instance = new PrismaLegacyService();
    }
    return PrismaLegacyService.instance;
  }

  /**
   * Inicializa la conexión a la base de datos legacy
   */
  async init() {
    try {
      await this.$connect();
      console.log(`✓ Conexión a la base de datos LEGACY establecida correctamente.`);
    } catch (error) {
      console.error('✗ Error al conectar con la base de datos LEGACY:', error);
    }
  }

  /**
   * Cierra la conexión a la base de datos legacy
   */
  async destroy() {
    try {
      await this.$disconnect();
      console.log('✓ Conexión a la base de datos LEGACY cerrada.');
    } catch (error) {
      console.error('✗ Error al cerrar la conexión con la base de datos LEGACY:', error);
    }
  }

  /**
   * Limpia y cierra la conexión (alias de destroy)
   */
  public async cleanup() {
    await this.$disconnect();
  }
}

// Manejadores de señales para cerrar la conexión correctamente
process.on('SIGINT', async () => {
  await prismaLegacyService.destroy();
  console.log('Proceso SIGINT: Conexión LEGACY cerrada.');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prismaLegacyService.destroy();
  console.log('Proceso SIGTERM: Conexión LEGACY cerrada.');
  process.exit(0);
});

// Exportar la instancia singleton
export const prismaLegacyService = PrismaLegacyService.getInstance();

// Exportar la clase por si se necesita para tipos o testing
export default PrismaLegacyService;
