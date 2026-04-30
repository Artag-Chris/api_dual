import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import { prismaMainService } from '../../database/main/prisma-main.service';
import LegacyDataService from '../legacy-data/legacy-data.service';
import MainDataService from '../main-data/main-data.service';
import QueueService from '../../domain/class/queue.service';
import CommentsAndCallsMigrationService from '../../domain/class/comments-and-calls-migration.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

/**
 * ✅ Servicio de Migración con Sistema de Colas FIFO
 * 
 * Características:
 * - Procesa 32k clientes en batches automáticos
 * - Utiliza colas persistentes en BD (migration_queue)
 * - Múltiples consumidores (6) en paralelo sin interferer
 * - Reintenta automáticamente en caso de error (máx 3)
 * - Patrón Singleton
 * 
 * Arquitectura de Flujo (Encadenado):
 * PRODUCTOR: Obtiene clientes de LEGACY en batches → enqueue a CLIENTES
 * 
 * Rama 1 (Clientes):
 * CONSUMIDOR 1: Dequeue CLIENTES → migrateClienteFromLegacy() → enqueue CREDITOS
 * 
 * Rama 2 (Créditos):
 * CONSUMIDOR 2: Dequeue CREDITOS → migrateCreditsPhase() → enqueue AMORTIZACIONES_TODO
 * 
 * Rama 3 (Amortizaciones):
 * CONSUMIDOR 3: Dequeue AMORTIZACIONES_TODO → migrateAmortizacionesPhase() → enqueue AMPLIAR_PAGO
 * 
 * Rama 4 (Pagos - Paralela):
 * CONSUMIDOR 4: Dequeue PAGOS_TODO → migratePaymentHistoryPhase() → Final
 * 
 * Rama 5 (Ampliar Pago):
 * CONSUMIDOR 5: Dequeue AMPLIAR_PAGO → procesar → enqueue GASTOS_CARTERA
 * 
 * Rama 6 (Gastos de Cartera - Final):
 * CONSUMIDOR 6: Dequeue GASTOS_CARTERA → procesar → Final
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
            
            // Query optimizada: Obtiene documentos de clientes con créditos activos/mora
            const batch = await prismaLegacyService.$queryRaw<any[]>`
              SELECT CAST(c.num_doc AS CHAR) as documento
              FROM clientes c
              WHERE c.id IN (
                SELECT DISTINCT c.id
                FROM clientes c
                INNER JOIN precreditos pr ON pr.cliente_id = c.id
                INNER JOIN creditos cr ON cr.precredito_id = pr.id
                WHERE c.num_doc IS NOT NULL 
                  AND CHAR_LENGTH(TRIM(c.num_doc)) > 0
                  AND cr.estado IN ('Al día', 'Mora', 'Prejurídico', 'Jurídico')
              )
              ORDER BY c.id ASC
              LIMIT ${batchSize}
              OFFSET ${skip}
            `;
            
            
            // QUERY ANTERIOR (archivada):
            // Esta query simple obtenía TODOS los documentos sin filtrar por créditos
            
            // const batch = await prismaLegacyService.$queryRaw<any[]>`
            //   SELECT CAST(num_doc AS CHAR) as documento
            //   FROM clientes
            //   WHERE num_doc IS NOT NULL 
            //     AND num_doc != ''
            //     AND TRIM(num_doc) != ''
            //   ORDER BY id ASC
            //   LIMIT ${batchSize}
            //   OFFSET ${skip} 
            // `;
            
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
    
    this.procesarAmortizacionesTodoConsumer().catch(err => 
      this.logger.error(`[MIGRATION] Consumidor AMORTIZACIONES_TODO error: ${err.message}`)
    );
    
    this.procesarPagosTodoConsumer().catch(err => 
      this.logger.error(`[MIGRATION] Consumidor PAGOS_TODO error: ${err.message}`)
    );

    this.procesarComentariosTodoConsumer().catch(err => 
      this.logger.error(`[MIGRATION] Consumidor COMENTARIOS_TODO error: ${err.message}`)
    );

    // 🔴 DESHABILITADO: Consumidores AMPLIAR_PAGO y GASTOS_CARTERA comentados por ahora
    // this.procesarAmplarPagoConsumer().catch(err => 
    //   this.logger.error(`[MIGRATION] Consumidor AMPLIAR_PAGO error: ${err.message}`)
    // );
    
    // this.procesarGastosCarteraConsumer().catch(err => 
    //   this.logger.error(`[MIGRATION] Consumidor GASTOS_CARTERA error: ${err.message}`)
    // );

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


        try {
          // Llamar PHASE 2: migrateCreditsPhase
          const resultado = await this.mainDataService.migrateCreditsPhase(item.documento);
          
          // this.logger.info(`[${consumerName}] Resultado PHASE 2: ${resultado.status}`);
          
          if (resultado.status === 'SIN_CREDITOS') {
            // this.logger.info(`[${consumerName}] Cliente registrado en documento_precredito (sin créditos)`);
          } else if (resultado.status === 'CREDITOS_MIGRADOS') {
            this.logger.info(`[${consumerName}] ${resultado.creditosMigrados} créditos migrados, ${resultado.enqueuedAmortizaciones} enqueuados a AMORTIZACIONES`);
          } else if (resultado.status === 'TODOS_FALLIDOS') {
            this.logger.warn(`[${consumerName}] Todos los créditos fallaron: ${resultado.errores?.join(', ')}`);
          }
          
          await this.queueService.markCompleted(item.id);
          // this.logger.info(`[${consumerName}] ✅ CREDITOS completado: ${item.documento}`);

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
   * CONSUMIDOR 3: Procesa amortizaciones - PHASE 3B
   * Calcula e inserta amortizaciones para TODOS los créditos de un cliente
   * 
   * Flow:
   * 1. Dequeue item de AMORTIZACIONES_TODO con documento
   * 2. Validar documento (string, no vacío)
   * 3. Llamar migrateAmortizacionesPhase(documento) - procesará todos los créditos del cliente
   * 4. Log resultado: amortizaciones creadas, sin créditos, o error
   * 5. Marcar como completado
   */
  private async procesarAmortizacionesTodoConsumer(): Promise<void> {
    const consumerName = 'AmortizacionesTodoConsumer';
    let heartbeatCounter = 0;

    while (this.consumersRunning) {
      try {
        // Heartbeat logging cada 10 iteraciones (aprox cada 50s)
        heartbeatCounter++;
        if (heartbeatCounter % 10 === 0) {
          this.logger.debug(`[${consumerName}] ♥️ Consumer activo, esperando items en AMORTIZACIONES_TODO...`);
        }

        const item = await this.queueService.dequeue('AMORTIZACIONES_TODO');

        if (!item) {
          await this.sleep(1000);
          continue;
        }

        this.logger.info(`[${consumerName}] 📦 Item recibido: documento=${item.documento}`);

        try {
          // Validar que item.documento es string válido
          if (!item.documento || String(item.documento).trim() === '') {
            throw new Error(`documento vacío o inválido`);
          }
          
          const documento = String(item.documento).trim();
          this.logger.info(`[${consumerName}] Iniciando migrateAmortizacionesPhase para documento=${documento}`);

          // Llamar Phase 3B: migrateAmortizacionesPhase con documento
          const resultado = await this.mainDataService.migrateAmortizacionesPhase(documento);
          
          if (resultado.status === 'AMORTIZACIONES_Y_SANCIONES_CREADAS') {
            this.logger.info(
              `[${consumerName}] ✅ Phase 3B completado para documento=${documento}: ` +
              `${resultado.creditosProcesados} crédito(s), ${resultado.totalAmortizaciones} amortizaciones creadas`
            );
          } else if (resultado.status === 'SIN_CREDITOS') {
            this.logger.info(`[${consumerName}] ℹ️ Sin créditos para documento=${documento}`);
          } else if (resultado.status === 'TODOS_FALLIDOS') {
            this.logger.warn(
              `[${consumerName}] ⚠️ Todos los créditos fallaron para documento=${documento}. Errores: ${resultado.errores?.join(', ')}`
            );
          } else {
            this.logger.error(
              `[${consumerName}] ❌ Error procesando documento=${documento}: ${resultado.errores?.join(', ')}`
            );
          }
          
          await this.queueService.markCompleted(item.id);
          this.logger.info(`[${consumerName}] ✅ Item completado: documento=${documento}`);

          // 🔴 DESHABILITADO: Enqueue a AMPLIAR_PAGO comentado por ahora
          // await this.queueService.enqueue(item.documento, 'AMPLIAR_PAGO');
          // this.logger.info(`[${consumerName}] 📤 Enqueued a AMPLIAR_PAGO: documento=${documento}`);

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
   * CONSUMIDOR 4: Procesa pagos - PHASE 4
   * Migra historial de pagos para TODOS los créditos de un cliente
   * 
   * Flow:
   * 1. Dequeue item de PAGOS_TODO con documento
   * 2. Validar documento (string, no vacío)
   * 3. Llamar migratePaymentHistoryPhase(documento) - procesará todos los créditos del cliente
   * 4. Log resultado: pagos migrados, sin créditos, sin pagos, o error
   * 5. Marcar como completado
   */
  private async procesarPagosTodoConsumer(): Promise<void> {
    const consumerName = 'PagosConsumer';
    let heartbeatCounter = 0;

    while (this.consumersRunning) {
      try {
        // Heartbeat logging cada 10 iteraciones
        heartbeatCounter++;
        if (heartbeatCounter % 10 === 0) {
          this.logger.debug(`[${consumerName}] Consumer activo, esperando items en PAGOS_TODO...`);
        }

        const item = await this.queueService.dequeue('PAGOS_TODO');

        if (!item) {
          await this.sleep(1000);
          continue;
        }

        this.logger.info(`[${consumerName}] 📦 Item recibido: documento=${item.documento}`);

        try {
          // Validar que item.documento es string válido
          if (!item.documento || String(item.documento).trim() === '') {
            throw new Error(`documento vacío o inválido`);
          }
          
          const documento = String(item.documento).trim();
          this.logger.info(`[${consumerName}] Iniciando migratePaymentHistoryPhase para documento=${documento}`);

          // Llamar Phase 4: migratePaymentHistoryPhase con documento
          const resultado = await this.mainDataService.migratePaymentHistoryPhase(documento);
          
          if (resultado.status === 'PAGOS_MIGRADOS') {
            this.logger.info(
              `[${consumerName}] ✅ Phase 4 completado para documento=${documento}: ` +
              `${resultado.creditosProcesados} crédito(s), ${resultado.totalPagos} pagos migrados`
            );
          } else if (resultado.status === 'SIN_CREDITOS') {
            this.logger.info(`[${consumerName}] ℹ️ Sin créditos para documento=${documento}`);
          } else if (resultado.status === 'SIN_PAGOS') {
            this.logger.info(
              `[${consumerName}] ℹ️ Sin pagos encontrados para documento=${documento} (${resultado.creditosProcesados} crédito(s) procesado(s))`
            );
          } else if (resultado.status === 'TODOS_FALLIDOS') {
            this.logger.warn(
              `[${consumerName}] ⚠️ Todos los créditos fallaron para documento=${documento}. Errores: ${resultado.errores?.join(', ')}`
            );
          } else {
            this.logger.error(
              `[${consumerName}] ❌ Error procesando documento=${documento}: ${resultado.errores?.join(', ')}`
            );
          }
          
          await this.queueService.markCompleted(item.id);
          this.logger.info(`[${consumerName}] ✅ Item completado: documento=${documento}`);

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
   * CONSUMIDOR 5: Procesa comentarios - FASE COMENTARIOS
   * Migra observaciones de precreditos y llamadas como comentarios
   * 
   * Flow:
   * 1. Dequeue item de COMENTARIOS_TODO con documento
   * 2. Validar documento (string, no vacío)
   * 3. Llamar migrateAllCommentsForDocument(documento) - procesará todos los créditos del cliente
   * 4. Log resultado: comentarios migrados, sin créditos, sin comentarios, o error
   * 5. Marcar como completado
   */
  private async procesarComentariosTodoConsumer(): Promise<void> {
    const consumerName = 'ComentariosConsumer';
    let heartbeatCounter = 0;

    while (this.consumersRunning) {
      try {
        // Heartbeat logging cada 10 iteraciones
        heartbeatCounter++;
        if (heartbeatCounter % 10 === 0) {
          this.logger.debug(`[${consumerName}] ♥️ Consumer activo, esperando items en COMENTARIOS_TODO...`);
        }

        const item = await this.queueService.dequeue('COMENTARIOS_TODO');

        if (!item) {
          await this.sleep(1000);
          continue;
        }

        this.logger.info(`[${consumerName}] 📦 Item recibido: documento=${item.documento}`);

        try {
          // Validar que item.documento es string válido
          if (!item.documento || String(item.documento).trim() === '') {
            throw new Error(`documento vacío o inválido`);
          }
          
          const documento = String(item.documento).trim();
          this.logger.info(`[${consumerName}] Iniciando migrateAllCommentsForDocument para documento=${documento}`);

          // Llamar FASE COMENTARIOS: migrateAllCommentsForDocument con documento
          const resultado = await CommentsAndCallsMigrationService.getInstance().migrateAllCommentsForDocument(documento);
          
          if (resultado.status === 'COMENTARIOS_MIGRADOS') {
            this.logger.info(
              `[${consumerName}] ✅ Comentarios completado para documento=${documento}: ` +
              `${resultado.creditosProcesados} crédito(s), ${resultado.totalComentarios} comentarios migrados`
            );
          } else if (resultado.status === 'SIN_CREDITOS') {
            this.logger.info(`[${consumerName}] ℹ️ Sin créditos para documento=${documento}`);
          } else if (resultado.status === 'SIN_COMENTARIOS') {
            this.logger.info(
              `[${consumerName}] ℹ️ Sin comentarios encontrados para documento=${documento} (${resultado.creditosProcesados} crédito(s) procesado(s))`
            );
          } else if (resultado.status === 'TODOS_FALLIDOS') {
            this.logger.warn(
              `[${consumerName}] ⚠️ Todos los créditos fallaron para documento=${documento}. Errores: ${resultado.errores?.join(', ')}`
            );
          } else {
            this.logger.error(
              `[${consumerName}] ❌ Error procesando documento=${documento}: ${resultado.errores?.join(', ')}`
            );
          }
          
          await this.queueService.markCompleted(item.id);
          this.logger.info(`[${consumerName}] ✅ Item completado: documento=${documento}`);

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
   * CONSUMIDOR 6: Procesa ampliar pagos - PHASE 6
   * 🔴 DESHABILITADO POR AHORA
   * 
   * Flow:
   * 1. Dequeue item de AMPLIAR_PAGO con documento
   * 2. Validar documento (string, no vacío)
   * 3. Procesar ampliar pago
   * 4. Marcar como completado o error
   * 5. Auto-enqueue a GASTOS_CARTERA
   */
  /*
  private async procesarAmplarPagoConsumer(): Promise<void> {
    const consumerName = 'AmplarPagoConsumer';
    let heartbeatCounter = 0;

    while (this.consumersRunning) {
      try {
        // Heartbeat logging cada 10 iteraciones
        heartbeatCounter++;
        if (heartbeatCounter % 10 === 0) {
          this.logger.debug(`[${consumerName}] Consumer activo, esperando items en AMPLIAR_PAGO...`);
        }

        const item = await this.queueService.dequeue('AMPLIAR_PAGO');

        if (!item) {
          await this.sleep(1000);
          continue;
        }

        this.logger.info(`[${consumerName}] 📦 Item recibido: documento=${item.documento}`);

        try {
          // Validar que item.documento es string válido
          if (!item.documento || String(item.documento).trim() === '') {
            throw new Error(`documento vacío o inválido`);
          }
          
          const documento = String(item.documento).trim();
          this.logger.info(`[${consumerName}] Iniciando PHASE 5 - Ampliar Pago para documento=${documento}`);

  // TODO: Implementar lógica de ampliar pago
          // Actualmente solo marca como completado
          
          await this.queueService.markCompleted(item.id);
          
          // Auto-enqueue a GASTOS_CARTERA Phase
          await this.queueService.enqueue(item.documento, 'GASTOS_CARTERA');
          this.logger.info(`[${consumerName}] ✅ PHASE 5 completado - Enqueued a GASTOS_CARTERA: documento=${documento}`);

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
   * CONSUMIDOR 6: Procesa gastos de cartera - PHASE 6
   * 🔴 DESHABILITADO POR AHORA
   * 
   * Flow:
   * 1. Dequeue item de GASTOS_CARTERA con documento
   * 2. Validar documento (string, no vacío)
   * 3. Procesar gastos de cartera
   * 4. Marcar como completado o error
   */
  /*
  private async procesarGastosCarteraConsumer(): Promise<void> {
    const consumerName = 'GastosCarteraConsumer';
    let heartbeatCounter = 0;

    while (this.consumersRunning) {
      try {
        // Heartbeat logging cada 10 iteraciones
        heartbeatCounter++;
        if (heartbeatCounter % 10 === 0) {
          this.logger.debug(`[${consumerName}] Consumer activo, esperando items en GASTOS_CARTERA...`);
        }

        const item = await this.queueService.dequeue('GASTOS_CARTERA');

        if (!item) {
          await this.sleep(1000);
          continue;
        }

        this.logger.info(`[${consumerName}] 📦 Item recibido: documento=${item.documento}`);

        try {
          // Validar que item.documento es string válido
          if (!item.documento || String(item.documento).trim() === '') {
            throw new Error(`documento vacío o inválido`);
          }
          
          const documento = String(item.documento).trim();
          this.logger.info(`[${consumerName}] Iniciando procesamiento para documento=${documento}`);

          // TODO: Implementar lógica de gastos de cartera
          // Por ahora solo marcamos como completado
          
          await this.queueService.markCompleted(item.id);
          this.logger.info(`[${consumerName}] ✅ Item completado: documento=${documento}`);

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

  */

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
  
  // private async getTotalClientesLegacy(): Promise<number> {
    
  //   try {
  //     // Query optimizada: Cuenta solo clientes con créditos activos/mora
  //     const result = await prismaLegacyService.$queryRaw<any[]>`
  //       SELECT COUNT(DISTINCT c.id) as count
  //       FROM clientes c
  //       INNER JOIN precreditos pr ON pr.cliente_id = c.id
  //       INNER JOIN creditos cr ON cr.precredito_id = pr.id
  //       WHERE c.num_doc IS NOT NULL 
  //         AND CHAR_LENGTH(TRIM(c.num_doc)) > 0
  //         AND cr.estado IN ('Al día', 'Mora', 'Prejurídico', 'Jurídico')
  //     `;
  //     return Number(result[0].count);
  //   } catch (error) {
  //     this.logger.error(`[MIGRATION] Error contando: ${(error as any).message}`);
  //     return 0;
  //   }
  // }
    
  
  // QUERY ANTERIOR (archivada):
  // Esta query simple contaba TODOS los clientes con documento, sin filtrar por créditos
  
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
  

  /* 
  SELECT COUNT(DISTINCT c.id) as count
FROM clientes c
INNER JOIN precreditos pr ON pr.cliente_id = c.id
INNER JOIN creditos cr ON cr.precredito_id = pr.id
WHERE c.num_doc IS NOT NULL 
  AND CHAR_LENGTH(TRIM(c.num_doc)) > 0
  AND cr.estado IN ('Al día', 'Mora', 'Prejurídico', 'Jurídico')

//arreglar limit and offset 
SELECT CAST(c.num_doc AS CHAR) as documento
FROM clientes c
WHERE c.id IN (
  SELECT DISTINCT c.id
  FROM clientes c
  INNER JOIN precreditos pr ON pr.cliente_id = c.id
  INNER JOIN creditos cr ON cr.precredito_id = pr.id
  WHERE c.num_doc IS NOT NULL 
    AND CHAR_LENGTH(TRIM(c.num_doc)) > 0
    AND cr.estado IN ('Al día', 'Mora', 'Prejurídico', 'Jurídico')
)
ORDER BY c.id ASC



  */

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * CONSUMIDOR 4: Procesa historial de pagos - PHASE 4
   * Migra facturas legacy a historial_pagos main
   * 
   * Flow:
   * 1. Dequeue item con prestamo_ID
   * 2. Llamar migratePaymentHistoryPhase(prestamo_ID)
   * 3. Log resultado: pagos migrados o sin pagos
   * 4. Marcar como completado
   */
  /**
   * DEPRECATED: Legacy consumer - functionality moved to procesarPagosTodoConsumer
   * This method is kept as a stub for backwards compatibility
   */
  private async procesarHistorialPagosConsumer(): Promise<void> {
    // Deprecated: all functionality has been integrated into procesarPagosTodoConsumer
    // This consumer is no longer called, but kept for backwards compatibility
    while (this.consumersRunning) {
      await this.sleep(60000); // Sleep indefinitely - not used anymore
    }
  }
}

export default MigrationService;
