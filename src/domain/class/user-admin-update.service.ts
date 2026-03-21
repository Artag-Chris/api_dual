import { UpdateUserAdminExcelParser, UpdateUserAdminFromExcelDto } from '../dtos/update-user-admin-excel.dto';
import UserAdminFuzzyMatchService from './user-admin-fuzzy-match.service';
import { prismaMainService } from '../../database/main/prisma-main.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

/**
 * Resultado de actualización de usuario
 */
export interface UserUpdateResult {
  email: string;
  nombre: string;
  actualizado: boolean;
  zona_id: number | null;
  id_permiso: number;
  puntoMatch?: { similitud: number; nombre: string };
  rolMatch?: { similitud: number; nombre: string };
  error?: string;
}

/**
 * Resultado final de la operación
 */
export interface UpdateUsersFromExcelResult {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  totalProcesados: number;
  totalActualizados: number;
  totalErrores: number;
  resultados: UserUpdateResult[];
  resumen: {
    matchesExactos: number;
    matchesFuzzy: number;
    usuariosNoEncontrados: number;
    zonaIdDefault: number;
  };
}

/**
 * UserAdminUpdateService
 * 
 * Procesa archivo Excel para actualizar información de usuarios admin
 * 
 * Características:
 * - Parsea Excel con validación
 * - Busca usuario por email (clave única)
 * - Fuzzy matching: punto → zona_id, rol → id_permiso
 * - Threshold fuzzy: 70%
 * - Valores default: zona_id=NULL, id_permiso=5 (Asesor)
 * - Estado: siempre "Activo"
 * - Actualiza: nombre, email, telefono, zona_id, id_permiso
 */
class UserAdminUpdateService {
  private static instance: UserAdminUpdateService;
  private logger = WinstonAdapter;
  private parser = new UpdateUserAdminExcelParser();
  private fuzzyService = UserAdminFuzzyMatchService;

  // Constante: id_permiso por defecto si no hay match (Asesor)
  private readonly DEFAULT_PERMISO_ID = 5;

  private constructor() {}

  public static getInstance(): UserAdminUpdateService {
    if (!UserAdminUpdateService.instance) {
      UserAdminUpdateService.instance = new UserAdminUpdateService();
    }
    return UserAdminUpdateService.instance;
  }

