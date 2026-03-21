import { prismaMainService } from '../../database/main/prisma-main.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

/**
 * Resultado de fuzzy match
 */
export interface FuzzyMatchResult {
  id: number;
  nombre: string;
  similitud: number; // 0-1 (1 = match exacto)
}

/**
 * UserAdminFuzzyMatchService
 * 
 * Busca coincidencias fuzzy entre:
 * - punto (Excel) → sucursal.nombre (DB) → retorna zona_id
 * - rol (Excel) → lista_permisos.nombre (DB) → retorna id_permiso
 * 
 * Implementa cache in-memory para optimizar búsquedas repetidas
 * Threshold: 70% similitud
 */
class UserAdminFuzzyMatchService {
  private static instance: UserAdminFuzzyMatchService;
  private logger = WinstonAdapter;

  // Caches in-memory (se limpian después de cada lote)
  private puntoCache = new Map<string, FuzzyMatchResult | null>();
  private rolCache = new Map<string, FuzzyMatchResult | null>();

  // Datos cacheados de base de datos
  private sucursalesCache: { id: number; nombre: string; zona_id: number }[] = [];
  private permisosCache: { id: number; nombre: string }[] = [];
  private dbDataLoaded = false;

  // Threshold de similitud mínima
  private readonly SIMILARITY_THRESHOLD = 0.7; // 70%

  private constructor() {}

  public static getInstance(): UserAdminFuzzyMatchService {
    if (!UserAdminFuzzyMatchService.instance) {
      UserAdminFuzzyMatchService.instance = new UserAdminFuzzyMatchService();
    }
    return UserAdminFuzzyMatchService.instance;
  }

  /**
   * Normaliza rol del Excel a nombres estándar en BD
   * Mapeo directo: Excel → BD para mejorar precisión de matching
   */
  private normalizarRol(rol: string): string {
    if (!rol) return '';

    const rolLower = rol.toLowerCase().trim();

    // Mapeos directos (Excel → BD nombres estándar)
    const mapeos: { [key: string]: string } = {
      'asesor': 'ASESOR',
      'lider_asesor': 'LIDER ASESORES',
      'lider asesor': 'LIDER ASESORES',
      'lider asesores': 'LIDER ASESORES',
      'coordinador': 'COORDINADOR CARTERA',
      'administrador': 'ADMINISTRADOR',
      'callcenter': 'ATENCION AL CLIENTE',
      'call center': 'ATENCION AL CLIENTE',
      'auxiliar_contable': 'AUXILIAR ADMINISTRATIVO',
      'auxiliar contable': 'AUXILIAR ADMINISTRATIVO',
      'director_cartera': 'DIRECTOR CARTERA',
      'director cartera': 'DIRECTOR CARTERA',
      'superadmin': 'SÚPER ADMINSTRADOR',
      'super admin': 'SÚPER ADMINSTRADOR',
    };

    return mapeos[rolLower] || rol; // Si no encuentra mapeo, retorna el original
  }

