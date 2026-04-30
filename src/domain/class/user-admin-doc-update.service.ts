import { UpdateUserAdminCsvParser, UpdateUserAdminCsvDto, UserAdminCsvRow } from '../dtos/update-user-admin-csv.dto';
import UserAdminFuzzyMatchService from './user-admin-fuzzy-match.service';
import { prismaMainService } from '../../database/main/prisma-main.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';
import bcrypt from 'bcryptjs';

// ─── Interfaces ──────────────────────────────────────────────

type MatchMethod = 'TELEFONO_EN_DOCUMENTO' | 'CEDULA_EN_DOCUMENTO' | 'NOMBRE_FUZZY' | 'NO_ENCONTRADO';

export interface UserDocUpdateResult {
  rowNum: number;
  csvName: string;
  csvCedula: string;
  csvTelefono: string;
  csvEmail: string;
  matchMethod: MatchMethod;
  actualizado: boolean;
  documentoAnterior?: string;
  documentoNuevo?: string;
  passwordActualizado?: boolean;
  rolAsignado?: { id_permiso: number; nombre: string; similitud: number };
  error?: string;
}

export interface UpdateDocFromCsvResult {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  totalProcesados: number;
  totalActualizados: number;
  totalNoEncontrados: number;
  totalErrores: number;
  resumen: {
    matchesPorTelefono: number;
    matchesPorCedula: number;
    matchesPorNombre: number;
    sinCoincidencia: number;
    passwordsHasheados: number;
    rolesAsignados: number;
  };
  actualizados: UserDocUpdateResult[];
  noEncontrados: UserDocUpdateResult[];
  errores: UserDocUpdateResult[];
}

// ─── Service ──────────────────────────────────────────────────

const BCRYPT_SALT_ROUNDS = 10;
const DEFAULT_PERMISO_ID = 5; // Asesor

class UserAdminDocUpdateService {
  private static instance: UserAdminDocUpdateService;
  private logger = WinstonAdapter;
  private parser = new UpdateUserAdminCsvParser();
  private fuzzyService = UserAdminFuzzyMatchService;

  private constructor() {}

  public static getInstance(): UserAdminDocUpdateService {
    if (!UserAdminDocUpdateService.instance) {
      UserAdminDocUpdateService.instance = new UserAdminDocUpdateService();
    }
    return UserAdminDocUpdateService.instance;
  }