  /**
   * Método principal: procesa Excel y actualiza usuarios
   */
  async updateUsersAdminFromExcel(excelBuffer: Buffer): Promise<UpdateUsersFromExcelResult> {
    const startTime = Date.now();
    this.logger.info('[USERUPDATE] 🚀 Iniciando actualización de usuarios desde Excel');

    try {
      // 1. Parsear Excel
      const excelRows = await this.parser.parseFile(excelBuffer, 'usuarios.xlsx');
      this.logger.info(`[USERUPDATE] 📄 ${excelRows.length} filas parseadas de Excel`);

      // 2. Cargar datos de BD para fuzzy matching
      await this.fuzzyService.loadDataFromDatabase();
      this.fuzzyService.clearSearchCaches();

      // 3. Procesar cada fila
      const resultados: UserUpdateResult[] = [];
      let totalActualizados = 0;
      let matchesExactos = 0;
      let matchesFuzzy = 0;
      let usuariosNoEncontrados = 0;

      for (let i = 0; i < excelRows.length; i++) {
        const row = excelRows[i];
        const rowNum = i + 2; // +2 porque Excel empieza en 1 y hay header

        try {
          // Validar DTO
          const [validationError, dto] = UpdateUserAdminFromExcelDto.create(row);
          if (validationError || !dto) {
            this.logger.warn(`[USERUPDATE] ⚠️ Row ${rowNum}: ${validationError}`);
            resultados.push({
              email: row.email,
              nombre: row.name,
              actualizado: false,
              zona_id: null,
              id_permiso: this.DEFAULT_PERMISO_ID,
              error: validationError || 'Validation failed',
            });
            continue;
          }

          // Procesar usuario
          const updateResult = await this.processUserRow(dto, row, rowNum);
          resultados.push(updateResult);

          if (updateResult.actualizado) {
            totalActualizados++;
            if (updateResult.puntoMatch?.similitud === 1.0 && updateResult.rolMatch?.similitud === 1.0) {
              matchesExactos++;
            } else {
              matchesFuzzy++;
            }
          } else if (updateResult.error?.includes('not found')) {
            usuariosNoEncontrados++;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.error(`[USERUPDATE] ❌ Row ${rowNum}: ${msg}`);
          resultados.push({
            email: row.email,
            nombre: row.name,
            actualizado: false,
            zona_id: null,
            id_permiso: this.DEFAULT_PERMISO_ID,
            error: msg,
          });
        }
      }

      // 4. Compilar resultado final
      const duration = Date.now() - startTime;
      const status =
        totalActualizados === excelRows.length
          ? 'SUCCESS'
          : totalActualizados > 0
            ? 'PARTIAL'
            : 'FAILED';

      const cacheStats = this.fuzzyService.getCacheStats();

      this.logger.info(`[USERUPDATE] ✅ Actualización completada en ${duration}ms`);
      this.logger.info(`[USERUPDATE] 📊 Estadísticas: ${totalActualizados}/${excelRows.length} actualizados`);
      this.logger.info(
        `[USERUPDATE] 🎯 Matches: ${matchesExactos} exactos, ${matchesFuzzy} fuzzy`
      );
      this.logger.info(
        `[USERUPDATE] 💾 Cache: ${cacheStats.puntosCacheados} puntos, ${cacheStats.rolesCacheados} roles`
      );

      return {
        status,
        totalProcesados: excelRows.length,
        totalActualizados,
        totalErrores: excelRows.length - totalActualizados,
        resultados,
        resumen: {
          matchesExactos,
          matchesFuzzy,
          usuariosNoEncontrados,
          zonaIdDefault: 0, // Placeholder, actualizar si es necesario
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[USERUPDATE] ❌ Error crítico: ${msg}`);

      return {
        status: 'FAILED',
        totalProcesados: 0,
        totalActualizados: 0,
        totalErrores: 1,
        resultados: [],
        resumen: {
          matchesExactos: 0,
          matchesFuzzy: 0,
          usuariosNoEncontrados: 0,
          zonaIdDefault: 0,
        },
      };
    }
  }

  /**
   * Procesa una fila individual del Excel
   */
  private async processUserRow(
    dto: UpdateUserAdminFromExcelDto,
    originalRow: any,
    rowNum: number
  ): Promise<UserUpdateResult> {
    // 1. Buscar usuario por email (usando findFirst porque email no es unique)
    let usuario = await prismaMainService.user_admin.findFirst({
      where: { email: dto.email },
    });

    // Si no existe, crear usuario
    if (!usuario) {
      this.logger.info(
        `[USERUPDATE] 📝 Row ${rowNum}: Creando nuevo usuario "${dto.email}"`
      );
      try {
        usuario = await prismaMainService.user_admin.create({
          data: {
            documento: `TEMP_${Date.now()}`, // Valor temporal
            nombre: dto.name,
            apellido: '', // Será completado por usuario
            email: dto.email,
            telefono: dto.telefono,
            password: 'TEMP_PASSWORD', // Será reemplazada por usuario
            estado: 'ACTIVO',
            tipo: 'USUARIO', // Tipo predeterminado
          },
        });
        this.logger.info(`[USERUPDATE] ✅ Row ${rowNum}: Usuario creado exitosamente`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`[USERUPDATE] ❌ Row ${rowNum}: Error creando usuario: ${msg}`);
        return {
          email: dto.email,
          nombre: dto.name,
          actualizado: false,
          zona_id: null,
          id_permiso: this.DEFAULT_PERMISO_ID,
          error: `Could not create user: ${msg}`,
        };
      }
    }

    // 2. Fuzzy matching: punto → zona_id
    const puntoPunto = await this.fuzzyService.findZonaIdByPunto(dto.punto);
    const zona_id = puntoPunto?.id ?? null;

    // 3. Fuzzy matching: rol → id_permiso
    const roleResult = await this.fuzzyService.findPermisoIdByRol(dto.rol_);
    const id_permiso = roleResult?.id ?? this.DEFAULT_PERMISO_ID;

    // 4. Actualizar en BD
    try {
      await prismaMainService.user_admin.update({
        where: { id: usuario.id },
        data: {
          nombre: dto.name,
          email: dto.email,
          telefono: dto.telefono,
          zona_id,
          id_permiso,
          estado: 'ACTIVO', // Siempre activo según especificación
        },
      });

      this.logger.info(
        `[USERUPDATE] ✅ Row ${rowNum}: Usuario "${dto.email}" actualizado (completo)`
      );

      const resultado: UserUpdateResult = {
        email: dto.email,
        nombre: dto.name,
        actualizado: true,
        zona_id,
        id_permiso,
      };

      // Agregar información de fuzzy match si aplica
      if (puntoPunto && puntoPunto.similitud < 1.0) {
        resultado.puntoMatch = {
          similitud: puntoPunto.similitud,
          nombre: puntoPunto.nombre
        };
      }

      if (roleResult && roleResult.similitud < 1.0) {
        resultado.rolMatch = {
          similitud: roleResult.similitud,
          nombre: roleResult.nombre
        };
      }

      return resultado;
    } catch (error) {
      // Si hay error de constraint único en nombre, reintentar sin actualizar nombre
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg.includes('nombre_completo')) {
        this.logger.warn(
          `[USERUPDATE] ⚠️ Row ${rowNum}: Constraint único en nombre_completo. Actualizando sin nombre...`
        );
        
        try {
          // Reintento: actualizar solo campos no únicos
          await prismaMainService.user_admin.update({
            where: { id: usuario.id },
            data: {
              email: dto.email,
              telefono: dto.telefono,
              zona_id,
              id_permiso,
              estado: 'ACTIVO',
            },
          });

          this.logger.info(
            `[USERUPDATE] ✅ Row ${rowNum}: Usuario "${dto.email}" actualizado (sin nombre)`
          );

          const resultado: UserUpdateResult = {
            email: dto.email,
            nombre: usuario.nombre, // Mantener el nombre original
            actualizado: true,
            zona_id,
            id_permiso,
            error: 'Nombre no actualizado (constraint único)',
          };

          if (puntoPunto && puntoPunto.similitud < 1.0) {
            resultado.puntoMatch = {
              similitud: puntoPunto.similitud,
              nombre: puntoPunto.nombre
            };
          }

          if (roleResult && roleResult.similitud < 1.0) {
            resultado.rolMatch = {
              similitud: roleResult.similitud,
              nombre: roleResult.nombre
            };
          }

          return resultado;
        } catch (retryError) {
          const retryMsg = retryError instanceof Error ? retryError.message : String(retryError);
          this.logger.error(
            `[USERUPDATE] ❌ Row ${rowNum}: Error en reintento: ${retryMsg}`
          );

          return {
            email: dto.email,
            nombre: usuario.nombre,
            actualizado: false,
            zona_id,
            id_permiso,
            error: retryMsg,
          };
        }
      }

      // Si es otro error diferente del constraint, lo reportamos
      this.logger.error(`[USERUPDATE] ❌ Row ${rowNum}: Error al actualizar: ${errorMsg}`);

      return {
        email: dto.email,
        nombre: dto.name,
        actualizado: false,
        zona_id,
        id_permiso,
        error: errorMsg,
      };
    }
  }
}

export default UserAdminUpdateService.getInstance();
