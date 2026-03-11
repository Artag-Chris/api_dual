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
	amortizaciones.porc_seguro AS seguro,
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
	ON estudios.estDatacredito_id = est_datacreditos.id
ORDER BY precreditos.id DESC




////////////////////////////////////////
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
	ON estudios.estDatacredito_id = est_datacreditos.id
ORDER BY precreditos.id DESC


///////////////////////
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
    ON estudios.estDatacredito_id = est_datacreditos.id
WHERE clientes.num_doc = '16792193'
ORDER BY precreditos.id DESC

/////////////////////////////////
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
	amortizaciones.cta_capital,
	amortizaciones.cta_aval,
	amortizaciones.cta_iva_aval,
	amortizaciones.total_cta_aval,
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
	ON estudios.estDatacredito_id = est_datacreditos.id
ORDER BY precreditos.id DESC

///////////////////////////////////////////////
SELECT 
	clientes.num_doc AS documento,
	precreditos.vlr_fin AS valor_prestamo,
	precreditos.aprobado AS estado_aprobacion,
	precreditos.cuota_inicial,
	precreditos.s_inicial AS segunda_inicial,
	precreditos.meses AS numero_meses,
	precreditos.cuotas AS numero_cuotas_mensuales,
	precreditos.periodo AS periodicidad,
	precreditos.vlr_cuota,
	amortizaciones.porc_interes AS tasa,
	amortizaciones.porc_tea AS tasa_efectiva_anual,
	precreditos.p_fecha AS fecha_pago_1,
	precreditos.s_fecha AS fecha_pago_2,
	fc.fecha_pago AS proxima_fecha_pago,
    creditos.id AS credito_id,
	creditos.estado,
	creditos.cuotas_faltantes,
    creditos.id as credito_id,
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
	ON estudios.estDatacredito_id = est_datacreditos.id
ORDER BY precreditos.id DESC
///////////////////////////////////////////////////////////
SELECT 
	clientes.num_doc AS documento,
	precreditos.vlr_fin AS valor_prestamo,
	precreditos.aprobado AS estado_aprobacion,
	precreditos.cuota_inicial,
	precreditos.s_inicial AS segunda_inicial,
	precreditos.meses AS numero_meses,
	precreditos.cuotas AS numero_cuotas_mensuales,
	precreditos.periodo AS periodicidad,
	precreditos.vlr_cuota,
	amortizaciones.porc_interes AS tasa,
	amortizaciones.porc_tea AS tasa_efectiva_anual,
	precreditos.p_fecha AS fecha_pago_1,
	precreditos.s_fecha AS fecha_pago_2,
	fc.fecha_pago AS proxima_fecha_pago,
    creditos.id AS credito_id,
	creditos.estado,
	creditos.cuotas_faltantes,
    creditos.id as credito_id,
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
	ON estudios.estDatacredito_id = est_datacreditos.id
WHERE creditos.id = 26122
ORDER BY precreditos.id DESC

////////////////////////////////////
SELECT 
    clientes.num_doc AS documento,
    precreditos.vlr_fin AS valor_prestamo,
    precreditos.vlr_cuota AS valor_cuota,
    precreditos.periodo AS periodicidad,
    precreditos.meses AS cantidad_meses,
    precreditos.created_at AS fecha_creacion,
	precreditos.p_fecha as fecha_pago1,
	precreditos.s_fecha as fecha_pago2,
    creditos.cuotas_faltantes,
    creditos.id AS credito_id
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
    ON creditos.user_update_id = updator.id
LEFT JOIN fecha_cobros fc 
    ON creditos.id = fc.credito_id
INNER JOIN carteras 
    ON precreditos.cartera_id = carteras.id
LEFT JOIN est_datacreditos
    ON estudios.estDatacredito_id = est_datacreditos.id
WHERE creditos.id = 26122
ORDER BY precreditos.id DESC;


//////////////////////////////////////////////////////////////
SELECT * FROM `sanciones` WHERE `credito_id` = 25391 

SELECT 
    SUM(CASE WHEN estado = 'Ok' THEN 1 ELSE 0 END) AS estado_ok,
    SUM(CASE WHEN estado = 'Debe' THEN 1 ELSE 0 END) AS estado_debe,
    SUM(CASE WHEN estado = 'Exonerada' THEN 1 ELSE 0 END) AS estado_exonerada,
    COUNT(*) AS total_sanciones
FROM `sanciones` 
WHERE `credito_id` = 12360;
-------------------------------

SELECT * FROM `pagos` WHERE `credito_id` = 25391 

