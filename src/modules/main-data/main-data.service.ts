import { prismaMainService } from '../../database/main/prisma-main.service';
import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import ClienteMapperService from './cliente-mapper';
import { ReferenceParser } from './reference-parser';
import WinstonAdapter from '../../config/adapters/winstonAdapter';
import QueueService from '../../domain/class/queue.service';
import RefinanciamientoService from '../../amortizacion/amortizacion-refinanciamiento.service';
import { getTasabyPeriocidad } from '../../utils/functions/getTasabyPeriocidad';
import { getIdbyFuzzy } from '../../utils/functions/getIdbyFuzzy';
import { getDiaPago } from '../../utils/functions/getDiaPago';
import { getDatacreditScore } from '../../utils/functions/getDatacreditScore';
import { raw } from '@prisma/client/runtime/library';
import { getEstadoValidoFromList } from '../../utils/functions/getDataCreditState';

/**************************************************************************************************
 * Servicio para datos Main
 * 
 * Servicio para operaciones CRUD en la base de datos principal
 * Acceso a múltiples modelos: user_cliente, info_personal, pagos, productos, etc.
 ***************************************************************************************************/

class MainDataService {
  private static instance: MainDataService;
  private logger: typeof WinstonAdapter;

  constructor() {
    this.logger = WinstonAdapter;
  }

  public static getInstance(): MainDataService {
    if (!MainDataService.instance) {
      MainDataService.instance = new MainDataService();
    }
    return MainDataService.instance;
  }

  /**
   * Calcula similitud entre dos strings para fuzzy matching
   */
  private calcularSimilitud(a: string, b: string): number {
    const max = Math.max(a.length, b.length);
    if (max === 0) return 1;
    let diferencias = 0;
    for (let i = 0; i < max; i++) {
      if (a[i] !== b[i]) diferencias++;
    }
    return 1 - (diferencias / max);
  }

  /**
   * Obtiene el estado válido más parecido con fuzzy matching (70%+)
   */
  private async getEstadoValidoFromList(estadoLegacy: string): Promise<string> {
    try {
      const estadosValidos = await prismaMainService.lista_estado_credito.findMany({
        select: { tipo: true }
      });

      if (!estadosValidos || estadosValidos.length === 0) {
        return 'EN ESTUDIO';
      }

      const estadoNormalizado = String(estadoLegacy || '').trim().toUpperCase();

      // Match exacto
      const matchExacto = estadosValidos.find(e => e.tipo.toUpperCase() === estadoNormalizado);
      if (matchExacto) {
        return matchExacto.tipo;
      }

      // Fuzzy match
      let mejorMatch = estadosValidos[0].tipo;
      let mejorSimilitud = 0;

      for (const estado of estadosValidos) {
        const similitud = this.calcularSimilitud(estadoNormalizado, estado.tipo.toUpperCase());
        if (similitud > mejorSimilitud) {
          mejorSimilitud = similitud;
          mejorMatch = estado.tipo;
        }
      }

      if (mejorSimilitud >= 0.7) {
        this.logger.info(`[ESTADO] Fuzzy: "${estadoLegacy}" → "${mejorMatch}" (${(mejorSimilitud * 100).toFixed(0)}%)`);
        return mejorMatch;
      }

      return 'EN ESTUDIO';
    } catch (error) {
      this.logger.warn(`[ESTADO] Error: ${error}. Using fallback.`);
      return 'EN ESTUDIO';
    }
  }

  /**
   * Parsea fecha de forma segura
   * Intenta múltiples formatos y devuelve ISO string o fallback
   * Maneja: strings, Date objects, números (como día del mes)
   */
  private parseFecha(fecha: any, fallbackDate: Date = new Date()): string {
    try {
      if (fecha === null || fecha === undefined || fecha === '') {
        return fallbackDate.toISOString().split('T')[0];
      }

      // Si es Date object
      if (fecha instanceof Date) {
        if (!isNaN(fecha.getTime())) {
          return fecha.toISOString().split('T')[0];
        }
      }

      // Si es string, intenta parsear
      if (typeof fecha === 'string') {
        // Si es string vacío
        if (fecha.trim() === '') {
          return fallbackDate.toISOString().split('T')[0];
        }

        const parsed = new Date(fecha);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      }

      // Si es número, interpretarlo como día del mes
      if (typeof fecha === 'number') {
        const dia = Math.floor(fecha);
        // Validar que sea un día válido (1-31)
        if (dia >= 1 && dia <= 31) {
          const hoy = new Date(fallbackDate);
          hoy.setDate(dia);
          if (!isNaN(hoy.getTime())) {
            return hoy.toISOString().split('T')[0];
          }
        }
      }

      // Fallback final
      return fallbackDate.toISOString().split('T')[0];
    } catch (error) {
      this.logger.warn(`[PARSE_FECHA] Error parsing fecha=${fecha}: ${error}, using fallback`);
      return fallbackDate.toISOString().split('T')[0];
    }
  }

  // ==================== USER CLIENTE ====================

  async getAllUserClientes(skip?: number, take?: number) {
    return await prismaMainService.user_cliente.findMany({
      skip: skip || 0,
      take: take || 100,
    });
  }

  async getUserClienteById(id: number) {
    return await prismaMainService.user_cliente.findUnique({
      where: { id },
    });
  }

  async getUserClienteByDocumento(documento: string) {
    return await prismaMainService.user_cliente.findUnique({
      where: { documento },
    });
  }

  // ==================== INFO PERSONAL ====================

  async getAllInfoPersonal(skip?: number, take?: number) {
    return await prismaMainService.info_personal.findMany({
      skip: skip || 0,
      take: take || 100,
    });
  }

  async getInfoPersonalById(id: number) {
    return await prismaMainService.info_personal.findUnique({
      where: { id },
    });
  }

  // ==================== INFO CONTACTO ====================

  async getAllInfoContacto(skip?: number, take?: number) {
    return await prismaMainService.info_contacto.findMany({
      skip: skip || 0,
      take: take || 100,
    });
  }

  async getInfoContactoById(id: number) {
    return await prismaMainService.info_contacto.findUnique({
      where: { id },
    });
  }

  // ==================== INFO LABORAL ====================

  async getAllInfoLaboral(skip?: number, take?: number) {
    return await prismaMainService.info_laboral.findMany({
      skip: skip || 0,
      take: take || 100,
    });
  }

  async getInfoLaboralById(id: number) {
    return await prismaMainService.info_laboral.findUnique({
      where: { id },
    });
  }

  // ==================== INFO REFERENCIAS ====================

  async getAllInfoReferencias(skip?: number, take?: number) {
    return await prismaMainService.info_referencias.findMany({
      skip: skip || 0,
      take: take || 100,
    });
  }

  async getInfoReferenciaById(id: number) {
    return await prismaMainService.info_referencias.findUnique({
      where: { id },
    });
  }

  // ==================== PAGOS ====================

  async getAllPagos(skip?: number, take?: number) {
    return await prismaMainService.pagos.findMany({
      skip: skip || 0,
      take: take || 100,
    });
  }

  async getPagoById(id: number) {
    return await prismaMainService.pagos.findUnique({
      where: { id_pago: id },
    });
  }

  // ==================== PRODUCTOS ====================

  async getAllProductos(skip?: number, take?: number) {
    return await prismaMainService.producto.findMany({
      skip: skip || 0,
      take: take || 100,
    });
  }

  async getProductoById(id: number) {
    return await prismaMainService.producto.findUnique({
      where: { id },
    });
  }

  // ==================== INVENTARIO ====================

  async getAllInventario(skip?: number, take?: number) {
    return await prismaMainService.inventario.findMany({
      skip: skip || 0,
      take: take || 100,
    });
  }

  async getInventarioById(product_id: number, almacen: number) {
    return await prismaMainService.inventario.findUnique({
      where: { product_id_almacen: { product_id, almacen } },
    });
  }

  // ==================== PEDIDOS ====================

  async getAllPedidos(skip?: number, take?: number) {
    return await prismaMainService.pedido.findMany({
      skip: skip || 0,
      take: take || 100,
    });
  }

  async getPedidoById(id: number) {
    return await prismaMainService.pedido.findUnique({
      where: { id },
    });
  }

  // ==================== ESTUDIOS DE CRÉDITO ====================

  async getAllEstudiosCredito(skip?: number, take?: number) {
    return await prismaMainService.estudio_de_credito.findMany({
      skip: skip || 0,
      take: take || 100,
    });
  }

  async getEstudioCreditoById(id: number) {
    return await prismaMainService.estudio_de_credito.findUnique({
      where: { id },
    });
  }

