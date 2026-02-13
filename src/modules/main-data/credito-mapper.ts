import { DetalleCreditoCreateDto } from '../../domain/dtos/migrate-cliente.dto';

/**
 * Mapper para convertir datos de precreditos (legacy) a detalle_credito (main)
 */
export class CreditoMapper {
  /**
   * Calcula el día de pago basado en la periocidad
   * - SEMANAL: día 7
   * - QUINCENAL: día 15
   * - MENSUAL: día 15 (default)
   */
  private static calcularDiaPago(periocidad?: string): string {
    switch (periocidad?.toUpperCase()) {
      case 'SEMANAL':
        return '7';
      case 'QUINCENAL':
        return '15';
      case 'MENSUAL':
      default:
        return '15';
    }
  }

  /**
   * Calcula la fecha de primer pago
   * Si viene p_fecha del legacy, la usa; sino calcula 30 días desde hoy
   */
  private static calcularFechaPago(fechaLegacy?: string): string {
    try {
      if (fechaLegacy) {
        // Intentar parsear la fecha legacy (puede ser string en varios formatos)
        const fecha = new Date(fechaLegacy);
        if (!isNaN(fecha.getTime())) {
          return fecha.toISOString().split('T')[0];
        }
      }
    } catch (e) {
      // Si falla el parsing, usar default
    }

    // Default: 30 días desde hoy
    const hoy = new Date();
    hoy.setDate(hoy.getDate() + 30);
    return hoy.toISOString().split('T')[0];
  }

  /**
   * Mapea un precredito legacy a DTO de detalle_credito
   */
  static async mapToCreditoDto(
    precreditoLegacy: any,
    clienteLegacy: any,
    diaPagoOverride?: string,
    fechaPagoOverride?: string
  ): Promise<[string?, DetalleCreditoCreateDto?]> {
    try {
      // Validaciones básicas
      if (!precreditoLegacy) {
        return ['Precredito legacy is required', undefined];
      }

      if (!clienteLegacy || !clienteLegacy.num_doc) {
        return ['Cliente legacy with num_doc is required', undefined];
      }

      // Mapear estado: PENDIENTE/APROBADO/RECHAZADO → EN ESTUDIO/APROBADO/RECHAZADO
      let estado = 'EN ESTUDIO';
      if (precreditoLegacy.aprobado === 'APROBADO' || precreditoLegacy.aprobado === 'Aprobado') {
        estado = 'APROBADO';
      } else if (precreditoLegacy.aprobado === 'RECHAZADO' || precreditoLegacy.aprobado === 'Rechazado') {
        estado = 'RECHAZADO';
      }

      // Mapear período: CORTO_PLAZO/LARGO_PLAZO → meses
      // Si no hay info, usar por defecto 12 meses
      const meses = precreditoLegacy.meses || 12;
      const plazo = `${meses} ${meses === 1 ? 'MES' : 'MESES'}`;

      // Calcular tasa si no viene en precredito (asumir 0 si no viene)
      const tasa = precreditoLegacy.tasa || '0';

      // Calcular día de pago y fecha de pago
      const periocidad = precreditoLegacy.periodo || 'MENSUAL';
      const diaPago = diaPagoOverride || this.calcularDiaPago(periocidad);
      const fechaPago = fechaPagoOverride || this.calcularFechaPago(precreditoLegacy.p_fecha);

      // Crear el DTO
      const [error, dto] = DetalleCreditoCreateDto.create({
        documento: clienteLegacy.num_doc,
        tipoCredito: 'CREDITO EXPRESS',
        valor_prestamo: precreditoLegacy.vlr_fin,
        inicial: precreditoLegacy.cuota_inicial || 0,
        plazo: plazo,
        numero_cuotas: precreditoLegacy.cuotas,
        valor_cuota: precreditoLegacy.vlr_cuota,
        periocidad: periocidad,
        tasa: tasa,
        estado: estado,
        origen: 'NUEVO',
        seguro: 0,
        iva_aval: '0',
        pablok: 0,
        seguro_add: '0',
        diaPago: diaPago,
        fechaPago: fechaPago,
      });

      if (error) {
        return [error, undefined];
      }

      return [undefined, dto];
    } catch (error) {
      return [
        `Error mapeando precredito a detalle_credito: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
      ];
    }
  }

  /**
   * Mapea múltiples precreditos de un cliente
   */
  static async mapPrecreditosCliente(
    clienteLegacy: any,
    precreditosLegacy: any[]
  ): Promise<DetalleCreditoCreateDto[]> {
    const creditos: DetalleCreditoCreateDto[] = [];

    for (const precredito of precreditosLegacy) {
      const [error, dto] = await this.mapToCreditoDto(precredito, clienteLegacy);

      if (!error && dto) {
        creditos.push(dto);
      } else {
        console.warn(`[CREDITO-MAPPER] Error mapeando precredito ${precredito.id}: ${error}`);
      }
    }

    return creditos;
  }
}
