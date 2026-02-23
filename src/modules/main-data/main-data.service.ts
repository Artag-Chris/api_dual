import { prismaMainService } from '../../database/main/prisma-main.service';
import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import ClienteMapperService from './cliente-mapper';
import { ReferenceParser } from './reference-parser';
import WinstonAdapter from '../../config/adapters/winstonAdapter';
import QueueService from '../../domain/class/queue.service';

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

        // 11. Crear cónyuge if exists (resiliente: error no falla el cliente)
        let conyuge = null;
        if (conyugeDto) {
          try {
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
            this.logger.info(`[MIGRATE] ✅ Cónyuge creado para ${documento}`);
          } catch (conyugeError) {
            const errorMsg = conyugeError instanceof Error ? conyugeError.message : String(conyugeError);
            this.logger.warn(`[MIGRATE] ⚠️ Error creando cónyuge para ${documento}: ${errorMsg}. Continuando sin cónyuge.`);
            // Continuar sin cónyuge - la transacción NO falla
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
      this.logger.info(
        `✅ USUARIO MIGRADO: ${documento} - ${result.userCliente.nombre_completo}`
      );

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
   * QUERY 2 FALLBACK: Busca precreditos aprobados sin relación a creditos
   * Se ejecuta cuando Query 1 (con INNER JOIN creditos) retorna 0 filas
   * 
   * Filtros:
   * - aprobado = 'Si'
   * - id NOT IN (SELECT creditos.precredito_id FROM creditos)
   * 
   * Retorna datos similares a Query 1 pero desde tabla precreditos
   */
  private async executeQuery2(documento: string): Promise<any[]> {
    try {
      this.logger.info(`[PHASE 2-Q2] Ejecutando Query 2 (precreditos fallback) para ${documento}`);

      const precreditosData = await prismaLegacyService.$queryRaw<any[]>`
        SELECT 
          clientes.num_doc AS documento,
          precreditos.vlr_fin AS valor_prestamo,
          precreditos.aprobado AS estado_aprobacion,
          precreditos.cuota_inicial,
          precreditos.s_inicial AS segunda_inicial,
          precreditos.cuotas AS numero_cuotas_mensuales,
          precreditos.periodo AS periodicidad,
          precreditos.vlr_cuota,
          amortizaciones.porc_interes AS tasa,
          amortizaciones.porc_tea AS tasa_efectiva_anual,
          precreditos.p_fecha AS fecha_pago_1,
          precreditos.s_fecha AS fecha_pago_2,
          'APROBADO' AS estado,
          creator.name AS creador,
          precreditos.created_at AS fecha_creacion,
          amortizaciones.porc_aval AS seguro,
          amortizaciones.porc_iva_aval AS iva_aval,
          'NO' AS es_castigada,
          NULL AS proxima_fecha_pago,
          creator.name as actualizador,
          precreditos.updated_at AS ultima_fecha_actualizacion,
          carteras.id AS cartera_id,
          carteras.nombre AS linea_credito,
          codeudores.num_doc AS documento_codeudor,
          codeudores.id AS id_codeudor,
          estudios.cal_asesor,
          estudios.cal_estudio,
          est_datacreditos.puntaje AS puntaje_datacredito_fc
        FROM clientes
        LEFT JOIN codeudores ON clientes.codeudor_id = codeudores.id
        INNER JOIN precreditos ON clientes.id = precreditos.cliente_id 
        LEFT JOIN estudios ON clientes.id = estudios.cliente_id 
        LEFT JOIN amortizaciones ON precreditos.id = amortizaciones.precredito_id
        INNER JOIN users AS creator ON precreditos.user_create_id = creator.id
        INNER JOIN carteras ON precreditos.cartera_id = carteras.id
        LEFT JOIN est_datacreditos ON estudios.estDatacredito_id = est_datacreditos.id
        WHERE clientes.num_doc = ${documento}
        AND precreditos.aprobado = 'Si'
        AND precreditos.id NOT IN (SELECT creditos.precredito_id FROM creditos WHERE creditos.precredito_id IS NOT NULL)
        ORDER BY precreditos.id DESC
      `;

      this.logger.info(`[PHASE 2-Q2] Query 2 retornó ${precreditosData.length} precreditos aprobados`);
      return precreditosData;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[PHASE 2-Q2] Error ejecutando Query 2: ${errorMsg}`);
      return [];
    }
  }

  /**
   * MIGRATION PHASE 2: Migra créditos de un cliente desde Legacy a Main
   * 
   * Bifurcación DUO-QUERY:
   * - Query 1 (INNER JOIN creditos): Créditos relacionados existentes
   *   - Si 0 filas → Path B2 (Query 2 Fallback)
   *   - Si N filas → Path B1 (Migrar desde creditos)
   * - Query 2 (precreditos aprobados sin creditos): Precreditos alternativos
   *   - Si 0 filas → Path A (Registrar documento_precredito)
   *   - Si N filas → Path B2 (Migrar desde precreditos)
   * - Path A (ambas queries = 0): Sin créditos → registrar en documento_precredito
   * 
   * Resilencia: error en 1 crédito NO falla el documento completo
   */
  async migrateCreditsPhase(documento: string): Promise<{
    status: "SIN_CREDITOS" | "CREDITOS_MIGRADOS" | "TODOS_FALLIDOS",
    creditosMigrados?: number,
    enqueuedAmortizaciones?: number,
    documentoRegistrado?: boolean,
    errores?: string[],
    queryUsed?: "Q1" | "Q2"
  }> {
    try {
      this.logger.info(`[PHASE 2] Iniciando migrateCreditsPhase para documento ${documento}`);

      // ========================= QUERY 1: CREDITOS RELACIONADOS =========================
      // QUERY EXACTA: Obtener créditos del cliente desde Legacy (con INNER JOIN creditos)
      const creditosData = await prismaLegacyService.$queryRaw<any[]>`
        SELECT 
          clientes.num_doc AS documento,
          precreditos.vlr_fin AS valor_prestamo,
          precreditos.aprobado AS estado_aprobacion,
          precreditos.cuota_inicial,
          precreditos.s_inicial AS segunda_inicial,
          precreditos.cuotas AS numero_cuotas_mensuales,
          precreditos.periodo AS periodicidad,
          precreditos.vlr_cuota,
          amortizaciones.porc_interes AS tasa,
          amortizaciones.porc_tea AS tasa_efectiva_anual,
          precreditos.p_fecha AS fecha_pago_1,
          precreditos.s_fecha AS fecha_pago_2,
          creditos.estado,
          creator.name AS creador,
          precreditos.created_at AS fecha_creacion,
          amortizaciones.porc_aval AS seguro,
          amortizaciones.porc_iva_aval AS iva_aval,
          creditos.castigada AS es_castigada,
          fc.fecha_pago AS proxima_fecha_pago,
          updator.name as actualizador,
          creditos.updated_at AS ultima_fecha_actualizacion,
          carteras.id AS cartera_id,
          carteras.nombre AS linea_credito,
          codeudores.num_doc AS documento_codeudor,
          codeudores.id AS id_codeudor,
          estudios.cal_asesor,
          estudios.cal_estudio,
          est_datacreditos.puntaje AS puntaje_datacredito_fc
        FROM clientes
        LEFT JOIN codeudores ON clientes.codeudor_id = codeudores.id
        INNER JOIN precreditos ON clientes.id = precreditos.cliente_id 
        LEFT JOIN estudios ON clientes.id = estudios.cliente_id 
        INNER JOIN creditos ON precreditos.id = creditos.precredito_id 
        LEFT JOIN amortizaciones ON precreditos.id = amortizaciones.precredito_id
        INNER JOIN users AS creator ON precreditos.user_create_id = creator.id
        INNER JOIN users AS updator ON precreditos.user_create_id = updator.id
        LEFT JOIN fecha_cobros fc ON creditos.id = fc.credito_id
        INNER JOIN carteras ON precreditos.cartera_id = carteras.id
        LEFT JOIN est_datacreditos ON estudios.estDatacredito_id = est_datacreditos.id
        WHERE clientes.num_doc = ${documento}
        ORDER BY precreditos.id DESC
      `;

      this.logger.info(`[PHASE 2-Q1] Query 1 retornó ${creditosData.length} créditos`);

      // ========================= DUAL-QUERY LOGIC =========================
      let queryUsed: "Q1" | "Q2" = "Q1";
      let dataToProcess = creditosData;

      // Si Query 1 retorna 0, intentar Query 2 (precreditos fallback)
      if (!creditosData || creditosData.length === 0) {
        this.logger.info(`[PHASE 2] Query 1 = 0 filas, intentando Query 2 fallback...`);
        
        const precreditosData = await this.executeQuery2(documento);
        
        if (precreditosData && precreditosData.length > 0) {
          this.logger.info(`[PHASE 2-Q2] ✅ Query 2 encontró ${precreditosData.length} precreditos aprobados`);
          queryUsed = "Q2";
          dataToProcess = precreditosData;
        } else {
          // ========================= PATH A: Sin créditos ni precreditos =========================
          this.logger.info(`[PHASE 2] Path A: Ambas queries vacías → registrando en documento_precredito`);
          
          try {
            await prismaMainService.documento_precredito.create({
              data: {
                documento_cliente: documento,
                estado: 'SIN_CREDITOS_RELACIONADOS'
              }
            });
            
            this.logger.info(`[PHASE 2] Documento registrado sin créditos: ${documento}`);
          } catch (error) {
            this.logger.warn(`[PHASE 2] Error registrando en documento_precredito: ${error}`);
          }

          return {
            status: "SIN_CREDITOS",
            documentoRegistrado: true,
            queryUsed: "Q1"
          };
        }
      }

      // ========================= PATH B: Con créditos (Q1 o Q2) =========================
      const errores: string[] = [];
      let creditosMigrados = 0;
      let enqueuedAmortizaciones = 0;

      for (const row of dataToProcess) {
        try {
          // i. Mapear fila a detalle_credito DTO
          this.logger.debug(`[PHASE 2] Procesando crédito para documento ${documento}`);

          // Función auxiliar para mapear estado
          const mapEstadoCredito = (estadoLegacy: string): string => {
            const mapa: { [key: string]: string } = {
              'Activo': 'ACTIVO',
              'Cancelado': 'FINALIZADO',
              'Vencido': 'VENCIDO',
              'Castigo': 'CASTIGO',
              'En mora': 'MORA',
              'Reestructurado': 'REESTRUCTURADO'
            };
            return mapa[estadoLegacy] || 'EN ESTUDIO';
          };

          // Extraer día de pago de fecha_pago_1
          let diaPago = '15';
          if (row.fecha_pago_1) {
            try {
              const fecha = new Date(row.fecha_pago_1);
              const dia = fecha.getDate();
              diaPago = String(dia);
            } catch (e) {
              diaPago = '15';
            }
          }

          const detalleCreditoData = {
            documento: row.documento,
            valor_prestamo: String(row.valor_prestamo),
            estado: mapEstadoCredito(row.estado || 'Activo'),
            tasa: String(row.tasa || 0),
            numero_cuotas: String(row.numero_cuotas_mensuales || row.cuotas || 12),
            plazo: String(row.periodicidad) || 'MENSUAL',
            valor_cuota: String(row.vlr_cuota),
            tipoCredito: 'CREDITO EXPRESS',
            origen: 'LEGACY_MIGRADO',  // ✅ VALORES VÁLIDOS: 'NUEVO' o 'REFINANCIADO' (FK constraint a lista_origen_credito)
            creador: row.creador || 'SISTEMA_LEGACY',
            fecha_registro: row.fecha_creacion,
            fecha_actualizacion: row.ultima_fecha_actualizacion,
            seguro: parseInt(row.seguro || 0),
            iva_aval: String(row.iva_aval || 0),
            pablok: 0,
            seguro_add: String(row.seguro_add || 0),
            castigo: row.es_castigada === 'Si' ? 'SI' : 'NO',
            dia_pago: diaPago,
            fecha_Pago: row.fecha_pago_1 ? new Date(row.fecha_pago_1).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            inicial: parseInt(row.cuota_inicial || 0),
            periocidad: row.periodicidad || 'MENSUAL'
          };

          // ii. Insertar en main.detalle_credito usando transacción
          const prestamoCreado = await prismaMainService.$transaction(async (tx) => {
            const credito = await tx.detalle_credito.create({
              data: {
                documento: detalleCreditoData.documento,
                tipoCredito: detalleCreditoData.tipoCredito,
                valor_prestamo: detalleCreditoData.valor_prestamo,
                inicial: detalleCreditoData.inicial,
                plazo: detalleCreditoData.plazo,
                numero_cuotas: detalleCreditoData.numero_cuotas,
                valor_cuota: detalleCreditoData.valor_cuota,
                periocidad: detalleCreditoData.periocidad,
                tasa: detalleCreditoData.tasa,
                dia_pago: detalleCreditoData.dia_pago,
                fecha_Pago: detalleCreditoData.fecha_Pago,
                estado: detalleCreditoData.estado,
                origen: detalleCreditoData.origen,
                creador: detalleCreditoData.creador,
                fecha_registro: row.fecha_pago_1 ? new Date(row.fecha_pago_1) : new Date(),  // ✅ Usa fecha original del row para evitar "Invalid time value"
                seguro: detalleCreditoData.seguro,
                iva_aval: detalleCreditoData.iva_aval ? parseFloat(String(detalleCreditoData.iva_aval)) : 0,
                pablok: detalleCreditoData.pablok,
                seguro_add: detalleCreditoData.seguro_add ? parseFloat(String(detalleCreditoData.seguro_add)) : 0,
                fecha_actualizacion: new Date()
              }
            });

            return credito;
          });

          creditosMigrados++;

          // iii. Enqueuear automático a AMORTIZACIONES
          const queueService = QueueService.getInstance();
          await queueService.enqueue(documento, 'AMORTIZACIONES');
          enqueuedAmortizaciones++;

          this.logger.info(`[PHASE 2] ✅ Crédito migrado: prestamo_ID=${prestamoCreado.prestamo_ID}, enqueuado a AMORTIZACIONES`);

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.logger.warn(`[PHASE 2] ❌ Error crédito: ${errorMsg}`);
          errores.push(errorMsg);
          // Continuar con próximo crédito (NO fallar documento)
        }
      }

      // Determinar resultado final
      if (creditosMigrados === 0) {
        
        this.logger.info(`[PHASE 2] Todos los créditos fallaron, registrando documento_precredito`);
        
        try {
          await prismaMainService.documento_precredito.create({
            data: {
              documento_cliente: documento,
              estado: 'ERROR_MIGRACION_CREDITOS'
            }
          });
        } catch (error) {
          this.logger.warn(`[PHASE 2] Error registrando documento en estado ERROR: ${error}`);
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
      this.logger.error(`[PHASE 2] Error fatal en migrateCreditsPhase: ${errorMsg}`);
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
}

export default MainDataService;
