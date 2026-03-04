-- ============================================================================
-- COMPARACIÓN: Créditos FACILITO vs FACILCREDITOS
-- ============================================================================
-- Esta consulta compara la tabla 'creditos' (FACILITO) con 'detalle_credito' (FACILCREDITOS)
-- Identificando registros únicos en cada base de datos

-- OPCIÓN 1: CONSULTA COMPLETA CON UNION (Recomendada - ejecutar tal cual)
-- ============================================================================
SELECT 
    'SOLO EN FACILCREDITOS' AS ubicacion,
    dc.prestamo_ID AS id_credito,
    dc.documento,
    dc.valor_prestamo,
    dc.numero_cuotas,
    dc.estado,
    dc.fecha_registro,
    NULL AS id_facilito,
    NULL AS cliente_id_facilito,
    NULL AS estado_facilito
FROM 
    FACILCREDITOS.detalle_credito dc
WHERE 
    NOT EXISTS (
        SELECT 1 FROM FACILITO.creditos c 
        WHERE c.id = dc.prestamo_ID
    )

UNION ALL

SELECT 
    'SOLO EN FACILITO' AS ubicacion,
    NULL AS id_credito,
    NULL AS documento,
    NULL AS valor_prestamo,
    NULL AS numero_cuotas,
    NULL AS estado,
    NULL AS fecha_registro,
    c.id AS id_facilito,
    c.precredito_id,
    c.estado AS estado_facilito
FROM 
    FACILITO.creditos c
WHERE 
    NOT EXISTS (
        SELECT 1 FROM FACILCREDITOS.detalle_credito dc 
        WHERE dc.prestamo_ID = c.id
    )
ORDER BY 
    ubicacion DESC, 
    id_credito DESC, 
    id_facilito DESC;


-- ============================================================================
-- OPCIÓN 2: CON ESTADÍSTICAS (Ejecutar para resumen)
-- ============================================================================
SELECT 
    'SOLO EN FACILCREDITOS' AS ubicacion,
    COUNT(*) AS total_registros,
    SUM(CAST(REPLACE(REPLACE(dc.valor_prestamo, '$', ''), ',', '') AS DECIMAL(15,2))) AS valor_total
FROM 
    FACILCREDITOS.detalle_credito dc
WHERE 
    NOT EXISTS (
        SELECT 1 FROM FACILITO.creditos c 
        WHERE c.id = dc.prestamo_ID
    )

UNION ALL

SELECT 
    'SOLO EN FACILITO' AS ubicacion,
    COUNT(*) AS total_registros,
    SUM(CAST(c.saldo AS DECIMAL(15,2))) AS valor_total
FROM 
    FACILITO.creditos c
WHERE 
    NOT EXISTS (
        SELECT 1 FROM FACILCREDITOS.detalle_credito dc 
        WHERE dc.prestamo_ID = c.id
    )

UNION ALL

SELECT 
    'EN AMBAS BASES (SINCRONIZADOS)' AS ubicacion,
    COUNT(*) AS total_registros,
    SUM(CAST(REPLACE(REPLACE(dc.valor_prestamo, '$', ''), ',', '') AS DECIMAL(15,2))) AS valor_total
FROM 
    FACILCREDITOS.detalle_credito dc
INNER JOIN 
    FACILITO.creditos c ON c.id = dc.prestamo_ID;


-- ============================================================================
-- OPCIÓN 3: COMPARACIÓN DETALLADA (Mostrar qué cambió)
-- ============================================================================
SELECT 
    dc.prestamo_ID,
    c.id AS credito_facilito_id,
    CASE 
        WHEN dc.prestamo_ID IS NULL THEN 'SOLO EN FACILITO'
        WHEN c.id IS NULL THEN 'SOLO EN FACILCREDITOS'
        ELSE 'EXISTE EN AMBAS'
    END AS estado_sincronizacion,
    dc.documento AS documento_facilcreditos,
    c.precredito_id AS precredito_facilito,
    dc.valor_prestamo AS valor_facilcreditos,
    c.saldo AS saldo_facilito,
    dc.numero_cuotas AS cuotas_facilcreditos,
    NULL AS cuotas_facilito,
    dc.estado AS estado_facilcreditos,
    c.estado AS estado_facilito,
    dc.fecha_registro AS fecha_facilcreditos,
    c.created_at AS fecha_facilito
FROM 
    FACILCREDITOS.detalle_credito dc
FULL OUTER JOIN 
    FACILITO.creditos c ON c.id = dc.prestamo_ID
WHERE 
    dc.prestamo_ID IS NULL OR c.id IS NULL
ORDER BY 
    prestamo_ID, 
    credito_facilito_id;


-- ============================================================================
-- OPCIÓN 4: REPORTE EJECUTIVO (Mejor para ver en un vistazo)
-- ============================================================================
WITH comparacion AS (
    SELECT 
        'FACILCREDITOS' AS base_datos,
        COUNT(DISTINCT prestamo_ID) AS total_creditos,
        COUNT(DISTINCT documento) AS clientes_unicos,
        MIN(fecha_registro) AS credito_mas_antiguo,
        MAX(fecha_registro) AS credito_mas_reciente
    FROM 
        FACILCREDITOS.detalle_credito
    
    UNION ALL
    
    SELECT 
        'FACILITO' AS base_datos,
        COUNT(DISTINCT id) AS total_creditos,
        COUNT(DISTINCT cliente_id) AS clientes_unicos,
        MIN(created_at) AS credito_mas_antiguo,
        MAX(created_at) AS credito_mas_reciente
    FROM 
        FACILITO.creditos
)
SELECT 
    *
FROM 
    comparacion
ORDER BY 
    base_datos;


-- ============================================================================
-- OPCIÓN 5: IDENTIFICAR DUPLICADOS EN FACILCREDITOS (Si existen prestamo_ID repetidos)
-- ============================================================================
SELECT 
    prestamo_ID,
    COUNT(*) AS repeticiones,
    GROUP_CONCAT(documento SEPARATOR ', ') AS documentos,
    GROUP_CONCAT(valor_prestamo SEPARATOR ', ') AS valores,
    GROUP_CONCAT(estado SEPARATOR ', ') AS estados
FROM 
    FACILCREDITOS.detalle_credito
GROUP BY 
    prestamo_ID
HAVING 
    COUNT(*) > 1;


-- ============================================================================
-- OPCIÓN 6: IDENTIFICAR GAPS EN IDS (Créditos faltantes en secuencia)
-- ============================================================================
SELECT 
    c.id,
    c.precredito_id,
    c.estado,
    c.created_at,
    CASE 
        WHEN dc.prestamo_ID IS NULL THEN '❌ NO EXISTE EN FACILCREDITOS'
        ELSE '✓ EXISTE'
    END AS estado_migracion
FROM 
    FACILITO.creditos c
LEFT JOIN 
    FACILCREDITOS.detalle_credito dc ON dc.prestamo_ID = c.id
WHERE 
    c.id BETWEEN (SELECT MIN(id) FROM FACILITO.creditos) 
    AND (SELECT MAX(id) FROM FACILITO.creditos)
ORDER BY 
    c.id;
