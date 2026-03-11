import { prismaMainService } from '../../database/main/prisma-main.service';
import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import ClienteMapperService from './cliente-mapper';
import { ReferenceParser } from './reference-parser';
import WinstonAdapter from '../../config/adapters/winstonAdapter';
import QueueService from '../../domain/class/queue.service';
import RefinanciamientoService from '../../amortizacion/amortizacion-refinanciamiento.service';
import AmortizacionPatternService from '../../amortizacionPattern/amortizacionPattern.service';
import { getTasabyPeriocidad, getDiaPago, parseFecha, getDatacreditScore, getEstadoValidoFromList, getCarteraIdbyFuzzy, sanitizeFieldValue, normalizeDate, normalizeCastigo, calculateAge } from '../../utils/functions';
import { getClientLegacyByDoc, getCreditLegacyDataByDoc } from '../../utils/querys';
import { raw } from '@prisma/client/runtime/library';




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
   * Parsea fecha de forma segura
   * Intenta múltiples formatos y devuelve ISO string o fallback
   * Maneja: strings, Date objects, números (como día del mes)
   */

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

  async migrateClienteFromLegacy(documento: string): Promise<any> {
    // 1. Consultar cliente en LEGACY 
    const clientesData = await getClientLegacyByDoc(prismaLegacyService,documento)
    

    if (!clientesData || clientesData.length === 0) {
      throw new Error(`Cliente no encontrado en base de datos LEGACY: ${documento}`);
    }

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
      try {
        const conyugeData = await prismaLegacyService.conyuges.findUnique({
          where: { id: clienteLegacy.conyuge_id },
        });
        if (conyugeData) {
          clienteLegacy.conyuges = [conyugeData];
        }
      } catch (conyugeError) {
        // Si falla la lectura del cónyuge (por ej: enum inválido), simplemente continuamos sin él
        this.logger.warn(
          `[PHASE 2] ⚠️ Error al obtener cónyuge ${clienteLegacy.conyuge_id} para documento ${documento}: ${
            conyugeError instanceof Error ? conyugeError.message : String(conyugeError)
          }. Continuando sin cónyuge.`
        );
        clienteLegacy.conyuges = [];
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
      if (conyugeError) {
        // Si hay error en el mapeo del cónyuge, registrar warning y continuar sin cónyuge
        // this.logger.warn(
        //   `[PHASE 2] ⚠️ Error en mapeo del cónyuge para documento ${documento}: ${conyugeError}. Continuando sin cónyuge.`
        // );
        conyugeDto = null;
      } else {
        conyugeDto = conyugeMapped;
      }
    }

    try {
      const result = await prismaMainService.$transaction(async (tx) => {
        // 6. Crear user_cliente usando raw SQL con fuzzy matching para tipo
        await tx.$executeRawUnsafe(
          `INSERT INTO user_cliente (documento, nombre, apellido, tipo, email, telefono, nombre_completo, password, estado_registro, fecha_registro)
           VALUES (?, ?, ?, 
                   COALESCE(
                     (SELECT tipo FROM lista_documentos WHERE tipo = ? LIMIT 1),
                     (SELECT tipo FROM lista_documentos WHERE LOWER(tipo) LIKE CONCAT('%', LOWER(?), '%') LIMIT 1),
                     (SELECT tipo FROM lista_documentos ORDER BY id ASC LIMIT 1),
                     'CC'
                   ),
                   ?, ?, ?, ?, ?, NOW())`,
          userClienteDto!.documento,
          userClienteDto!.nombre,
          userClienteDto!.apellido,
          userClienteDto!.tipo || 'CC',
          userClienteDto!.tipo || 'CC',
          userClienteDto!.email || 'clienteSinEmail@Migradofacilito',
          userClienteDto!.telefono,
          userClienteDto!.nombre_completo,
          userClienteDto!.password,
          userClienteDto!.estado_registro || 'incompleto'
        );

        // 6.1 Retrieve created user_cliente
        const userCliente = await tx.user_cliente.findUnique({
          where: { documento: userClienteDto!.documento },
        });

        // 7. Crear info_personal using raw SQL with FK handling
        // Ensure dates have safe defaults (use '1900-01-01' if normalization fails)
        const fechaNacimientoSafe = normalizeDate(infoPersonalDto!.fecha_nacimiento) || '1900-01-01';
        const fechaExpedicionSafe = normalizeDate(infoPersonalDto!.fecha_expedicion) || '1900-01-01';
        
        await tx.$executeRawUnsafe(
          `INSERT INTO info_personal (documento, nombre, apellido, tipoDocumento, fecha_nacimiento, fecha_expedicion, lugar_expedicion, estudios, estrato, conyuge, fecha_registro) 
           VALUES (?, ?, ?, 
                   COALESCE(
                     (SELECT tipo FROM lista_documentos WHERE tipo = ? LIMIT 1),
                     (SELECT tipo FROM lista_documentos WHERE LOWER(tipo) LIKE CONCAT('%', LOWER(?), '%') LIMIT 1),
                     (SELECT tipo FROM lista_documentos ORDER BY id ASC LIMIT 1),
                     'CC'
                   ),
                   ?, ?, ?, 
                   COALESCE((SELECT tipo FROM lista_estudios WHERE tipo = ? LIMIT 1), 
                            (SELECT tipo FROM lista_estudios LIMIT 1), 'N/A'),
                   COALESCE((SELECT tipo FROM lista_estrato WHERE tipo = ? LIMIT 1), 
                            (SELECT tipo FROM lista_estrato LIMIT 1), 'N/A'),
                   ?, NOW())`,
          infoPersonalDto!.documento,
          infoPersonalDto!.nombre,
          infoPersonalDto!.apellido,
          infoPersonalDto!.tipoDocumento || 'CC',
          infoPersonalDto!.tipoDocumento || 'CC',
          fechaNacimientoSafe,
          fechaExpedicionSafe,
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
          sanitizeFieldValue(infoContactoDto!.barrio, 50),
          infoContactoDto!.tipo_vivienda || null,
          infoContactoDto!.tipo_vivienda || null,
          sanitizeFieldValue(infoContactoDto!.telefono_residencial, 50),
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
          normalizeDate(infoLaboralDto!.fecha_vinculacion) || new Date().toISOString().split('T')[0],
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
            nombreFamiliar: sanitizeFieldValue(infoReferenciasDto!.nombreFamiliar, 100),
            parentescoFamiliar: sanitizeFieldValue(infoReferenciasDto!.parentescoFamiliar, 30),
            telefonoFamiliar: sanitizeFieldValue(infoReferenciasDto!.telefonoFamiliar || '0', 100),
            direccion_familiar: sanitizeFieldValue(infoReferenciasDto!.direccion_familiar, 150) || '',
            nombreFamiliar2: sanitizeFieldValue(infoReferenciasDto!.nombreFamiliar2, 100),
            parentescoFamiliar2: sanitizeFieldValue(infoReferenciasDto!.parentescoFamiliar2, 30),
            celularFamiliar2: sanitizeFieldValue(infoReferenciasDto!.celularFamiliar2 || '0', 100),
            direccion_familiar_2: sanitizeFieldValue(infoReferenciasDto!.direccion_familiar_2, 150) || '',
            nombrePersonal: sanitizeFieldValue(infoReferenciasDto!.nombrePersonal, 100),
            parentescoPersonal: sanitizeFieldValue(infoReferenciasDto!.parentescoPersonal, 30),
            telefonoPersonal: sanitizeFieldValue(infoReferenciasDto!.telefonoPersonal || '0', 100),
            direcion_personal: sanitizeFieldValue(infoReferenciasDto!.direcion_personal, 150) || '',
            nombrePersonal2: sanitizeFieldValue(infoReferenciasDto!.nombrePersonal2, 100),
            parentescoPersonal2: sanitizeFieldValue(infoReferenciasDto!.parentescoPersonal2, 30),
            celularPersonal2: sanitizeFieldValue(infoReferenciasDto!.celularPersonal2 || '0', 100),
            direccion_personal_2: sanitizeFieldValue(infoReferenciasDto!.direccion_personal_2, 150) || '',
          },
        });

        // 11. Crear o actualizar cónyuge if exists (resiliente: error no falla el cliente)
        let conyuge: any = "NO";
        if (conyugeDto) {
          try {
            conyuge = await tx.conyuge.upsert({
              where: { documento: conyugeDto.documento },
              update: {
                nombres: conyugeDto.nombres,
                apellidos: conyugeDto.apellidos,
                tipo_documento: conyugeDto.tipo_documento|| null,
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
            conyuge = "NO";
          }
        }

        return {
          userCliente,
          infoPersonal,
          infoContacto,
          infoLaboral,
          infoReferencias,
          conyuge,
        };
      });

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

  // ==================== MIGRACIÓN DE CRÉDITOS - PHASE 2 ====================

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
      const creditosData = await getCreditLegacyDataByDoc(prismaLegacyService,documento)

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
              'CANCELADO POR REFINANCIACION': 'CANCELADO REFINANCIADO'  // Legacy con espacios
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
            castigo: normalizeCastigo(row.es_castigada),
            dia_pago: getDiaPago(row.fecha_pago_1, row.fecha_pago_2),
            fecha_Pago: parseFecha(row.fecha_pago_1),
            inicial: parseInt(row.cuota_inicial || 0),
            periocidad: mapPeriodicidad(row.periodicidad),
            id_estrategia: getCarteraIdbyFuzzy(row.nombre_cartera, row.estado).estrategiaId,
            id_cartera: getCarteraIdbyFuzzy(row.nombre_cartera, row.estado).carteraId,
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
              id_cartera: detalleCreditoData.id_cartera,
              castigo:detalleCreditoData.castigo
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

            const credito = await tx.detalle_credito.create({
              data: creditoCreateData
            });


            if (creditosMigrados === 0) {
              try {
                const scoreValor = getDatacreditScore(row.puntaje_datacredito_fc || '0');
                const estadoValor = await getEstadoValidoFromList(row.estado);
                
                // Obtener fecha_nacimiento del cliente para calcular edad
                const infoPersonalCliente = await tx.info_personal.findUnique({
                  where: { documento }
                });
                const edadCliente = calculateAge(infoPersonalCliente?.fecha_nacimiento);

                await tx.estudio_de_credito.upsert({
                  where: { documento },
                  update: {
                    score: scoreValor,
                    estado: estadoValor,
                    edad: edadCliente,
                    observacion: `Actualizado. Asesor: ${row.cal_asesor || 'N/A'}`
                  },
                  create: {
                    documento: documento,
                    sect_financiero: '0',
                    sect_real: '0',
                    sect_coop: '0',
                    sect_telco: '0',
                    score: scoreValor,
                    edad: edadCliente,
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
                this.logger.info(`[ESTUDIO] ✅ Creado para doc=${documento}, score=${scoreValor}, estado=${estadoValor}, edad=${edadCliente} años`);
              } catch (estudioError) {
                const msg = estudioError instanceof Error ? estudioError.message : String(estudioError);
                this.logger.warn(`[ESTUDIO] ⚠️ Error: ${msg}. Continuando...`);
              }
            }

            return credito;
          });

          creditosMigrados++;

          const creditoIdInfo = row.credito_id_legacy ? `[credito_legacy=${row.credito_id_legacy}]` : '[auto-increment]';
          this.logger.info(`[Fase 2] ✅ Crédito migrado: prestamo_ID=${prestamoCreado.prestamo_ID} ${creditoIdInfo}`);

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.logger.warn(`[Fase 2] ❌ Error crédito: ${errorMsg}`);
          errores.push(errorMsg);
          
          // ✅ Guardar crédito fallido en DLQ
          try {
            const queueService = QueueService.getInstance();
            await queueService.saveCreditoErrorToDLQ(
              documento,
              'PHASE 2',
              row.credito_id_legacy,
              {
                valor_prestamo: row.valor_prestamo,
                numero_cuotas: row.numero_cuotas,
                plazo: row.plazo,
                nombre_cartera: row.nombre_cartera,
                estado: row.estado,
                tasa: row.tasa,
                periodicidad: row.periodicidad,
                fecha_creacion: row.fecha_creacion
              },
              errorMsg
            );
          } catch (dlqError) {
            this.logger.error(`[Fase 2] Error guardando en DLQ: ${dlqError}`);
          }
          // Continuar con próximo crédito (NO fallar documento)
        }
      }

      // iii. DESPUÉS del loop: Enqueuear UNA VEZ el documento a AMORTIZACIONES y PAGOS
      if (creditosMigrados > 0) {
        try {
          const queueService = QueueService.getInstance();
          this.logger.info(`[Fase 2] 🔄 Enqueuando documento=${documento} a AMORTIZACIONES_TODO y PAGOS_TODO (${creditosMigrados} crédito(s) procesado(s))...`);
          await queueService.enqueue(documento, 'AMORTIZACIONES_TODO');
          await queueService.enqueue(documento, 'PAGOS_TODO');
          enqueuedAmortizaciones = 1; // Marcamos como enqueuado una vez
          this.logger.info(`[Fase 2] ✅ Documento enqueuado a Phase 3B y Phase 4`);
        } catch (queueError) {
          const qErrorMsg = queueError instanceof Error ? queueError.message : String(queueError);
          this.logger.warn(`[Fase 2] ⚠️ Error al enqueuear documento=${documento}: ${qErrorMsg}`);
          errores.push(`Enqueueing error: ${qErrorMsg}`);
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

      this.logger.info(`[PHASE 2] ✅ Completado: ${creditosMigrados} créditos migrados, documento=${documento} enqueuado a Phase 3B y Phase 4 (Query: ${queryUsed})`);

      return {
        status: "CREDITOS_MIGRADOS",
        creditosMigrados,
        enqueuedAmortizaciones: 1,
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
   * PHASE 3B: Calcula y crea amortizaciones para TODOS los créditos de un cliente
   * 
   * Flujo:
   * 1. Buscar ALL créditos del cliente (by documento) en main.detalle_credito
   * 2. Para cada crédito:
   *    - Llamar a RefinanciamientoService.calcularRefinanciamientoConPagos(prestamo_ID)
   *    - Mapear amortizacionActualizada[] a schema de main.amortizacion
   *    - Insertar amortizaciones en bulk en transacción
   * 3. Retornar status + cantidades agregadas
   * 
   * @param documento - Documento del cliente (busca todos sus créditos)
   * @returns Promise<AmortizacionesMigrationResult>
   */
  async migrateAmortizacionesPhase(documento: string): Promise<{
    status: "AMORTIZACIONES_Y_SANCIONES_CREADAS" | "SIN_CREDITOS" | "TODOS_FALLIDOS" | "ERROR";
    creditosProcesados?: number;
    amortizacionesCreadas?: number;
    totalAmortizaciones?: number;
    errores?: string[];
  }> {
    try {
      // 1. Buscar TODOS los créditos del cliente en main
      const creditosMain = await prismaMainService.detalle_credito.findMany({
        where: { documento }
      });

      if (!creditosMain || creditosMain.length === 0) {
        
        return {
          status: "SIN_CREDITOS",
          creditosProcesados: 0,
          amortizacionesCreadas: 0,
          totalAmortizaciones: 0
        };
      }

      this.logger.info(`[PHASE 3B] 📋 ${creditosMain.length} crédito(s) encontrado(s) para documento=${documento}`);

      const errores: string[] = [];
      let creditosProcesados = 0;
      let totalAmortizacionesCreadas = 0;

      // 2. Procesar cada crédito
      for (const credito of creditosMain) {
        try {
          this.logger.info(`[PHASE 3B] 🔄 Procesando crédito ${creditosProcesados + 1}/${creditosMain.length}: prestamo_ID=${credito.prestamo_ID}`);

          // 2a. Llamar a AmortizacionPatternService para ejecutar las 3 fases (Factory, Pagos, Sanciones)
          const resultado = await AmortizacionPatternService.getInstance().ejecutarCompleto(credito.prestamo_ID);

          if (!resultado.success) {
            const msg = `AmortizacionPatternService falló para prestamo_ID=${credito.prestamo_ID}: ${resultado.message}`;
            this.logger.warn(`[PHASE 3B] ⚠️ ${msg}`);
            errores.push(msg);
            continue; // Pasar al siguiente crédito
          }

          if (!resultado.amortizacionFinal || resultado.amortizacionFinal.length === 0) {
            this.logger.warn(`[PHASE 3B] ⚠️ Sin amortizaciones calculadas para prestamo_ID=${credito.prestamo_ID}`);
            continue; // Pasar al siguiente crédito
          }

          // 2b. Mapear amortizaciones
          const amortizacionesToCreate = resultado.amortizacionFinal.map((cuota: any) => ({
            prestamoID: credito.prestamo_ID,
            documento: documento,
            Numero_cuota: String(cuota.numeroCuota),
            capital: parseInt(String(cuota.capital)) || 0,
            interes: parseInt(String(cuota.interes)) || 0,
            aval: parseInt(String(cuota.aval)) || 0,
            IVA: parseInt(String(cuota.iva)) || 0,
            pablok: 0,
            seguro: 0,
            sancion: parseInt(String(cuota.sancion)) || 0,
            total_cuota: parseInt(String(cuota.cuotaTotal)) || 0,
            saldo: String(cuota.saldo || '0'),
            fecha_pago: cuota.fechaPago || new Date().toISOString().split('T')[0]
          }));

          // 2c. Insertar amortizaciones en transacción
          const createdAmortizaciones = await prismaMainService.$transaction(async (tx) => {
            return await tx.amortizacion.createMany({
              data: amortizacionesToCreate,
              skipDuplicates: false
            });
          });

          this.logger.info(`[PHASE 3B] ✅ ${createdAmortizaciones.count} amortizaciones creadas para prestamo_ID=${credito.prestamo_ID}`);
          totalAmortizacionesCreadas += createdAmortizaciones.count;
          creditosProcesados++;

          // 2d. Guardar gastos de cartera si existen
          try {
            const gastosGuardados = await this.saveGastosCartera(
              credito.prestamo_ID,
              resultado.fase3?.gastosCartera
            );
            if (gastosGuardados) {
              this.logger.info(`[PHASE 3B] ✅ Gastos cartera guardados para prestamo_ID=${credito.prestamo_ID}`);
            }
          } catch (gastosError) {
            const gastosMsg = gastosError instanceof Error ? gastosError.message : String(gastosError);
            this.logger.warn(`[PHASE 3B] ⚠️ Error guardando gastos cartera para prestamo_ID=${credito.prestamo_ID}: ${gastosMsg}`);
            // No fallar PHASE 3B por error en gastos cartera - continuar
          }

          // // 2e. Guardar sanciones condonadas si existen
          try {
            const sancionesGuardadas = await this.saveSancionesCondonadas(
              credito.prestamo_ID,
              resultado.fase2?.infoPagos
            );
            if (sancionesGuardadas) {
              this.logger.info(`[PHASE 3B] ✅ Sanciones condonadas guardadas para prestamo_ID=${credito.prestamo_ID}`);
            }
          } catch (sancionesError) {
            const sancionesMsg = sancionesError instanceof Error ? sancionesError.message : String(sancionesError);
            this.logger.warn(`[PHASE 3B] ⚠️ Error guardando sanciones condonadas para prestamo_ID=${credito.prestamo_ID}: ${sancionesMsg}`);
            // No fallar PHASE 3B por error en sanciones - continuar
          }

        } catch (creditoError) {
          const errorMsg = creditoError instanceof Error ? creditoError.message : String(creditoError);
          this.logger.warn(`[PHASE 3B] ❌ Error procesando crédito prestamo_ID=${credito.prestamo_ID}: ${errorMsg}`);
          errores.push(errorMsg);
          
          // ✅ Guardar crédito fallido en DLQ
          try {
            const queueService = QueueService.getInstance();
            await queueService.saveCreditoErrorToDLQ(
              documento,
              'PHASE 3B',
              credito.prestamo_ID,
              {
                valor_prestamo: credito.valor_prestamo,
                numero_cuotas: credito.numero_cuotas,
                tasa: credito.tasa
              },
              errorMsg
            );
          } catch (dlqError) {
            this.logger.error(`[PHASE 3B] Error guardando en DLQ: ${dlqError}`);
          }
          // Continuar con próximo crédito (NO fallar documento completo)
        }
      }

      // 3. Determinar resultado final
      if (creditosProcesados === 0) {
        this.logger.warn(`[PHASE 3B] ❌ Todos los créditos fallaron para documento=${documento}`);
        return {
          status: "TODOS_FALLIDOS",
          creditosProcesados: 0,
          amortizacionesCreadas: 0,
          totalAmortizaciones: 0,
          errores
        };
      }

      this.logger.info(`[PHASE 3B] ✅ Completado: ${creditosProcesados} crédito(s) procesado(s), ${totalAmortizacionesCreadas} amortizaciones creadas para documento=${documento}`);

      return {
        status: "AMORTIZACIONES_Y_SANCIONES_CREADAS",
        creditosProcesados,
        amortizacionesCreadas: totalAmortizacionesCreadas,
        totalAmortizaciones: totalAmortizacionesCreadas
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[PHASE 3B] ❌ Error fatal en migrateAmortizacionesPhase: ${errorMsg}`);
      return {
        status: "ERROR",
        totalAmortizaciones: 0,
        errores: [errorMsg]
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4: HISTORIAL DE PAGOS - Migrar facturas legacy a historial_pagos main
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * PHASE 4: Migra historial de pagos para TODOS los créditos de un cliente
   * 
   * Flujo:
   * 1. Buscar ALL créditos del cliente (by documento) en main.detalle_credito
   * 2. Para cada crédito:
   *    - Buscar facturas en legacy con credito_id = prestamo_ID
   *    - Mapear cada factura a schema main.historial_pagos
   *    - Insertar en bulk
   * 3. Retornar status + cantidades agregadas
   * 
   * @param documento - Documento del cliente (busca todos sus créditos)
   * @returns Promise<PaymentHistoryMigrationResult>
   */
  async migratePaymentHistoryPhase(documento: string): Promise<{
    status: "PAGOS_MIGRADOS" | "SIN_CREDITOS" | "SIN_PAGOS" | "TODOS_FALLIDOS" | "ERROR";
    creditosProcesados?: number;
    pagosMigrados?: number;
    totalPagos?: number;
    errores?: string[];
  }> {
    try {
      this.logger.info(`[PHASE 4] Iniciando migratePaymentHistoryPhase para documento=${documento}`);

      // 1. Buscar TODOS los créditos del cliente en main
      const creditosMain = await prismaMainService.detalle_credito.findMany({
        where: { documento }
      });

      if (!creditosMain || creditosMain.length === 0) {
        this.logger.info(`[PHASE 4] ℹ️ Sin créditos encontrados para documento=${documento}`);
        return {
          status: "SIN_CREDITOS",
          creditosProcesados: 0,
          pagosMigrados: 0,
          totalPagos: 0
        };
      }

      this.logger.info(`[PHASE 4] 📋 ${creditosMain.length} crédito(s) encontrado(s) para documento=${documento}`);

      const errores: string[] = [];
      let creditosProcesados = 0;
      let totalPagosMigrados = 0;

      // 2. Procesar cada crédito
      for (const credito of creditosMain) {
        try {
          this.logger.info(`[PHASE 4] 🔄 Procesando crédito ${creditosProcesados + 1}/${creditosMain.length}: prestamo_ID=${credito.prestamo_ID}`);

          // 2a. Buscar facturas en legacy por credito_id = prestamo_ID
          const facturas = await prismaLegacyService.facturas.findMany({
            where: { credito_id: credito.prestamo_ID }
          });

          if (!facturas || facturas.length === 0) {
            this.logger.info(`[PHASE 4] ℹ️ Sin facturas encontradas para prestamo_ID=${credito.prestamo_ID}`);
            creditosProcesados++;
            continue; // Pasar al siguiente crédito
          }

          this.logger.info(`[PHASE 4] 📋 ${facturas.length} factura(s) encontrada(s) para prestamo_ID=${credito.prestamo_ID}`);

          // 2b. Mapear facturas a historial_pagos
          const pagosToCreate = facturas.map((factura, idx) => {
            const fecha = factura.fecha ? new Date(factura.fecha) : factura.created_at || new Date();

            return {
              documento: documento,
              prestamoID: credito.prestamo_ID,
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

          // 2c. Insertar pagos en transacción
          const createdPagos = await prismaMainService.$transaction(async (tx) => {
            return await tx.historial_pagos.createMany({
              data: pagosToCreate,
              skipDuplicates: false
            });
          });

          this.logger.info(`[PHASE 4] ✅ ${createdPagos.count} pagos migrados para prestamo_ID=${credito.prestamo_ID}`);
          totalPagosMigrados += createdPagos.count;
          creditosProcesados++;

        } catch (creditoError) {
          const errorMsg = creditoError instanceof Error ? creditoError.message : String(creditoError);
          this.logger.warn(`[PHASE 4] ❌ Error procesando crédito prestamo_ID=${credito.prestamo_ID}: ${errorMsg}`);
          errores.push(errorMsg);
          // Continuar con próximo crédito (NO fallar documento completo)
        }
      }

      // 3. Determinar resultado final
      if (creditosProcesados === 0) {
        this.logger.warn(`[PHASE 4] ❌ Todos los créditos fallaron para documento=${documento}`);
        return {
          status: "TODOS_FALLIDOS",
          creditosProcesados: 0,
          pagosMigrados: 0,
          totalPagos: 0,
          errores
        };
      }

      if (totalPagosMigrados === 0) {
        this.logger.info(`[PHASE 4] ℹ️ ${creditosProcesados} crédito(s) procesado(s) pero sin pagos encontrados para documento=${documento}`);
        return {
          status: "SIN_PAGOS",
          creditosProcesados,
          pagosMigrados: 0,
          totalPagos: 0
        };
      }

      this.logger.info(`[PHASE 4] ✅ Completado: ${creditosProcesados} crédito(s) procesado(s), ${totalPagosMigrados} pagos migrados para documento=${documento}`);

      return {
        status: "PAGOS_MIGRADOS",
        creditosProcesados,
        pagosMigrados: totalPagosMigrados,
        totalPagos: totalPagosMigrados
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[PHASE 4] ❌ Error fatal en migratePaymentHistoryPhase: ${errorMsg}`);
      return {
        status: "ERROR",
        totalPagos: 0,
        errores: [errorMsg]
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GASTOS CARTERA - Guardar gastos de cartera desde cálculo de refinanciamiento
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Guarda gastos de cartera en la BD después del cálculo de amortizaciones
   * 
   * @param prestamoId - ID del crédito (prestamo_ID)
   * @param gastosCartera - Objeto con estructura {prejuridico: {total, cantidad}, juridico: {total, cantidad}}
   * @returns Promise<boolean> - true si se guardó, false si no hay datos o error
   */
  private async saveGastosCartera(prestamoId: number, gastosCartera?: any): Promise<boolean> {
    try {
      // 1. Validar que gastosCartera existe y tiene propiedades necesarias
      if (!gastosCartera) {
        this.logger.debug(`[GASTOS_CARTERA] ℹ️ Sin gastosCartera para prestamo_ID=${prestamoId}`);
        return false;
      }

      // 2. Extraer valores de prejuridico y juridico
      let prejuridicoTotal = 0;
      let juridicoTotal = 0;

      // Extraer prejuridico total
      if (gastosCartera.prejuridico && typeof gastosCartera.prejuridico.total !== 'undefined') {
        prejuridicoTotal = parseInt(String(gastosCartera.prejuridico.total)) || 0;
      }

      // Extraer juridico total
      if (gastosCartera.juridico && typeof gastosCartera.juridico.total !== 'undefined') {
        juridicoTotal = parseInt(String(gastosCartera.juridico.total)) || 0;
      }

      // 3. Si ambos valores son 0, no guardar
      if (prejuridicoTotal === 0 && juridicoTotal === 0) {
        this.logger.debug(`[GASTOS_CARTERA] ℹ️ Ambos gastos vacíos (prejuridico=0, juridico=0) para prestamo_ID=${prestamoId}`);
        return false;
      }

      // 4. Buscar si ya existe registro para este prestamo_id
      const gastosExistente = await prismaMainService.gastos_cartera.findFirst({
        where: { prestamo_id: prestamoId }
      });

      // 5. Crear o actualizar según corresponda
      if (gastosExistente) {
        // Actualizar registro existente
        await prismaMainService.gastos_cartera.update({
          where: { id: gastosExistente.id },
          data: {
            prejuridico: prejuridicoTotal,
            juridico: juridicoTotal,
            fecha_actualizacion: new Date()
          }
        });
        this.logger.debug(
          `[GASTOS_CARTERA] ✅ Actualizado: prestamo_ID=${prestamoId}, prejuridico=${prejuridicoTotal}, juridico=${juridicoTotal}`
        );
      } else {
        // Crear nuevo registro
        await prismaMainService.gastos_cartera.create({
          data: {
            prestamo_id: prestamoId,
            prejuridico: prejuridicoTotal,
            juridico: juridicoTotal,
            fecha_creacion: new Date(),
            fecha_actualizacion: new Date()
          }
        });
        this.logger.debug(
          `[GASTOS_CARTERA] ✅ Creado: prestamo_ID=${prestamoId}, prejuridico=${prejuridicoTotal}, juridico=${juridicoTotal}`
        );
      }

      return true;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[GASTOS_CARTERA] ⚠️ Error guardando gastos para prestamo_ID=${prestamoId}: ${errorMsg}`
      );
      // No lanzar error - retornar false para que el flujo continúe
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SANCIONES CONDONADAS - Guardar sanciones condonadas desde cálculo de refinanciamiento
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Guarda sanciones condonadas en la BD después del cálculo de amortizaciones
   * 
   * @param prestamoId - ID del crédito (prestamo_ID)
   * @param infoPagos - Objeto con estructura {sanciones_condonadas: number, dias_sanciones_condonadas: number, ...}
   * @returns Promise<boolean> - true si se guardó, false si no hay datos o error
   */
  private async saveSancionesCondonadas(prestamoId: number, infoPagos?: any): Promise<boolean> {
    try {
      // 1. Validar que infoPagos existe
      if (!infoPagos) {
        this.logger.debug(`[SANCIONES_CONDONADAS] ℹ️ Sin infoPagos para prestamo_ID=${prestamoId}`);
        return false;
      }

      // 2. Extraer valores de sanciones y días condonados
      let montoCondonado = 0;
      let diaCondonado = 0;

      // Extraer monto condonado
      if (typeof infoPagos.sanciones_condonadas !== 'undefined' && infoPagos.sanciones_condonadas !== null) {
        montoCondonado = parseInt(String(infoPagos.sanciones_condonadas)) || 0;
      }

      // Extraer días condonados
      if (typeof infoPagos.dias_sanciones_condonadas !== 'undefined' && infoPagos.dias_sanciones_condonadas !== null) {
        diaCondonado = parseInt(String(infoPagos.dias_sanciones_condonadas)) || 0;
      }

      // 3. Si ambos valores son 0, no guardar
      if (montoCondonado === 0 && diaCondonado === 0) {
        this.logger.debug(`[SANCIONES_CONDONADAS] ℹ️ Ambas sanciones vacías (monto=0, dias=0) para prestamo_ID=${prestamoId}`);
        return false;
      }

      // 4. Buscar si ya existe registro para este prestamo_id
      const sancionExistente = await prismaMainService.sanciones_condonadas.findFirst({
        where: { prestamo_id: prestamoId }
      });

      // 5. Crear o actualizar según corresponda
      if (sancionExistente) {
        // Actualizar registro existente
        await prismaMainService.sanciones_condonadas.update({
          where: { id: sancionExistente.id },
          data: {
            monto_condonado: montoCondonado,
            dia_condonado: diaCondonado,
            actualizado: new Date()
          }
        });
        this.logger.debug(
          `[SANCIONES_CONDONADAS] ✅ Actualizado: prestamo_ID=${prestamoId}, monto=${montoCondonado}, dias=${diaCondonado}`
        );
      } else {
        // Crear nuevo registro
        await prismaMainService.sanciones_condonadas.create({
          data: {
            prestamo_id: prestamoId,
            monto_condonado: montoCondonado,
            dia_condonado: diaCondonado,
            fecha_registro: new Date(),
            actualizado: new Date()
          }
        });
        this.logger.debug(
          `[SANCIONES_CONDONADAS] ✅ Creado: prestamo_ID=${prestamoId}, monto=${montoCondonado}, dias=${diaCondonado}`
        );
      }

      return true;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[SANCIONES_CONDONADAS] ⚠️ Error guardando sanciones para prestamo_ID=${prestamoId}: ${errorMsg}`
      );
      // No lanzar error - retornar false para que el flujo continúe
      return false;
    }
  }
}

export default MainDataService;
