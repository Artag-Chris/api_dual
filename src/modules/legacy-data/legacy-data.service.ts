import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';

/**************************************************************************************************
 * Servicio para datos Legacy
 * 
 * Servicio para operaciones CRUD en la base de datos legacy
 * Acceso a múltiples modelos: clientes, créditos, codeudores, facturas, pagos, etc.
 ***************************************************************************************************/

class LegacyDataService {
  private static instance: LegacyDataService;

  constructor() {}

  public static getInstance(): LegacyDataService {
    if (!LegacyDataService.instance) {
      LegacyDataService.instance = new LegacyDataService();
    }
    return LegacyDataService.instance;
  }

  // ==================== CLIENTES ====================

  async getAllClientes(skip?: number, take?: number) {
    return await prismaLegacyService.clientes.findMany({
      skip: skip || 0,
      take: take || 100,
    });
  }

  async getClienteById(id: number) {
    return await prismaLegacyService.clientes.findUnique({
      where: { id },
    });
  }

  async getClienteByDocumento(documento: string) {
    return await prismaLegacyService.clientes.findUnique({
      where: { num_doc: documento },
    });
  }

  // ==================== CRÉDITOS ====================

  async getAllCreditos(skip?: number, take?: number) {
    return await prismaLegacyService.creditos.findMany({
      skip: skip || 0,
      take: take || 100,
      include: {
        precreditos: true,
        users_creditos_user_create_idTousers: true,
      },
    });
  }

  async getCreditoById(id: number) {
    return await prismaLegacyService.creditos.findUnique({
      where: { id },
      include: {
        precreditos: true,
        users_creditos_user_create_idTousers: true,
      },
    });
  }

  async getCreditosByCliente(cliente_id: number) {
    return await prismaLegacyService.creditos.findMany({
      where: {
        precreditos: {
          cliente_id,
        },
      },
      include: {
        precreditos: {
          include: {
            clientes: true,
          },
        },
      },
    });
  }

  // ==================== CODEUDORES ====================

  async getAllCodeudores(skip?: number, take?: number) {
    return await prismaLegacyService.codeudores.findMany({
      skip: skip || 0,
      take: take || 100,
    });
  }

  async getCodeudorById(id: number) {
    return await prismaLegacyService.codeudores.findUnique({
      where: { id },
    });
  }

  // ==================== FACTURAS ====================

  async getAllFacturas(skip?: number, take?: number) {
    return await prismaLegacyService.facturas.findMany({
      skip: skip || 0,
      take: take || 100,
    });
  }

  async getFacturaById(id: number) {
    return await prismaLegacyService.facturas.findUnique({
      where: { id },
    });
  }

  // ==================== PAGOS ====================

  async getAllPagos(skip?: number, take?: number) {
    return await prismaLegacyService.pagos.findMany({
      skip: skip || 0,
      take: take || 100,
    });
  }

  async getPagoById(id: number) {
    return await prismaLegacyService.pagos.findUnique({
      where: { id },
    });
  }

  // ==================== PRECREDITOS ====================

  async getAllPrecreditos(skip?: number, take?: number) {
    return await prismaLegacyService.precreditos.findMany({
      skip: skip || 0,
      take: take || 100,
    });
  }

  async getPrecreditoById(id: number) {
    return await prismaLegacyService.precreditos.findUnique({
      where: { id },
    });
  }

  // ==================== REFERENCIAS ====================

  async getAllReferencias(skip?: number, take?: number) {
    return await prismaLegacyService.referencias.findMany({
      skip: skip || 0,
      take: take || 100,
    });
  }

  async getReferenciaById(id: number) {
    return await prismaLegacyService.referencias.findUnique({
      where: { id },
    });
  }

  // ==================== USUARIOS ====================

  async getAllUsuarios(skip?: number, take?: number) {
    return await prismaLegacyService.users.findMany({
      skip: skip || 0,
      take: take || 100,
    });
  }

  async getUsuarioById(id: number) {
    return await prismaLegacyService.users.findUnique({
      where: { id },
    });
  }

  // ==================== CARTERAS ====================

  async getAllCarteras(skip?: number, take?: number) {
    return await prismaLegacyService.carteras.findMany({
      skip: skip || 0,
      take: take || 100,
    });
  }

  async getCarteraById(id: number) {
    return await prismaLegacyService.carteras.findUnique({
      where: { id },
    });
  }

  // ==================== ESTATÍSTICAS ====================

  async getEstadisticasGenerales() {
    const clientesTotal = await prismaLegacyService.clientes.count();
    const creditosTotal = await prismaLegacyService.creditos.count();
    const pagosTotal = await prismaLegacyService.pagos.count();
    const precreditosTotal = await prismaLegacyService.precreditos.count();

    return {
      clientes: clientesTotal,
      creditos: creditosTotal,
      pagos: pagosTotal,
      precreditos: precreditosTotal,
    };
  }
}

export default LegacyDataService;
