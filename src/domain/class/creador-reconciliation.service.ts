import { prismaMainService } from '../../database/main/prisma-main.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

class CreadorReconciliationService {
  private static instance: CreadorReconciliationService;
  private logger = WinstonAdapter;
  private readonly SIMILARITY_THRESHOLD = 0.7;

  private constructor() {}

  public static getInstance(): CreadorReconciliationService {
    if (!CreadorReconciliationService.instance) {
      CreadorReconciliationService.instance = new CreadorReconciliationService();
    }
    return CreadorReconciliationService.instance;
  }

  /**
   * Reconcilia TODOS los creadores de créditos
   * Lee cada creador (nombre), busca el usuario en user_admin, guarda el ID
   */
  async reconcileAllCreditos(): Promise<void> {
    try {
      this.logger.info(
        '[CREADOR] 🔍 INICIANDO RECONCILIACIÓN DE CREADORES EN CRÉDITOS'
      );

      // 1. Obtener todos los créditos con creador
      const creditos = await prismaMainService.detalle_credito.findMany({
        select: {
          prestamo_ID: true,
          documento: true,
          creador: true,
        },
      });

      this.logger.info(
        `[CREADOR] 📋 Se encontraron ${creditos.length} créditos totales`
      );

      // 2. Pre-cargar todos los usuarios admin
      const usuariosAdmin = await prismaMainService.user_admin.findMany({
        select: {
          id: true,
          nombre_completo: true,
          nombre: true,
          estado: true,
        },
      });

      this.logger.info(
        `[CREADOR] 👥 Se cargaron ${usuariosAdmin.length} usuarios de admin`
      );

      let actualizados = 0;
      let noEncontrados = 0;
      let conErrores = 0;

      // 3. Procesar cada crédito
      for (const credito of creditos) {
        try {
          const creadorActual = credito.creador?.trim() || '';

          if (!creadorActual || creadorActual === 'EN PROCESO') {
            continue;
          }

          // Buscar usuario por nombre
          const usuarioEncontrado = this.findBestMatchUser(
            creadorActual,
            usuariosAdmin
          );

          if (usuarioEncontrado) {
            // Actualizar crédito con ID del usuario
            await prismaMainService.detalle_credito.update({
              where: { prestamo_ID: credito.prestamo_ID },
              data: {
                creador: String(usuarioEncontrado.id),
              },
            });

            actualizados++;
            this.logger.info(
              `[CREADOR] ✅ Crédito ${credito.prestamo_ID}: "${creadorActual}" → ID ${usuarioEncontrado.id} (${usuarioEncontrado.nombre_completo} - ${usuarioEncontrado.estado})`
            );
          } else {
            noEncontrados++;
            this.logger.warn(
              `[CREADOR] ⚠️ Crédito ${credito.prestamo_ID}: No encontrado "${creadorActual}"`
            );
          }
        } catch (creditoError) {
          conErrores++;
          const msg =
            creditoError instanceof Error ? creditoError.message : String(creditoError);
          this.logger.error(
            `[CREADOR] ❌ Error crédito ${credito.prestamo_ID}: ${msg}`
          );
        }
      }

      // 4. Resumen
      this.logger.info('[CREADOR] 📊 ===== RECONCILIACIÓN COMPLETADA =====');
      this.logger.info(`[CREADOR] ✅ Actualizados: ${actualizados}`);
      this.logger.info(`[CREADOR] ⚠️ No encontrados: ${noEncontrados}`);
      this.logger.info(`[CREADOR] ❌ Errores: ${conErrores}`);
      this.logger.info('[CREADOR] ========================================');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[CREADOR] ❌ Error fatal: ${msg}`);
      throw error;
    }
  }

  /**
   * Busca mejor match para nombre de creador
   * 1. Exacto por nombre_completo
   * 2. Fuzzy por nombre_completo
   * 3. Fuzzy por nombre
   * Prioriza ACTIVO
   */
  private findBestMatchUser(
    creadorNombre: string,
    usuarios: Array<{
      id: number;
      nombre_completo: string | null;
      nombre: string;
      estado: string;
    }>
  ): { id: number; nombre_completo: string | null; estado: string } | null {
    if (!creadorNombre) return null;

    const creadorNorm = this.normalizeString(creadorNombre);

    // 1. Exacto por nombre_completo
    const exactMatch = usuarios.find(
      (u) =>
        u.nombre_completo &&
        this.normalizeString(u.nombre_completo) === creadorNorm
    );
    if (exactMatch) {
      return {
        id: exactMatch.id,
        nombre_completo: exactMatch.nombre_completo,
        estado: exactMatch.estado,
      };
    }

    // 2. Fuzzy por nombre_completo
    let bestMatch: (typeof usuarios)[0] | null = null;
    let bestScore = this.SIMILARITY_THRESHOLD;

    for (const usuario of usuarios) {
      if (usuario.nombre_completo) {
        const score = this.fuzzyMatch(
          creadorNorm,
          this.normalizeString(usuario.nombre_completo)
        );
        if (score > bestScore) {
          bestScore = score;
          bestMatch = usuario;
        }
      }
    }

    if (bestMatch) {
      const activos = usuarios.filter(
        (u) =>
          u.nombre_completo &&
          this.fuzzyMatch(
            creadorNorm,
            this.normalizeString(u.nombre_completo)
          ) > this.SIMILARITY_THRESHOLD &&
          u.estado === 'ACTIVO'
      );
      const winner = activos.length > 0 ? activos[0] : bestMatch;
      return {
        id: winner.id,
        nombre_completo: winner.nombre_completo,
        estado: winner.estado,
      };
    }

    // 3. Fuzzy por primer nombre
    const primerNombre = creadorNombre.split(' ')[0].toLowerCase();
    bestMatch = null;
    bestScore = this.SIMILARITY_THRESHOLD;

    for (const usuario of usuarios) {
      const score = this.fuzzyMatch(
        primerNombre,
        this.normalizeString(usuario.nombre)
      );
      if (score > bestScore) {
        bestScore = score;
        bestMatch = usuario;
      }
    }

    if (bestMatch) {
      const activos = usuarios.filter(
        (u) =>
          this.fuzzyMatch(primerNombre, this.normalizeString(u.nombre)) >
            this.SIMILARITY_THRESHOLD && u.estado === 'ACTIVO'
      );
      const winner = activos.length > 0 ? activos[0] : bestMatch;
      return {
        id: winner.id,
        nombre_completo: winner.nombre_completo,
        estado: winner.estado,
      };
    }

    return null;
  }

  private normalizeString(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private fuzzyMatch(str1: string, str2: string): number {
    const s1 = (str1 || '').toLowerCase().trim();
    const s2 = (str2 || '').toLowerCase().trim();

    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0;

    const matrix: number[][] = [];
    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    const distance = matrix[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - distance / maxLength;
  }
}

export default CreadorReconciliationService;
