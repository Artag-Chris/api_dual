import { prismaMainService } from '../../database/main/prisma-main.service';

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
}

export default MainDataService;
