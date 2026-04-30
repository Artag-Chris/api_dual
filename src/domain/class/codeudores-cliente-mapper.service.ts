import { prismaMainService } from '../../database/main/prisma-main.service';
import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';
import { v4 as uuidv4 } from 'uuid';

interface CodeudorLegacy {
  id: number;
  nombrec: string;
  primer_nombrec: string | null;
  segundo_nombrec: string | null;
  primer_apellidoc: string | null;
  segundo_apellidoc: string | null;
  num_docc: string;
  emailc: string | null;
  movilc: string;
  direccionc: string | null;
  created_at: Date | null;
}

interface CodeudorMappeado {
  documento: string;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  email: string;
  telefono: string;
  tipo: string; // Tipo de documento válido (CC, etc.)
  password: string;
  fecha_registro: Date;
  estado_registro: 'completo' | 'incompleto' | 'contado';
}

interface MigracionResultado {
  status: string;
  totalEncontrados: number;
  migrados: number;
  omitidosSinDocumento: number;
  incompletos: number;
  emailDummy: number;
  duplicadosNombre: number;
  errores: Array<{ num_docc: string; error: string }>;
}

class CodeudoresClienteMapperService {
  private static instance: CodeudoresClienteMapperService;
  private logger = WinstonAdapter;

  private constructor() {}

  public static getInstance(): CodeudoresClienteMapperService {
    if (!CodeudoresClienteMapperService.instance) {
      CodeudoresClienteMapperService.instance = new CodeudoresClienteMapperService();
    }
    return CodeudoresClienteMapperService.instance;
  }

