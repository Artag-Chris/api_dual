import { PrismaClient as PrismaClientMain } from '@prisma/client-main';
import { envs } from '../../config/envs';

/**************************************************************************************************
 * Servicio Singleton para la base de datos Main (Principal)
 * 
 * Esta clase gestiona la conexión a la base de datos principal donde se almacenarán
 * los datos transformados y migrados desde la base de datos legacy.
 * 
 * El patrón Singleton garantiza que solo exista una única instancia de conexión
 * a la base de datos principal durante toda la ejecución de la aplicación.
 ***************************************************************************************************/

class PrismaMainService extends PrismaClientMain {
  private static instance: PrismaMainService;

  constructor() {
    super({
      log: ['warn', 'error'],
      datasources: {
        dbMain: {
          url: envs.DATABASE_URL_MAIN ? envs.DATABASE_URL_MAIN : "",
        },
      },
    });

    this.init();
  }

  /**
   * Obtiene la instancia singleton del servicio
   * Si no existe, la crea; si ya existe, retorna la existente
   */
  public static getInstance(): PrismaMainService {
    if (!PrismaMainService.instance) {
      PrismaMainService.instance = new PrismaMainService();
    }
    return PrismaMainService.instance;
  }

  /**
   * Inicializa la conexión a la base de datos principal
   */
  async init() {
    try {
      await this.$connect();
      console.log(`✓ Conexión a la base de datos MAIN establecida correctamente.`);
    } catch (error) {
      console.error('✗ Error al conectar con la base de datos MAIN:', error);
    }
  }

  /**
   * Cierra la conexión a la base de datos principal
   */
  async destroy() {
    try {
      await this.$disconnect();
      console.log('✓ Conexión a la base de datos MAIN cerrada.');
    } catch (error) {
      console.error('✗ Error al cerrar la conexión con la base de datos MAIN:', error);
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
  await prismaMainService.destroy();
  console.log('Proceso SIGINT: Conexión MAIN cerrada.');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prismaMainService.destroy();
  console.log('Proceso SIGTERM: Conexión MAIN cerrada.');
  process.exit(0);
});

// Exportar la instancia singleton
export const prismaMainService = PrismaMainService.getInstance();

// Exportar la clase por si se necesita para tipos o testing
export default PrismaMainService;
