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
   * ESTRATEGIA:
   * - Para créditos DESEMBOLSADOS: usar created_at del crédito + días según periodicidad
   * - Para créditos PENDIENTES: usar s_fecha o created_at del precredito
   * - NUNCA usar p_fecha (puede ser muy antigua - fecha de simulación)
   */
  private static calcularFechaPago(
    precreditoLegacy: any,
    creditoLegacy?: any
  ): string {
    try {
      // CRÉDITOS DESEMBOLSADOS: usar fecha REAL de desembolso
      if (creditoLegacy?.created_at) {
        const fechaDesembolso = new Date(creditoLegacy.created_at);
        const periocidad = precreditoLegacy.periodo?.toUpperCase() || 'MENSUAL';
        
        // Calcular días hasta primera cuota según periodicidad
        let diasHastaPrimeraCuota = 30; // default MENSUAL
        if (periocidad === 'QUINCENAL' || periocidad === 'DECADAL') {
          diasHastaPrimeraCuota = 15;
        } else if (periocidad === 'SEMANAL') {
          diasHastaPrimeraCuota = 7;
        }
        
        fechaDesembolso.setDate(fechaDesembolso.getDate() + diasHastaPrimeraCuota);
        return fechaDesembolso.toISOString().split('T')[0];
      }
      
      // CRÉDITOS PENDIENTES: usar s_fecha (segunda fecha) si existe
      if (precreditoLegacy.s_fecha) {
        const fecha = new Date(precreditoLegacy.s_fecha);
        if (!isNaN(fecha.getTime())) {
          return fecha.toISOString().split('T')[0];
        }
      }
      
      // Alternativa: usar created_at del precredito + 30 días
      if (precreditoLegacy.created_at) {
        const fecha = new Date(precreditoLegacy.created_at);
        if (!isNaN(fecha.getTime())) {
          fecha.setDate(fecha.getDate() + 30);
          return fecha.toISOString().split('T')[0];
        }
      }
      
      // ÚLTIMO RECURSO: p_fecha (con warning)
      console.warn(
        `[CREDITO-MAPPER] Usando p_fecha para precredito ${precreditoLegacy.id} - ` +
        `Verificar si es correcta (puede ser fecha muy antigua)`
      );
      if (precreditoLegacy.p_fecha) {
        const fecha = new Date(precreditoLegacy.p_fecha);
        if (!isNaN(fecha.getTime())) {
          return fecha.toISOString().split('T')[0];
        }
      }
    } catch (e) {
      console.error(`[CREDITO-MAPPER] Error calculando fecha de pago:`, e);
    }

    // Fallback extremo (no debería llegar aquí)
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
    prismaLegacyService: any,
    creditoLegacy?: any,
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

      // Mapear estado: Usar valores correctos del enum precreditos_aprobado
      let estado = 'EN ESTUDIO';
      switch (precreditoLegacy.aprobado) {
        case 'Si':
          estado = 'APROBADO';
          break;
        case 'No':
          estado = 'RECHAZADO';
          break;
        case 'En_estudio':
          estado = 'EN ESTUDIO';
          break;
        case 'Desistio':
          estado = 'CANCELADO';
          break;
        default:
          // Log warning but continue with default estado
          estado = 'EN ESTUDIO';
      }

      // Mapear período: CORTO_PLAZO/LARGO_PLAZO → meses
      // Si no hay info, usar por defecto 12 meses
      const meses = precreditoLegacy.meses || 12;
      const plazo = `${meses} ${meses === 1 ? 'MES' : 'MESES'}`;

      // CRÍTICO: La tasa está en la tabla carteras, NO en precreditos
      // Usar la tasa de la cartera relacionada
      const tasa = precreditoLegacy.carteras?.tasa?.toString() || '0';
      
      // Validar que la tasa sea válida
      if (!precreditoLegacy.carteras || !precreditoLegacy.carteras.tasa) {
        console.warn(
          `[CREDITO-MAPPER] Precredito ${precreditoLegacy.id} sin cartera o sin tasa. ` +
          `Esto no debería pasar si los filtros están correctos.`
        );
      }

      // Calcular día de pago y fecha de pago
      // ✅ NORMALIZAR periodicidad a MAYÚSCULAS para comparaciones
      const periocidad = (precreditoLegacy.periodo || 'MENSUAL').toUpperCase();
      const diaPago = diaPagoOverride || this.calcularDiaPago(periocidad);
      const fechaPago = fechaPagoOverride || this.calcularFechaPago(precreditoLegacy, creditoLegacy);

      // ============ CAMPOS CALCULADOS DESDE AMORTIZACIONES (QUERY RAW) ============
      // Consultar tabla amortizaciones directamente sin modificar schema
      let seguro = 0;
      let iva_aval = '0';
      let seguro_add = '0';
      
      try {
        const amortizacionesRaw: any[] = await prismaLegacyService.$queryRaw`
          SELECT porc_seguro, porc_iva_aval 
          FROM amortizaciones 
          WHERE precredito_id = ${precreditoLegacy.id}
          LIMIT 1
        `;

        if (amortizacionesRaw && amortizacionesRaw.length > 0) {
          const amortizacion = amortizacionesRaw[0];
          const vlr_fin = precreditoLegacy.vlr_fin;

          // Calcular seguro: porcentaje del valor del crédito
          if (amortizacion.porc_seguro) {
            seguro = Math.round(vlr_fin * (amortizacion.porc_seguro / 100));
          }

          // Calcular IVA del aval: porcentaje del valor del crédito
          if (amortizacion.porc_iva_aval) {
            iva_aval = (vlr_fin * (amortizacion.porc_iva_aval / 100)).toFixed(2);
          }

          // Seguro adicional: usar mismo porcentaje de seguro
          if (amortizacion.porc_seguro) {
            seguro_add = (vlr_fin * (amortizacion.porc_seguro / 100)).toFixed(2);
          }
        } else {
          console.warn(
            `[CREDITO-MAPPER] Precredito ${precreditoLegacy.id} sin amortizaciones. ` +
            `Los campos seguro, iva_aval y seguro_add serán 0.`
          );
        }
      } catch (error) {
        console.error(
          `[CREDITO-MAPPER] Error consultando amortizaciones para precredito ${precreditoLegacy.id}:`,
          error
        );
      }

      // ============ CAMPOS DE AUDITORÍA ============
      // Creador del crédito: nombre del funcionario que lo creó
      const creador = precreditoLegacy.users_precreditos_funcionario_idTousers?.name 
        || 'SISTEMA_LEGACY';

      // ============ CAMPOS DE NEGOCIO ============
      // Tipo de crédito dinámico según la cartera
      const tipoCredito = precreditoLegacy.carteras?.nombre || 'CREDITO EXPRESS';

      // Origen: verificar si es refinanciamiento
      let origen = 'NUEVO';
      if (precreditoLegacy.creditos && precreditoLegacy.creditos.length > 0) {
        const credito = precreditoLegacy.creditos[0];
        if (credito.refinanciacion === 'Si') {
          origen = 'REFINANCIADO';
        }
      }

      // Crear el DTO
      const [error, dto] = DetalleCreditoCreateDto.create({
        documento: clienteLegacy.num_doc,
        tipoCredito: tipoCredito,                  // ✅ Dinámico desde carteras
        valor_prestamo: precreditoLegacy.vlr_fin,
        inicial: precreditoLegacy.cuota_inicial || 0,
        plazo: plazo,
        numero_cuotas: precreditoLegacy.cuotas,
        valor_cuota: precreditoLegacy.vlr_cuota,
        periocidad: periocidad,
        tasa: tasa,
        estado: estado,
        origen: origen,                            // ✅ Check refinanciamiento
        seguro: seguro,                            // ✅ Calculado desde amortizaciones (query raw)
        iva_aval: iva_aval,                        // ✅ Calculado desde amortizaciones (query raw)
        pablok: 0,                                 // TODO: Pendiente investigación
        seguro_add: seguro_add,                    // ✅ Calculado desde amortizaciones (query raw)
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
    precreditosLegacy: any[],
    prismaLegacyService: any
  ): Promise<DetalleCreditoCreateDto[]> {
    const creditos: DetalleCreditoCreateDto[] = [];

    for (const precredito of precreditosLegacy) {
      const creditoLegacy = precredito.creditos?.[0];
      const [error, dto] = await this.mapToCreditoDto(precredito, clienteLegacy, prismaLegacyService, creditoLegacy);

      if (!error && dto) {
        creditos.push(dto);
      } else {
        console.warn(`[CREDITO-MAPPER] Error mapeando precredito ${precredito.id}: ${error}`);
      }
    }

    return creditos;
  }
}
