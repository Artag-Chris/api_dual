import { prismaMainService } from '../../database/main/prisma-main.service';
import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

const LEGACY_DB = '`FACIL-2026-03-06`';

/**
 * CommentsAndCallsMigrationService
 * 
 * Consumidor independiente para migrar comentarios desde Legacy a Main
 * Procesa observaciones de precreditos y llamadas como comentarios
 * 
 * Patrón: Singleton
 * Fase: COMENTARIOS_TODO (ejecutado por QueueProcessor)
 * 
 * Flujo:
 * 1. QueueProcessor detecta fase "COMENTARIOS_TODO"
 * 2. Invoca migrateAllCommentsForDocument(documento)
 * 3. Para cada crédito del cliente:
 *    - Extrae observaciones del precredito → comentario [PRECREDITO]
 *    - Extrae llamadas y sus criterios → comentarios ${criterio} ${obs}
 * 4. Inserta todos en UNA transacción
 * 5. Retorna status + cantidades
 */
class CommentsAndCallsMigrationService {
  private static instance: CommentsAndCallsMigrationService;
  private logger = WinstonAdapter;

  private constructor() {}

  public static getInstance(): CommentsAndCallsMigrationService {
    if (!CommentsAndCallsMigrationService.instance) {
      CommentsAndCallsMigrationService.instance = new CommentsAndCallsMigrationService();
    }
    return CommentsAndCallsMigrationService.instance;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * MÉTODO PRINCIPAL - Orquestador Batch
   * ═══════════════════════════════════════════════════════════════════════════
   * 
   * Procesa TODOS los créditos del documento y migra sus comentarios
   * Una transacción por documento (todos los comentarios juntos)
   */
  async migrateAllCommentsForDocument(documento: string): Promise<{
    status: "COMENTARIOS_MIGRADOS" | "SIN_CREDITOS" | "SIN_COMENTARIOS" | "TODOS_FALLIDOS" | "ERROR";
    creditosProcesados?: number;
    comentariosMigrados?: number;
    totalComentarios?: number;
    errores?: string[];
  }> {
    try {

      // 1. Obtener TODOS los créditos del cliente en main.detalle_credito
      const creditosMain = await prismaMainService.detalle_credito.findMany({
        where: { documento },
        select: { prestamo_ID: true }
      });

      if (!creditosMain || creditosMain.length === 0) {
        return {
          status: "SIN_CREDITOS",
          creditosProcesados: 0,
          comentariosMigrados: 0,
          totalComentarios: 0
        };
      }

      this.logger.info(`[COMENTARIOS] 📋 ${creditosMain.length} crédito(s) encontrado(s) para documento=${documento}`);

      // 2. Extraer IDs de créditos
      const prestamoIDs = creditosMain.map(c => c.prestamo_ID);

      // 3. Obtener crédito_id y precredito_id desde legacy para cada prestamo_ID
      const creditosLegacy = await this.getCreditosLegacyByPrestamoIds(prestamoIDs);

      if (!creditosLegacy || creditosLegacy.length === 0) {
        this.logger.warn(`[COMENTARIOS] ⚠️ No se encontraron relaciones en legacy para los prestamoIDs=${prestamoIDs.join(',')}`);
        return {
          status: "SIN_COMENTARIOS",
          creditosProcesados: 0,
          comentariosMigrados: 0,
          totalComentarios: 0
        };
      }

      // 4. Procesar cada crédito: extraer observaciones y llamadas
      const allComments: any[] = [];
      const errores: string[] = [];
      let creditosProcesados = 0;

      for (const creditoLegacy of creditosLegacy) {
        try {

          // 4a. Obtener observaciones del precredito
          if (creditoLegacy.precredito_id) {
            try {
              const precreditoData = await this.getPrecreditoObservaciones(creditoLegacy.precredito_id);

              if (precreditoData && precreditoData.observaciones) {
                const commentText = this.formatCommentFromPrecredito(precreditoData.observaciones);
                allComments.push({
                  documento,
                  comentario: commentText,
                  tipo: 'MIGRACION',
                  creador: null,
                  fecha_registro: new Date()
                });
                this.logger.debug(`[COMENTARIOS] ✅ Observación precredito extraída para precredito_id=${creditoLegacy.precredito_id}`);
              }
            } catch (precreditoError) {
              const msg = precreditoError instanceof Error ? precreditoError.message : String(precreditoError);
              this.logger.warn(`[COMENTARIOS] ⚠️ Error extractando observaciones precredito (id=${creditoLegacy.precredito_id}): ${msg}`);
              errores.push(`Precredito ${creditoLegacy.precredito_id}: ${msg}`);
            }
          }

          // 4b. Obtener llamadas del crédito
          try {
            const llamadas = await this.getLlamadasByCreditoId(creditoLegacy.id);

            if (llamadas && llamadas.length > 0) {
              // Extraer IDs de criterios únicos
              const criterioIds = [...new Set(llamadas.map(l => l.criterio_id).filter(id => id))];

              // 4c. Obtener criterios (batch lookup)
              const criterios = criterioIds.length > 0 
                ? await this.getCriterioBatch(criterioIds)
                : [];

              // Crear mapa de criterios para búsqueda rápida
              const criterioMap = new Map(criterios.map(c => [c.id, c.criterio]));

              // 4d. Mapear cada llamada a comentario
              for (const llamada of llamadas) {
                if (llamada.observaciones) {
                  const criterioNombre = criterioMap.get(llamada.criterio_id) || `Criterio ${llamada.criterio_id}`;
                  const commentText = this.formatCommentFromLlamada(criterioNombre, llamada.observaciones);

                  allComments.push({
                    documento,
                    comentario: commentText,
                    tipo: 'MIGRACION',
                    creador: null,
                    fecha_registro: new Date()
                  });
                }
              }

              this.logger.debug(`[COMENTARIOS] ✅ ${llamadas.length} llamada(s) procesada(s) para credito_id=${creditoLegacy.id}`);
            }
          } catch (llamadasError) {
            const msg = llamadasError instanceof Error ? llamadasError.message : String(llamadasError);
            this.logger.warn(`[COMENTARIOS] ⚠️ Error extractando llamadas (credito_id=${creditoLegacy.id}): ${msg}`);
            errores.push(`Llamadas credito ${creditoLegacy.id}: ${msg}`);
          }

          creditosProcesados++;

        } catch (creditoError) {
          const errorMsg = creditoError instanceof Error ? creditoError.message : String(creditoError);
          this.logger.warn(`[COMENTARIOS] ❌ Error procesando crédito: ${errorMsg}`);
          errores.push(errorMsg);
        }
      }

      // 5. Si no hay comentarios, retornar
      if (allComments.length === 0) {
        this.logger.info(`[COMENTARIOS] ℹ️ ${creditosProcesados} crédito(s) procesado(s) pero sin comentarios generados`);
        return {
          status: "SIN_COMENTARIOS",
          creditosProcesados,
          comentariosMigrados: 0,
          totalComentarios: 0
        };
      }

      // 6. Insertar todos los comentarios en UNA transacción
      try {
        const createdComments = await prismaMainService.$transaction(async (tx) => {
          return await tx.comentarios.createMany({
            data: allComments,
            skipDuplicates: false
          });
        });

        this.logger.info(`[COMENTARIOS] ✅ ${createdComments.count} comentarios migrados para documento=${documento}`);

        if (creditosProcesados === 0) {
          return {
            status: "TODOS_FALLIDOS",
            creditosProcesados,
            comentariosMigrados: 0,
            totalComentarios: 0,
            errores
          };
        }

        return {
          status: "COMENTARIOS_MIGRADOS",
          creditosProcesados,
          comentariosMigrados: createdComments.count,
          totalComentarios: createdComments.count
        };

      } catch (txError) {
        const txMsg = txError instanceof Error ? txError.message : String(txError);
        this.logger.error(`[COMENTARIOS] ❌ Error en transacción de comentarios: ${txMsg}`);
        errores.push(`Transaction error: ${txMsg}`);
        return {
          status: "ERROR",
          creditosProcesados,
          comentariosMigrados: 0,
          totalComentarios: 0,
          errores
        };
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[COMENTARIOS] ❌ Error fatal en migrateAllCommentsForDocument: ${errorMsg}`);
      return {
        status: "ERROR",
        totalComentarios: 0,
        errores: [errorMsg]
      };
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * HELPERS - Queries a Legacy
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   * Obtiene credito_id y precredito_id desde legacy.creditos
   */
  private async getCreditosLegacyByPrestamoIds(prestamoIds: number[]): Promise<any[]> {
    try {
      if (!prestamoIds || prestamoIds.length === 0) {
        return [];
      }

      const result = await prismaLegacyService.$queryRawUnsafe<any[]>(`
        SELECT id, precredito_id
        FROM ${LEGACY_DB}.creditos
        WHERE CAST(id AS UNSIGNED) IN (${prestamoIds.join(',')})
      `);

      return result || [];
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[QUERY] ⚠️ Error en getCreditosLegacyByPrestamoIds: ${msg}`);
      return [];
    }
  }

  /**
   * Obtiene observaciones del precredito desde legacy.precreditos
   */
  private async getPrecreditoObservaciones(precreditoId: number): Promise<any> {
    try {
      const result = await prismaLegacyService.$queryRawUnsafe<any[]>(`
        SELECT id, observaciones
        FROM ${LEGACY_DB}.precreditos
        WHERE CAST(id AS UNSIGNED) = ${precreditoId}
        LIMIT 1
      `);

      return result && result.length > 0 ? result[0] : null;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[QUERY] ⚠️ Error en getPrecreditoObservaciones (id=${precreditoId}): ${msg}`);
      return null;
    }
  }

  /**
   * Obtiene todas las llamadas de un crédito desde legacy.llamadas
   */
  private async getLlamadasByCreditoId(creditoId: number): Promise<any[]> {
    try {
      const result = await prismaLegacyService.$queryRawUnsafe<any[]>(`
        SELECT id, criterio_id, observaciones, created_at
        FROM ${LEGACY_DB}.llamadas
        WHERE CAST(credito_id AS UNSIGNED) = ${creditoId}
      `);

      return result || [];
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[QUERY] ⚠️ Error en getLlamadasByCreditoId (credito_id=${creditoId}): ${msg}`);
      return [];
    }
  }

  /**
   * Obtiene criterios por batch desde legacy.criterios
   */
  private async getCriterioBatch(criterioIds: number[]): Promise<any[]> {
    try {
      if (!criterioIds || criterioIds.length === 0) {
        return [];
      }

      const result = await prismaLegacyService.$queryRawUnsafe<any[]>(`
        SELECT id, criterio
        FROM ${LEGACY_DB}.criterios
        WHERE CAST(id AS UNSIGNED) IN (${criterioIds.join(',')})
      `);

      return result || [];
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[QUERY] ⚠️ Error en getCriterioBatch: ${msg}`);
      return [];
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * HELPERS - Formateo de Comentarios
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   * Formatea comentario desde observación de precredito
   */
  private formatCommentFromPrecredito(observaciones: string): string {
    const obs = String(observaciones || '').trim();
    if (!obs) return '';
    return `[PRECREDITO] ${obs}`;
  }

  /**
   * Formatea comentario desde observación de llamada
   */
  private formatCommentFromLlamada(criterio: string, observaciones: string): string {
    const crit = String(criterio || '').trim();
    const obs = String(observaciones || '').trim();
    if (!crit || !obs) return '';
    return `${crit} ${obs}`;
  }
}

export default CommentsAndCallsMigrationService;
