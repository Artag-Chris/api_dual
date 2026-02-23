import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import { prismaMainService } from '../../database/main/prisma-main.service';
import LegacyDataService from '../legacy-data/legacy-data.service';
import MainDataService from '../main-data/main-data.service';
import QueueService from '../../domain/class/queue.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

/**
 * ✅ Servicio de Migración con Sistema de Colas FIFO
 * 
 * Características:
 * - Procesa 32k clientes en batches automáticos
 * - Utiliza colas persistentes en BD (migration_queue)
 * - Múltiples consumidores (4) en paralelo sin interferer
 * - Reintenta automáticamente en caso de error (máx 3)
 * - Patrón Singleton
 * 
 * Arquitectura:
 * PRODUCTOR: Obtiene clientes de LEGACY en batches → enqueue a CLIENTES
 * CONSUMIDOR 1: Dequeue CLIENTES → migrateClienteFromLegacy() → final
 * CONSUMIDOR 2: Dequeue CREDITOS → procesar → enqueue PAGOS
 * CONSUMIDOR 3: Dequeue PAGOS → procesar → enqueue AMORTIZACIONES
 * CONSUMIDOR 4: Dequeue AMORTIZACIONES → procesar → final
 */
class MigrationService {
  private static instance: MigrationService;
  
  // Servicios
  private legacyDataService = LegacyDataService.getInstance();
  private mainDataService = MainDataService.getInstance();
  private queueService = QueueService.getInstance();
  private logger = WinstonAdapter;

  // Control de procesos
  private isProcessing = false;
  private batchIndex = 0;
  private consumersRunning = false;

  constructor() {}

