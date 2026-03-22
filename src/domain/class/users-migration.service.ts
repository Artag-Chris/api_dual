import { prismaMainService } from '../../database/main/prisma-main.service';
import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';
import { v4 as uuidv4 } from 'uuid';

const LEGACY_DB = '`FACIL-2026-03-06`';

/**
 * UsersMigrationService
 * 
 * Migra usuarios de legacy.users a main.user_admin
 * 
 * Características:
 * - Genera documento auto-incrementable: 990000, 990001, ...
 * - Mapea roles legacy → permisos main (fuzzy match por nombre)
 * - Mapea puntos → zonas (fuzzy match por nombre)
 * - Maneja emails duplicados: crea UUID fallback
 * - Deixa zona_id = NULL si no encuentra match
 * 
 * Uso: POST /api/admin/migrate-users
 * Respuesta:
 * {
 *   status: "USUARIOS_MIGRADOS" | "TODOS_FALLIDOS" | "ERROR",
 *   usuariosMigrados: number,
 *   usuariosProcesados: number,
 *   duplicadosEmail: number,
 *   sinZona: number,
 *   errores: string[]
 * }
 */
class UsersMigrationService {
  private static instance: UsersMigrationService;
  private logger = WinstonAdapter;
  private nombreCompletoUsados = new Set<string>(); // Track nombre_completo para evitar duplicados

  private constructor() {}

  public static getInstance(): UsersMigrationService {
    if (!UsersMigrationService.instance) {
      UsersMigrationService.instance = new UsersMigrationService();
    }
    return UsersMigrationService.instance;
  }

