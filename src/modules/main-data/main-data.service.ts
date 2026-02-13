import { prismaMainService } from '../../database/main/prisma-main.service';
import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import ClienteMapperService from './cliente-mapper';

/**************************************************************************************************
 * Servicio para datos Main
 * 
 * Servicio para operaciones CRUD en la base de datos principal
 * Acceso a múltiples modelos: user_cliente, info_personal, pagos, productos, etc.
 ***************************************************************************************************/

class MainDataService {
  private static instance: MainDataService;

  constructor() {}

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
    // 1. Consultar cliente en LEGACY
    const clienteLegacy = await prismaLegacyService.clientes.findUnique({
      where: { num_doc: documento },
      include: {
        conyuges: true,
      },
    });

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
      municipioData = await prismaLegacyService.$queryRaw`
        SELECT nombre, departamento, codigo_departamento
        FROM municipios 
        WHERE id = ${clienteLegacy.municipio_id}
        LIMIT 1
      `;
    }

    const [infoContactoError, infoContactoDto] = mapperService.mapToInfoContacto(clienteLegacy, municipioData?.[0] || null);
    if (infoContactoError) throw new Error(`Error en mapeo InfoContacto: ${infoContactoError}`);

    const [infoLaboralError, infoLaboralDto] = mapperService.mapToInfoLaboral(clienteLegacy);
    if (infoLaboralError) throw new Error(`Error en mapeo InfoLaboral: ${infoLaboralError}`);

    const [infoReferenciasError, infoReferenciasDto] = mapperService.mapToInfoReferencias(clienteLegacy);
    if (infoReferenciasError) throw new Error(`Error en mapeo InfoReferencias: ${infoReferenciasError}`);

    let conyugeDto: any = null;
    if (clienteLegacy.conyuges) {
      const [conyugeError, conyugeMapped] = mapperService.mapToConyuge(clienteLegacy.conyuges, documento);
      if (conyugeError) throw new Error(`Error en mapeo Cónyuge: ${conyugeError}`);
      conyugeDto = conyugeMapped;
    }

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
          conyuge,
        };
      });

      // 13. Retornar usuario completado con relaciones anidadas
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
      // Transacción automáticamente revertida en caso de error
      throw new Error(`Error durante migración de cliente: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export default MainDataService;
