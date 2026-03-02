import { prismaMainService } from '../../database/main/prisma-main.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

/**
 * ✓ Servicio de Cola FIFO para migración de 32k clientes
 * ✓ Implementa patrón Singleton - igual que LegacyDataService
 * ✓ Persistent en BD Main - no se pierde si se reinicia
 * ✓ FIFO garantizado por createdAt ASC + id ASC
 * ✓ Reintentos automáticos: máximo 3 intentos
 * ✓ Dead Letter Queue: items que agotaron reintentos
 */
class QueueService {
  private static instance: QueueService;
  private logger = WinstonAdapter;

  constructor() {}

  /**
   * Obtiene la instancia singleton
   */
  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  /**
   * ENQUEUE: Añade un item a la cola FIFO
   * 
   * @param documento - Identificador del cliente (ej: "1234567890")
   * @param fase - En qué fase migrarlo (CLIENTES, CREDITOS, PAGOS, AMORTIZACIONES, BODEGA)
     * @returns Item creado en la cola
   * 
   * @example
   * await queueService.enqueue('1234567890', 'CLIENTES');

   */
  async enqueue(documento: string, fase: string) {
    try {
      const item = await prismaMainService.migration_queue.create({
        data: {
          documento,
          fase,
          estado: 'PENDIENTE',
          intentos: 0,
        }
      });

      this.logger.debug(`[QUEUE] Enqueued: ${documento} → ${fase}`);
      return item;
      
    } catch (error) {
      this.logger.error(`[QUEUE] Error enqueuing: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * DEQUEUE: Obtiene el primer item de la cola (FIFO)
   * 
   * Automáticamente lo marca como PROCESANDO para evitar que otro 
   * proceso lo agarre simultáneamente.
   * 
   * @param fase - Qué fase procesar (CLIENTES, CREDITOS, PAGOS, AMORTIZACIONES)
   * @returns Item más antiguo en PENDIENTE, o null si la cola está vacía
   * 
   * @example
   * const item = await queueService.dequeue('CREDITOS');
   * if (!item) {
   *   console.log('Cola vacía');
   * } else {
   *   console.log(`Procesando: ${item.documento}`);
   * }
   */
  async dequeue(fase: string) {
    try {
      // Busca el PRIMERO (más antiguo) en PENDIENTE - ESTO ES FIFO!
      const item = await prismaMainService.migration_queue.findFirst({
        where: {
          fase,
          estado: 'PENDIENTE'
        },
        orderBy: [
          { createdAt: 'asc' },  // ← Ordenar ASC = FIFO: primero que entró sale primero
          { id: 'asc' }           // Fallback por ID si createdAt es igual
        ]
      });

      if (!item) {
        this.logger.debug(`[QUEUE] Empty queue for phase: ${fase}`);
        return null;
      }

      // Marca como PROCESANDO para evitar que otro worker lo agarre
      await prismaMainService.migration_queue.update({
        where: { id: item.id },
        data: { estado: 'PROCESANDO' }
      });

      this.logger.debug(`[QUEUE] Dequeued: ${item.documento} (${fase})`);
      return item;
      
    } catch (error) {
      this.logger.error(`[QUEUE] Error dequeuing: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Marca un item como completado exitosamente
   * 
   * @param id - ID del item en la cola
   * @returns Item actualizado
   */
  async markCompleted(id: number) {
    try {
      // Verificar que el item existe antes de actualizar
      const item = await prismaMainService.migration_queue.findUnique({
        where: { id }
      });

      if (!item) {
        this.logger.warn(`[QUEUE] Item ${id} not found for markCompleted`);
        return;
      }

      const updated = await prismaMainService.migration_queue.update({
        where: { id },
        data: {
          estado: 'COMPLETADO',
          processedAt: new Date(),
          intentos: 0  // Reset para claridad
        }
      });

      this.logger.info(`[QUEUE] Completed: ${updated.documento}`);
      return updated;
      
    } catch (error) {
      this.logger.error(`[QUEUE] Error marking completed: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Maneja errores: reintenta 3 veces o mueve a Dead Letter Queue
   * 
   * @param id - ID del item en la cola
   * @param errorMessage - Mensaje de error
   * 
   * Si intentos < 3:
   *   → Vuelve a estado PENDIENTE (será reintentado)
   * Si intentos >= 3:
   *   → Mueve a migration_queue_dlq (requiere intervención manual)
   */
  async markError(id: number, errorMessage: string) {
    try {
      const item = await prismaMainService.migration_queue.findUnique({
        where: { id }
      });

      if (!item) {
        this.logger.warn(`[QUEUE] Item ${id} not found`);
        return;
      }

      // ¿Alcanzó 3 reintentos?
      if (item.intentos >= 2) {  // 0, 1, 2 = 3 intentos totales
        this.logger.error(`[QUEUE] Max retries reached: ${item.documento}`);

        // Mueve a Dead Letter Queue
        await prismaMainService.migration_queue_dlq.create({
          data: {
            documento: item.documento,
            fase: item.fase,
            error: `Intentos agotados (3). Último error: ${errorMessage}`
          }
        });

        // Elimina de cola principal
        await prismaMainService.migration_queue.delete({
          where: { id }
        });

        this.logger.warn(`[QUEUE] Moved to DLQ: ${item.documento}`);

      } else {
        // Reintenta: vuelve a PENDIENTE con intento incrementado
        await prismaMainService.migration_queue.update({
          where: { id },
          data: {
            estado: 'PENDIENTE',
            intentos: item.intentos + 1,
            error: errorMessage,
            updatedAt: new Date()
          }
        });

        this.logger.warn(
          `[QUEUE] Retry #${item.intentos + 1}/3: ${item.documento} - Error: ${errorMessage}`
        );
      }
      
    } catch (error) {
      this.logger.error(`[QUEUE] Error handling error: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Obtiene métricas de la cola en tiempo real
   * 
   * @returns Objeto con conteos por estado
   * 
   * @example
   * const metrics = await queueService.getMetrics();
   * // {
   * //   pendientes: 30000,
   * //   procesando: 45,
   * //   completados: 1955,
   * //   errores: 0,
   * //   total: 32000,
   * //   progreso: "6.09%"
   * // }
   */
  async getMetrics() {
    try {
      const [pendientes, procesando, completados, dlqCount] = await Promise.all([
        prismaMainService.migration_queue.count({
          where: { estado: 'PENDIENTE' }
        }),
        prismaMainService.migration_queue.count({
          where: { estado: 'PROCESANDO' }
        }),
        prismaMainService.migration_queue.count({
          where: { estado: 'COMPLETADO' }
        }),
        prismaMainService.migration_queue_dlq.count()
      ]);

      const total = pendientes + procesando + completados + dlqCount;
      const progreso = total > 0 ? ((completados / total) * 100).toFixed(2) : '0';

      // Estimar tiempo restante (asumiendo 5 items/seg)
      const segundosRestantes = Math.ceil(pendientes / 5);
      const horasRestantes = Math.floor(segundosRestantes / 3600);
      const minutosRestantes = Math.floor((segundosRestantes % 3600) / 60);
      const tiempoRestante = horasRestantes > 0 
        ? `~${horasRestantes}h ${minutosRestantes}m` 
        : `~${minutosRestantes}m`;

      return {
        pendientes,
        procesando,
        completados,
        dlq: dlqCount,
        total,
        progreso: `${progreso}%`,
        tiempoEstimado: tiempoRestante,
        timestamp: new Date()
      };
      
    } catch (error) {
      this.logger.error(`[QUEUE] Error getting metrics: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Guarda un crédito fallido en DLQ sin cambiar la tabla
   * Usa el campo error como JSON para almacenar info del crédito
   * 
   * @param documento - Documento del cliente
   * @param fase - PHASE 2, PHASE 3B, PHASE 4, etc
   * @param creditoId - prestamo_ID (o credito_id_legacy, son iguales)
   * @param creditoData - Objeto con datos del crédito (valor_prestamo, numero_cuotas, cartera, etc)
   * @param errorMessage - Mensaje de error
   */
  async saveCreditoErrorToDLQ(
    documento: string,
    fase: string,
    creditoId: number | null | undefined,
    creditoData: any,
    errorMessage: string
  ) {
    try {
      // Helper para convertir BigInt a string
      const serializeBigInt = (obj: any): any => {
        if (obj === null || obj === undefined) return obj;
        
        if (typeof obj === 'bigint') {
          return obj.toString();
        }
        
        if (typeof obj === 'object') {
          if (Array.isArray(obj)) {
            return obj.map(serializeBigInt);
          }
          const result: any = {};
          for (const key in obj) {
            result[key] = serializeBigInt(obj[key]);
          }
          return result;
        }
        
        return obj;
      };

      const errorObject = {
        tipo: 'CREDITO_FALLIDO',
        prestamo_ID: creditoId,
        fase,
        error_message: errorMessage,
        datos_credito: {
          valor_prestamo: creditoData?.valor_prestamo ? String(creditoData.valor_prestamo) : null,
          numero_cuotas: creditoData?.numero_cuotas ? Number(creditoData.numero_cuotas) : null,
          nombre_cartera: creditoData?.nombre_cartera || null,
          estado: creditoData?.estado || null,
          tasa: creditoData?.tasa ? Number(creditoData.tasa) : null,
          periodicidad: creditoData?.periodicidad || null,
          plazo: creditoData?.plazo ? Number(creditoData.plazo) : null,
          fecha_creacion: creditoData?.fecha_creacion || new Date().toISOString()
        },
        guardado_en: new Date().toISOString()
      };

      // Serializar con manejo de BigInt
      const errorJSON = JSON.stringify(
        serializeBigInt(errorObject),
        null,
        2
      );

      await prismaMainService.migration_queue_dlq.create({
        data: {
          documento,
          fase,
          error: errorJSON
        }
      });

      this.logger.warn(
        `[QUEUE] 💾 Crédito fallido guardado en DLQ: documento=${documento}, prestamo_ID=${creditoId}, fase=${fase}`
      );
    } catch (dlqError) {
      this.logger.error(
        `[QUEUE] Error guardando crédito en DLQ: ${
          dlqError instanceof Error ? dlqError.message : String(dlqError)
        }`
      );
    }
  }

  /**
   * Obtiene items de Dead Letter Queue (errores graves)
   * 
   * @param limit - Cuántos mostrar
   * @returns Array de items en DLQ
   */
  async getDeadLetterQueue(limit: number = 100) {
    try {
      return await prismaMainService.migration_queue_dlq.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      this.logger.error(`[QUEUE] Error getting DLQ: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Limpia la cola (útil para reinicios o testing)
   * ⚠️ USE CON CUIDADO - elimina todos los datos de la cola
   */
  async clearQueue() {
    try {
      const result1 = await prismaMainService.migration_queue.deleteMany({});
      const result2 = await prismaMainService.migration_queue_dlq.deleteMany({});
      
      this.logger.warn(
        `[QUEUE] Cleared ${result1.count} items from queue and ${result2.count} from DLQ`
      );
      
      return {
        queueCleared: result1.count,
        dlqCleared: result2.count
      };
    } catch (error) {
      this.logger.error(`[QUEUE] Error clearing queue: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Obtiene items que pasaron mucho tiempo en PROCESANDO (stalled)
   * Útil si un worker se cuelga sin marcar completado
   */
  async getStalled(minutes: number = 5) {
    try {
      const minutesAgo = new Date(Date.now() - minutes * 60000);
      
      return await prismaMainService.migration_queue.findMany({
        where: {
          estado: 'PROCESANDO',
          updatedAt: {
            lt: minutesAgo
          }
        }
      });
    } catch (error) {
      this.logger.error(`[QUEUE] Error getting stalled: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Resetea items stalled de vuelta a PENDIENTE
   */
  async resetStalled(minutes: number = 5) {
    try {
      const stalled = await this.getStalled(minutes);
      
      for (const item of stalled) {
        await prismaMainService.migration_queue.update({
          where: { id: item.id },
          data: {
            estado: 'PENDIENTE',
            intentos: item.intentos + 1
          }
        });
      }

      this.logger.info(`[QUEUE] Reset ${stalled.length} stalled items back to PENDIENTE`);
      return stalled.length;
    } catch (error) {
      this.logger.error(`[QUEUE] Error resetting stalled: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas por fase
   */
  async getMetricsByPhase() {
    try {
      const fases = ['CLIENTES', 'CREDITOS', 'PAGOS', 'AMORTIZACIONES', 'BODEGA'];
      const stats: any = {};

      for (const fase of fases) {
        const [pendientes, procesando, completados] = await Promise.all([
          prismaMainService.migration_queue.count({
            where: { fase, estado: 'PENDIENTE' }
          }),
          prismaMainService.migration_queue.count({
            where: { fase, estado: 'PROCESANDO' }
          }),
          prismaMainService.migration_queue.count({
            where: { fase, estado: 'COMPLETADO' }
          })
        ]);

        stats[fase] = { pendientes, procesando, completados };
      }

      return stats;
    } catch (error) {
      this.logger.error(`[QUEUE] Error getting metrics by phase: ${(error as any).message}`);
      throw error;
    }
  }
}

export default QueueService;
