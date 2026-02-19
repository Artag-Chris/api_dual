import { prismaMainService } from '../../database/main/prisma-main.service';
import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import ClienteMapperService from './cliente-mapper';
import { CreditoMapper } from './credito-mapper';
import { ReferenceParser } from './reference-parser';
import { BodegaMapper } from '../../domain/class/bodega-mapper';
import { CreditosIntegrationMapper } from '../../domain/class/creditos-integration-mapper';
import { AmortizacionGenerator } from '../../domain/class/amortizacion-generator';
import { EstudiosRealizadosMapper } from '../../domain/class/estudios-realizados-mapper';
import { PedidoMapper } from '../../domain/class/pedido-mapper';
import { SaldoInicialMapper } from '../../domain/class/saldo-inicial-mapper';
import { HistorialPagosMapper } from '../../domain/class/historial-pagos-mapper';
import { AmortizacionCreateDto } from '../../domain/dtos/migrate-cliente.dto';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

/**************************************************************************************************
 * Servicio para datos Main
 * 
 * Servicio para operaciones CRUD en la base de datos principal
 * Acceso a múltiples modelos: user_cliente, info_personal, pagos, productos, etc.
 ***************************************************************************************************/

class MainDataService {
  private static instance: MainDataService;
  private logger: typeof WinstonAdapter;
  private bodegaMapper: BodegaMapper;
  private creditosIntegrationMapper: CreditosIntegrationMapper;
  private amortizacionGenerator: AmortizacionGenerator;
  private estudiosRealizadosMapper: EstudiosRealizadosMapper;
  private pedidoMapper: PedidoMapper;
  private saldoInicialMapper: SaldoInicialMapper;
  private historialPagosMapper: HistorialPagosMapper;

  constructor() {
    this.logger = WinstonAdapter;
    this.bodegaMapper = new BodegaMapper(prismaMainService, prismaLegacyService, this.logger);
    this.creditosIntegrationMapper = new CreditosIntegrationMapper(prismaLegacyService, this.logger);
    this.amortizacionGenerator = new AmortizacionGenerator(this.logger);
    this.estudiosRealizadosMapper = new EstudiosRealizadosMapper(prismaLegacyService, this.logger);
    this.pedidoMapper = new PedidoMapper(prismaMainService, prismaLegacyService, this.logger);
    this.saldoInicialMapper = new SaldoInicialMapper(this.logger);
    this.historialPagosMapper = new HistorialPagosMapper(prismaLegacyService, this.logger);
  }

