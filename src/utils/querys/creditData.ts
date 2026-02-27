import { prismaLegacyService } from "../../database/legacy/prisma-legacy.service";

  export const  creditosData = async(documento:string)=>await prismaLegacyService.$queryRaw<any[]>`
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
    creditos.id as credito_id_legacy,
	creator.name AS creador,
	precreditos.created_at AS fecha_creacion,
	precreditos.id as precredito_id,
	amortizaciones.porc_aval AS seguro,
	amortizaciones.porc_iva_aval AS iva_aval,
	amortizaciones.cta_capital,
	amortizaciones.cta_aval,
	amortizaciones.cta_iva_aval,
	amortizaciones.total_cta_aval,
	creditos.castigada AS es_castigada,
	updator.name as actualizador,
	creditos.updated_at AS ultima_fecha_actualizacion,
	carteras.id AS cartera_id,
    carteras.nombre AS nombre_cartera,
	carteras.nombre AS linea_credito,
	codeudores.num_doc AS documento_codeudor,
	codeudores.id AS id_codeudor,
	estudios.cal_asesor,
	estudios.cal_estudio,
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
	ON estudios.estDatacredito_id = datacreditos.id
WHERE clientes.num_doc = ${documento}
ORDER BY precreditos.id DESC
      `;