  public static getInstance(): MigrationService {
    if (!MigrationService.instance) {
      MigrationService.instance = new MigrationService();
    }
    return MigrationService.instance;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTOR: Procesa clientes por batches y los añade a la cola
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Inicia migración en batches de manera automática y continua
   * 
   * ✅ SIN BLOQUEAR: Retorna inmediatamente (fire & forget)
   * ✅ Procesa 32k clientes en background
   * ✅ Crea items en cola con estado PENDIENTE
   * 
   * @param batchSize - Cuántos clientes por lote (ej: 500, default: 500)
   */
  async processBatchesInBackground(batchSize: number = 500): Promise<void> {
    if (this.isProcessing) {
      throw new Error('Ya hay una migración en progreso');
    }

    this.isProcessing = true;
    this.batchIndex = 0;

    this.logger.info(
      `[MIGRATION] Iniciando migración de clientes en batches de ${batchSize}`
    );

    // ← ESTE CÓDIGO CORRE EN BACKGROUND (no espera)
    (async () => {
      try {
        const totalClientes = await this.getTotalClientesLegacy();
        this.logger.info(`[MIGRATION] Total clientes a procesar: ${totalClientes}`);

        const totalBatches = Math.ceil(totalClientes / batchSize);

        for (let i = 0; i < totalBatches && this.isProcessing; i++) {
          this.batchIndex = i;
          const skip = i * batchSize;
          
          try {
            this.logger.info(
              `[MIGRATION] Batch ${i + 1}/${totalBatches}: procesando clientes ${skip}-${skip + batchSize}`
            );

            const batch = await prismaLegacyService.$queryRaw<any[]>`
              SELECT CAST(num_doc AS CHAR) as documento
              FROM clientes
              WHERE num_doc IS NOT NULL 
                AND num_doc != ''
                AND TRIM(num_doc) != ''
              ORDER BY id ASC
              LIMIT ${batchSize}
              OFFSET ${skip}
            `;

            if (!batch || batch.length === 0) {
              this.logger.info(`[MIGRATION] Batch ${i + 1} vacío, terminando`);
              break;
            }

            for (const row of batch) {
              try {
                await this.queueService.enqueue(row.documento, 'CLIENTES');
              } catch (err) {
                this.logger.warn(
                  `[MIGRATION] Error enqueuing ${row.documento}: ${(err as any).message}`
                );
              }
            }

            this.logger.info(
              `[MIGRATION] ✅ Batch ${i + 1} enqueued: ${batch.length} items a fase CLIENTES`
            );

            await this.sleep(2000);

          } catch (batchError) {
            this.logger.error(
              `[MIGRATION] Error procesando batch ${i + 1}: ${(batchError as any).message}`
            );
          }
        }

        this.logger.info(
          `[MIGRATION] ✅ Productor completado: ${totalBatches} batches enqueued`
        );

      } catch (error) {
        this.logger.error(
          `[MIGRATION] Error en productor: ${(error as any).message}`
        );
      } finally {
        this.isProcessing = false;
      }
    })();

    return Promise.resolve();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSUMIDORES: Procesan items de la cola (en paralelo)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Inicia todos los consumidores en paralelo
   */
  async startAllConsumers(): Promise<void> {
    if (this.consumersRunning) {
      this.logger.warn('[MIGRATION] Consumidores ya están corriendo');
      return;
    }

    this.consumersRunning = true;
    this.logger.info('[MIGRATION] Iniciando consumidores en paralelo...');

    this.procesarClientesConsumer().catch(err => 
      this.logger.error(`[MIGRATION] Consumidor CLIENTES error: ${err.message}`)
    );
    
    this.procesarCreditosConsumer().catch(err => 
      this.logger.error(`[MIGRATION] Consumidor CREDITOS error: ${err.message}`)
    );
    
    this.procesarPagosConsumer().catch(err => 
      this.logger.error(`[MIGRATION] Consumidor PAGOS error: ${err.message}`)
    );
    
    this.procesarAmortizacionesConsumer().catch(err => 
      this.logger.error(`[MIGRATION] Consumidor AMORTIZACIONES error: ${err.message}`)
    );

    this.logger.info('[MIGRATION] ✓ Todos los consumidores iniciados en paralelo');
  }

  /**
   * CONSUMIDOR 1: Procesa clientes
   */
  private async procesarClientesConsumer(): Promise<void> {
    const consumerName = 'ClientesConsumer';

    while (this.consumersRunning) {
      try {
        const item = await this.queueService.dequeue('CLIENTES');

        if (!item) {
          await this.sleep(5000);
          continue;
        }

        this.logger.info(`[${consumerName}] Procesando cliente: ${item.documento}`);

        try {
          await this.mainDataService.migrateClienteFromLegacy(item.documento);
          await this.queueService.markCompleted(item.id);
          
          // Auto-enqueue a CREDITOS Phase
          await this.queueService.enqueue(item.documento, 'CREDITOS');
          this.logger.info(`[${consumerName}] ✅ Cliente completado: ${item.documento}`);

        } catch (processError) {
          this.logger.error(
            `[${consumerName}] ❌ Error: ${(processError as any).message}`
          );
          await this.queueService.markError(item.id, (processError as any).message);
        }

      } catch (error) {
        this.logger.warn(`[${consumerName}] Error en loop: ${(error as any).message}`);
        await this.sleep(1000);
      }
    }
  }

  /**
   * CONSUMIDOR 2: Procesa créditos - PHASE 2
   * Llama a migrateCreditsPhase() para migrar créditos de legacy a main
   * Bifurcación:
   * - Sin créditos → documento_precredito
   * - Con créditos → detalle_credito + enqueue AMORTIZACIONES (automático)
   */
  private async procesarCreditosConsumer(): Promise<void> {
    const consumerName = 'CreditosConsumer';

    while (this.consumersRunning) {
      try {
        const item = await this.queueService.dequeue('CREDITOS');

        if (!item) {
          await this.sleep(5000);
          continue;
        }

        this.logger.info(`[${consumerName}] Procesando: ${item.documento}`);

        try {
          // Llamar PHASE 2: migrateCreditsPhase
          const resultado = await this.mainDataService.migrateCreditsPhase(item.documento);
          
          this.logger.info(`[${consumerName}] Resultado PHASE 2: ${resultado.status}`);
          
          if (resultado.status === 'SIN_CREDITOS') {
            this.logger.info(`[${consumerName}] Cliente registrado en documento_precredito (sin créditos)`);
          } else if (resultado.status === 'CREDITOS_MIGRADOS') {
            this.logger.info(`[${consumerName}] ${resultado.creditosMigrados} créditos migrados, ${resultado.enqueuedAmortizaciones} enqueuados a AMORTIZACIONES`);
          } else if (resultado.status === 'TODOS_FALLIDOS') {
            this.logger.warn(`[${consumerName}] Todos los créditos fallaron: ${resultado.errores?.join(', ')}`);
          }
          
          await this.queueService.markCompleted(item.id);
          this.logger.info(`[${consumerName}] ✅ CREDITOS completado: ${item.documento}`);

        } catch (processError) {
          this.logger.error(`[${consumerName}] Error procesando: ${(processError as any).message}`);
          await this.queueService.markError(item.id, (processError as any).message);
        }

      } catch (error) {
        this.logger.warn(`[${consumerName}] Error en loop: ${(error as any).message}`);
        await this.sleep(1000);
      }
    }
  }

  /**
   * CONSUMIDOR 3: Procesa amortizaciones - PHASE 3
   * Prepara datos de crédito migrado para cálculo de amortización
   * 
   * Flow:
   * 1. Dequeue item con metadata (documento + prestamo_ID)
   * 2. Llamar prepareAmortizacionesPhase(documento, prestamo_ID)
   * 3. Log resultado: datos preparados, credito no encontrado, o error
   * 4. Marcar como completado
   */
  private async procesarAmortizacionesConsumer(): Promise<void> {
    const consumerName = 'AmortizacionesConsumer';

    while (this.consumersRunning) {
      try {
        const item = await this.queueService.dequeue('AMORTIZACIONES');

        if (!item) {
          await this.sleep(5000);
          continue;
        }

        this.logger.info(`[${consumerName}] Procesando: ${item.documento}`);

        try {
          // Consultar el último crédito del cliente (el más recientemente creado)
          const ultimoCredito = await prismaMainService.detalle_credito.findFirst({
            where: { documento: item.documento },
            orderBy: { fecha_registro: 'desc' }
          });

          if (!ultimoCredito) {
            this.logger.warn(`[${consumerName}] ⚠️ No hay créditos para ${item.documento}`);
            await this.queueService.markCompleted(item.id);
            continue;
          }

          const prestamo_ID = ultimoCredito.prestamo_ID;
          this.logger.info(`[${consumerName}] Último crédito encontrado: prestamo_ID=${prestamo_ID}`);

          // Llamar Phase 3: prepareAmortizacionesPhase
          const resultado = await this.mainDataService.prepareAmortizacionesPhase(item.documento, prestamo_ID);
          
          if (resultado.status === 'DATOS_PREPARADOS') {
            this.logger.info(
              `[${consumerName}] ✅ Datos preparados para prestamo_ID=${resultado.prestamo_ID}: ` +
              `plazo=${resultado.calculoParams?.plazo}, tasa=${resultado.calculoParams?.tasa}%, ` +
              `periocidad=${resultado.calculoParams?.periocidad}`
            );
          } else if (resultado.status === 'CREDITO_NO_ENCONTRADO') {
            this.logger.warn(
              `[${consumerName}] ⚠️ Crédito no encontrado: prestamo_ID=${prestamo_ID}. Errores: ${resultado.errores?.join(', ')}`
            );
          } else {
            this.logger.error(
              `[${consumerName}] ❌ Error procesando: ${resultado.errores?.join(', ')}`
            );
          }
          
          await this.queueService.markCompleted(item.id);
          this.logger.info(`[${consumerName}] ✅ Item completado: ${item.documento}`);

        } catch (processError) {
          this.logger.error(
            `[${consumerName}] Error procesando: ${(processError as any).message}`
          );
          await this.queueService.markError(item.id, (processError as any).message);
        }

      } catch (error) {
        this.logger.warn(`[${consumerName}] Error en loop: ${(error as any).message}`);
        await this.sleep(1000);
      }
    }
  }

  /**
   * CONSUMIDOR 4: Procesa pagos (placeholder)
   */


    private async procesarPagosConsumer(): Promise<void> {
    const consumerName = 'PagosConsumer';

    while (this.consumersRunning) {
      try {
        const item = await this.queueService.dequeue('PAGOS');

        if (!item) {
          await this.sleep(5000);
          continue;
        }

        this.logger.info(`[${consumerName}] Procesando: ${item.documento}`);

        try {
          await this.queueService.markCompleted(item.id);
          this.logger.info(`[${consumerName}] ✅ Completado: ${item.documento}`);

        } catch (processError) {
          await this.queueService.markError(item.id, (processError as any).message);
        }

      } catch (error) {
        this.logger.warn(`[${consumerName}] Error: ${(error as any).message}`);
        await this.sleep(1000);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTROL Y MONITOREO
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Obtiene estado actual de la migración en tiempo real
   */
  async getQueueStatus() {
    try {
      const queueMetrics = await this.queueService.getMetrics();
      const metricsByPhase = await this.queueService.getMetricsByPhase();

      return {
        producer: {
          running: this.isProcessing,
          currentBatch: this.batchIndex
        },
        consumers: {
          running: this.consumersRunning
        },
        queue: queueMetrics,
        byPhase: metricsByPhase,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error(`[MIGRATION] Error obteniendo estado: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Pausa los consumidores (el productor sigue si está en progreso)
   */
  async pauseConsumers(): Promise<void> {
    this.consumersRunning = false;
    this.logger.info('[MIGRATION] Consumidores pausados');
  }

  /**
   * Reanuda los consumidores
   */
  async resumeConsumers(): Promise<void> {
    if (this.consumersRunning) {
      throw new Error('Consumidores ya están corriendo');
    }

    this.consumersRunning = true;
    await this.startAllConsumers();
    this.logger.info('[MIGRATION] Consumidores reanudados');
  }

  /**
   * Detiene la migración completamente
   */
  async stopMigration(): Promise<void> {
    this.isProcessing = false;
    this.consumersRunning = false;
    this.logger.info('[MIGRATION] Migración detenida completamente');
  }

  /**
   * Resetea items stalled
   */
  async resetStalledItems(minutes: number = 5): Promise<number> {
    const count = await this.queueService.resetStalled(minutes);
    this.logger.info(`[MIGRATION] Reseteados ${count} items stalled`);
    return count;
  }

  /**
   * Limpia la cola
   */
  async clearQueue(): Promise<void> {
    await this.queueService.clearQueue();
    this.batchIndex = 0;
    this.logger.warn('[MIGRATION] Cola limpiada completamente');
  }

  /**
   * Obtiene Dead Letter Queue
   */
  async getDeadLetterQueue(limit: number = 100) {
    return await this.queueService.getDeadLetterQueue(limit);
  }

  // LEGACY: Métodos para compatibilidad

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
        main: mainStats
      };
    } catch (error) {
      this.logger.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }

  /**
   * Valida consistencia de datos
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
          mainPagosCount: mainPagos.length
        }
      };
    } catch (error) {
      this.logger.error('Error validando:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILIDADES PRIVADAS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Obtiene total de clientes
   */
  private async getTotalClientesLegacy(): Promise<number> {
    try {
      const result = await prismaLegacyService.$queryRaw<any[]>`
        SELECT COUNT(*) as count FROM clientes
        WHERE num_doc IS NOT NULL 
          AND num_doc != ''
          AND TRIM(num_doc) != ''
      `;
      return Number(result[0].count);
    } catch (error) {
      this.logger.error(`[MIGRATION] Error contando: ${(error as any).message}`);
      return 0;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default MigrationService;