  public static getInstance(): MainDataService {
    if (!MainDataService.instance) {
      MainDataService.instance = new MainDataService();
    }
    return MainDataService.instance;
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
   * Migra un cliente desde Legacy al Main
   * 
   * Pasos:
   * 1. Consulta cliente en LEGACY por documento
   * 2. Valida que existe en LEGACY
   * 3. Valida que NO existe en MAIN
   * 4. Mapea datos a DTOs
   * 5. Inicia transacción en MAIN
   * 6. Crea user_cliente
   * 7. Crea info_personal
   * 8. Crea info_contacto
   * 9. Crea info_laboral
   * 10. Crea info_referencias
   * 11. Crea cónyuge si existe
   * 12. Confirma transacción
   * 13. Retorna usuario completado con relaciones anidadas
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
//TODO: hay que  colocar el sistema que  me cree el usuario independientemente si tiene credito o no
    // 4.6 Obtener TODOS los precreditos del cliente legacy (sin filtros)
    let precreditosData: any[] = [];
    if (clienteLegacy.id) {
      precreditosData = await prismaLegacyService.precreditos.findMany({
        where: {
          cliente_id: clienteLegacy.id,
        },
        include: {
          carteras: true,
          creditos: true,  // Obtener todos los créditos sin filtros
          users_precreditos_funcionario_idTousers: {
            select: { 
              id: true,
              name: true 
            }
          }
        }
      });
    }

    this.logger.info(
      `📊 PRECREDITOS para cliente ${documento}:` +
      `\n  ✅ Aprobados con interés (tasa > 0): ${precreditosData.length}` +
      `\n  ℹ️  EXCLUIDOS: Simulaciones (aprobado='En_estudio'), Rechazados (aprobado='No'), ` +
      `Sin interés (tasa=0), Sin cuotas válidas`
    );

    let conyugeDto: any = null;
    if (clienteLegacy.conyuges && clienteLegacy.conyuges.length > 0) {
      const [conyugeError, conyugeMapped] = mapperService.mapToConyuge(clienteLegacy.conyuges[0], documento);
      if (conyugeError) throw new Error(`Error en mapeo Cónyuge: ${conyugeError}`);
      conyugeDto = conyugeMapped;
    }

    // PHASE 0: Create bodega mapping (puntos → bodega)
    this.logger.info('[PHASE 0] Creating bodega mapping...');
    const mapeoBodegas = await this.bodegaMapper.crearMapeoBodegas();
    this.logger.info(`[PHASE 0] Bodega mapping created: ${mapeoBodegas.size} entries`);

    // PHASE 9: Get active credits data (if exists)
    this.logger.info('[PHASE 9] Fetching active credit data from legacy...');
    const precreditoIds = precreditosData.map((p: any) => Number(p.id));
    const datosCreditosActivos = await this.creditosIntegrationMapper.obtenerDatosCreditoActivoLote(precreditoIds);
    this.logger.info(`[PHASE 9] Loaded ${datosCreditosActivos.size} active credits`);

    // PHASE 9.1: Classify precreditos by disbursement status
    const precreditosDesembolsados: any[] = [];
    const precreditosPendientesDesembolso: any[] = [];

    for (const precredito of precreditosData) {
      if (precredito.creditos && precredito.creditos.length > 0) {
        // Has creditos record = DISBURSED
        precreditosDesembolsados.push(precredito);
      } else {
        // Approved but no disbursement = PENDING
        precreditosPendientesDesembolso.push(precredito);
      }
    }

    this.logger.info(
      `📊 CLASIFICACIÓN DE CRÉDITOS para cliente ${documento}:` +
      `\n  💰 Desembolsados (con amortización completa): ${precreditosDesembolsados.length}` +
      `\n  ⏳ Aprobados pendientes desembolso (sin amortización): ${precreditosPendientesDesembolso.length}` +
      `\n  📝 Total a migrar: ${precreditosData.length}`
    );

    // 5-12. Iniciar transacción e insertar datos
    try {
      const result = await prismaMainService.$transaction(async (tx) => {
        // 6. Crear user_cliente
        const userCliente = await tx.user_cliente.create({
          data: {
            documento: userClienteDto!.documento,
            nombre: userClienteDto!.nombre,
            apellido: userClienteDto!.apellido,
            tipo: userClienteDto!.tipo,
            email: userClienteDto!.email,
            telefono: userClienteDto!.telefono,
            nombre_completo: userClienteDto!.nombre_completo,
            password: userClienteDto!.password,
            estado_registro: userClienteDto!.estado_registro,
          },
        });

        // 7. Crear info_personal usando SQL directo con manejo de foreign keys
        // Para campos con constraints de FK (estudios, estrato), usamos COALESCE con valores por defecto de la tabla
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

        // 7.1 Recuperar el registro creado
        const infoPersonal = await tx.info_personal.findUnique({
          where: { documento: infoPersonalDto!.documento },
        });

        // 8. Crear info_contacto usando SQL directo con fuzzy matching para foreign keys
        // Usar codigo_departamento para match exacto en geo_department.code
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
          infoContactoDto!.email,
          infoContactoDto!.direccion,
          infoContactoDto!.ciudad,  // ciudad nombre (parameter 1 para fuzzy match)
          municipioData?.[0]?.codigo_departamento || null,  // codigo_departamento para match exacto en code
          infoContactoDto!.ciudad,  // ciudad nombre (parameter 2 para fallback fuzzy match)
          municipioData?.[0]?.nombre || 'N/A',  // ciudad nombre fallback
          municipioData?.[0]?.departamento || 'N/A',  // departamento nombre fallback
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

        // 8.1 Recuperar el registro creado
        const infoContacto = await tx.info_contacto.findUnique({
          where: { documento: infoContactoDto!.documento },
        });

        // 9. Crear info_laboral usando SQL directo con fuzzy match para foreign keys
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

        // 9.1 Recuperar el registro creado
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

        // 10.1 Crear detalle_credito (créditos migrados desde precreditos legacy)
        const detalleCreditos: any[] = [];
        const amortizaciones: any[] = [];
        const pedidos: any[] = [];
        const saldosIniciales: any[] = [];
        
        // Process DISBURSED credits (with complete amortization, payments, etc.)
        if (precreditosDesembolsados && precreditosDesembolsados.length > 0) {
          this.logger.info(`[MIGRATION] Processing ${precreditosDesembolsados.length} DISBURSED credits...`);
          
          for (const precredito of precreditosDesembolsados) {
            const precreditoId = Number(precredito.id);
            
            // Get active credit data
            const datosCreditoActivo = datosCreditosActivos.get(precreditoId) || null;
            
            // Get credito data for fecha calculation
            const creditoLegacy = precredito.creditos?.[0];
            
            const [error, creditoDto] = await CreditoMapper.mapToCreditoDto(
              precredito, 
              clienteLegacy,
              prismaLegacyService,
              creditoLegacy
            );

            if (!error && creditoDto) {
              // Determine final estado (use active credit status if available)
              const estadoFinal = datosCreditoActivo ? datosCreditoActivo.estado : creditoDto.estado;

              // Buscar el tipo de crédito en la lista
              const tipoCredito = await tx.lista_tipo_credito.findFirst({
                where: { tipo: creditoDto.tipoCredito },
              });

              // Obtener campos adicionales desde precredito
              const creador = precredito.users_precreditos_funcionario_idTousers?.name || 'SISTEMA_LEGACY';
              const fechaRegistro = precredito.created_at || new Date();
              const fechaActualizacion = precredito.updated_at;
              
              // Verificar si el crédito fue castigado (si existe en creditos)
              let castigo = 'NO';
              if (datosCreditoActivo && datosCreditoActivo.credito_id) {
                const creditoLegacy = precredito.creditos?.[0];
                if (creditoLegacy?.castigada === 'Si') {
                  castigo = 'SI';
                }
              }
            //TODO: debemos capturar el id del prestamo de legacy y colocarlo en el credito migrado para que concuerde en el detalle credito
              // Crear el registro de crédito
              const detalleCredito = await tx.detalle_credito.create({
                data: {
                  user_cliente: {
                    connect: {
                      documento: creditoDto.documento,
                    },
                  },
                  lista_tipo_credito: {
                    connect: {
                      tipo: tipoCredito?.tipo || 'CREDITO EXPRESS',
                    },
                  },
                  lista_estado_credito: {
                    connect: {
                      tipo: estadoFinal,
                    },
                  },
                  lista_origen_credito: {
                    connect: {
                      tipo: creditoDto.origen,
                    },
                  },
                  valor_prestamo: creditoDto.valor_prestamo,
                  inicial: creditoDto.inicial,
                  plazo: creditoDto.plazo,
                  numero_cuotas: creditoDto.numero_cuotas,
                  valor_cuota: creditoDto.valor_cuota,
                  periocidad: creditoDto.periocidad,
                  tasa: creditoDto.tasa,
                  dia_pago: creditoDto.diaPago,
                  fecha_Pago: creditoDto.fechaPago,
                  seguro: creditoDto.seguro,
                  iva_aval: creditoDto.iva_aval as any,
                  pablok: creditoDto.pablok,
                  seguro_add: creditoDto.seguro_add as any,
                  creador: creador,                          // ✅ Funcionario que creó
                  fecha_registro: fechaRegistro,             // ✅ Fecha original
                  fecha_actualizacion: fechaActualizacion,   // ✅ Fecha última actualización
                  castigo: castigo as any,                   // ✅ Si fue castigado
                },
              });

              detalleCreditos.push(detalleCredito);
              this.logger.info(`[CREDIT] Created detalle_credito ${detalleCredito.prestamo_ID} for precredito ${precreditoId}`);

              // PHASE 11: Generate amortization
              this.logger.info(`[PHASE 11] Generating amortization for prestamo ${detalleCredito.prestamo_ID}...`);
              
              // ✅ Extract amortization parameters from cartera
              let seguroAval = 0.1;     // Default 10% aval
              let ivaAval = 0.19;       // Default 19% IVA
              
              if (precredito?.carteras) {
                try {
                  const amortizacionConfig = precredito.carteras.amortizacion;
                  if (typeof amortizacionConfig === 'string') {
                    const config = JSON.parse(amortizacionConfig);
                    // Extract from cartera JSON: {"seguro": X, "porc_iva_aval": Y}
                    if (config.seguro !== undefined) seguroAval = config.seguro / 100;
                    if (config.porc_iva_aval !== undefined) ivaAval = config.porc_iva_aval / 100;
                    
                    this.logger.info(
                      `[CARTERA] Using amortization params: seguro/aval=` +
                      `${(seguroAval * 100).toFixed(1)}%, iva=${(ivaAval * 100).toFixed(1)}%`
                    );
                  }
                } catch (err) {
                  this.logger.warn(`[CARTERA] Could not parse amortizacion JSON: ${err}`);
                }
              }
              
              // ✅ CALCULATE RESIDUAL FROM PAYMENT HISTORY
              let residualHistorial: number | null = null;
              try {
                const creditoLegacyId = creditoLegacy?.id;
                if (creditoLegacyId) {
                  // Sum all payments (abono) from legacy pagos table
                  const pagosRealizados = await prismaLegacyService.pagos.findMany({
                    where: { credito_id: creditoLegacyId },
                    select: { abono: true },
                  });
                  
                  const sumaPagos = pagosRealizados.reduce((sum: number, pago: any) => sum + (pago.abono || 0), 0);
                  const montoOriginal = parseInt(creditoDto.valor_prestamo);
                  residualHistorial = Math.max(0, montoOriginal - sumaPagos);
                  
                  this.logger.info(
                    `[RESIDUAL] Crédito ${creditoLegacyId}: ` +
                    `Monto original=$${montoOriginal}, Pagos realizados=$${sumaPagos}, ` +
                    `Residual=$${residualHistorial}, ` +
                    `typeof residual=${typeof residualHistorial}`
                  );
                }
              } catch (err) {
                this.logger.warn(`[RESIDUAL] Error calculating residual from payment history: ${err}`);
              }
              
              this.logger.info(`[PARAM CHECK] Pasando residual_historial=${residualHistorial} al amortizador`);
              
              const cuotasAmortizacion = this.amortizacionGenerator.generarAmortizacion({
                prestamo_ID: detalleCredito.prestamo_ID,
                valor_prestamo: parseInt(creditoDto.valor_prestamo),
                numero_cuotas: parseInt(creditoDto.numero_cuotas),
                tasa_mensual: parseFloat(creditoDto.tasa),
                periocidad: creditoDto.periocidad,
                fecha_inicial: new Date(creditoDto.fechaPago),
                datosCreditoActivo,
                valor_cuota_fija: parseFloat(creditoDto.valor_cuota),
                seguro: seguroAval,           // ✅ Aval % from cartera
                iva_aval: ivaAval,            // ✅ IVA % from cartera
                seguro_add: 0,                // ✅ No seguro adicional for now
                pablok: 0,                    // ✅ No pablok for now
                residual_historial: residualHistorial ?? undefined,  // ✅ Pass residual if available (0 is valid!)
              });

              this.logger.info(`[PHASE 11] Generated ${cuotasAmortizacion.length} amortization DTOs (not yet persisted)`);

              // PHASE 14: Migrate payment history FIRST
              // This ensures historial_pagos is populated before PHASE 11B enrichment
              if (datosCreditoActivo && datosCreditoActivo.credito_id) {
                this.logger.info(`[PHASE 14] Migrating complete payment history...`);
                try {
                  // ✅ DEBUG: Log which credito ID we're migrating from
                  this.logger.info(`[PHASE 14] DEBUG - credito_id=${datosCreditoActivo.credito_id}, prestamo_ID=${detalleCredito.prestamo_ID}`);
                  
                  const stats = await this.historialPagosMapper.migrarHistorialPagosCompleto(
                    datosCreditoActivo.credito_id,
                    detalleCredito.prestamo_ID,
                    userCliente.id,
                    documento,
                    tx
                  );
                  
                  // ✅ DEBUG: Verify records were actually created in tx
                  const verificacion = await tx.historial_pagos.findMany({
                    where: { prestamoID: detalleCredito.prestamo_ID },
                    select: { Numero_cuota: true, total_pagado: true }
                  });
                  this.logger.info(`[PHASE 14] DEBUG - Verification: Found ${verificacion.length} historial_pagos records in tx`);
                  
                  this.logger.info(
                    `[PHASE 14] ✅ Payment migration complete - Applied: ${stats.pagosAplicados}, Pending: ${stats.pagosPendientes}, Historial: ${stats.historialCreados}, Detallados: ${stats.detalladosCreados}`
                  );
                } catch (pagoError) {
                  this.logger.error(`[PHASE 14] ❌ Error migrating payments: ${pagoError}`);
                  this.logger.error(`[PHASE 14] Stack: ${(pagoError as any).stack}`);
                }
              } else {
                this.logger.warn(`[PHASE 14] Skipped - no datosCreditoActivo or credito_id`);
              }

              // PHASE 11B: Enrich cuotas - zero out component fields for paid cuotas
              // Legacy system pattern: mark PAGADA by setting capital=0, interes=0, aval=0, IVA=0, etc.
              let cuotasEnriquecidas = [...cuotasAmortizacion];
              try {
                this.logger.info(`[PHASE 11B] Enriching cuotas - checking payment history to mark paid cuotas (date + cuota matching, ±7 days)...`);
                
                // Get all payment records for this prestamo (from PHASE 14, within tx context)
                const pagasHistoricas = await tx.historial_pagos.findMany({
                  where: { prestamoID: detalleCredito.prestamo_ID },
                  select: { Numero_cuota: true, total_pagado: true, fecha_registro: true }
                });
                
                // ✅ Normalize all cuota numbers to string for consistent VARCHAR comparison
                const pagasNormalizadas = pagasHistoricas.map(p => ({
                  ...p,
                  Numero_cuota: String(p.Numero_cuota)
                }));
                
                if (pagasNormalizadas.length > 0) {
                  const sample = pagasNormalizadas.slice(0, 3).map(p => `#${p.Numero_cuota} (${p.fecha_registro})`).join(', ');
                  this.logger.info(
                    `[PHASE 11B] Found ${pagasNormalizadas.length} payment records. Sample: ${sample}. Matching by cuota number + date proximity (±7 days)...`
                  );
                  
                  let marcadasPagadas = 0;
                  
                  // Enrich cuotas: zero out components for paid ones (legacy pattern)
                  cuotasEnriquecidas = cuotasAmortizacion.map(cuota => {
                    const cuotaFecha = new Date(cuota.fecha_pago);
                    const fechaMin = new Date(cuotaFecha);
                    fechaMin.setDate(fechaMin.getDate() - 7);  // 7 days before
                    const fechaMax = new Date(cuotaFecha);
                    fechaMax.setDate(fechaMax.getDate() + 7);  // 7 days after

                    // Search for payment with matching cuota number AND within date range
                    // ✅ STRING-to-STRING comparison for VARCHAR(100) Numero_cuota
                    const pagoEncontrado = pagasNormalizadas.find(pago => {
                      const pagoFecha = new Date(pago.fecha_registro);
                      const numeroCuotaStr = String(cuota.numero_cuota);
                      const esNumeroCuotaIgual = String(pago.Numero_cuota) === numeroCuotaStr;
                      const estaDentroRango = pagoFecha >= fechaMin && pagoFecha <= fechaMax;
                      return esNumeroCuotaIgual && estaDentroRango;
                    });

                    if (pagoEncontrado) {
                      marcadasPagadas++;
                      const cuotaDateStr = cuota.fecha_pago.toISOString().split('T')[0];
                      const pagoDateStr = pagoEncontrado.fecha_registro instanceof Date 
                        ? pagoEncontrado.fecha_registro.toISOString().split('T')[0]
                        : String(pagoEncontrado.fecha_registro).split('T')[0];
                      this.logger.info(
                        `[PHASE 11B] ✓ Cuota #${cuota.numero_cuota} (type: ${typeof cuota.numero_cuota}, match: "${String(pagoEncontrado.Numero_cuota)}") (due: ${cuotaDateStr}) → PAGADO (received: ${pagoDateStr}, amount: $${pagoEncontrado.total_pagado})`
                      );
                      
                      // Zero out component fields to mark as PAGADA (legacy system pattern)
                      const enrichedCuota = {
                        ...cuota,
                        capital: 0,
                        interes: 0,
                        aval: 0,
                        IVA: 0,
                        pablok: 0,
                        seguro: 0,
                        sancion: 0,
                        total_cuota: 0,
                        // ✅ Keep saldo as is (residual balance from amortizador)
                      };
                      
                      // ✅ DEBUG: Verify enrichment values before returning
                      this.logger.info(
                        `[PHASE 11B] DEBUG Enrich #${cuota.numero_cuota}: capital=${enrichedCuota.capital}, interes=${enrichedCuota.interes}, total_cuota=${enrichedCuota.total_cuota}, saldo=${enrichedCuota.saldo}`
                      );
                      
                      return enrichedCuota;
                    }
                    
                    // Return unchanged if not paid
                    return cuota;
                  });
                  
                  this.logger.info(`[PHASE 11B] ✅ Enriched ${marcadasPagadas}/${cuotasAmortizacion.length} cuotas marked as PAGADA`);
                } else {
                  this.logger.info(`[PHASE 11B] No payment history found. All cuotas remain PENDIENTE`);
                }
              } catch (err) {
                this.logger.warn(`[PHASE 11B] Error enriching cuotas: ${err}`);
              }

              // Create amortization records (AFTER enrichment with paid status)
              for (const cuota of cuotasEnriquecidas) {
                // ✅ DEBUG: Log exactly what we're persisting to verify enrichment worked
                const shouldBeZero = cuota.capital === 0 && cuota.interes === 0 && cuota.total_cuota === 0;
                if (shouldBeZero) {
                  this.logger.info(
                    `[PHASE 11B→DB] Cuota #${cuota.numero_cuota} PAGADA: capital=${cuota.capital}, interes=${cuota.interes}, total_cuota=${cuota.total_cuota}, saldo=${cuota.saldo}`
                  );
                }
                
                const amort = await tx.amortizacion.create({
                  data: {
                    prestamoID: cuota.prestamo_ID,
                    documento: documento,
                    Numero_cuota: String(cuota.numero_cuota),
                    capital: cuota.capital,
                    interes: cuota.interes,
                    aval: cuota.aval,
                    IVA: cuota.IVA,
                    total_cuota: cuota.total_cuota,
                    saldo: String(cuota.saldo),
                    fecha_pago: cuota.fecha_pago.toISOString().split('T')[0],
                  },
                });
                amortizaciones.push(amort);
              }
              
              this.logger.info(`[PHASE 11B→Persist] Created ${cuotasEnriquecidas.length} amortization records (with paid status applied)`);

              // PHASE 12: Create pedido with products
              this.logger.info(`[PHASE 12] Creating pedido with products...`);
              try {
                const { pedidoId, productos } = await this.pedidoMapper.crearPedidoConProductos(
                  precreditoId,
                  userCliente.id,
                  detalleCredito.prestamo_ID,
                  mapeoBodegas,
                  tx
                );
                
                if (pedidoId > 0) {
                  pedidos.push({ pedidoId, productos });
                  this.logger.info(`[PHASE 12] Created pedido ${pedidoId} with ${productos} products`);
                }
              } catch (pedidoError) {
                this.logger.warn(`[PHASE 12] Could not create pedido for precredito ${precreditoId}: ${pedidoError}`);
              }

              // PHASE 13: Create saldo_inicial
              this.logger.info(`[PHASE 13] Creating saldo_inicial...`);
              const saldoInicialDto = this.saldoInicialMapper.crearSaldoInicial(
                detalleCredito.prestamo_ID,
                documento,
                parseInt(creditoDto.valor_prestamo),
                datosCreditoActivo
              );

              if (saldoInicialDto) {
                const saldoInicial = await tx.saldo_inicial.create({
                  data: {
                    prestamoID: saldoInicialDto.prestamoID,
                    documento: saldoInicialDto.documento,
                    saldo_Inicial: saldoInicialDto.saldo_Inicial,
                    saldo_actual: saldoInicialDto.saldo_actual,
                  },
                });
                saldosIniciales.push(saldoInicial);
                this.logger.info(`[PHASE 13] Created saldo_inicial for prestamo ${detalleCredito.prestamo_ID}`);
              }

              // PHASE 14: Already executed before PHASE 11B (see above)

            } else {
              this.logger.warn(`[MAIN-DATA-SERVICE] Error mapeando precredito ${precredito.id}: ${error}`);
            }
          }
        }

        // Process PENDING DISBURSEMENT credits (approved but not yet disbursed)
        // These will NOT have amortization, saldo_inicial, or payment history
        if (precreditosPendientesDesembolso && precreditosPendientesDesembolso.length > 0) {
          this.logger.info(
            `[MIGRATION] Processing ${precreditosPendientesDesembolso.length} PENDING DISBURSEMENT credits...`
          );

          for (const precredito of precreditosPendientesDesembolso) {
            // No creditoLegacy for pending disbursements
            const [error, creditoDto] = await CreditoMapper.mapToCreditoDto(
              precredito, 
              clienteLegacy,
              prismaLegacyService,
              undefined  // No credito for pending disbursements
            );

            if (!error && creditoDto) {
              // Buscar el tipo de crédito
              const tipoCredito = await tx.lista_tipo_credito.findFirst({
                where: { tipo: creditoDto.tipoCredito },
              });

              // Obtener campos adicionales desde precredito
              const creador = precredito.users_precreditos_funcionario_idTousers?.name || 'SISTEMA_LEGACY';
              const fechaRegistro = precredito.created_at || new Date();
              const fechaActualizacion = precredito.updated_at;

              // Crear registro sin amortización
              const detalleCredito = await tx.detalle_credito.create({
                data: {
                  user_cliente: {
                    connect: {
                      documento: creditoDto.documento,
                    },
                  },
                  lista_tipo_credito: {
                    connect: {
                      tipo: tipoCredito?.tipo || 'CREDITO EXPRESS',
                    },
                  },
                  lista_estado_credito: {
                    connect: {
                      tipo: 'APROBADO',  // Estado aprobado
                    },
                  },
                  lista_origen_credito: {
                    connect: {
                      tipo: creditoDto.origen,
                    },
                  },
                  valor_prestamo: creditoDto.valor_prestamo,
                  inicial: creditoDto.inicial,
                  numero_cuotas: creditoDto.numero_cuotas,
                  valor_cuota: creditoDto.valor_cuota,
                  fecha_Pago: creditoDto.fechaPago,
                  plazo: creditoDto.plazo,
                  tasa: creditoDto.tasa,
                  periocidad: creditoDto.periocidad,
                  dia_pago: creditoDto.diaPago,
                  seguro: creditoDto.seguro || 0,
                  iva_aval: creditoDto.iva_aval as any || '0',
                  pablok: creditoDto.pablok || 0,
                  seguro_add: creditoDto.seguro_add as any || '0',
                  creador: creador,
                  fecha_registro: fechaRegistro,
                  fecha_actualizacion: fechaActualizacion,
                  castigo: 'NO', // Pendiente de desembolso nunca está castigado
                  // Observación: Crédito aprobado en FACILITO pero PENDIENTE DE DESEMBOLSO
                },
              });

              detalleCreditos.push(detalleCredito);
              this.logger.info(
                `[MIGRATION] Precredito ${precredito.id} migrated as PENDING_DISBURSEMENT (no amortization) - prestamo_ID: ${detalleCredito.prestamo_ID}`
              );
            } else {
              this.logger.warn(
                `[MAIN-DATA-SERVICE] Error mapeando precredito pendiente ${precredito.id}: ${error}`
              );
            }
          }
        }

        // 10.2 Crear estudio_de_credito
        const estudioDeCredito = await tx.estudio_de_credito.create({
          data: {
            documento: documento,
            estado: 'EN ESTUDIO',
            observacion: 'migrado desde FACILITO',
          },
        });

        // PHASE 10: Crear estudios_realizados con datos reales
        this.logger.info('[PHASE 10] Creating estudios_realizados with real data...');
        const estudiosDto = await this.estudiosRealizadosMapper.crearEstudioRealizado(documento);
        
        let estudiosRealizados;
        if (estudiosDto) {
          estudiosRealizados = await tx.estudios_realizados.create({
            data: {
              documento: estudiosDto.documento,
              cupo: estudiosDto.cupo,
              cupoDisponible: estudiosDto.cupoDisponible,
              tasa: estudiosDto.tasa,
              plazo: estudiosDto.plazo,
              creditos_activos: estudiosDto.creditos_activos,
              creditos_maximos: estudiosDto.creditos_maximos,
              pagare: estudiosDto.pagare,
              desembolso: estudiosDto.desembolso,
              observacion: estudiosDto.observacion,
            },
          });
          this.logger.info('[PHASE 10] Created estudios_realizados successfully');
        } else {
          // Fallback to default
          estudiosRealizados = await tx.estudios_realizados.create({
            data: {
              documento: documento,
              cupo: '0',
              cupoDisponible: '0',
              tasa: 0,
              plazo: 12,
              creditos_activos: precreditosData.length,
              creditos_maximos: 2,
              observacion: 'migrado desde FACILITO',
            },
          });
          this.logger.warn('[PHASE 10] Used default estudios_realizados');
        }

        // 11. Crear cónyuge si existe
        let conyuge = null;
        if (conyugeDto) {
          conyuge = await tx.conyuge.create({
            data: {
              nombres: conyugeDto.nombres,
              apellidos: conyugeDto.apellidos,
              tipo_documento: conyugeDto.tipo_documento,
              documento_conyuge: conyugeDto.documento_conyuge,
              documento: conyugeDto.documento,
              telefono: conyugeDto.telefono,
            },
          });
        }

        // 13. Retornar usuario con relaciones
        return {
          userCliente,
          infoPersonal,
          infoContacto,
          infoLaboral,
          infoReferencias,
          estudioDeCredito,
          estudiosRealizados,
          detalleCreditos,
          amortizaciones,
          pedidos,
          saldosIniciales,
          conyuge,
          stats: {
            creditosCreados: detalleCreditos.length,
            creditosDesembolsados: precreditosDesembolsados.length,
            creditosPendientesDesembolso: precreditosPendientesDesembolso.length,
            cuotasAmortizacion: amortizaciones.length,
            pedidosCreados: pedidos.length,
            saldosCreados: saldosIniciales.length,
          },
        };
      });

      // Log final migration summary
      this.logger.info(
        `\n✅ MIGRACIÓN COMPLETADA EXITOSAMENTE para cliente ${documento}:` +
        `\n  👤 User Cliente: ${result.userCliente.nombre_completo}` +
        `\n  💳 Créditos totales: ${result.stats.creditosCreados}` +
        `\n     ├─ 💰 Desembolsados (con amortización): ${result.stats.creditosDesembolsados}` +
        `\n     └─ ⏳ Pendientes desembolso (sin amortización): ${result.stats.creditosPendientesDesembolso}` +
        `\n  📊 Cuotas de amortización: ${result.stats.cuotasAmortizacion}` +
        `\n  📦 Pedidos migrados: ${result.stats.pedidosCreados}` +
        `\n  💵 Saldos iniciales: ${result.stats.saldosCreados}`
      );

      // 13. Retornar usuario completado con relaciones anidadas
      return {
        user_cliente: {
          ...result.userCliente,
          info_personal: result.infoPersonal,
          info_contacto: result.infoContacto,
          info_laboral: result.infoLaboral,
          info_referencias: result.infoReferencias,
          estudio_de_credito: result.estudioDeCredito,
          estudios_realizados: result.estudiosRealizados,
          detalle_credito: result.detalleCreditos,
          ...(result.conyuge && { conyuge: result.conyuge }),
        },
        migration_stats: result.stats,
      };
    } catch (error) {
      // Transacción automáticamente revertida en caso de error
      throw new Error(`Error durante migración de cliente: ${error instanceof Error ? error.message : String(error)}`);
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
}

export default MainDataService;