  async migrateAllCodeudoresAsUserCliente(): Promise<MigracionResultado> {
    try {
      this.logger.debug('Iniciando migración de codeudores...');

      // 1. Obtener todos los codeudores con documento
      const codeudoresLegacy = await this.getAllCodeudoresLegacy();
      this.logger.info(`Se encontraron ${codeudoresLegacy.length} codeudores con documento`);

      // 2. Pre-cargar datos existentes en main
      const [emailsExistentes, nombresCompletos, clientesDocumentos] =
        await Promise.all([
          this.getEmailsExistentes(),
          this.getNombresCompletoExistentes(),
          this.getClientesDocumentos(),
        ]);

      this.logger.debug(
        `Pre-cargados: ${emailsExistentes.size} emails, ${nombresCompletos.size} nombres, ${clientesDocumentos.size} clientes`,
      );

      // 3. Mapear y migrar cada codeudor
      const resultado: MigracionResultado = {
        status: 'CODEUDORES_MIGRADOS',
        totalEncontrados: codeudoresLegacy.length,
        migrados: 0,
        omitidosSinDocumento: 0,
        incompletos: 0,
        emailDummy: 0,
        duplicadosNombre: 0,
        errores: [],
      };

      const usuariosAInsertar: CodeudorMappeado[] = [];
      const relacionesCodeudor: Array<{ titular: string; codeudor: string }> = [];
      const emailsEnBatch = new Map<string, number>();
      const nombresEnBatch = new Map<string, number>();

      // Procesar cada codeudor
      for (const codeudor of codeudoresLegacy) {
        try {
          // Validation: documento MANDATORY
          if (!codeudor.num_docc || codeudor.num_docc.trim() === '') {
            resultado.omitidosSinDocumento++;
            this.logger.warn(
              `Codeudor ${codeudor.id} omitido: sin documento (num_docc vacío)`,
            );
            continue;
          }

          const documento = codeudor.num_docc.trim();

          // Mapear nombre y apellido
          const { nombre, apellido } = this.splitNombre(
            codeudor.nombrec,
            codeudor.primer_nombrec,
            codeudor.primer_apellidoc,
          );

          // Email: validar duplicados en pre-carga + batch
          let email = codeudor.emailc
            ? codeudor.emailc.trim().toLowerCase()
            : null;

          if (!email || emailsExistentes.has(email) || emailsEnBatch.has(email)) {
            email = this.generarEmailDummy(documento);
            resultado.emailDummy++;
          } else {
            emailsEnBatch.set(email, 1);
          }

          // Nombre completo: validar duplicados (max 100 chars)
          let nombreCompleto = `${nombre} ${apellido}`.trim().toUpperCase();
          if (
            nombresCompletos.has(nombreCompleto) ||
            nombresEnBatch.has(nombreCompleto)
          ) {
            const contador = (nombresEnBatch.get(nombreCompleto) || 0) + 1;
            nombreCompleto = `${nombreCompleto}_${documento}_${contador}`.toUpperCase();
            nombresEnBatch.set(nombreCompleto, contador);
            resultado.duplicadosNombre++;
            this.logger.debug(
              `Nombre duplicado para ${documento}: adaptado a ${nombreCompleto}`,
            );
          } else {
            nombresEnBatch.set(nombreCompleto, 1);
          }
          // Truncar a máximo 100 caracteres (constraint BD)
          nombreCompleto = nombreCompleto.substring(0, 100);

          // Validar completitud
          const esCompleto = !!(
            nombre &&
            apellido &&
            documento &&
            email &&
            codeudor.movilc
          );
          const estadoRegistro: 'completo' | 'incompleto' | 'contado' = esCompleto
            ? 'completo'
            : 'incompleto';

          if (!esCompleto) {
            resultado.incompletos++;
            this.logger.debug(
              `Codeudor ${documento} marcado como incompleto: nombre=${!!nombre}, apellido=${!!apellido}, email=${!!email}, telefono=${!!codeudor.movilc}`,
            );
          }

          // Construir usuario con tipo válido (CC = Cédula de Ciudadanía)
          const usuarioMappeado: CodeudorMappeado = {
            documento,
            nombre,
            apellido,
            nombre_completo: nombreCompleto,
            email,
            telefono: codeudor.movilc || '0',
            tipo: 'CC', // Tipo de documento válido en lista_documentos
            password: 'TEMPORAL_' + uuidv4().substring(0, 10), // Password temporal
            fecha_registro: codeudor.created_at || new Date(),
            estado_registro: estadoRegistro,
          };

          usuariosAInsertar.push(usuarioMappeado);

          // Guardar relación titular ↔ codeudor
          // Obtener cliente principal si existe
          const clienteDoc = clientesDocumentos.get(documento);
          if (clienteDoc) {
            relacionesCodeudor.push({
              titular: clienteDoc,
              codeudor: documento,
            });
          }
        } catch (error: any) {
          this.logger.error(
            `Error procesando codeudor ${codeudor.id}: ${(error as Error).message}`,
          );
          resultado.errores.push({
            num_docc: codeudor.num_docc || 'desconocido',
            error: (error as Error).message,
          });
        }
      }

      // 4. Insertar en batch
      if (usuariosAInsertar.length > 0) {
        try {
          // Log de diagnóstico: primeros 3 registros
          this.logger.info(`[DEBUG] Primeros 3 registros a insertar:`, 
            JSON.stringify(usuariosAInsertar.slice(0, 3), null, 2)
          );

          const insertResult = await prismaMainService.user_cliente.createMany({
            data: usuariosAInsertar as any,
            skipDuplicates: false,
          });
          
          resultado.migrados = insertResult.count;
          this.logger.info(
            `Inserción batch exitosa: ${insertResult.count}/${usuariosAInsertar.length} codeudores insertados`,
          );
        } catch (batchError: any) {
          this.logger.warn(
            `Batch insert falló: ${(batchError as Error).message}. Intentando inserciones individuales...`,
          );
          // Fallback: insertar individual con manejo de duplicados
          let insertadosIndividual = 0;
          for (const usuario of usuariosAInsertar) {
            try {
              const resultado_individual = await prismaMainService.user_cliente.create({
                data: usuario as any,
              });
              insertadosIndividual++;
              this.logger.debug(`Insertado individual: ${usuario.documento}`);
            } catch (individualError: any) {
              // Ignorar si ya existe (UNIQUE constraint)
              if ((individualError as Error).message.includes('Unique constraint failed')) {
                this.logger.debug(`Documento ${usuario.documento} ya existe, omitido`);
              } else {
                this.logger.warn(
                  `Fallo inserción individual ${usuario.documento}: ${(individualError as Error).message}`,
                );
                resultado.errores.push({
                  num_docc: usuario.documento,
                  error: (individualError as Error).message,
                });
              }
            }
          }
          resultado.migrados = insertadosIndividual;
          this.logger.info(`Inserciones individuales completadas: ${insertadosIndividual}/${usuariosAInsertar.length}`);
        }
      }

      // 5. Insertar relaciones en tabla codeudor
      if (relacionesCodeudor.length > 0) {
        try {
          await prismaMainService.codeudor.createMany({
            data: relacionesCodeudor.map((rel) => ({
              titular: rel.titular,
              codeudor: rel.codeudor,
              estado: 'ACTIVO',
              fecha_registro: new Date(),
            })),
            skipDuplicates: true,
          });
          this.logger.info(
            `Relaciones codeudor guardadas: ${relacionesCodeudor.length}`,
          );
        } catch (relError: any) {
          this.logger.error(
            `Error guardando relaciones: ${(relError as Error).message}`,
          );
          resultado.errores.push({
            num_docc: 'relaciones',
            error: (relError as Error).message,
          });
        }
      }

      this.logger.info(
        `Migración completada. Migrados: ${resultado.migrados}, Omitidos: ${resultado.omitidosSinDocumento}, Incompletos: ${resultado.incompletos}`,
      );

      return resultado;
    } catch (error: any) {
      this.logger.error(
        `Error en migrateAllCodeudoresAsUserCliente: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private async getAllCodeudoresLegacy(): Promise<CodeudorLegacy[]> {
    try {
      const query = `
        SELECT 
          id,
          nombrec,
          primer_nombrec,
          segundo_nombrec,
          primer_apellidoc,
          segundo_apellidoc,
          num_docc,
          emailc,
          movilc,
          direccionc,
          created_at
        FROM \`FACILITO2\`.codeudores
        WHERE num_docc IS NOT NULL AND num_docc != ''
        ORDER BY id ASC
      `;
      const codeudores = await prismaLegacyService.$queryRawUnsafe<
        CodeudorLegacy[]
      >(query);
      return codeudores || [];
    } catch (error: any) {
      this.logger.error(
        `Error en getAllCodeudoresLegacy: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private async getEmailsExistentes(): Promise<Set<string>> {
    try {
      const emails = await prismaMainService.user_cliente.findMany({
        where: { email: { not: '' } },
        select: { email: true },
      });
      return new Set(
        emails
          .map((e: any) => e.email?.toLowerCase())
          .filter((e: any) => e),
      );
    } catch (error: any) {
      this.logger.warn(
        `Error pre-cargando emails: ${(error as Error).message}`,
      );
      return new Set();
    }
  }

  private async getNombresCompletoExistentes(): Promise<Set<string>> {
    try {
      const nombres = await prismaMainService.user_cliente.findMany({
        where: { nombre_completo: { not: '' } },
        select: { nombre_completo: true },
      });
      return new Set(
        nombres.map((n: any) => n.nombre_completo).filter((n: any) => n),
      );
    } catch (error: any) {
      this.logger.warn(
        `Error pre-cargando nombres: ${(error as Error).message}`,
      );
      return new Set();
    }
  }

  private async getClientesDocumentos(): Promise<Map<string, string>> {
    // Mapa de documento_codeudor → documento_cliente
    // Obtener relación clientes → codeudores desde legacy
    try {
      const query = `
        SELECT 
          c.num_doc as cliente_documento,
          cod.num_docc as codeudor_documento
        FROM \`FACILITO2\`.clientes c
        INNER JOIN \`FACILITO2\`.codeudores cod ON c.codeudor_id = cod.id
        WHERE c.num_doc IS NOT NULL 
          AND cod.num_docc IS NOT NULL
          AND cod.num_docc != ''
      `;
      const relaciones = await prismaLegacyService.$queryRawUnsafe<
        Array<{ cliente_documento: string; codeudor_documento: string }>
      >(query);
      
      const mapa = new Map<string, string>();
      relaciones?.forEach((rel) => {
        mapa.set(rel.codeudor_documento, rel.cliente_documento);
      });
      
      this.logger.info(`Relaciones cliente-codeudor cargadas: ${mapa.size}`);
      return mapa;
    } catch (error: any) {
      this.logger.error(
        `Error cargando relaciones cliente-codeudor: ${(error as Error).message}`,
      );
      return new Map();
    }
  }

  private splitNombre(
    nombrec: string,
    primerNombrec: string | null,
    primerApellidoc: string | null,
  ): { nombre: string; apellido: string } {
    let nombre = primerNombrec || nombrec || 'N/A';
    let apellido = primerApellidoc || 'N/A';

    // Limpieza y normalización a mayúsculas
    nombre = nombre.trim().substring(0, 60).toUpperCase();
    apellido = apellido.trim().substring(0, 60).toUpperCase();

    return { nombre, apellido };
  }

  private generarEmailDummy(documento: string): string {
    return `codeudor${documento}@dummy.facilcreditos`.substring(0, 50);
  }
}

export default CodeudoresClienteMapperService;