  /**
   * Método principal: procesa CSV y actualiza documentos de usuarios
   * 
   * Lógica de búsqueda por prioridad:
   * 1. Buscar user_admin.documento === telefono (CSV)
   * 2. Buscar user_admin.documento === cedula (CSV)
   * 3. Buscar por nombre fuzzy en nombre_completo, nombre, apellido
   * 
   * Cuando encuentra por telefono en documento:
   * - Reemplaza documento por la cedula del CSV
   * - Hashea la cedula y la pone como password
   * - Mapea rol_ con fuzzy match → id_permiso
   */
  async updateUsersDocFromCsv(fileBuffer: Buffer, filename: string): Promise<UpdateDocFromCsvResult> {
    const startTime = Date.now();
    this.logger.info('[DOCUPDATE] Iniciando actualización de documentos desde CSV');

    try {
      // 1. Parsear archivo
      const csvRows = await this.parser.parseFile(fileBuffer, filename);
      this.logger.info(`[DOCUPDATE] ${csvRows.length} filas parseadas del archivo`);

      // 2. Cargar datos para fuzzy matching de roles
      await this.fuzzyService.loadDataFromDatabase();
      this.fuzzyService.clearSearchCaches();

      // 3. Cargar todos los usuarios de user_admin para búsqueda por nombre
      const allUsers = await prismaMainService.user_admin.findMany({
        select: {
          id: true,
          documento: true,
          nombre: true,
          apellido: true,
          nombre_completo: true,
          telefono: true,
          email: true,
        },
      });
      this.logger.info(`[DOCUPDATE] ${allUsers.length} usuarios cargados de user_admin`);

      // 4. Procesar cada fila
      const actualizados: UserDocUpdateResult[] = [];
      const noEncontrados: UserDocUpdateResult[] = [];
      const errores: UserDocUpdateResult[] = [];
      let matchesPorTelefono = 0;
      let matchesPorCedula = 0;
      let matchesPorNombre = 0;
      let sinCoincidencia = 0;
      let passwordsHasheados = 0;
      let rolesAsignados = 0;

      for (let i = 0; i < csvRows.length; i++) {
        const row = csvRows[i];
        const rowNum = i + 2; // +2: Excel row 1 = header

        try {
          // Validar DTO
          const [validationError, dto] = UpdateUserAdminCsvDto.create(row);
          if (validationError || !dto) {
            this.logger.warn(`[DOCUPDATE] Row ${rowNum}: ${validationError}`);
            errores.push({
              rowNum,
              csvName: row.name,
              csvCedula: row.cedula,
              csvTelefono: row.telefono,
              csvEmail: row.email,
              matchMethod: 'NO_ENCONTRADO',
              actualizado: false,
              error: validationError || 'Validation failed',
            });
            continue;
          }

          const result = await this.processRow(dto, row, rowNum, allUsers);

          if (result.matchMethod === 'NO_ENCONTRADO') {
            noEncontrados.push(result);
            sinCoincidencia++;
          } else if (result.actualizado) {
            actualizados.push(result);
            if (result.matchMethod === 'TELEFONO_EN_DOCUMENTO') matchesPorTelefono++;
            if (result.matchMethod === 'CEDULA_EN_DOCUMENTO') matchesPorCedula++;
            if (result.matchMethod === 'NOMBRE_FUZZY') matchesPorNombre++;
            if (result.passwordActualizado) passwordsHasheados++;
            if (result.rolAsignado) rolesAsignados++;
          } else {
            errores.push(result);
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.error(`[DOCUPDATE] Row ${rowNum}: ${msg}`);
          errores.push({
            rowNum,
            csvName: row.name,
            csvCedula: row.cedula,
            csvTelefono: row.telefono,
            csvEmail: row.email,
            matchMethod: 'NO_ENCONTRADO',
            actualizado: false,
            error: msg,
          });
        }
      }

      // 5. Compilar resultado
      const totalActualizados = actualizados.length;
      const duration = Date.now() - startTime;
      const status =
        totalActualizados === csvRows.length
          ? 'SUCCESS'
          : totalActualizados > 0
            ? 'PARTIAL'
            : 'FAILED';

      this.logger.info(`[DOCUPDATE] Completado en ${duration}ms`);
      this.logger.info(`[DOCUPDATE] ${totalActualizados}/${csvRows.length} actualizados`);
      this.logger.info(`[DOCUPDATE] Matches: ${matchesPorTelefono} tel, ${matchesPorCedula} ced, ${matchesPorNombre} nombre`);
      this.logger.info(`[DOCUPDATE] No encontrados: ${sinCoincidencia}, Errores: ${errores.length}`);

      return {
        status,
        totalProcesados: csvRows.length,
        totalActualizados,
        totalNoEncontrados: noEncontrados.length,
        totalErrores: errores.length,
        resumen: {
          matchesPorTelefono,
          matchesPorCedula,
          matchesPorNombre,
          sinCoincidencia,
          passwordsHasheados,
          rolesAsignados,
        },
        actualizados,
        noEncontrados,
        errores,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[DOCUPDATE] Error crítico: ${msg}`);

      return {
        status: 'FAILED',
        totalProcesados: 0,
        totalActualizados: 0,
        totalNoEncontrados: 0,
        totalErrores: 1,
        resumen: {
          matchesPorTelefono: 0,
          matchesPorCedula: 0,
          matchesPorNombre: 0,
          sinCoincidencia: 0,
          passwordsHasheados: 0,
          rolesAsignados: 0,
        },
        actualizados: [],
        noEncontrados: [],
        errores: [{ rowNum: 0, csvName: '', csvCedula: '', csvTelefono: '', csvEmail: '', matchMethod: 'NO_ENCONTRADO', actualizado: false, error: msg }],
      };
    }
  }

  /**
   * Procesa una fila individual del CSV
   */
  private async processRow(
    dto: UpdateUserAdminCsvDto,
    originalRow: UserAdminCsvRow,
    rowNum: number,
    allUsers: { id: number; documento: string; nombre: string; apellido: string; nombre_completo: string | null; telefono: string; email: string }[]
  ): Promise<UserDocUpdateResult> {
    const baseResult = {
      rowNum,
      csvName: dto.name,
      csvCedula: dto.cedula,
      csvTelefono: dto.telefono,
      csvEmail: dto.email,
    };

    // ── Paso 1: Buscar por telefono en campo documento ──
    const telefonoNorm = dto.telefono.replace(/\D/g, '').trim();
    let usuario = allUsers.find((u) => u.documento.replace(/\D/g, '').trim() === telefonoNorm && telefonoNorm !== '');

    if (usuario) {
      this.logger.info(`[DOCUPDATE] Row ${rowNum}: Match TELEFONO en documento (user.id=${usuario.id})`);
      return this.applyUpdate(usuario, dto, 'TELEFONO_EN_DOCUMENTO', baseResult, true);
    }

    // ── Paso 2: Buscar por cedula en campo documento ──
    const cedulaNorm = dto.cedula.replace(/\D/g, '').trim();
    if (cedulaNorm) {
      usuario = allUsers.find((u) => u.documento.replace(/\D/g, '').trim() === cedulaNorm);
    }

    if (usuario) {
      this.logger.info(`[DOCUPDATE] Row ${rowNum}: Match CEDULA en documento (user.id=${usuario.id})`);
      return this.applyUpdate(usuario, dto, 'CEDULA_EN_DOCUMENTO', baseResult, false);
    }

    // ── Paso 3: Buscar por nombre fuzzy ──
    const nombreCsv = this.removeAccents(dto.name);

    if (nombreCsv) {
      let bestUser: typeof allUsers[0] | null = null;
      let bestScore = 0.7; // threshold 70%

      for (const u of allUsers) {
        // Comparar contra nombre_completo
        if (u.nombre_completo) {
          const score = this.fuzzyMatchString(nombreCsv, this.removeAccents(u.nombre_completo));
          if (score > bestScore) {
            bestScore = score;
            bestUser = u;
          }
        }

        // Comparar contra "nombre apellido"
        const fullName = `${u.nombre} ${u.apellido}`.trim();
        if (fullName) {
          const score = this.fuzzyMatchString(nombreCsv, this.removeAccents(fullName));
          if (score > bestScore) {
            bestScore = score;
            bestUser = u;
          }
        }

        // Comparar contra solo nombre
        if (u.nombre) {
          const scoreNombre = this.fuzzyMatchString(nombreCsv, this.removeAccents(u.nombre));
          if (scoreNombre > bestScore) {
            bestScore = scoreNombre;
            bestUser = u;
          }
        }
      }

      if (bestUser) {
        // Reemplazar documento solo si el documento actual del usuario ES el teléfono del CSV
        const docEsTelefono =
          bestUser.documento.replace(/\D/g, '').trim() === telefonoNorm && telefonoNorm !== '';
        this.logger.info(
          `[DOCUPDATE] Row ${rowNum}: Match NOMBRE fuzzy (${(bestScore * 100).toFixed(0)}%) user.id=${bestUser.id} "${bestUser.nombre_completo || bestUser.nombre}" replaceDoc=${docEsTelefono}`
        );
        return this.applyUpdate(bestUser, dto, 'NOMBRE_FUZZY', baseResult, docEsTelefono);
      }
    }

    // ── No encontrado ──
    this.logger.warn(`[DOCUPDATE] Row ${rowNum}: NO ENCONTRADO "${dto.name}" tel=${dto.telefono} ced=${dto.cedula}`);
    return {
      ...baseResult,
      matchMethod: 'NO_ENCONTRADO',
      actualizado: false,
    };
  }

  /**
   * Aplica la actualización al usuario encontrado
   * @param replaceDocumento - true si el documento actual es el telefono y se debe reemplazar por cedula
   */
  private async applyUpdate(
    usuario: { id: number; documento: string; nombre: string; apellido: string; nombre_completo: string | null; telefono: string; email: string },
    dto: UpdateUserAdminCsvDto,
    matchMethod: MatchMethod,
    baseResult: { rowNum: number; csvName: string; csvCedula: string; csvTelefono: string; csvEmail: string },
    replaceDocumento: boolean
  ): Promise<UserDocUpdateResult> {
    try {
      // Preparar datos de actualización
      const updateData: any = {};
      let documentoAnterior = usuario.documento;
      let documentoNuevo = usuario.documento;
      let passwordActualizado = false;

      // Si se encontró por telefono en documento → reemplazar documento por cedula
      if (replaceDocumento && dto.cedula) {
        // Verificar que la cedula no esté ya usada por otro usuario
        const existeConCedula = await prismaMainService.user_admin.findFirst({
          where: {
            documento: dto.cedula,
            id: { not: usuario.id },
          },
        });

        if (existeConCedula) {
          this.logger.warn(
            `[DOCUPDATE] Row ${baseResult.rowNum}: Cedula ${dto.cedula} ya existe en user_admin.id=${existeConCedula.id}. No se actualiza documento.`
          );
        } else {
          updateData.documento = dto.cedula;
          documentoNuevo = dto.cedula;
        }
      }

      // Hashear cedula como password
      if (dto.cedula) {
        const hashedPassword = await bcrypt.hash(dto.cedula, BCRYPT_SALT_ROUNDS);
        updateData.password = hashedPassword;
        passwordActualizado = true;
      }

      // Fuzzy match del rol → id_permiso
      let rolAsignado: { id_permiso: number; nombre: string; similitud: number } | undefined;
      if (dto.rol_) {
        const roleResult = await this.fuzzyService.findPermisoIdByRol(dto.rol_);
        if (roleResult) {
          updateData.id_permiso = roleResult.id;
          rolAsignado = {
            id_permiso: roleResult.id,
            nombre: roleResult.nombre,
            similitud: roleResult.similitud,
          };
        } else {
          updateData.id_permiso = DEFAULT_PERMISO_ID;
          rolAsignado = { id_permiso: DEFAULT_PERMISO_ID, nombre: 'Asesor (default)', similitud: 0 };
        }
      }

      // Solo hacer update si hay algo que actualizar
      if (Object.keys(updateData).length === 0) {
        return {
          ...baseResult,
          matchMethod,
          actualizado: false,
          documentoAnterior,
          error: 'Nothing to update (no cedula provided)',
        };
      }

      await prismaMainService.user_admin.update({
        where: { id: usuario.id },
        data: updateData,
      });

      this.logger.info(
        `[DOCUPDATE] Row ${baseResult.rowNum}: Usuario id=${usuario.id} actualizado OK (${matchMethod})`
      );

      return {
        ...baseResult,
        matchMethod,
        actualizado: true,
        documentoAnterior,
        documentoNuevo,
        passwordActualizado,
        rolAsignado,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[DOCUPDATE] Row ${baseResult.rowNum}: Error update: ${msg}`);
      return {
        ...baseResult,
        matchMethod,
        actualizado: false,
        error: msg,
      };
    }
  }

  // ─── Utilidades de fuzzy match (reutilizadas del patrón existente) ──

  private removeAccents(str: string): string {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private fuzzyMatchString(str1: string, str2: string): number {
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

export default UserAdminDocUpdateService.getInstance();