-------------------------------------------

SELECT 
	clientes.num_doc AS documento,
	precreditos.vlr_fin AS valor_prestamo,
	precreditos.aprobado AS estado_aprobacion,
	precreditos.cuota_inicial,
	precreditos.s_inicial AS segunda_inicial,
	precreditos.meses AS numero_meses,
	precreditos.cuotas AS numero_cuotas_mensuales,
	precreditos.periodo AS periodicidad,
	precreditos.vlr_cuota,
	amortizaciones.porc_interes AS tasa,
	amortizaciones.porc_tea AS tasa_efectiva_anual,
	precreditos.p_fecha AS fecha_pago_1,
	precreditos.s_fecha AS fecha_pago_2,
	fc.fecha_pago AS proxima_fecha_pago,
    creditos.id AS credito_id,
	creditos.estado,
	creditos.cuotas_faltantes,
    creditos.id as credito_id,
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
	ON estudios.estDatacredito_id = est_datacreditos.id
WHERE creditos.id = 28520
ORDER BY precreditos.id DESC



---------------------------------------

-- Iniciar transaccion por seguridad
START TRANSACTION;

-- Eliminar solo de user_cliente (CASCADE eliminara el resto)
DELETE FROM user_cliente 
WHERE fecha_registro >= '2026-02-20 20:19:44';

DELETE FROM `migration_queue`;

DELETE FROM `migration_queue_dlq`;

-- Confirmar la transaccion
COMMIT;


--------------------------------------------
SELECT SUM(`prejuridico`) AS total_prejuridico, SUM(`juridico`) AS total_juridico, SUM(`prejuridico` + `juridico`) AS total_general FROM `gastos_cartera` WHERE `fecha_creacion` >= '2026-03-03 17:22:55'; 

SELECT 
  dc.prestamo_ID,
  dc.documento,
  dc.estado,
  dc.fecha_actualizacion,
  COALESCE(SUM(CAST(am.total_cuota AS UNSIGNED)), 0) as total_cuota
FROM detalle_credito dc
LEFT JOIN amortizacion am ON dc.prestamo_ID = am.prestamoID
WHERE dc.estado IN ('ACTIVO', 'JURIDICO', 'PREJURIDICO', 'REFINANCIADO')
AND dc.fecha_actualizacion > '2026-03-03 17:44:29'
GROUP BY dc.prestamo_ID, dc.documento, dc.estado, dc.fecha_actualizacion
ORDER BY dc.prestamo_ID ASC;

SELECT 
  COALESCE(SUM(CAST(am.total_cuota AS UNSIGNED)), 0) as valor_final_total_cuota
FROM detalle_credito dc
LEFT JOIN amortizacion am ON dc.prestamo_ID = am.prestamoID
WHERE dc.estado IN ('ACTIVO', 'JURIDICO', 'PREJURIDICO', 'REFINANCIADO')
AND dc.fecha_actualizacion > '2026-03-03 17:44:29';
SELECT dc.prestamo_ID, dc.documento, dc.estado, dc.fecha_actualizacion, COALESCE(SUM(CAST(am.total_cuota AS UNSIGNED)), 0) as total_cuota FROM detalle_credito dc LEFT JOIN amortizacion am ON dc.prestamo_ID = am.prestamoID WHERE dc.estado IN ('ACTIVO', 'JURIDICO', 'PREJURIDICO', 'REFINANCIADO') AND dc.fecha_actualizacion > '2026-03-03 17:44:29' GROUP BY dc.prestamo_ID, dc.documento, dc.estado, dc.fecha_actualizacion ORDER BY dc.prestamo_ID ASC; 
1054552958

SELECT 
  dc.prestamo_ID,
  dc.documento,
  dc.tipoCredito,
  dc.estado AS estado_facilcreditos,
  COALESCE(gc.estado, 'SIN_GESTION') AS estado_cartera,
  COALESCE(gco.prejuridico, 0) AS gastos_prejuridico,
  COALESCE(gco.juridico, 0) AS gastos_juridico,
  CASE WHEN c.id IS NOT NULL THEN 'SÍ EXISTE' ELSE 'NO EXISTE' END AS existe_en_facilito,
  COALESCE(c.estado, '---') AS estado_en_facilito,
  COALESCE(c.castigada, '---') AS castigo_facilito,
  dc.valor_prestamo,
  dc.numero_cuotas,
  dc.fecha_Pago
