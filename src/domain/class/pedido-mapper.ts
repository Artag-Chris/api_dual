/**
 * PHASE 12: Pedido and Products Mapper
 * Creates pedido (order) and products with tracking nomenclature
 * Products saved as: Faciliti_${producto_id_legacy}
 */

import { prismaMainService } from '../../database/main/prisma-main.service';
import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';
import { PedidoCreateDto, PedidoProductoCreateDto } from '../dtos/migrate-cliente.dto';

interface ProductoMain {
  id: number;
  nombre: string;
  costo_unitario: number;
  costo_unitario_con_iva: number;
  referencia_id: number;
}

export class PedidoMapper {
  private static readonly DEFAULT_REFERENCIA_ID = 1; // Default reference if not found

  constructor(
    private readonly prismaMain: typeof prismaMainService,
    private readonly prismaLegacy: typeof prismaLegacyService,
    private readonly logger: typeof WinstonAdapter
  ) {}

  /**
   * Creates pedido and associated products for a credit
   */
  async crearPedidoConProductos(
    precreditoId: number,
    userClienteIdMain: number,
    prestamoIDMain: number,
    mapeoBodegas: Map<number, number>,
    tx: any // Prisma transaction
  ): Promise<{ pedidoId: number; productos: number }> {
    try {
      // 1. Fetch ref_productos from legacy
      const refProductos = await this.prismaLegacy.ref_productos.findMany({
        where: {
          precredito_id: precreditoId,
          estado: {
            in: ['En_proceso', 'Liquidado'],
          },
        },
        include: {
          productos: true,
        },
      });

      if (refProductos.length === 0) {
        this.logger.warn(`No ref_productos found for precredito ${precreditoId}`);
        return { pedidoId: 0, productos: 0 };
      }

      // 2. Calculate totals
      const valorTotal = refProductos.reduce((sum, rp) => {
        const costo = rp.costo || 0;
        const iva = rp.iva || 0;
        const otros = rp.otros || 0;
        return sum + costo + iva + otros;
      }, 0);

      const cuotaInicial = Math.round(valorTotal * 0.1); // 10% initial payment

      // 3. Create pedido
      const [errorPedido, pedidoDto] = PedidoCreateDto.create({
        user_cliente_id: userClienteIdMain,
        prestamo_ID: prestamoIDMain,
        cuota_inicial: cuotaInicial,
        valor_total: Math.round(valorTotal),
        estado: 'CREADO',
      });

      if (errorPedido || !pedidoDto) {
        throw new Error(`Error creating pedido DTO: ${errorPedido}`);
      }

      const pedido = await tx.pedido.create({
        data: {
          user_cliente_id: pedidoDto.user_cliente_id,
          prestamo_ID: pedidoDto.prestamo_ID,
          cuota_inicial: pedidoDto.cuota_inicial,
          valor_total: pedidoDto.valor_total,
          estado: pedidoDto.estado,
        },
      });

      this.logger.info(`Created pedido ${pedido.id} for prestamo ${prestamoIDMain}`);

      // 4. Create products with nomenclature and add to pedido
      let productosCreados = 0;

      for (const refProducto of refProductos) {
        // Get almacen from created_by user's punto_id
        let almacen = 100; // Default almacen
        
        if (refProducto.created_by) {
          const createdByUser = await this.prismaLegacy.users.findUnique({
            where: { id: refProducto.created_by },
            select: { punto_id: true },
          });
          
          if (createdByUser) {
            almacen = mapeoBodegas.get(createdByUser.punto_id) || 100;
          }
        }

        // Create or get product in main with Faciliti nomenclature
        const productoMain = await this.crearObtenerProductoMain(
          refProducto.producto_id,
          refProducto.nombre,
          refProducto.costo || 0,
          refProducto.iva || 0,
          tx
        );

        // Create pedido_producto
        const costoFinal = (refProducto.costo || 0) + (refProducto.iva || 0) + (refProducto.otros || 0);

        const [errorPP, pedidoProductoDto] = PedidoProductoCreateDto.create({
          pedido_id: pedido.id,
          product_id: productoMain.id,
          cantidad_selec: 1,
          costo_final: Math.round(costoFinal),
          almacen: almacen,
        });

        if (errorPP || !pedidoProductoDto) {
          this.logger.error(`Error creating pedido_producto: ${errorPP}`);
          continue;
        }

        await tx.pedido_producto.create({
          data: {
            pedido_id: pedidoProductoDto.pedido_id,
            product_id: pedidoProductoDto.product_id,
            cantidad_selec: pedidoProductoDto.cantidad_selec,
            costo_final: pedidoProductoDto.costo_final,
            almacen: pedidoProductoDto.almacen,
          },
        });

        productosCreados++;
      }

      this.logger.info(`Created ${productosCreados} products for pedido ${pedido.id}`);

      return { pedidoId: pedido.id, productos: productosCreados };
    } catch (error) {
      this.logger.error(`Error creating pedido for precredito ${precreditoId}:`, error);
      throw error;
    }
  }

  /**
   * Creates or retrieves product in main database with Faciliti nomenclature
   * Product name: Faciliti_${producto_id_legacy}
   */
  private async crearObtenerProductoMain(
    productoIdLegacy: number,
    nombreLegacy: string,
    costo: number,
    iva: number,
    tx: any
  ): Promise<ProductoMain> {
    // Product nomenclature for migration tracking
    const nombreProductoMain = `Faciliti_${productoIdLegacy}`;

    // Check if product already exists
    const productoExistente = await tx.producto.findFirst({
      where: {
        nombre: nombreProductoMain,
      },
    });

    if (productoExistente) {
      return productoExistente;
    }

    // Create new product
    const costoUnitario = Math.round(costo);
    const costoConIva = Math.round(costo + iva);

    const productoMain = await tx.producto.create({
      data: {
        nombre: nombreProductoMain,
        costo_unitario: costoUnitario,
        costo_unitario_con_iva: costoConIva,
        iva: Math.round(iva),
        referencia_id: PedidoMapper.DEFAULT_REFERENCIA_ID,
        descripcion: `Migrado desde FACILITO - Producto: ${nombreLegacy} (ID Legacy: ${productoIdLegacy})`,
        activo: true,
      },
    });

    this.logger.info(
      `Created product in main: ${nombreProductoMain} (ID: ${productoMain.id}, Legacy: ${productoIdLegacy})`
    );

    return productoMain;
  }

  /**
   * Extracts legacy product ID from Faciliti nomenclature
   */
  static extractLegacyProductId(nombreProducto: string): number | null {
    const match = nombreProducto.match(/^Faciliti_(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Checks if product name follows Faciliti nomenclature
   */
  static isFacilitiProduct(nombreProducto: string): boolean {
    return /^Faciliti_\d+$/.test(nombreProducto);
  }
}
