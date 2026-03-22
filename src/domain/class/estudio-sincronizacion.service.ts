import { prismaMainService } from '../../database/main/prisma-main.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

class EstudioSincronizacionService {
  private static instance: EstudioSincronizacionService;
  private logger = WinstonAdapter;

  private constructor() {}

  public static getInstance(): EstudioSincronizacionService {
    if (!EstudioSincronizacionService.instance) {
      EstudioSincronizacionService.instance = new EstudioSincronizacionService();
    }
    return EstudioSincronizacionService.instance;
  }

  /**
   * Sincroniza creadores: detalle_credito.creador → estudio_de_credito.creador
   * + Crea registros en estudios_realizados con defaults
   * TODO en UN CICLO
   */
  async sincronizarTodos(): Promise<void> {
    try {
      this.logger.info(
        '[ESTUDIO-SYNC] 🔍 INICIANDO SINCRONIZACIÓN DE CRÉDITOS Y CREACIÓN DE ESTUDIOS'
      );

      // 1. Pre-cargar mapeo: documento → creador de detalle_credito
      const detalleCreditos = await prismaMainService.detalle_credito.findMany({
        select: {
          documento: true,
          creador: true,
        },
      });

      this.logger.info(
        `[ESTUDIO-SYNC] 📋 Se encontraron ${detalleCreditos.length} créditos totales`
      );

      // 2. Pre-cargar estudio_de_credito existentes
      const estudiosExistentes = await prismaMainService.estudio_de_credito.findMany(
        {
          select: {
            documento: true,
            id: true,
            creador: true,
          },
        }
      );

      const estudiosMap = new Map(
        estudiosExistentes.map((e) => [e.documento, e as any])
      );

      this.logger.info(
        `[ESTUDIO-SYNC] 📚 Se cargaron ${estudiosExistentes.length} estudios existentes`
      );

      let actualizados = 0;
      let creados = 0;
      let sinEstudio = 0;
      let conErrores = 0;

      // 3. Procesar cada crédito
      for (const detalle of detalleCreditos) {
        try {
          const documento = detalle.documento?.trim() || '';

          if (!documento) {
            continue;
          }

          // Convertir STRING a INT: "123" → 123
          const creadorInt = this.convertCreadorStringToInt(detalle.creador);

          // Verificar si estudio existe
          const estudioExistente = estudiosMap.get(documento);

          if (estudioExistente) {
            // Actualizar estudio_de_credito.creador
            await prismaMainService.estudio_de_credito.update({
              where: { documento },
              data: {
                creador: creadorInt,
              },
            });

            actualizados++;
            this.logger.info(
              `[ESTUDIO-SYNC] ✅ Estudio ${documento}: creador actualizado → ${creadorInt} (de: "${detalle.creador}")`
            );

            // Crear estudio realizado si no existe
            try {
              await prismaMainService.estudios_realizados.create({
                data: {
                  documento,
                  cupo: '0',
                  cupoDisponible: '0',
                  tasa: 2,
                  plazo: 0,
                  creditos_activos: 0,
                  creditos_maximos: 2,
                  pagare: 'NO',
                  desembolso: 'NO',
                  observacion: 'MIGRADO',
                },
              });

              creados++;
              this.logger.info(
                `[ESTUDIO-SYNC] 🆕 Estudio Realizado creado para documento: ${documento}`
              );
            } catch (createError) {
              // Si ya existe (UNIQUE constraint), solo informar
              if (
                createError instanceof Error &&
                createError.message.includes('Unique constraint failed')
              ) {
                this.logger.info(
                  `[ESTUDIO-SYNC] ℹ️ Estudio realizado ya existe para ${documento}`
                );
              } else {
                throw createError;
              }
            }
          } else {
            sinEstudio++;
            this.logger.warn(
              `[ESTUDIO-SYNC] ⚠️ Crédito ${documento}: NO tiene estudio_de_credito`
            );
          }
        } catch (creditoError) {
          conErrores++;
          const msg =
            creditoError instanceof Error
              ? creditoError.message
              : String(creditoError);
          this.logger.error(
            `[ESTUDIO-SYNC] ❌ Error procesando crédito ${detalle.documento}: ${msg}`
          );
        }
      }

      // 4. Resumen
      this.logger.info('[ESTUDIO-SYNC] 📊 ===== SINCRONIZACIÓN COMPLETADA =====');
      this.logger.info(`[ESTUDIO-SYNC] ✅ Estudios actualizados: ${actualizados}`);
      this.logger.info(`[ESTUDIO-SYNC] 🆕 Estudios realizados creados: ${creados}`);
      this.logger.info(`[ESTUDIO-SYNC] ⚠️ Créditos sin estudio: ${sinEstudio}`);
      this.logger.info(`[ESTUDIO-SYNC] ❌ Errores: ${conErrores}`);
      this.logger.info('[ESTUDIO-SYNC] ============================================');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[ESTUDIO-SYNC] ❌ Error fatal: ${msg}`);
      throw error;
    }
  }

  /**
   * Convierte creador STRING a INT
   * "123" → 123
   * "1" → 1
   * null/invalid → null
   */
  private convertCreadorStringToInt(
    creadorString: string | null
  ): number | null {
    if (!creadorString) {
      return null;
    }

    try {
      const trimmed = creadorString.trim();
      const parsed = parseInt(trimmed, 10);

      if (isNaN(parsed)) {
        this.logger.warn(
          `[ESTUDIO-SYNC] ⚠️ No se pudo convertir creador: "${creadorString}" → NaN`
        );
        return null;
      }

      return parsed;
    } catch (err) {
      this.logger.warn(
        `[ESTUDIO-SYNC] ⚠️ Error convirtiendo creador: "${creadorString}"`
      );
      return null;
    }
  }
}

export default EstudioSincronizacionService;