FROM FACILCREDITOS.detalle_credito dc
LEFT JOIN FACILCREDITOS.gestion_cartera gc 
  ON dc.prestamo_ID = gc.prestamo_ID
LEFT JOIN FACILCREDITOS.gastos_cartera gco 
  ON dc.prestamo_ID = gco.prestamo_id
LEFT JOIN FACILITO.creditos c 
  ON c.id = dc.prestamo_ID
WHERE 
  dc.estado IN ('ACTIVO', 'PREJURIDICO', 'JURIDICO')
ORDER BY dc.prestamo_ID DESC;


SELECT 
  'FACILCREDITOS' AS base_datos,
  dc.estado,
  COUNT(dc.prestamo_ID) AS total_creditos,
  SUM(CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END) AS existen_en_facilito
FROM FACILCREDITOS.detalle_credito dc
LEFT JOIN FACILITO.creditos c ON c.id = dc.prestamo_ID
WHERE dc.estado IN ('ACTIVO', 'PREJURIDICO', 'JURIDICO')
GROUP BY dc.estado

UNION ALL

SELECT 
  'FACILITO' AS base_datos,
  c.estado,
  COUNT(c.id) AS total_creditos,
  SUM(CASE WHEN dc.prestamo_ID IS NOT NULL THEN 1 ELSE 0 END) AS existen_en_facilcreditos
FROM FACILITO.creditos c
LEFT JOIN FACILCREDITOS.detalle_credito dc ON dc.prestamo_ID = c.id
WHERE c.estado IN ('Al dia', 'Mora', 'Prejuridico', 'Juridico')
GROUP BY c.estado

UNION ALL

SELECT 
  'AMBAS BASES' AS base_datos,
  'Creditos que existen en ambas' AS estado,
  COUNT(DISTINCT dc.prestamo_ID) AS total_creditos,
  COUNT(DISTINCT dc.prestamo_ID) AS existen_en_ambas
FROM FACILCREDITOS.detalle_credito dc
INNER JOIN FACILITO.creditos c ON c.id = dc.prestamo_ID
WHERE dc.estado IN ('ACTIVO', 'PREJURIDICO', 'JURIDICO')
  AND c.estado IN ('Al dia', 'Mora', 'Prejuridico', 'Juridico');
  
---------------
24283

1059712028
--------------


-- =====================================================
-- CONSULTA: Gastos de Prejurídico y Jurídico adeudados
-- en créditos activos (Al dia, Mora, Prejuridico, Juridico)
-- Base de datos: Legacy (FacilCreditos)
-- =====================================================

-- 1. RESUMEN GENERAL: Total adeudado por concepto
SELECT 
    e.concepto,
    COUNT(*) AS cantidad_registros,
    SUM(e.valor) AS total_adeudado,
    COUNT(DISTINCT e.credito_id) AS creditos_afectados
FROM extras e
INNER JOIN creditos c ON e.credito_id = c.id
WHERE c.estado IN ('Al dia', 'Mora', 'Prejuridico', 'Juridico')
  AND e.estado = 'Debe'
  AND e.concepto IN ('Prejuridico', 'Juridico')
GROUP BY e.concepto;

-- 2. RESUMEN POR ESTADO DE CRÉDITO: Cuánto se debe por cada estado
SELECT 
    c.estado AS estado_credito,
    e.concepto,
    COUNT(*) AS cantidad_registros,
    SUM(e.valor) AS total_adeudado,
    COUNT(DISTINCT e.credito_id) AS creditos_afectados
FROM extras e
INNER JOIN creditos c ON e.credito_id = c.id
WHERE c.estado IN ('Al dia', 'Mora', 'Prejuridico', 'Juridico')
  AND e.estado = 'Debe'
  AND e.concepto IN ('Prejuridico', 'Juridico')
GROUP BY c.estado, e.concepto
ORDER BY c.estado, e.concepto;

-- 3. DETALLE COMPLETO: Cada gasto adeudado con info del crédito y cliente
SELECT 
    e.id AS extra_id,
    e.concepto,
    e.valor,
    e.fecha,
    e.estado AS estado_extra,
    c.id AS credito_id,
    c.estado AS estado_credito,
    c.saldo AS saldo_credito,
    c.cuotas_faltantes,
    p.id AS precredito_id,
    p.num_fact,
    cl.num_doc AS documento_cliente,
    cl.nombre AS nombre_cliente,
    cl.movil AS telefono