  /**
   * MÉTODO - Migra solo usuarios INACTIVOS de legacy
   * Establece tipo = 'CC' y estado = 'INACTIVO'
   */
  async migrateInactiveUsersAdmin(): Promise<{
    status: "USUARIOS_MIGRADOS" | "TODOS_FALLIDOS" | "ERROR";
    usuariosMigrados?: number;
    usuariosProcesados?: number;
    errores?: string[];
  }> {
    try {
      this.logger.info(`[USUARIOS] 🔄 Iniciando migrateInactiveUsersAdmin (tipo=CC)`);
      
      this.nombreCompletoUsados.clear();

      const ultimoDocumento = await this.getUltimoDocumento();
      let proximoDocumento = ultimoDocumento + 1;

      const usuariosInactivos = await this.getAllUsersInactiveLegacy();
      this.logger.info(`[USUARIOS] 👥 ${usuariosInactivos.length} usuarios INACTIVOS encontrados`);

      if (!usuariosInactivos || usuariosInactivos.length === 0) {
        return {
          status: "TODOS_FALLIDOS",
          usuariosProcesados: 0,
          usuariosMigrados: 0,
          errores: ["No se encontraron usuarios inactivos en legacy"]
        };
      }

      const [rolesMap, permisosMain, zonasMain, puntosLegacy, nombresExistentes] = await Promise.all([
        this.getRoleToPermisoMap(),
        this.getPermisosMain(),
        this.getZonasMain(),
        this.getPuntosLegacy(),
        this.getNombresCompletoExistentes()
      ]);

      for (const nombre of nombresExistentes) {
        this.nombreCompletoUsados.add(nombre);
      }

      const usersToCreate: any[] = [];
      const errores: string[] = [];
      let usuariosProcesados = 0;

      for (const userInactivo of usuariosInactivos) {
        try {
          const { nombre, apellido } = this.splitNombre(userInactivo.name);
          const idPermiso = this.mapRoleToPermiso(userInactivo.rol, rolesMap);
          const zonaId = this.fuzzyMatchPuntoToZona(userInactivo.punto_id, puntosLegacy, zonasMain);

          let documento = String(proximoDocumento);
          proximoDocumento++;

          let nombreCompleto = `${nombre} ${apellido}`.trim().substring(0, 100);
          let contador = 0;

          while (this.nombreCompletoUsados.has(nombreCompleto) && contador < 10) {
            nombreCompleto = `${nombre} ${apellido} (${proximoDocumento})`.substring(0, 100);
            contador++;
          }

          this.nombreCompletoUsados.add(nombreCompleto);

          usersToCreate.push({
            nombre,
            apellido,
            tipo: 'CC',  // ← TIPO CC PARA INACTIVOS
            documento,
            telefono: userInactivo.telefono || '',
            email: userInactivo.email,
            password: userInactivo.password,
            estado: 'INACTIVO',
            nombre_completo: nombreCompleto,
            id_permiso: idPermiso,
            zona_id: zonaId
          });

          usuariosProcesados++;
        } catch (userError) {
          const msg = userError instanceof Error ? userError.message : String(userError);
          this.logger.warn(`[USUARIOS] ❌ Error procesando inactivo ${userInactivo.id}: ${msg}`);
          errores.push(`Usuario ${userInactivo.id} (${userInactivo.name}): ${msg}`);
        }
      }

      if (usersToCreate.length === 0) {
        return {
          status: "TODOS_FALLIDOS",
          usuariosProcesados,
          usuariosMigrados: 0,
          errores: errores.length > 0 ? errores : ["Ningún usuario válido para migrar"]
        };
      }

      try {
        this.logger.info(`[USUARIOS] 🔄 Insertando ${usersToCreate.length} usuarios INACTIVOS`);
        
        const result = await prismaMainService.$transaction(async (tx) => {
          return await tx.user_admin.createMany({ data: usersToCreate, skipDuplicates: true });
        });

        this.logger.info(`[USUARIOS] ✅ ${result.count} usuarios INACTIVOS migrados (tipo=CC)`);

        return {
          status: "USUARIOS_MIGRADOS",
          usuariosMigrados: result.count,
          usuariosProcesados,
          errores: errores.length > 0 ? errores : undefined
        };

      } catch (txError) {
        const msg = txError instanceof Error ? txError.message : String(txError);
        this.logger.error(`[USUARIOS] ❌ Error en transacción: ${msg}`);
        
        let insertadosParcial = 0;
        const errorSpecificos: string[] = [];
        
        for (const usuario of usersToCreate) {
          try {
            await prismaMainService.user_admin.create({ data: usuario });
            insertadosParcial++;
          } catch (singleError) {
            const singleMsg = singleError instanceof Error ? singleError.message : String(singleError);
            errorSpecificos.push(`Usuario ${usuario.documento}: ${singleMsg}`);
          }
        }
        
        return {
          status: insertadosParcial > 0 ? "USUARIOS_MIGRADOS" : "ERROR",
          usuariosMigrados: insertadosParcial,
          usuariosProcesados,
          errores: errorSpecificos.slice(0, 10)
        };
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[USUARIOS] ❌ Error fatal en migrateInactiveUsersAdmin: ${msg}`);
      return {
        status: "ERROR",
        errores: [msg]
      };
    }
  }

  /**
   * MÉTODO PRINCIPAL - Migra todos los usuarios legacy a main
   */
  async migrateAllUsersAdmin(): Promise<{
    status: "USUARIOS_MIGRADOS" | "TODOS_FALLIDOS" | "ERROR";
    usuariosMigrados?: number;
    usuariosProcesados?: number;
    duplicadosEmail?: number;
    duplicadosNombre?: number;
    sinZona?: number;
    errores?: string[];
  }> {
    try {
      this.logger.info(`[USUARIOS] 🔄 Iniciando migrateAllUsersAdmin`);
      
      // Limpiar set de nombres usados (se pre-cargará después)
      this.nombreCompletoUsados.clear();

      // 1. Obtener último documento usado en rango 990000-999999
      const ultimoDocumento = await this.getUltimoDocumento();
      let proximoDocumento = ultimoDocumento + 1;

      this.logger.info(`[USUARIOS] 📋 Próximo documento a usar: ${proximoDocumento}`);

      // 2. Obtener todos los usuarios legacy
      const usuariosLegacy = await this.getAllUsersLegacy();
      this.logger.info(`[USUARIOS] 👥 ${usuariosLegacy.length} usuarios legacy encontrados`);

      if (!usuariosLegacy || usuariosLegacy.length === 0) {
        return {
          status: "TODOS_FALLIDOS",
          usuariosProcesados: 0,
          usuariosMigrados: 0,
          errores: ["No se encontraron usuarios legacy"]
        };
      }

      // 3. Precarga de datos para mapping + nombres existentes en BD
      const [rolesMap, permisosMain, zonasMain, puntosLegacy, nombresExistentes] = await Promise.all([
        this.getRoleToPermisoMap(),
        this.getPermisosMain(),
        this.getZonasMain(),
        this.getPuntosLegacy(),
        this.getNombresCompletoExistentes()
      ]);

      // Pre-cargar nombres existentes al Set
      for (const nombre of nombresExistentes) {
        this.nombreCompletoUsados.add(nombre);
      }
      this.logger.info(`[USUARIOS] 📋 Pre-cargados ${nombresExistentes.length} nombres existentes en BD`);

      // 4. Procesar cada usuario
      const usersToCreate: any[] = [];
      const errores: string[] = [];
      let duplicadosEmail = 0;
      let duplicadosNombre = 0;
      let sinZona = 0;
      let usuariosProcesados = 0;

      for (const userLegacy of usuariosLegacy) {
        try {
          // 4a. Verificar documento disponible
          if (proximoDocumento > 999999) {
            throw new Error(`Rango de documentos (990000-999999) agotado`);
          }

          const documento = String(proximoDocumento).padStart(6, '0');
          proximoDocumento++;

          // 4b. Extraer nombre y apellido
          const { nombre, apellido } = this.splitNombre(userLegacy.name);

          // 4c. Mapear rol a permiso (mapeo explícito)
          const idPermiso = this.mapRoleToPermiso(userLegacy.rol || '', rolesMap);

          // 4d. Mapear punto a zona
          let zonaId = null;
          if (userLegacy.punto_id) {
            zonaId = this.fuzzyMatchPuntoToZona(userLegacy.punto_id, puntosLegacy, zonasMain);
            if (!zonaId) sinZona++;
          }

          // 4e. Manejar email duplicado - crear dummy
          let email = userLegacy.email;
          // Verificar si el email ya está en users que vamos a crear
          const emailYaUsado = usersToCreate.some(u => u.email === email);
          if (emailYaUsado) {
            email = `user${documento}@dummy.facilcreditos`;
            duplicadosEmail++;
            this.logger.debug(`[USUARIOS] ⚠️ Email duplicado usuario ${userLegacy.id}: ${userLegacy.email} → ${email}`);
          }

          // 4f. Manejar nombre_completo duplicado
          let nombreCompleto = userLegacy.name;
          let contador = 0;
          while (this.nombreCompletoUsados.has(nombreCompleto) && contador < 10) {
            nombreCompleto = `${userLegacy.name}_${documento}_${contador}`;
            contador++;
          }
          
          if (contador > 0) {
            duplicadosNombre++;
            this.logger.warn(`[USUARIOS] ⚠️ Nombre duplicado usuario ${userLegacy.id}: "${userLegacy.name}" → "${nombreCompleto}"`);
          }
          
          this.nombreCompletoUsados.add(nombreCompleto);

          // 4g. Preparar datos del usuario
          usersToCreate.push({
            nombre,
            apellido,
            tipo: 'CC',
            documento,
            telefono: userLegacy.telefono || '',
            email,
            password: userLegacy.password,
            estado: this.mapEstadoUsuario(userLegacy.estado),
            nombre_completo: nombreCompleto,
            id_permiso: idPermiso,
            zona_id: zonaId
          });

          usuariosProcesados++;

        } catch (userError) {
          const msg = userError instanceof Error ? userError.message : String(userError);
          this.logger.warn(`[USUARIOS] ❌ Error procesando usuario ${userLegacy.id}: ${msg}`);
          errores.push(`Usuario ${userLegacy.id} (${userLegacy.name}): ${msg}`);
        }
      }

      // 5. Insertar todos en transacción
      if (usersToCreate.length === 0) {
        return {
          status: "TODOS_FALLIDOS",
          usuariosProcesados,
          usuariosMigrados: 0,
          errores: errores.length > 0 ? errores : ["Ningún usuario válido para migrar"]
        };
      }

      try {
        this.logger.info(`[USUARIOS] 🔄 Iniciando transacción con ${usersToCreate.length} usuarios`);
        
        const result = await prismaMainService.$transaction(async (tx) => {
          return await tx.user_admin.createMany({
            data: usersToCreate,
            skipDuplicates: true  // Permite guardar parcialmente si hay duplicados
          });
        });

        this.logger.info(`[USUARIOS] ✅ ${result.count} usuarios migrados exitosamente`);

        return {
          status: "USUARIOS_MIGRADOS",
          usuariosMigrados: result.count,
          usuariosProcesados,
          duplicadosEmail,
          duplicadosNombre,
          sinZona,
          errores: errores.length > 0 ? errores : undefined
        };

      } catch (txError) {
        const msg = txError instanceof Error ? txError.message : String(txError);
        this.logger.error(`[USUARIOS] ❌ Error en transacción: ${msg}`);
        
        // Intentar insertar uno por uno para identificar cuál falla
        this.logger.info(`[USUARIOS] 🔄 Intentando insertar usuarios individuélmente...`);
        let insertadosParcial = 0;
        const errorSpecificos: string[] = [];
        
        for (const usuario of usersToCreate) {
          try {
            await prismaMainService.user_admin.create({ data: usuario });
            insertadosParcial++;
          } catch (singleError) {
            const singleMsg = singleError instanceof Error ? singleError.message : String(singleError);
            errorSpecificos.push(`Usuario ${usuario.documento} (${usuario.nombre_completo}): ${singleMsg}`);
          }
        }
        
        this.logger.info(`[USUARIOS] ✅ Insertados ${insertadosParcial} usuarios en modo individual`);
        
        return {
          status: insertadosParcial > 0 ? "USUARIOS_MIGRADOS" : "ERROR",
          usuariosMigrados: insertadosParcial,
          usuariosProcesados,
          duplicadosEmail,
          duplicadosNombre,
          sinZona,
          errores: errorSpecificos.length > 0 ? errorSpecificos.slice(0, 10) : [msg]  // Top 10 errores
        };
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[USUARIOS] ❌ Error fatal en migrateAllUsersAdmin: ${msg}`);
      return {
        status: "ERROR",
        errores: [msg]
      };
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * HELPERS - Datos Legacy
   * ═══════════════════════════════════════════════════════════════════════════
   */

  private async getAllUsersLegacy(): Promise<any[]> {
    try {
      return await prismaLegacyService.$queryRawUnsafe<any[]>(`
        SELECT id, name, email, password, telefono, punto_id, estado, rol
        FROM ${LEGACY_DB}.users
        WHERE estado != 'Inactivo'
      `);
    } catch (error) {
      this.logger.warn(`[QUERY] ⚠️ Error en getAllUsersLegacy: ${error}`);
      return [];
    }
  }

  private async getAllUsersInactiveLegacy(): Promise<any[]> {
    try {
      return await prismaLegacyService.$queryRawUnsafe<any[]>(`
        SELECT id, name, email, password, telefono, punto_id, estado, rol
        FROM ${LEGACY_DB}.users
        WHERE estado = 'Inactivo'
      `);
    } catch (error) {
      this.logger.warn(`[QUERY] ⚠️ Error en getAllUsersInactiveLegacy: ${error}`);
      return [];
    }
  }

  /**
   * MAPEO EXPLÍCITO DE ROLES
   * Convierte roles legacy al id_permiso correspondiente en main
   */
  private async getRoleToPermisoMap(): Promise<Map<string, number>> {
    try {
      // Mapeo manual según especificación del usuario
      const roleMapping: Record<string, number> = {
        'Superadmin': 1,              // Superadmin
        'Callcenter': 3,              // Atención al cliente
        'Vendedor': 4,                // Asesor
        'Auxiliar_contable': 2,       // Admin/Contable
        'Freelance': 5,               // Default
        'Invitado': 5,                // Default
      };

      // Obtener todos los roles legacy para validar
      const roles = await prismaLegacyService.$queryRawUnsafe<any[]>(`
        SELECT id, name FROM ${LEGACY_DB}.roles
      `);

      const map = new Map<string, number>();

      // Mapear cada rol encontrado
      for (const role of roles) {
        const roleName = role.name;
        
        if (roleMapping.hasOwnProperty(roleName)) {
          map.set(roleName, roleMapping[roleName]);
          this.logger.info(`[MAPPING] Role "${roleName}" → Permiso ${roleMapping[roleName]}`);
        } else {
          // Fallback: usar permiso default (id=5)
          map.set(roleName, 5);
          this.logger.warn(`[MAPPING] Role "${roleName}" sin mapeo específico → Default permiso 5`);
        }
      }

      return map;
    } catch (error) {
      this.logger.warn(`[QUERY] ⚠️ Error en getRoleToPermisoMap: ${error}`);
      return new Map();
    }
  }

  private async getPermisosMain(): Promise<any[]> {
    try {
      return await prismaMainService.lista_permisos.findMany({
        select: { id: true, nombre: true }
      });
    } catch (error) {
      this.logger.warn(`[QUERY] ⚠️ Error en getPermisosMain: ${error}`);
      return [];
    }
  }

  private async getZonasMain(): Promise<any[]> {
    try {
      return await prismaMainService.zonas.findMany({
        select: { id: true, nombre: true }
      });
    } catch (error) {
      this.logger.warn(`[QUERY] ⚠️ Error en getZonasMain: ${error}`);
      return [];
    }
  }

  private async getPuntosLegacy(): Promise<any[]> {
    try {
      return await prismaLegacyService.$queryRawUnsafe<any[]>(`
        SELECT id, nombre, zona_id FROM ${LEGACY_DB}.puntos
      `);
    } catch (error) {
      this.logger.warn(`[QUERY] ⚠️ Error en getPuntosLegacy: ${error}`);
      return [];
    }
  }

  private async getUltimoDocumento(): Promise<number> {
    try {
      const result = await prismaMainService.$queryRawUnsafe<any[]>(`
        SELECT MAX(CAST(documento AS UNSIGNED)) as max_doc 
        FROM user_admin 
        WHERE documento BETWEEN '990000' AND '999999'
      `);

      const maxDoc = result && result.length > 0 ? result[0]?.max_doc : null;
      return maxDoc ? Number(maxDoc) : 989999;
    } catch (error) {
      this.logger.warn(`[QUERY] ⚠️ Error en getUltimoDocumento: ${error}`);
      return 989999;
    }
  }

  private async emailExists(email: string): Promise<boolean> {
    try {
      // Cache simple: solo verificar si el email está en los usuarios que vamos a crear
      // La transacción con skipDuplicates: true ya maneja el resto
      return false;  // Dejamos que la BD maneje duplicados en transacción
    } catch (error) {
      return false;
    }
  }

  private async getNombresCompletoExistentes(): Promise<string[]> {
    try {
      const usuarios = await prismaMainService.user_admin.findMany({
        select: { nombre_completo: true },
        where: { nombre_completo: { not: null } }
      });
      return usuarios.map(u => u.nombre_completo!).filter(n => n);
    } catch (error) {
      this.logger.warn(`[QUERY] ⚠️ Error en getNombresCompletoExistentes: ${error}`);
      return [];
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * HELPERS - Transformación de Datos
   * ═══════════════════════════════════════════════════════════════════════════
   */

  private splitNombre(fullName: string): { nombre: string; apellido: string } {
    try {
      const parts = (fullName || '').trim().split(/\s+/);
      
      if (parts.length === 0) {
        return { nombre: 'N/A', apellido: 'N/A' };
      }
      
      if (parts.length === 1) {
        return { nombre: parts[0], apellido: 'N/A' };
      }

      // Primer elemento es nombre, resto es apellido
      const nombre = parts[0];
      const apellido = parts.slice(1).join(' ').substring(0, 30); // Limit apellido to 30 chars

      return { nombre: nombre.substring(0, 50), apellido };
    } catch (error) {
      return { nombre: 'N/A', apellido: 'N/A' };
    }
  }

  /**
   * Mapea rol a permiso usando el mapa explícito
   */
  private mapRoleToPermiso(rol: string, rolesMap: Map<string, number>): number {
    // Si está en el mapa, retorna
    if (rolesMap.has(rol)) {
      return rolesMap.get(rol)!;
    }

    // Fallback: default permiso 5
    this.logger.warn(`[MAPPING] Rol "${rol}" no está en mapeo → Default 5`);
    return 5;
  }

  private fuzzyMatchPuntoToZona(puntoId: number, puntos: any[], zonas: any[]): number | null {
    try {
      // Encontrar punto
      const punto = puntos.find(p => p.id === puntoId);
      if (!punto || !punto.nombre) {
        return null;
      }

      // Si el punto tiene zona_id directo, usarlo
      if (punto.zona_id) {
        return punto.zona_id;
      }

      // Fuzzy match: buscar zona con nombre similar al punto
      const puntoNombre = (punto.nombre || '').toLowerCase();
      const zona = zonas.find(z => 
        puntoNombre.includes(z.nombre.toLowerCase()) ||
        z.nombre.toLowerCase().includes(puntoNombre)
      );

      return zona?.id || null;
    } catch (error) {
      return null;
    }
  }

  private mapEstadoUsuario(estadoLegacy: string): any {
    const estado = (estadoLegacy || 'Activo').toLowerCase();
    
    // Mapear estado legacy → estado main
    if (estado.includes('inactivo')) return 'INACTIVO';
    if (estado.includes('suspendido')) return 'SUSPENDIDO';
    
    return 'ACTIVO'; // Default
  }
}

export default UsersMigrationService;