  // ==================== HISTORIAL PAGOS ====================

  async getAllHistorialPagos(skip?: number, take?: number) {
    return await prismaMainService.historial_pagos.findMany({
      skip: skip || 0,
      take: take || 100,
    });
  }

  async getHistorialPagoById(id: number) {
    return await prismaMainService.historial_pagos.findUnique({
      where: { id },
    });
  }

  // ==================== ESTADÍSTICAS ====================

  async getEstadisticasGenerales() {
    const usuariosTotal = await prismaMainService.user_cliente.count();
    const pagosTotal = await prismaMainService.pagos.count();
    const productosTotal = await prismaMainService.producto.count();
    const pedidosTotal = await prismaMainService.pedido.count();

    return {
      usuarios: usuariosTotal,
      pagos: pagosTotal,
      productos: productosTotal,
      pedidos: pedidosTotal,
    };
  }

  // ==================== MIGRACIÓN DE CLIENTE ====================

  /**
   * SIMPLIFIED: Migra SOLO usuario + información personal desde Legacy al Main
   * 
   * Pasos:
   * 1. Consulta cliente en LEGACY por documento
   * 2. Valida que existe en LEGACY
   * 3. Valida que NO existe en MAIN
   * 4. Mapea datos a DTOs (user + info only)
   * 5. Inicia transacción en MAIN
   * 6. Crea user_cliente
   * 7. Crea info_personal
   * 8. Crea info_contacto
   * 9. Crea info_laboral
   * 10. Crea info_referencias
   * 11. Crea cónyuge si existe
   * 12. Confirma transacción
   * 13. Retorna usuario completado
   * 
   * NOTA: Este método SOLO crea usuario + información.
   * Los créditos, amortizaciones, pedidos y saldos se migran en fases separadas.
   */
  async migrateClienteFromLegacy(documento: string): Promise<any> {
    // 1. Consultar cliente en LEGACY usando SQL directo para manejar enums vacíos
    const clientesData = await prismaLegacyService.$queryRaw<any[]>`
      SELECT 
        CAST(id AS UNSIGNED) as id,
        nombre,
        primer_nombre,
        segundo_nombre,
        primer_apellido,
        segundo_apellido,
        tipo_doc,
        num_doc,
        fecha_nacimiento,
        direccion,
        barrio,
        CAST(municipio_id AS UNSIGNED) as municipio_id,
        movil,
        fijo,
        email,
        placa,
        ocupacion,
        empresa,
        NULLIF(tipo_actividad, '') as tipo_actividad,
        CAST(codeudor_id AS UNSIGNED) as codeudor_id,
        numero_de_creditos,
        CAST(user_create_id AS UNSIGNED) as user_create_id,
        CAST(user_update_id AS UNSIGNED) as user_update_id,
        calificacion,
        created_at,
        updated_at,
        dir_empresa,
        tel_empresa,
        CAST(conyuge_id AS UNSIGNED) as conyuge_id,
        genero,
        NULLIF(estado_civil, '') as estado_civil,
        fecha_exp,
        lugar_exp,
        lugar_nacimiento,
        NULLIF(nivel_estudios, '') as nivel_estudios,
        antiguedad_movil,
        anos_residencia,
        NULLIF(envio_correspondencia, '') as envio_correspondencia,
        NULLIF(estrato, '') as estrato,
        meses_residencia,
        NULLIF(tipo_vivienda, '') as tipo_vivienda,
        nombre_arrendador,
        telefono_arrendador,
        cargo,
        descripcion_actividad,
        doc_empresa,
        fecha_vinculacion,
        NULLIF(tipo_contrato, '') as tipo_contrato,
        reportado
      FROM clientes
      WHERE num_doc = ${documento}
      LIMIT 1
    `;

    if (!clientesData || clientesData.length === 0) {
      throw new Error(`Cliente no encontrado en base de datos LEGACY: ${documento}`);
    }

    // Convertir BigInt a number PRIMERO para todas las operaciones con Prisma
    const clienteLegacy = {
      ...clientesData[0],
      id: Number(clientesData[0].id),
      municipio_id: clientesData[0].municipio_id ? Number(clientesData[0].municipio_id) : null,
      conyuge_id: clientesData[0].conyuge_id ? Number(clientesData[0].conyuge_id) : null,
      codeudor_id: clientesData[0].codeudor_id ? Number(clientesData[0].codeudor_id) : null,
      user_create_id: Number(clientesData[0].user_create_id),
      user_update_id: clientesData[0].user_update_id ? Number(clientesData[0].user_update_id) : null,
      conyuges: [],
    };

    // Obtener cónyuge relacionado (si existe) - AHORA con ID convertido a number
    if (clienteLegacy.conyuge_id) {
      const conyugeData = await prismaLegacyService.conyuges.findUnique({
        where: { id: clienteLegacy.conyuge_id },
      });
      if (conyugeData) {
        clienteLegacy.conyuges = [conyugeData];
      }
    }

    // 2. Validar que existe en LEGACY
    if (!clienteLegacy) {
      throw new Error(`Cliente no encontrado en base de datos LEGACY: ${documento}`);
    }

    // 3. Validar que NO existe en MAIN
    const clienteExistente = await prismaMainService.user_cliente.findUnique({
      where: { documento },
    });

    if (clienteExistente) {
      throw new Error(`Cliente ya existe en base de datos MAIN: ${documento}`);
    }

    // 4. Mapear datos a DTOs
    const mapperService = ClienteMapperService.getInstance();

    const [userClienteError, userClienteDto] = mapperService.mapToUserCliente(clienteLegacy);
    if (userClienteError) throw new Error(`Error en mapeo UserCliente: ${userClienteError}`);

    const [infoPersonalError, infoPersonalDto] = mapperService.mapToInfoPersonal(clienteLegacy);
    if (infoPersonalError) throw new Error(`Error en mapeo InfoPersonal: ${infoPersonalError}`);

    // 4.3 Obtener nombre, departamento y codigo_departamento del municipio si existe
    let municipioData: any = null;
    if (clienteLegacy.municipio_id) {
      municipioData = await prismaLegacyService.$queryRaw<any[]>`
        SELECT nombre, departamento, codigo_departamento
        FROM municipios 
        WHERE CAST(id AS UNSIGNED) = ${clienteLegacy.municipio_id}
        LIMIT 1
      `;
    }

    const [infoContactoError, infoContactoDto] = mapperService.mapToInfoContacto(clienteLegacy, municipioData?.[0] || null);
    if (infoContactoError) throw new Error(`Error en mapeo InfoContacto: ${infoContactoError}`);

    const [infoLaboralError, infoLaboralDto] = mapperService.mapToInfoLaboral(clienteLegacy);
    if (infoLaboralError) throw new Error(`Error en mapeo InfoLaboral: ${infoLaboralError}`);

    // 4.4 Obtener lista de parentescos válidos de main DB para fuzzy matching
    const listaParentescos = await prismaMainService.lista_parentesco.findMany({
      select: { tipo: true },
    });
    const parentescosArray = listaParentescos.map(p => p.tipo);
    const parser = new ReferenceParser(parentescosArray);

    // 4.5 Obtener estudios del cliente con referencias comentarios (ref_1 a ref_4)
    let estudiosData: any[] = [];
    if (clienteLegacy.id) {
      estudiosData = await prismaLegacyService.estudios.findMany({
        where: { cliente_id: clienteLegacy.id },
        select: { ref_1: true, ref_2: true, ref_3: true, ref_4: true },
      });
    }

    const [infoReferenciasError, infoReferenciasDto] = mapperService.mapToInfoReferencias(
      clienteLegacy,
      estudiosData,
      parser
    );
    if (infoReferenciasError) throw new Error(`Error en mapeo InfoReferencias: ${infoReferenciasError}`);

    // Map conyuge if exists
    let conyugeDto: any = null;
    if (clienteLegacy.conyuges && clienteLegacy.conyuges.length > 0) {
      const [conyugeError, conyugeMapped] = mapperService.mapToConyuge(clienteLegacy.conyuges[0], documento);
      if (conyugeError) throw new Error(`Error en mapeo Cónyuge: ${conyugeError}`);
      conyugeDto = conyugeMapped;
    }

    // SIMPLIFIED TRANSACTION: Create ONLY user + info (no credits/amortization)
    try {
      const result = await prismaMainService.$transaction(async (tx) => {
        // 6. Crear user_cliente
        const userCliente = await tx.user_cliente.create({
          data: {
            documento: userClienteDto!.documento,
            nombre: userClienteDto!.nombre,
            apellido: userClienteDto!.apellido,
            tipo: userClienteDto!.tipo,
            email: userClienteDto!.email || 'clienteSinEmail@Migradofacilito',
            telefono: userClienteDto!.telefono,
            nombre_completo: userClienteDto!.nombre_completo,
            password: userClienteDto!.password,
            estado_registro: userClienteDto!.estado_registro,
          },
        });

        // 7. Crear info_personal using raw SQL with FK handling
        await tx.$executeRawUnsafe(
          `INSERT INTO info_personal (documento, nombre, apellido, tipoDocumento, fecha_nacimiento, fecha_expedicion, lugar_expedicion, estudios, estrato, conyuge, fecha_registro) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 
                   COALESCE((SELECT tipo FROM lista_estudios WHERE tipo = ? LIMIT 1), 
                            (SELECT tipo FROM lista_estudios LIMIT 1), 'N/A'),
                   COALESCE((SELECT tipo FROM lista_estrato WHERE tipo = ? LIMIT 1), 
                            (SELECT tipo FROM lista_estrato LIMIT 1), 'N/A'),
                   ?, NOW())`,
          infoPersonalDto!.documento,
          infoPersonalDto!.nombre,
          infoPersonalDto!.apellido,
          infoPersonalDto!.tipoDocumento,
          infoPersonalDto!.fecha_nacimiento || '',
          infoPersonalDto!.fecha_expedicion || '',
          infoPersonalDto!.lugar_expedicion || '',
          infoPersonalDto!.estudios || 'N/A',
          infoPersonalDto!.estrato || 'N/A',
          infoPersonalDto!.conyuge // SI o NO
        );

        // 7.1 Retrieve created info_personal
        const infoPersonal = await tx.info_personal.findUnique({
          where: { documento: infoPersonalDto!.documento },
        });

        // 8. Crear info_contacto using raw SQL with fuzzy matching
        await tx.$executeRawUnsafe(
          `INSERT INTO info_contacto (documento, celular, email, direccion, ciudad, genero, estado_civil, barrio, tipo_vivienda, telefono_residencial, tiempo_vivienda, fecha_registro)
           VALUES (?, ?, ?, ?, 
                   COALESCE(
                     (SELECT CONCAT(gc.ciudad, ' - ', gd.name)
                      FROM geo_city gc
                      JOIN geo_department gd ON gc.departamento = gd.id
                      WHERE LOWER(gc.ciudad) LIKE CONCAT('%', LOWER(?), '%')
                      AND gd.code = ?
                      LIMIT 1),
                     (SELECT CONCAT(gc.ciudad, ' - ', gd.name)
                      FROM geo_city gc
                      JOIN geo_department gd ON gc.departamento = gd.id
                      WHERE LOWER(gc.ciudad) LIKE CONCAT('%', LOWER(?), '%')
                      LIMIT 1),
                     CONCAT(?, ' - ', ?),
                     'N/A'
                   ),
                   COALESCE((SELECT tipo FROM lista_genero WHERE tipo = ? LIMIT 1), NULL),
                   COALESCE(
                     (SELECT tipo FROM lista_civil WHERE tipo = ? LIMIT 1),
                     (SELECT tipo FROM lista_civil WHERE LOWER(tipo) LIKE CONCAT('%', LOWER(?), '%') LIMIT 1),
                     (SELECT tipo FROM lista_civil ORDER BY id ASC LIMIT 1),
                     NULL
                   ),
                   ?, 
                   COALESCE(
                     (SELECT tipo FROM lista_vivienda WHERE tipo = ? LIMIT 1),
                     (SELECT tipo FROM lista_vivienda WHERE LOWER(tipo) LIKE CONCAT('%', LOWER(?), '%') LIMIT 1),
                     (SELECT tipo FROM lista_vivienda ORDER BY id ASC LIMIT 1),
                     NULL
                   ),
                   ?, 
                   COALESCE(
                     (SELECT tipo FROM listado_tiempo_vivienda WHERE tipo = ? LIMIT 1),
                     (SELECT tipo FROM listado_tiempo_vivienda WHERE LOWER(tipo) LIKE CONCAT('%', LOWER(?), '%') LIMIT 1),
                     (SELECT tipo FROM listado_tiempo_vivienda ORDER BY id ASC LIMIT 1),
                     NULL
                   ),
                   NOW())`,
          infoContactoDto!.documento,
          infoContactoDto!.celular,
          infoContactoDto!.email || 'clientesinEmail@Migradofacilito',
          infoContactoDto!.direccion,
          infoContactoDto!.ciudad,
          municipioData?.[0]?.codigo_departamento || null,
          infoContactoDto!.ciudad,
          municipioData?.[0]?.nombre || 'N/A',
          municipioData?.[0]?.departamento || 'N/A',
          infoContactoDto!.genero || null,
          infoContactoDto!.estado_civil || null,
          infoContactoDto!.estado_civil || null,
          infoContactoDto!.barrio || null,
          infoContactoDto!.tipo_vivienda || null,
          infoContactoDto!.tipo_vivienda || null,
          infoContactoDto!.telefono_residencial || '0',
          infoContactoDto!.tiempo_vivienda || null,
          infoContactoDto!.tiempo_vivienda || null
        );

        // 8.1 Retrieve created info_contacto
        const infoContacto = await tx.info_contacto.findUnique({
          where: { documento: infoContactoDto!.documento },
        });

        // 9. Crear info_laboral using raw SQL with fuzzy matching
        await tx.$executeRawUnsafe(
          `INSERT INTO info_laboral (documento, ocupacion_oficio, empresa, direccion_empresa, nit, tipo_contrato, cargo, actividadEconomica, telefono, fecha_vinculacion, descripcion, id_rango, fecha_registro)
           VALUES (?, 
                   COALESCE((SELECT tipo FROM lista_ocupacion WHERE tipo = ? LIMIT 1), 
                            (SELECT tipo FROM lista_ocupacion LIMIT 1), 'N/A'),
                   ?, 
                   COALESCE(?, ''),
                   ?, 
                   COALESCE((SELECT tipo FROM lista_contrato WHERE tipo = ? LIMIT 1), 'N/A'),
                   ?, ?, ?, ?, ?, 
                   COALESCE((SELECT id FROM lista_salario WHERE id = ? LIMIT 1),
                            (SELECT id FROM lista_salario ORDER BY id ASC LIMIT 1),
                            1),
                   NOW())`,
          infoLaboralDto!.documento,
          infoLaboralDto!.ocupacion_oficio || 'N/A',
          infoLaboralDto!.empresa || 'N/A',
          infoLaboralDto!.direccion_empresa || '',
          infoLaboralDto!.nit || '',
          infoLaboralDto!.tipo_contrato || 'N/A',
          infoLaboralDto!.cargo || 'N/A',
          infoLaboralDto!.actividadEconomica || '',
          infoLaboralDto!.telefono || '0',
          infoLaboralDto!.fecha_vinculacion
            ? new Date(infoLaboralDto!.fecha_vinculacion as string).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          infoLaboralDto!.descripcion || '',
          infoLaboralDto!.id_rango || 1
        );

        // 9.1 Retrieve created info_laboral
        const infoLaboral = await tx.info_laboral.findUnique({
          where: { documento: infoLaboralDto!.documento },
        });

        // 10. Crear info_referencias
        const infoReferencias = await tx.info_referencias.create({
          data: {
            documento: infoReferenciasDto!.documento,
            nombreFamiliar: infoReferenciasDto!.nombreFamiliar || '',
            parentescoFamiliar: infoReferenciasDto!.parentescoFamiliar || null,
            telefonoFamiliar: infoReferenciasDto!.telefonoFamiliar || '0',
            direccion_familiar: infoReferenciasDto!.direccion_familiar || '',
            nombreFamiliar2: infoReferenciasDto!.nombreFamiliar2 || '',
            parentescoFamiliar2: infoReferenciasDto!.parentescoFamiliar2 || null,
            celularFamiliar2: infoReferenciasDto!.celularFamiliar2 || '0',
            direccion_familiar_2: infoReferenciasDto!.direccion_familiar_2 || '',
            nombrePersonal: infoReferenciasDto!.nombrePersonal || '',
            parentescoPersonal: infoReferenciasDto!.parentescoPersonal || null,
            telefonoPersonal: infoReferenciasDto!.telefonoPersonal || '0',
            direcion_personal: infoReferenciasDto!.direcion_personal || '',
            nombrePersonal2: infoReferenciasDto!.nombrePersonal2 || '',
            parentescoPersonal2: infoReferenciasDto!.parentescoPersonal2 || null,
            celularPersonal2: infoReferenciasDto!.celularPersonal2 || '0',
            direccion_personal_2: infoReferenciasDto!.direccion_personal_2 || '',
          },
        });

        // 11. Crear o actualizar cónyuge if exists (resiliente: error no falla el cliente)
        let conyuge = null;
        if (conyugeDto) {
          try {
            conyuge = await tx.conyuge.upsert({
              where: { documento: conyugeDto.documento },
              update: {
                nombres: conyugeDto.nombres,
                apellidos: conyugeDto.apellidos,
                tipo_documento: conyugeDto.tipo_documento,
                documento_conyuge: conyugeDto.documento_conyuge,
                telefono: conyugeDto.telefono,
              },
              create: {
                nombres: conyugeDto.nombres,
                apellidos: conyugeDto.apellidos,
                tipo_documento: conyugeDto.tipo_documento,
                documento_conyuge: conyugeDto.documento_conyuge,
                documento: conyugeDto.documento,
                telefono: conyugeDto.telefono,
              },
            });
       
          } catch (conyugeError) {
            conyuge = null;
          }
        }

        // 12. Return simplified result
        return {
          userCliente,
          infoPersonal,
          infoContacto,
          infoLaboral,
          infoReferencias,
          conyuge,
        };
      });

      // Log migration summary
      // this.logger.info(
      //   `✅ USUARIO MIGRADO: ${documento} - ${result.userCliente.nombre_completo}`
      // );

      // 13. Return user with nested relationships (user + info only)
      return {
        user_cliente: {
          ...result.userCliente,
          info_personal: result.infoPersonal,
          info_contacto: result.infoContacto,
          info_laboral: result.infoLaboral,
          info_referencias: result.infoReferencias,
          ...(result.conyuge && { conyuge: result.conyuge }),
        },
      };
    } catch (error) {
      // Transaction automatically rolled back on error
      throw new Error(`Error during client migration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ==================== AMORTIZACIONES CON ESTADO ====================

  /**
   * Get amortizaciones with estado derived from historial_pagos
   * Matches cuotas by number + date proximity (±7 days) to determine if PAGADA or PENDIENTE
   */
  async getAmortizacionesConEstado(prestamoID: number) {
    try {
      // 1. Get all amortizaciones
      const amortizaciones = await prismaMainService.amortizacion.findMany({
        where: { prestamoID },
        orderBy: { Numero_cuota: 'asc' }
      });

      // 2. Get all payment history records
      const pagasHistoricas = await prismaMainService.historial_pagos.findMany({
        where: { prestamoID },
        select: {
          Numero_cuota: true,
          total_pagado: true,
          fecha_registro: true,
          recibo: true
        }
      });

      // 3. Enrich each cuota with estado derived from payment history
      const cuotasEnriquecidas = amortizaciones.map(cuota => {
        const cuotaFecha = new Date(cuota.fecha_pago);
        const fechaMin = new Date(cuotaFecha);
        fechaMin.setDate(fechaMin.getDate() - 7);  // 7 days before
        const fechaMax = new Date(cuotaFecha);
        fechaMax.setDate(fechaMax.getDate() + 7);  // 7 days after

        // Search for payment with matching cuota number AND within date range
        const pagoEncontrado = pagasHistoricas.find(pago => {
          const pagoFecha = new Date(pago.fecha_registro);
          const esNumeroCuotaIgual = pago.Numero_cuota === parseInt(cuota.Numero_cuota);
          const estaDentroRango = pagoFecha >= fechaMin && pagoFecha <= fechaMax;
          return esNumeroCuotaIgual && estaDentroRango;
        });

        return {
          ...cuota,
          estado_pago: pagoEncontrado ? 'PAGADA' : 'PENDIENTE',
          pago_info: pagoEncontrado ? {
            total_pagado: pagoEncontrado.total_pagado,
            fecha_pago: pagoEncontrado.fecha_registro,
            recibo: pagoEncontrado.recibo
          } : null
        };
      });

      return cuotasEnriquecidas;
    } catch (error) {
      this.logger.warn(`Error getting amortizaciones with estado: ${error}`);
      throw error;
    }
  }

  /**
   * BULK MIGRATION: Process multiple documents from Excel file
   * Secuentially migrates each documento by calling migrateClienteFromLegacy()
   * Returns report with successful and failed migrations
   */
  async procesarBulkMigracionExcel(
    documentos: string[]
  ): Promise<{ exitosos: number; errores: number; totalProcesados: number; detalles: any[] }> {
    const detalles: any[] = [];
    let exitosos = 0;
    let errores = 0;

    this.logger.info(`[BULK] Iniciando migración masiva de ${documentos.length} documentos`);

    for (let i = 0; i < documentos.length; i++) {
      const documento = documentos[i];

      try {
        this.logger.info(`[BULK] Procesando documento ${i + 1}/${documentos.length}: ${documento}`);

        // Call existing migration method for each document
        const resultado = await this.migrateClienteFromLegacy(documento);

        exitosos++;
        detalles.push({
          documento,
          prestamo_ID: resultado.prestamo_ID || '-',
          usuario: resultado.usuario || '-',
          cuotas: resultado.cuotas_totales || '-',
          estado: 'EXITOSO',
          timestamp: new Date().toISOString()
        });

        this.logger.info(`[BULK] ✅ Migración exitosa para documento ${documento}`);
      } catch (error) {
        errores++;
        detalles.push({
          documento,
          estado: 'ERROR',
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });

        this.logger.error(`[BULK] ❌ Error migrando documento ${documento}: ${error}`);
      }
    }

    const resumen = {
      exitosos,
      errores,
      totalProcesados: documentos.length,
      detalles
    };

    this.logger.info(
      `[BULK] Migración masiva completada: ${exitosos} exitosos, ${errores} errores de ${documentos.length} documentos`
    );

    return resumen;
  }

  // ==================== MIGRACIÓN DE CRÉDITOS - PHASE 2 ====================



  /**
   * MIGRATION PHASE 2: Migra créditos de un cliente desde Legacy a Main
   * 
   * Bifurcación SINGLE-QUERY:
   * - Query 1 (INNER JOIN creditos): Busca créditos relacionados existentes
   *   - Si 0 filas → PATH A: Registrar en documento_precredito (sin créditos)
   *   - Si N filas → PATH B: Procesar y migrar cada crédito
   * 
   * Resilencia: error en 1 crédito NO falla el documento completo
   */
  async migrateCreditsPhase(documento: string): Promise<{
    status: "SIN_CREDITOS" | "CREDITOS_MIGRADOS" | "TODOS_FALLIDOS",
    creditosMigrados?: number,
    enqueuedAmortizaciones?: number,
    documentoRegistrado?: boolean,
    errores?: string[],
    queryUsed?: "Q1"
  }> {
    try {
      // ========================= QUERY 1: CREDITOS RELACIONADOS =========================
      // QUERY EXACTA: Obtener créditos del cliente desde Legacy (con INNER JOIN creditos)
      const creditosData = await prismaLegacyService.$queryRaw<any[]>`
SELECT 
    clientes.num_doc AS documento,
    precreditos.vlr_fin AS valor_prestamo,
    precreditos.aprobado AS estado_aprobacion,
    precreditos.cuota_inicial,
    precreditos.s_inicial AS segunda_inicial,
    precreditos.meses AS plazo,
    precreditos.cuotas AS numero_cuotas,
    precreditos.periodo AS periodicidad,
    precreditos.vlr_cuota,
    amortizaciones.porc_interes AS tasa,
    amortizaciones.porc_tea AS tasa_efectiva_anual,
    precreditos.p_fecha AS fecha_pago_1,
    precreditos.s_fecha AS fecha_pago_2,
    fc.fecha_pago AS proxima_fecha_pago,
    creditos.id AS credito_id_legacy,
    creditos.estado,
    creditos.cuotas_faltantes,
    creator.name AS creador,
    precreditos.created_at AS fecha_creacion,
    precreditos.id AS precredito_id,
    amortizaciones.porc_aval AS seguro,
    amortizaciones.porc_iva_aval AS iva_aval,
    amortizaciones.cta_capital,
    amortizaciones.cta_aval,
    amortizaciones.cta_iva_aval,
    amortizaciones.total_cta_aval,
    creditos.castigada AS es_castigada,
    updator.name AS actualizador,
    creditos.updated_at AS ultima_fecha_actualizacion,
    carteras.id AS cartera_id,
    carteras.nombre AS nombre_cartera,
    carteras.nombre AS linea_credito,
    codeudores.num_doc AS documento_codeudor,
    codeudores.id AS id_codeudor,
    estudios.cal_asesor,
    estudios.cal_estudio,
    estudios.created_at AS creacion_de_estudio,
    estudios.estDatacredito_id,
    est_datacreditos.puntaje AS puntaje_datacredito_fc
FROM clientes
LEFT JOIN codeudores 
    ON clientes.codeudor_id = codeudores.id
INNER JOIN precreditos
    ON clientes.id = precreditos.cliente_id 
LEFT JOIN estudios
    ON clientes.id = estudios.cliente_id 
INNER JOIN creditos
    ON precreditos.id = creditos.precredito_id 
LEFT JOIN amortizaciones
    ON precreditos.id = amortizaciones.precredito_id
INNER JOIN users AS creator
    ON precreditos.user_create_id = creator.id
INNER JOIN users AS updator
    ON precreditos.user_create_id = updator.id
LEFT JOIN fecha_cobros fc 
    ON creditos.id = fc.credito_id
INNER JOIN carteras 
    ON precreditos.cartera_id = carteras.id
LEFT JOIN est_datacreditos
    ON estudios.estDatacredito_id = est_datacreditos.id
WHERE clientes.num_doc = ${documento}
ORDER BY precreditos.id DESC
      `;

      // ========================= DUAL-QUERY LOGIC =========================
      let queryUsed: "Q1" | "Q2" = "Q1";
      let dataToProcess = creditosData;

      // Si Query 1 retorna 0, intentar Query 2 (precreditos fallback)
      if (!creditosData || creditosData.length === 0) {
        try {
          this.logger.info(`[PHASE 2] Documento registrado sin créditos: ${documento}`);
        } catch (error) {
          await prismaMainService.documento_precredito.create({
            data: {
              documento_cliente: documento,
              estado: 'SIN_CREDITOS_RELACIONADOS'
            }
          });
        }

        return {
          status: "SIN_CREDITOS",
          documentoRegistrado: true,
          queryUsed: "Q1"
        };
      }


      // ========================= PATH B: Con créditos (Q1 o Q2) =========================
      const errores: string[] = [];
      let creditosMigrados = 0;
      let enqueuedAmortizaciones = 0;

      this.logger.info(`[Face credito] 🔄 Iniciando procesamiento de ${dataToProcess.length} créditos (Query: ${queryUsed})`);

      for (const row of dataToProcess) {
        try {
          // i. Mapear fila a detalle_credito DTO
          const creditoIndex = dataToProcess.indexOf(row) + 1;
          this.logger.info(`[Fase credito] 📌 Crédito ${creditoIndex}/${dataToProcess.length} para documento ${documento}`);


          const calcularSimilitud = (a: string, b: string): number => {
            const max = Math.max(a.length, b.length);
            let diferencias = 0;
            for (let i = 0; i < max; i++) {
              if (a[i] !== b[i]) diferencias++;
            }
            return 1 - (diferencias / max);
          };

          const mapEstadoCredito = (estadoLegacy: string): string => {
            // 1. Normalizar entrada: trim + mayúsculas para comparación
            const estadoNormalizado = String(estadoLegacy || '').trim().toUpperCase();

            // 2. Mapeo directo EXACTO desde enum legacy creditos_estado a estados main
            const mapaExacto: { [key: string]: string } = {
              'AL DIA': 'ACTIVO',           // Legacy: "Al dia" → Main: "ACTIVO"
              'MORA': 'ACTIVO',             // Legacy: "Mora" → Main: "ACTIVO" (crédito activo pero en mora)
              'PREJURIDICO': 'PREJURIDICO', // Legacy: "Prejuridico" → Main: "PREJURIDICO"
              'JURIDICO': 'JURIDICO',       // Legacy: "Juridico" → Main: "JURIDICO"
              'CANCELADO': 'FINALIZADO',    // Legacy: "Cancelado" → Main: "FINALIZADO"
              'CANCELADO POR REFINANCIACION': 'REFINANCIADO'  // Legacy con espacios
            };

            // 3. Intentar match exacto primero
            if (mapaExacto[estadoNormalizado]) {
              const estadoMapeado = mapaExacto[estadoNormalizado];
              return estadoMapeado;
            }

            // 4. Fuzzy match: encontrar el más parecido si no es exacto
            let mejorMatch = 'EN ESTUDIO'; // fallback
            let mejorSimilitud = 0;

            for (const [estadoLegacyKey, estadoMainValue] of Object.entries(mapaExacto)) {
              const similitud = calcularSimilitud(estadoNormalizado, estadoLegacyKey);
              if (similitud > mejorSimilitud) {
                mejorSimilitud = similitud;
                mejorMatch = estadoMainValue;
              }
            }

            // Si la similitud es >= 70%, usar el match fuzzy
            if (mejorSimilitud >= 0.7) {
              this.logger.warn(`[PHASE 2] ⚠️ Estado mapeado por FUZZY: "${estadoLegacy}" → "${mejorMatch}" (similitud: ${(mejorSimilitud * 100).toFixed(0)}%)`);
              return mejorMatch;
            }

            // 5. Fallback final: EN ESTUDIO
            this.logger.warn(`[PHASE 2] ⚠️ Estado desconocido "${estadoLegacy}" → usando "EN ESTUDIO" (fallback)`);
            return 'EN ESTUDIO';
          };


          const mapPeriodicidad = (periodoLegacy: string): string => {
            const periodoNormalizado = String(periodoLegacy || '').trim().toUpperCase();
            const mapaPeriodicidad: { [key: string]: string } = {
              'QUINCENAL': 'QUINCENAL',
              'MENSUAL': 'MENSUAL',
              'SEMANAL': 'SEMANAL',
              'DIARIO': 'DIARIO'
            };

            // Intentar match exacto primero
            if (mapaPeriodicidad[periodoNormalizado]) {
              this.logger.info(`[PHASE 2] 📅 Periodicidad mapeada: "${periodoLegacy}" → "${mapaPeriodicidad[periodoNormalizado]}" (EXACTO)`);
              return mapaPeriodicidad[periodoNormalizado];
            }

            // Fuzzy match con similitud >= 0.7
            let mejorMatch = 'MENSUAL'; // fallback
            let mejorSimilitud = 0;
            for (const [periodoKey, periodoValue] of Object.entries(mapaPeriodicidad)) {
              const similitud = calcularSimilitud(periodoNormalizado, periodoKey);
              if (similitud > mejorSimilitud) {
                mejorSimilitud = similitud;
                mejorMatch = periodoValue;
              }
            }

            if (mejorSimilitud >= 0.7) {
              this.logger.warn(`[PHASE 2] ⚠️ Periodicidad mapeada por FUZZY: "${periodoLegacy}" → "${mejorMatch}" (similitud: ${(mejorSimilitud * 100).toFixed(0)}%)`);
              return mejorMatch;
            }

            this.logger.warn(`[PHASE 2] ⚠️ Periodicidad desconocida "${periodoLegacy}" → usando "MENSUAL" (fallback)`);
            return 'MENSUAL';
          };

          // Extraer día de pago de fecha_pago_1
          let diaPago = '15';
          if (row.fecha_pago_1 !== null && row.fecha_pago_1 !== undefined) {
            try {
              // Si es número, usarlo directamente como día (1-31)
              if (typeof row.fecha_pago_1 === 'number') {
                const diaNum = Math.floor(row.fecha_pago_1);
                if (diaNum >= 1 && diaNum <= 31) {
                  diaPago = String(diaNum);
                }
              } else {
                // Si es string/date, extraer día
                const fecha = new Date(row.fecha_pago_1);
                if (!isNaN(fecha.getTime())) {
                  const dia = fecha.getDate();
                  diaPago = String(dia);
                }
              }
            } catch (e) {
              diaPago = '15'; // fallback
            }
          }

          const detalleCreditoData = {
            documento: row.documento,
            valor_prestamo: String(row.valor_prestamo),
            estado: mapEstadoCredito(row.estado || 'Activo'),
            tasa: getTasabyPeriocidad(String(row.tasa || 0), row.periodicidad),
            numero_cuotas: String(row.numero_cuotas),
            plazo: String(row.plazo), //meses
            valor_cuota: String(row.vlr_cuota),
            tipoCredito: 'CREDITO MIGRADO',
            origen: 'LEGACY_MIGRADO',
            creador: row.creador || 'SISTEMA_LEGACY',
            fecha_registro: row.fecha_creacion,
            fecha_actualizacion: row.ultima_fecha_actualizacion,
            seguro: parseInt(row.seguro || 0),
            iva_aval: String(row.iva_aval || 0),
            pablok: 0,
            seguro_add: String(row.seguro_add || 0),
            castigo: row.es_castigada === 'Si' ? 'SI' : 'NO',
            dia_pago: getDiaPago(row.fecha_pago_1, row.fecha_pago_2),
            fecha_Pago: this.parseFecha(row.fecha_pago_1),
            inicial: parseInt(row.cuota_inicial || 0),
            periocidad: mapPeriodicidad(row.periodicidad),
            id_estrategia: getIdbyFuzzy(row.nombre_cartera).estrategiaId,
            id_cartera: getIdbyFuzzy(row.nombre_cartera).carteraId,
          };

          // Usar credito_id_legacy como prestamo_ID para correlacionar con facturas en Phase 4
          const prestamoCreado = await prismaMainService.$transaction(async (tx) => {
            const creditoCreateData: any = {
              documento: detalleCreditoData.documento,
              tipoCredito: detalleCreditoData.tipoCredito,
              valor_prestamo: detalleCreditoData.valor_prestamo,
              inicial: detalleCreditoData.inicial,
              plazo: detalleCreditoData.plazo,
              numero_cuotas: detalleCreditoData.numero_cuotas,
              valor_cuota: detalleCreditoData.valor_cuota,
              periocidad: detalleCreditoData.periocidad,
              tasa: String(detalleCreditoData.tasa),
              dia_pago: detalleCreditoData.dia_pago,
              fecha_Pago: detalleCreditoData.fecha_Pago,
              estado: detalleCreditoData.estado,
              origen: detalleCreditoData.origen,
              creador: detalleCreditoData.creador,
              fecha_registro: row.fecha_pago_1 ? new Date(row.fecha_pago_1) : new Date(),
              seguro: detalleCreditoData.seguro,
              iva_aval: detalleCreditoData.iva_aval ? parseFloat(String(detalleCreditoData.iva_aval)) : 0,
              pablok: detalleCreditoData.pablok,
              seguro_add: detalleCreditoData.seguro_add ? parseFloat(String(detalleCreditoData.seguro_add)) : 0,
              fecha_actualizacion: new Date(),
              id_estrategia: detalleCreditoData.id_estrategia,
              id_cartera: detalleCreditoData.id_cartera
            };

            // Si tenemos credito_id_legacy de Query 1, usarlo como prestamo_ID para correlacionar con facturas
            if (row.credito_id_legacy && row.credito_id_legacy > 0) {
              creditoCreateData.prestamo_ID = Number(row.credito_id_legacy);
              this.logger.info(`[Fase 2] 🔗 Correlacionando con credito_id_legacy=${Number(row.credito_id_legacy)} para Phase 4`);
            }

            // Parsear fecha_registro de forma segura - SIEMPRE debe ser Date válida
            try {
              if (row.fecha_creacion) {
                const fechaCreacion = new Date(row.fecha_creacion);
                creditoCreateData.fecha_registro = !isNaN(fechaCreacion.getTime())
                  ? fechaCreacion
                  : new Date();
              } else {
                creditoCreateData.fecha_registro = new Date();
              }
            } catch (dateError) {
              this.logger.warn(`[Fase 2] ⚠️ Error parsing fecha_creacion, using current date`);
              creditoCreateData.fecha_registro = new Date();
            }

            // Validar que fecha_registro es una Date válida antes de usar en Prisma
            if (!creditoCreateData.fecha_registro || !(creditoCreateData.fecha_registro instanceof Date) || isNaN(creditoCreateData.fecha_registro.getTime())) {
              creditoCreateData.fecha_registro = new Date();
            }

            const clienteExiste = await tx.user_cliente.findUnique({
              where: { documento: creditoCreateData.documento }
            });

            if (!clienteExiste) {
              throw new Error(
                `[FK VIOLATION] Cliente con documento="${creditoCreateData.documento}" no existe en user_cliente. ` +
                `Phase 1 (migración de cliente) debe completarse antes de Phase 2 (créditos).`
              );
            }

            this.logger.debug(`[Fase 2] ✅ Cliente validado en BD: documento=${creditoCreateData.documento}`);

            const credito = await tx.detalle_credito.create({
              data: creditoCreateData
            });


            if (creditosMigrados === 0) {
              try {
                const scoreValor = getDatacreditScore(row.puntaje_datacredito_fc || '0');
                const estadoValor = await getEstadoValidoFromList(row.estado);

                await tx.estudio_de_credito.upsert({
                  where: { documento },
                  update: {
                    score: scoreValor,
                    estado: estadoValor,
                    observacion: `Actualizado. Asesor: ${row.cal_asesor || 'N/A'}`
                  },
                  create: {
                    documento: documento,
                    sect_financiero: '0',
                    sect_real: '0',
                    sect_coop: '0',
                    sect_telco: '0',
                    score: scoreValor,
                    edad: '0',
                    observacion: `Migrado. Asesor: ${row.cal_asesor || 'N/A'}, Cal: ${row.cal_estudio || 'N/A'}`,
                    estado: estadoValor,
                    creador: 1,
                    fecha_registro: new Date(),
                    fecha_actualizacion: new Date()
                  }
                });
                try {
                  let comentarioTexto = '';
                  let tipoComentario = 'MIGRACION';

                  // Condición 1: Si scoreValor es '0' → Sin experiencia crediticia
                  if (scoreValor === '0') {
                    comentarioTexto = `[MIGRACIÓN] Cliente sin experiencia crediticia. Score: ${scoreValor}. Requiere análisis especial.`;
                    tipoComentario = 'SISTEMA';
                  }
                  // Condición 2: Si scoreValor es 'Reportado' → Cliente reportado
                  else if (scoreValor === '1') {
                    comentarioTexto = `[MIGRACIÓN] Cliente reportado en DataCrédito. Score: ${scoreValor}. Revisar historial antes de desembolso.`;
                    tipoComentario = 'ALERTA';
                  }

                  // Crear comentario solo si hay texto
                  if (comentarioTexto) {
                    try {
                      await tx.comentarios.create({
                        data: {
                          documento: documento,
                          comentario: comentarioTexto,
                          tipo: "ESTUDIO",
                          fecha_registro: new Date()
                        }
                      });
                    } catch (comentarioError) {
                      const comentarioMsg = comentarioError instanceof Error ? comentarioError.message : String(comentarioError);
                    }
                  }
                } catch (comentarioWrapError) {
                  const wrapMsg = comentarioWrapError instanceof Error ? comentarioWrapError.message : String(comentarioWrapError);
                  this.logger.warn(`[COMENTARIO] ⚠️ Error: ${wrapMsg}`);
                }
                this.logger.info(`[ESTUDIO] ✅ Creado para doc=${documento}, score=${scoreValor}, estado=${estadoValor}`);
              } catch (estudioError) {
                const msg = estudioError instanceof Error ? estudioError.message : String(estudioError);
                this.logger.warn(`[ESTUDIO] ⚠️ Error: ${msg}. Continuando...`);
              }
            }

            return credito;
          });

          creditosMigrados++;

          // iii. Enqueuear automático a AMORTIZACIONES (pasando prestamo_ID)
          const queueService = QueueService.getInstance();

          // Log ANTES de enqueuear
          this.logger.info(`[Fase 2] 🔄 Enqueuando prestamo_ID=${prestamoCreado.prestamo_ID} a AMORTIZACIONES...`);
          await queueService.enqueue(String(prestamoCreado.prestamo_ID), 'AMORTIZACIONES');
          await queueService.enqueue(String(prestamoCreado.prestamo_ID), 'PAGOS');
          enqueuedAmortizaciones++;

          const creditoIdInfo = row.credito_id_legacy ? `[credito_legacy=${row.credito_id_legacy}]` : '[auto-increment]';
          this.logger.info(`[Fase 2] ✅ Crédito migrado: prestamo_ID=${prestamoCreado.prestamo_ID} ${creditoIdInfo}, enqueuado a AMORTIZACIONES y PAGOS`);

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.logger.warn(`[Fase 2] ❌ Error crédito: ${errorMsg}`);
          errores.push(errorMsg);
          // Continuar con próximo crédito (NO fallar documento)
        }
      }

      // Determinar resultado final
      if (creditosMigrados === 0) {

        this.logger.info(`[Fase 2] Todos los créditos fallaron, registrando documento_precredito`);

        try {
          await prismaMainService.documento_precredito.create({
            data: {
              documento_cliente: documento,
              estado: 'ERROR_MIGRACION_CREDITOS'
            }
          });
        } catch (error) {
          this.logger.warn(`[Fase 2] Error registrando documento en estado ERROR: ${error}`);
        }

        return {
          status: "TODOS_FALLIDOS",
          documentoRegistrado: true,
          errores,
          queryUsed
        };
      }

      this.logger.info(`[PHASE 2] Completado: ${creditosMigrados} créditos migrados, ${enqueuedAmortizaciones} enqueuados (Query: ${queryUsed})`);

      return {
        status: "CREDITOS_MIGRADOS",
        creditosMigrados,
        enqueuedAmortizaciones,
        queryUsed
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Fase 2] Error fatal en migrateCreditsPhase: ${errorMsg}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3: AMORTIZACIONES - Preparar datos para cálculo de amortización
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * PHASE 3: Prepara datos de crédito para cálculo de amortización
   * 
   * 📋 Consulta el crédito ya migrado en main.detalle_credito
   * 📋 Extrae todos los campos necesarios para el cálculo
   * 📋 Construye un objeto amortizacionContext con estructura clara
   * ⏸️  NO calcula las amortizaciones (eso será el siguiente paso)
   * 
   * Bifurcación:
   * - Crédito no encontrado → CREDITO_NO_ENCONTRADO
   * - Crédito encontrado → DATOS_PREPARADOS (retorna contexto + calculoParams)
   * - Error en query → ERROR
   * 
   * @param documento - Número de documento del cliente
   * @param prestamo_ID - ID del crédito en main.detalle_credito
   * @returns Promise<AmortizacionesPhaseResult> - Objeto con datos preparados
   */
  async prepareAmortizacionesPhase(documento: string, prestamo_ID: number): Promise<{
    status: "DATOS_PREPARADOS" | "CREDITO_NO_ENCONTRADO" | "ERROR";
    prestamo_ID?: number;
    creditoData?: any;
    calculoParams?: {
      prestamo: number;
      plazo: number;
      periocidad: string;
      pablok: number;
      seguro: number;
      iva_aval: number;
      tasa: number;
      diasPago: number;
      fechaDesembolso: Date;
    };
    errores?: string[];
  }> {
    try {
      this.logger.info(`[PHASE 3] Iniciando prepareAmortizacionesPhase para documento=${documento}, prestamo_ID=${prestamo_ID}`);

      // i. Consultar crédito en main.detalle_credito
      const credito = await prismaMainService.detalle_credito.findUnique({
        where: { prestamo_ID }
      });

      if (!credito) {
        this.logger.warn(`[PHASE 3] ❌ Crédito no encontrado: prestamo_ID=${prestamo_ID}`);
        return {
          status: "CREDITO_NO_ENCONTRADO",
          errores: [`Crédito con prestamo_ID=${prestamo_ID} no existe en main.detalle_credito`]
        };
      }

      if (credito.documento !== documento) {
        this.logger.warn(`[PHASE 3] ⚠️ Documento no coincide: esperado=${documento}, encontrado=${credito.documento}`);
        return {
          status: "ERROR",
          errores: [`Documento no coincide: esperado=${documento}, encontrado=${credito.documento}`]
        };
      }

      // ii. Extraer datos de día de pago
      let diasPago = 15;
      if (credito.dia_pago) {
        try {
          diasPago = parseInt(String(credito.dia_pago));
        } catch (e) {
          diasPago = 15;
        }
      }

      // iii. Extraer fecha de desembolso
      let fechaDesembolso = new Date();
      if (credito.fecha_Pago) {
        try {
          fechaDesembolso = new Date(credito.fecha_Pago);
        } catch (e) {
          fechaDesembolso = new Date();
        }
      }

      // iv. Extraer número de cuotas
      let plazo = 12;
      if (credito.numero_cuotas) {
        try {
          plazo = parseInt(String(credito.numero_cuotas));
        } catch (e) {
          plazo = 12;
        }
      }

      // v. Construir objeto calculoParams con todos los datos necesarios
      const calculoParams = {
        prestamo: parseInt(String(credito.valor_prestamo)),
        plazo: plazo,
        periocidad: credito.periocidad || 'MENSUAL',
        pablok: credito.pablok || 0,
        seguro: parseInt(String(credito.seguro)) || 0,
        iva_aval: parseInt(String(credito.iva_aval)) || 0,
        tasa: parseFloat(String(credito.tasa)) || 0,
        diasPago: diasPago,
        fechaDesembolso: fechaDesembolso
      };

      this.logger.info(`[PHASE 3] ✅ Datos preparados: prestamo_ID=${prestamo_ID}, plazo=${plazo}, tasa=${calculoParams.tasa}%`);

      return {
        status: "DATOS_PREPARADOS",
        prestamo_ID,
        creditoData: credito,
        calculoParams
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[PHASE 3] ❌ Error: ${errorMsg}`);
      return {
        status: "ERROR",
        errores: [errorMsg]
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3B: AMORTIZACIONES - Calcular e insertar amortizaciones
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * PHASE 3B: Calcula y crea amortizaciones + sanciones en main
   * 
   * Flujo:
   * 1. Buscar crédito by prestamo_ID en main.detalle_credito
   * 2. Llamar a RefinanciamientoService.calcularRefinanciamientoConPagos(prestamo_ID)
   * 3. Mapear amortizacionActualizada[] a schema de main.amortizacion
   * 4. Insertar amortizaciones en bulk en transacción
   * 5. FASE SANCIONES: Buscar sanciones del crédito en legacy
   * 6. Sumar sanciones con estado 'Debe'
   * 7. Actualizar main.amortizacion.sancion con el monto total distribuido
   * 8. Retornar status + cantidades
   * 
   * @param prestamo_ID - ID del crédito en main.detalle_credito
   * @returns Promise<AmortizacionesMigrationResult>
   */
  async migrateAmortizacionesPhase(prestamo_ID: number): Promise<{
    status: "AMORTIZACIONES_Y_SANCIONES_CREADAS" | "CREDITO_NO_ENCONTRADO" | "ERROR";
    amortizacionesCreadas?: number;
    sancionesAgregadas?: number;
    totalSanciones?: number;
    errores?: string[];
  }> {
    try {
      this.logger.info(`[Fase Amortizacion] Iniciando migrateAmortizacionesPhase para prestamo_ID=${prestamo_ID}`);

      // 1. Validar que el crédito existe en main
      const credito = await prismaMainService.detalle_credito.findUnique({
        where: { prestamo_ID }
      });

      if (!credito) {
        this.logger.warn(`[Fase Amortizacion] ❌ Crédito no encontrado: prestamo_ID=${prestamo_ID}`);
        return {
          status: "CREDITO_NO_ENCONTRADO",
          errores: [`Crédito con prestamo_ID=${prestamo_ID} no existe en main.detalle_credito`]
        };
      }

      // 2. Llamar a RefinanciamientoService para obtener amortizaciones
      const refinanciamientoService = RefinanciamientoService.getInstance();
      const resultado = await refinanciamientoService.calcularRefinanciamientoConPagos(prestamo_ID);

      if (!resultado.exitoso) {
        this.logger.error(`[Fase Amortizacion] ❌ RefinanciamientoService falló: ${resultado.mensaje}`);
        return {
          status: "ERROR",
          errores: [resultado.mensaje, ...(resultado.errores || [])]
        };
      }

      if (!resultado.amortizacionActualizada || resultado.amortizacionActualizada.length === 0) {
        this.logger.warn(`[Fase Amortizacion] ⚠️ Sin amortizaciones calculadas para prestamo_ID=${prestamo_ID}`);
        return {
          status: "AMORTIZACIONES_Y_SANCIONES_CREADAS",
          amortizacionesCreadas: 0,
          sancionesAgregadas: 0,
          totalSanciones: 0
        };
      }

      // 3. Mapear amortizacionActualizada[] a schema main.amortizacion
      // ✅ RefinanciamientoService es responsable de incluir TODAS las cuotas (pagadas + futuras)
      const amortizacionesToCreate = resultado.amortizacionActualizada.map(cuota => ({
        prestamoID: prestamo_ID,
        documento: credito.documento,
        Numero_cuota: String(cuota.numeroCuota),
        capital: parseInt(String(cuota.capital)) || 0,
        interes: parseInt(String(cuota.interes)) || 0,
        aval: parseInt(String(cuota.aval)) || 0,
        IVA: parseInt(String(cuota.iva)) || 0,
        pablok: 0,
        seguro: parseInt(String(credito.seguro)) || 0,
        sancion: 0,
        total_cuota: parseInt(String(cuota.cuotaTotal)) || 0,
        saldo: String(cuota.saldo || '0'),
        fecha_pago: cuota.fechaPago || new Date().toISOString().split('T')[0]
      }));

      const numPagadas = amortizacionesToCreate.filter(a => a.capital === 0 && a.saldo === '0').length;
      const numFuturas = amortizacionesToCreate.length - numPagadas;

      const createdAmortizaciones = await prismaMainService.$transaction(async (tx) => {
        return await tx.amortizacion.createMany({
          data: amortizacionesToCreate,
          skipDuplicates: false
        });
      });

      this.logger.info(`[Face Amortizacion] ✅ ${createdAmortizaciones.count} amortizaciones creadas para prestamo_ID=${prestamo_ID} (${numPagadas} pagadas + ${numFuturas} futuras)`);

      // ═══════════════════════════════════════════════════════════════════════════
      //TODO: FASE SANCIONES: Buscar y migrar sanciones de legacy
      // ═══════════════════════════════════════════════════════════════════════════

      // let totalSanciones = 0;
      // let sancionesAgregadas = 0;

      // try {
      //   this.logger.info(`[PHASE 3B - SANCIONES] Buscando sanciones para documento=${credito.documento}`);

      //   // 5a. Buscar cliente en legacy por documento
      //   const clienteLegacy = await prismaLegacyService.clientes.findFirst({
      //     where: { num_doc: credito.documento }
      //   });

      //   if (!clienteLegacy) {
      //     this.logger.warn(`[PHASE 3B - SANCIONES] ⚠️ Cliente no encontrado en legacy: documento=${credito.documento}`);
      //   } else {
      //     this.logger.info(`[PHASE 3B - SANCIONES] Cliente encontrado en legacy: cliente_id=${clienteLegacy.id}`);

      //     // 5b. Buscar créditos del cliente en legacy usando raw SQL para ignorar enums vacíos
      //     const creditosLegacy = await prismaLegacyService.$queryRaw<any[]>`
      //       SELECT id FROM creditos 
      //       WHERE precredito_id IN (
      //         SELECT id FROM precreditos WHERE cliente_id = ${clienteLegacy.id}
      //       )
      //     `;

      //     if (!creditosLegacy || creditosLegacy.length === 0) {
      //       this.logger.warn(`[PHASE 3B - SANCIONES] ⚠️ No se encontraron créditos legacy para cliente_id=${clienteLegacy.id}`);
      //     } else {
      //       this.logger.info(`[PHASE 3B - SANCIONES] ${creditosLegacy.length} crédito(s) encontrado(s) en legacy`);

      //       // 5c. Extraer IDs de créditos - convertir BigInt a number
      //       const creditoIds = creditosLegacy.map(c => Number(c.id));

      //       // 5d. Buscar sanciones con estado 'Debe'
      //       const sanciones = await prismaLegacyService.sanciones.findMany({
      //         where: {
      //           credito_id: { in: creditoIds },
      //           estado: 'Debe'
      //         }
      //       });

      //       if (sanciones.length === 0) {
      //         this.logger.info(`[PHASE 3B - SANCIONES] ℹ️ Sin sanciones con estado 'Debe' para este crédito`);
      //       } else {
      //         // 5e. Sumar sanciones vigentes
      //         totalSanciones = sanciones.reduce((sum, s) => sum + (s.valor || 0), 0);
      //         this.logger.info(
      //           `[PHASE 3B - SANCIONES] 📊 ${sanciones.length} sanciones encontradas, total: $${totalSanciones}`
      //         );

      //         // 5f. Actualizar amortizaciones distribuyendo las sanciones
      //         const sancionPorCuota = Math.round(totalSanciones / amortizacionesToCreate.length);
      //         const updatedAmortizaciones = await prismaMainService.$transaction(async (tx) => {
      //           return await tx.amortizacion.updateMany({
      //             where: { prestamoID: prestamo_ID },
      //             data: { sancion: sancionPorCuota }
      //           });
      //         });

      //         sancionesAgregadas = updatedAmortizaciones.count;
      //         this.logger.info(
      //           `[PHASE 3B - SANCIONES] ✅ Sanciones agregadas a ${sancionesAgregadas} amortizaciones ` +
      //           `($${sancionPorCuota} por cuota)`
      //         );
      //       }
      //     }
      //   }

      // } catch (sanctionError) {
      //   const sanctionErrorMsg = sanctionError instanceof Error ? sanctionError.message : String(sanctionError);
      //   this.logger.warn(
      //     `[PHASE 3B - SANCIONES] ⚠️ Error procesando sanciones (continuando): ${sanctionErrorMsg}`
      //   );
      //   // No retornamos error aquí - las amortizaciones ya fueron creadas, las sanciones son opcionales
      // }

      // 6. Retornar resultado completo
      return {
        status: "AMORTIZACIONES_Y_SANCIONES_CREADAS",
        amortizacionesCreadas: createdAmortizaciones.count,
        //ancionesAgregadas: sancionesAgregadas,
        //otalSanciones: totalSanciones
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[PHASE 3B] ❌ Error en migrateAmortizacionesPhase: ${errorMsg}`);
      return {
        status: "ERROR",
        errores: [errorMsg]
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4: HISTORIAL DE PAGOS - Migrar facturas legacy a historial_pagos main
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * PHASE 4: Migra historial de pagos (facturas legacy → historial_pagos main)
   * 
   * Flujo:
   * 1. Buscar all facturas en legacy con credito_id = prestamo_ID
   * 2. Mapear cada factura a schema main.historial_pagos
   * 3. Insertar en bulk
   * 4. Retornar status + cantidad
   * 
   * @param prestamo_ID - ID del crédito (correlacionado con legacy.creditos.id)
   * @returns Promise<PaymentHistoryMigrationResult>
   */
  async migratePaymentHistoryPhase(prestamo_ID: number): Promise<{
    status: "PAGOS_MIGRADOS" | "SIN_PAGOS" | "CREDITO_NO_ENCONTRADO" | "ERROR";
    pagosMigrados?: number;
    errores?: string[];
  }> {
    try {
      this.logger.info(`[PHASE 4] Iniciando migratePaymentHistoryPhase para prestamo_ID=${prestamo_ID}`);

      // 1. Validar crédito en main
      const credito = await prismaMainService.detalle_credito.findUnique({
        where: { prestamo_ID }
      });

      if (!credito) {
        this.logger.warn(`[PHASE 4] ❌ Crédito no encontrado: prestamo_ID=${prestamo_ID}`);
        return {
          status: "CREDITO_NO_ENCONTRADO",
          errores: [`Crédito con prestamo_ID=${prestamo_ID} no existe en main.detalle_credito`]
        };
      }

      // 2. Buscar facturas en legacy por credito_id = prestamo_ID
      const facturas = await prismaLegacyService.facturas.findMany({
        where: { credito_id: prestamo_ID }
      });

      if (!facturas || facturas.length === 0) {
        this.logger.info(`[PHASE 4] ℹ️ Sin facturas encontradas para prestamo_ID=${prestamo_ID}`);
        return {
          status: "SIN_PAGOS",
          pagosMigrados: 0
        };
      }

      this.logger.info(`[PHASE 4] 📋 ${facturas.length} factura(s) encontrada(s)`);

      // 3. Mapear facturas a historial_pagos
      const pagosToCreate = facturas.map((factura, idx) => {
        const fecha = factura.fecha ? new Date(factura.fecha) : factura.created_at || new Date();

        return {
          documento: credito.documento,
          prestamoID: prestamo_ID,
          Numero_cuota: idx + 1,
          capital: 0,
          interes: 0,
          aval: 0,
          IVA: 0,
          pablok: 0,
          sanciones: 0,
          prejuridico: 0,
          juridico: 0,
          seguro: 0,
          total_pagado: Math.round(factura.total || 0),
          recibo: factura.num_fact || `FAC-${factura.id}`,
          agente_creador: "MIGRACION",
          bolsa: null,
          canal: factura.tipo || "DESCONOCIDO",
          tipo_pago: factura.banco ? `BANCO: ${factura.banco}` : "NO_ESPECIFICADO",
          creador: "SISTEMA_MIGRACION",
          fecha_registro: fecha
        };
      });

      // 4. Insertar en transacción
      const createdPagos = await prismaMainService.$transaction(async (tx) => {
        return await tx.historial_pagos.createMany({
          data: pagosToCreate,
          skipDuplicates: false
        });
      });

      this.logger.info(
        `[PHASE 4] ✅ ${createdPagos.count} pagos migrados para prestamo_ID=${prestamo_ID}`
      );

      return {
        status: "PAGOS_MIGRADOS",
        pagosMigrados: createdPagos.count
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[PHASE 4] ❌ Error en migratePaymentHistoryPhase: ${errorMsg}`);
      return {
        status: "ERROR",
        errores: [errorMsg]
      };
    }
  }
}

export default MainDataService;