FROM extras e
INNER JOIN creditos c ON e.credito_id = c.id
INNER JOIN precreditos p ON c.precredito_id = p.id
INNER JOIN clientes cl ON p.cliente_id = cl.id
WHERE c.estado IN ('Al dia', 'Mora', 'Prejuridico', 'Juridico')
  AND e.estado = 'Debe'
  AND e.concepto IN ('Prejuridico', 'Juridico')
ORDER BY c.estado, e.concepto, e.valor DESC;

-- 4. GRAN TOTAL: Cifra global adeudada
SELECT 
    COUNT(*) AS total_gastos_adeudados,
    COUNT(DISTINCT e.credito_id) AS total_creditos_con_deuda,
    SUM(e.valor) AS total_valor_adeudado,
    SUM(CASE WHEN e.concepto = 'Prejuridico' THEN e.valor ELSE 0 END) AS total_prejuridico,
    SUM(CASE WHEN e.concepto = 'Juridico' THEN e.valor ELSE 0 END) AS total_juridico
FROM extras e
INNER JOIN creditos c ON e.credito_id = c.id
WHERE c.estado IN ('Al dia', 'Mora', 'Prejuridico', 'Juridico')
  AND e.estado = 'Debe'
  AND e.concepto IN ('Prejuridico', 'Juridico');
  
  -- =====================================================================
-- REPORTE INTEGRAL DE DEUDA: Créditos + Sanciones + Prejurídico/Jurídico
-- Créditos en estado: Al dia, Mora, Prejuridico, Juridico
-- Base de datos Legacy (FacilCreditos)
-- =====================================================================


-- =====================================================================
-- 1. RESUMEN GLOBAL POR ESTADO DE CRÉDITO
--    (cuotas pendientes × valor cuota, sanciones, extras)
-- =====================================================================
SELECT 
    c.estado                                        AS estado_credito,
    COUNT(DISTINCT c.id)                             AS total_creditos,
    
    -- DEUDA POR CUOTAS (vlr_cuota × cuotas_faltantes)
    SUM(p.vlr_cuota * c.cuotas_faltantes)            AS deuda_cuotas_pendientes,
    
    -- SALDO REGISTRADO EN CRÉDITOS
    SUM(COALESCE(c.saldo, 0))                        AS saldo_total_creditos,
    
    -- SANCIONES QUE DEBE (campo directo en creditos)
    SUM(COALESCE(c.sanciones_debe, 0))               AS total_sanciones_debe,
    
    -- SANCIONES DETALLADAS (desde tabla sanciones con estado='Debe')
    COALESCE(SUM(san.total_sanciones), 0)            AS total_sanciones_tabla,
    
    -- EXTRAS PREJURÍDICO QUE DEBE
    COALESCE(SUM(ext_pre.total_prejuridico), 0)      AS total_prejuridico_debe,
    
    -- EXTRAS JURÍDICO QUE DEBE
    COALESCE(SUM(ext_jur.total_juridico), 0)          AS total_juridico_debe,
    
    -- ========== GRAN TOTAL POR ESTADO ==========
    SUM(p.vlr_cuota * c.cuotas_faltantes)
        + COALESCE(SUM(san.total_sanciones), 0)
        + COALESCE(SUM(ext_pre.total_prejuridico), 0)
        + COALESCE(SUM(ext_jur.total_juridico), 0)   AS GRAN_TOTAL_ADEUDADO

FROM creditos c
INNER JOIN precreditos p ON c.precredito_id = p.id

-- Sanciones pendientes por crédito
LEFT JOIN (
    SELECT credito_id, SUM(valor) AS total_sanciones
    FROM sanciones
    WHERE estado = 'Debe'
    GROUP BY credito_id
) san ON san.credito_id = c.id

-- Extras Prejurídico pendientes por crédito
LEFT JOIN (
    SELECT credito_id, SUM(valor) AS total_prejuridico
    FROM extras
    WHERE concepto = 'Prejuridico' AND estado = 'Debe'
    GROUP BY credito_id
) ext_pre ON ext_pre.credito_id = c.id

-- Extras Jurídico pendientes por crédito
LEFT JOIN (
    SELECT credito_id, SUM(valor) AS total_juridico
    FROM extras
    WHERE concepto = 'Juridico' AND estado = 'Debe'
    GROUP BY credito_id
) ext_jur ON ext_jur.credito_id = c.id

WHERE c.estado IN ('Al dia', 'Mora', 'Prejuridico', 'Juridico')
GROUP BY c.estado
ORDER BY FIELD(c.estado, 'Al dia', 'Mora', 'Prejuridico', 'Juridico');