  /**
   * Remueve acentos de strings para mejorar matching fuzzy
   * "Ibagué" → "ibague", "CHAPARRAL" → "chaparral"
   */
  private removeAccents(str: string): string {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Extrae ciudad del punto/sucursal manteniendo su estructura completa
   * Formatos soportados:
   * - "CHAPARRAL - FACILCREDITOS SAS" → "CHAPARRAL"
   * - "LA DORADA - FACILCREDITOS SAS" → "LA DORADA"
   * - "NEIVA GRUPO 2 - FACILCREDITOS SAS" → "NEIVA GRUPO 2"
   * - "IBAGUE" → "IBAGUE"
   */
  private extraerCiudad(punto: string): string {
    if (!punto) return '';

    // Extraer antes del " - " manteniendo toda la estructura
    return punto.includes(' - ')
      ? punto.split(' - ')[0].trim()
      : punto.trim();
  }

  /**
   * Carga datos de base de datos (sucursales y permisos)
   * Ejecutar al inicio del procesamiento
   */
  async loadDataFromDatabase(): Promise<void> {
    try {
      this.logger.info('[FUZZY] 📦 Cargando sucursales y permisos de BD');

      // Cargar sucursales con sus zonas
      const sucursales = await prismaMainService.sucursal.findMany({
        select: {
          id: true,
          nombre: true,
          zona_id: true,
        },
      });

      // Cargar permisos
      const permisos = await prismaMainService.lista_permisos.findMany({
        select: {
          id: true,
          nombre: true,
        },
      });

      this.sucursalesCache = sucursales;
      this.permisosCache = permisos;
      this.dbDataLoaded = true;

      this.logger.info(
        `[FUZZY] ✅ Datos cargados: ${sucursales.length} sucursales, ${permisos.length} permisos`
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[FUZZY] ❌ Error cargando datos de BD: ${msg}`);
      throw error;
    }
  }

  /**
   * Limpia los caches de búsqueda (no el de datos de BD)
   */
  clearSearchCaches(): void {
    this.puntoCache.clear();
    this.rolCache.clear();
    this.logger.info('[FUZZY] 🧹 Caches de búsqueda limpiados');
  }

  /**
   * Busca zona_id por nombre de punto (sucursal)
   * Aplica fuzzy matching con threshold 70%
   * Extrae ciudad del formato "CIUDAD - EMPRESA" o "CIUDAD GRUPO - EMPRESA"
   */
  async findZonaIdByPunto(punto: string): Promise<FuzzyMatchResult | null> {
    if (!punto || punto.trim() === '') return null;

    // Extraer ciudad usando lógica mejorada
    const ciudadExtraida = this.extraerCiudad(punto);
    const puntoNormalized = this.removeAccents(ciudadExtraida);

    // Verificar caché
    if (this.puntoCache.has(puntoNormalized)) {
      return this.puntoCache.get(puntoNormalized) || null;
    }

    try {
      // Asegurar que los datos están cargados
      if (!this.dbDataLoaded) {
        await this.loadDataFromDatabase();
      }

      // Buscar match exacto primero (comparar con acentos removidos)
      const exactMatch = this.sucursalesCache.find(
        (s) => this.removeAccents(s.nombre) === puntoNormalized
      );

      if (exactMatch) {
        const result: FuzzyMatchResult = {
          id: exactMatch.zona_id,
          nombre: exactMatch.nombre,
          similitud: 1.0,
        };
        this.puntoCache.set(puntoNormalized, result);
        this.logger.info(
          `[FUZZY] 🎯 Punto "${punto}" → ciudad "${ciudadExtraida}" → zona_id ${result.id} (EXACTO)`
        );
        return result;
      }

      // Buscar fuzzy match (también con acentos removidos)
      let bestMatch: (typeof this.sucursalesCache)[0] | null = null;
      let bestScore = this.SIMILARITY_THRESHOLD;

      for (const sucursal of this.sucursalesCache) {
        const score = this.fuzzyMatchString(
          puntoNormalized,
          this.removeAccents(sucursal.nombre)
        );

        if (score > bestScore) {
          bestScore = score;
          bestMatch = sucursal;
        }
      }

      // Si fuzzy match normal falla, intentar substring match
      // Útil para "ibague grupo 2" → contiene "ibague"
      if (!bestMatch || bestScore < this.SIMILARITY_THRESHOLD) {
        for (const sucursal of this.sucursalesCache) {
          const sucursalNorm = this.removeAccents(sucursal.nombre);
          // Buscar si el nombre de sucursal está contenido en el punto normalizado
          if (puntoNormalized.includes(sucursalNorm) || sucursalNorm.includes(puntoNormalized)) {
            bestMatch = sucursal;
            bestScore = 0.9; // No es exacto pero es un match de substring confiable
            break;
          }
        }
      }

      const result =
        bestMatch && bestScore >= this.SIMILARITY_THRESHOLD
          ? {
              id: bestMatch.zona_id,
              nombre: bestMatch.nombre,
              similitud: bestScore,
            }
          : null;

      this.puntoCache.set(puntoNormalized, result);

      if (result) {
        const similarity = (result.similitud * 100).toFixed(0);
        this.logger.info(
          `[FUZZY] 🎯 Punto "${punto}" → ciudad "${ciudadExtraida}" → zona_id ${result.id} (${similarity}%)`
        );
      } else {
        this.logger.warn(
          `[FUZZY] ⚠️ No se encontró match para punto "${punto}" (ciudad extraída: "${ciudadExtraida}", threshold: ${(this.SIMILARITY_THRESHOLD * 100).toFixed(0)}%)`
        );
      }

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[FUZZY] ❌ Error en findZonaIdByPunto: ${msg}`);
      this.puntoCache.set(puntoNormalized, null);
      return null;
    }
  }

  /**
   * Busca id_permiso por nombre de rol
   * Aplica fuzzy matching con threshold 70%
   * Primero normaliza el rol usando mapeo directo Excel → BD
   */
  async findPermisoIdByRol(rol: string): Promise<FuzzyMatchResult | null> {
    if (!rol || rol.trim() === '') return null;

    // Normalizar rol primero (mapeo directo Excel → BD)
    const rolNormalizado = this.normalizarRol(rol);
    const rolNormalized = this.removeAccents(rolNormalizado);

    // Verificar caché
    if (this.rolCache.has(rolNormalized)) {
      return this.rolCache.get(rolNormalized) || null;
    }

    try {
      // Asegurar que los datos están cargados
      if (!this.dbDataLoaded) {
        await this.loadDataFromDatabase();
      }

      // Buscar match exacto primero (con acentos removidos)
      const exactMatch = this.permisosCache.find(
        (p) => this.removeAccents(p.nombre) === rolNormalized
      );

      if (exactMatch) {
        const result: FuzzyMatchResult = {
          id: exactMatch.id,
          nombre: exactMatch.nombre,
          similitud: 1.0,
        };
        this.rolCache.set(rolNormalized, result);
        return result;
      }

      // Buscar fuzzy match (también con acentos removidos)
      let bestMatch: (typeof this.permisosCache)[0] | null = null;
      let bestScore = this.SIMILARITY_THRESHOLD;

      for (const permiso of this.permisosCache) {
        const score = this.fuzzyMatchString(
          rolNormalized,
          this.removeAccents(permiso.nombre)
        );

        if (score > bestScore) {
          bestScore = score;
          bestMatch = permiso;
        }
      }

      // Si fuzzy match normal falla, intentar substring match
      if (!bestMatch || bestScore < this.SIMILARITY_THRESHOLD) {
        for (const permiso of this.permisosCache) {
          const permisoNorm = this.removeAccents(permiso.nombre);
          // Buscar si el nombre de permiso está contenido en el rol normalizado
          if (rolNormalized.includes(permisoNorm) || permisoNorm.includes(rolNormalized)) {
            bestMatch = permiso;
            bestScore = 0.9; // No es exacto pero es un match de substring confiable
            break;
          }
        }
      }

      const result =
        bestMatch && bestScore >= this.SIMILARITY_THRESHOLD
          ? {
              id: bestMatch.id,
              nombre: bestMatch.nombre,
              similitud: bestScore,
            }
          : null;

      this.rolCache.set(rolNormalized, result);

      if (result) {
        const similarity = (result.similitud * 100).toFixed(0);
        this.logger.info(
          `[FUZZY] 🎯 Rol "${rol}" → id_permiso ${result.id} (${similarity}%)`
        );
      } else {
        this.logger.warn(
          `[FUZZY] ⚠️ No se encontró match para rol "${rol}" (threshold: ${(this.SIMILARITY_THRESHOLD * 100).toFixed(0)}%)`
        );
      }

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[FUZZY] ❌ Error en findPermisoIdByRol: ${msg}`);
      this.rolCache.set(rolNormalized, null);
      return null;
    }
  }

  /**
   * Algoritmo Levenshtein normalizado (reutilizado de cliente-mapper.ts)
   * Retorna similitud de 0-1 (1 = exacto)
   */
  private fuzzyMatchString(str1: string, str2: string): number {
    const s1 = (str1 || '').toLowerCase().trim();
    const s2 = (str2 || '').toLowerCase().trim();

    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0;

    // Levenshtein distance calculation
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
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    const distance = matrix[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - distance / maxLength;
  }

  /**
   * Retorna estadísticas de caches (para debugging)
   */
  getCacheStats(): {
    puntosCacheados: number;
    rolesCacheados: number;
    sucursalesEnMemoria: number;
    permisosEnMemoria: number;
  } {
    return {
      puntosCacheados: this.puntoCache.size,
      rolesCacheados: this.rolCache.size,
      sucursalesEnMemoria: this.sucursalesCache.length,
      permisosEnMemoria: this.permisosCache.length,
    };
  }
}

export default UserAdminFuzzyMatchService.getInstance();