-- =====================================================================
-- 2. GRAN TOTAL CONSOLIDADO (una sola fila)
-- =====================================================================
SELECT 
    COUNT(DISTINCT c.id)                             AS total_creditos,
    COUNT(DISTINCT p.cliente_id)                     AS total_clientes,
    
    SUM(p.vlr_cuota * c.cuotas_faltantes)            AS deuda_por_cuotas,
    SUM(COALESCE(c.saldo, 0))                        AS saldo_creditos,
    COALESCE(SUM(san.total_sanciones), 0)            AS deuda_sanciones,
    COALESCE(SUM(ext_pre.total_prejuridico), 0)      AS deuda_prejuridico,
    COALESCE(SUM(ext_jur.total_juridico), 0)          AS deuda_juridico,
    
    -- GRAN TOTAL = cuotas + sanciones + prejurídico + jurídico
    SUM(p.vlr_cuota * c.cuotas_faltantes)
        + COALESCE(SUM(san.total_sanciones), 0)
        + COALESCE(SUM(ext_pre.total_prejuridico), 0)
        + COALESCE(SUM(ext_jur.total_juridico), 0)   AS GRAN_TOTAL_ADEUDADO

FROM creditos c
INNER JOIN precreditos p ON c.precredito_id = p.id
LEFT JOIN (
    SELECT credito_id, SUM(valor) AS total_sanciones
    FROM sanciones WHERE estado = 'Debe'
    GROUP BY credito_id
) san ON san.credito_id = c.id
LEFT JOIN (
    SELECT credito_id, SUM(valor) AS total_prejuridico
    FROM extras WHERE concepto = 'Prejuridico' AND estado = 'Debe'
    GROUP BY credito_id
) ext_pre ON ext_pre.credito_id = c.id
LEFT JOIN (
    SELECT credito_id, SUM(valor) AS total_juridico
    FROM extras WHERE concepto = 'Juridico' AND estado = 'Debe'
    GROUP BY credito_id
) ext_jur ON ext_jur.credito_id = c.id
WHERE c.estado IN ('Al dia', 'Mora', 'Prejuridico', 'Juridico');


-- =====================================================================
-- 3. DETALLE POR CRÉDITO (cada crédito con su desglose completo)
-- =====================================================================
SELECT 
    cl.num_doc                                       AS documento_cliente,
    cl.nombre                                        AS nombre_cliente,
    cl.movil                                         AS telefono,
    c.id                                             AS credito_id,
    c.estado                                         AS estado_credito,
    p.num_fact                                       AS numero_factura,
    
    -- Datos del crédito
    c.valor_credito,
    p.vlr_cuota                                      AS valor_cuota,
    c.cuotas_faltantes,
    (p.vlr_cuota * c.cuotas_faltantes)               AS deuda_cuotas,
    COALESCE(c.saldo, 0)                             AS saldo_credito,
    COALESCE(c.saldo_favor, 0)                       AS saldo_favor,
    
    -- Sanciones
    COALESCE(c.sanciones_debe, 0)                    AS sanciones_debe_campo,
    COALESCE(san.total_sanciones, 0)                 AS sanciones_debe_tabla,
    
    -- Extras
    COALESCE(ext_pre.total_prejuridico, 0)           AS prejuridico_debe,
    COALESCE(ext_jur.total_juridico, 0)              AS juridico_debe,
    
    -- TOTAL ADEUDADO POR CRÉDITO
    (p.vlr_cuota * c.cuotas_faltantes)
        + COALESCE(san.total_sanciones, 0)
        + COALESCE(ext_pre.total_prejuridico, 0)
        + COALESCE(ext_jur.total_juridico, 0)        AS TOTAL_ADEUDADO_CREDITO

FROM creditos c
INNER JOIN precreditos p ON c.precredito_id = p.id
INNER JOIN clientes cl ON p.cliente_id = cl.id
LEFT JOIN (
    SELECT credito_id, SUM(valor) AS total_sanciones
    FROM sanciones WHERE estado = 'Debe'
    GROUP BY credito_id
) san ON san.credito_id = c.id
LEFT JOIN (
    SELECT credito_id, SUM(valor) AS total_prejuridico
    FROM extras WHERE concepto = 'Prejuridico' AND estado = 'Debe'
    GROUP BY credito_id
) ext_pre ON ext_pre.credito_id = c.id
LEFT JOIN (
    SELECT credito_id, SUM(valor) AS total_juridico
    FROM extras WHERE concepto = 'Juridico' AND estado = 'Debe'
    GROUP BY credito_id
) ext_jur ON ext_jur.credito_id = c.id
WHERE c.estado IN ('Al dia', 'Mora', 'Prejuridico', 'Juridico')
ORDER BY c.estado, (p.vlr_cuota * c.cuotas_faltantes + COALESCE(san.total_sanciones, 0) + COALESCE(ext_pre.total_prejuridico, 0) + COALESCE(ext_jur.total_juridico, 0)) DESC;


SELECT 
    clientes.num_doc AS documento,
    CONCAT(clientes.primer_nombre, ' ', clientes.primer_apellido) AS nombre_cliente,
    creditos.id AS credito_id,
    creditos.estado,
    precreditos.vlr_fin AS valor_prestamo,
    precreditos.vlr_cuota,
    creditos.cuotas_faltantes,
    -- Cuotas pendientes
    (creditos.cuotas_faltantes * precreditos.vlr_cuota) AS deuda_cuotas,
    -- Sanciones
    COALESCE(sanc.total_sanciones, 0) AS deuda_sanciones,
    COALESCE(sanc.cant_sanciones, 0) AS cantidad_sanciones,
    -- Extras (Prejuridico + Juridico)
    COALESCE(ext_pago.debe_prejuridico, 0) + COALESCE(ext_sin.valor_prejuridico, 0) AS deuda_prejuridico,
    COALESCE(ext_pago.debe_juridico, 0) + COALESCE(ext_sin.valor_juridico, 0) AS deuda_juridico,
    -- TOTAL por crédito
    (creditos.cuotas_faltantes * precreditos.vlr_cuota) 
    + COALESCE(sanc.total_sanciones, 0)
    + COALESCE(ext_pago.debe_prejuridico, 0) + COALESCE(ext_sin.valor_prejuridico, 0)
    + COALESCE(ext_pago.debe_juridico, 0) + COALESCE(ext_sin.valor_juridico, 0) AS TOTAL_DEUDA_CREDITO,
    carteras.nombre AS linea_credito,
    creditos.castigada AS es_castigada,
    creator.name AS creador
FROM creditos
INNER JOIN precreditos ON precreditos.id = creditos.precredito_id
INNER JOIN clientes ON clientes.id = precreditos.cliente_id
INNER JOIN carteras ON precreditos.cartera_id = carteras.id
INNER JOIN users AS creator ON precreditos.user_create_id = creator.id
-- Sanciones pre-agregadas por crédito
LEFT JOIN (
    SELECT 
        credito_id,
        COUNT(*) AS cant_sanciones,
        SUM(valor) AS total_sanciones
    FROM sanciones 
    WHERE estado = 'Debe'
    GROUP BY credito_id
) sanc ON sanc.credito_id = creditos.id
-- Extras CON pagos: último pago.debe por concepto
LEFT JOIN (
    SELECT 
        sub.credito_id,
        SUM(CASE WHEN sub.concepto = 'Prejuridico' THEN sub.debe ELSE 0 END) AS debe_prejuridico,
        SUM(CASE WHEN sub.concepto = 'Juridico' THEN sub.debe ELSE 0 END) AS debe_juridico
    FROM (
        SELECT pg.credito_id, pg.concepto, pg.debe
        FROM pagos pg
        INNER JOIN (
            SELECT credito_id, concepto, MAX(id) AS ultimo_id
            FROM pagos
            WHERE concepto IN ('Prejuridico', 'Juridico')
            GROUP BY credito_id, concepto
        ) ult ON pg.id = ult.ultimo_id
        WHERE pg.debe > 0
    ) sub
    GROUP BY sub.credito_id
) ext_pago ON ext_pago.credito_id = creditos.id
-- Extras SIN pagos: valor completo
LEFT JOIN (
    SELECT 
        e.credito_id,
        SUM(CASE WHEN e.concepto = 'Prejuridico' THEN e.valor ELSE 0 END) AS valor_prejuridico,
        SUM(CASE WHEN e.concepto = 'Juridico' THEN e.valor ELSE 0 END) AS valor_juridico
    FROM extras e
    WHERE e.estado = 'Debe'
    AND NOT EXISTS (
        SELECT 1 FROM pagos pg 
        WHERE pg.credito_id = e.credito_id 
        AND pg.concepto = e.concepto
    )
    GROUP BY e.credito_id
) ext_sin ON ext_sin.credito_id = creditos.id
WHERE creditos.estado IN ('Al dia', 'Mora', 'Prejuridico', 'Juridico')
ORDER BY TOTAL_DEUDA_CREDITO DESC;
