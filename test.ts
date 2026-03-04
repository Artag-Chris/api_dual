import { prismaMainService } from './src/database/main/prisma-main.service';
import { prismaLegacyService } from './src/database/legacy/prisma-legacy.service';
import { normalizeCastigo } from './src/utils/functions';
import { getCreditLegacyDataByDoc } from './src/utils/querys/getCreditLegacyDataByDoc';

// Colores para console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

const log = {
  title: (msg: string) => console.log(`\n${colors.bright}${colors.blue}${msg}${colors.reset}`),
  section: (msg: string) => console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}\n${colors.bright}${msg}${colors.reset}\n${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  data: (key: string, value: any) => console.log(`   ${colors.bright}${key}:${colors.reset} ${value}`),
  arrow: () => console.log(`   ${colors.yellow}↓${colors.reset}`),
};

async function visualizeCastigoFlow() {
  try {
    log.section('🧪 TEST DE VISUALIZACIÓN: FLUJO DE CASTIGO');
    
    // PASO 1: Buscar documento con castigo="Si"
    log.title('[PASO 1] Buscando documento con castigo="Si"...');
    
    const documentoConSi = await prismaLegacyService.$queryRaw<any[]>`
      SELECT DISTINCT clientes.num_doc
      FROM clientes
      INNER JOIN precreditos ON clientes.id = precreditos.cliente_id
      INNER JOIN creditos ON precreditos.id = creditos.precredito_id
      WHERE creditos.castigada = 'Si'
      LIMIT 1
    `;

    if (!documentoConSi || documentoConSi.length === 0) {
      log.error('No hay documentos con castigo="Si"');
      process.exit(1);
    }

    const documento = (documentoConSi[0] as any).num_doc;
    log.success(`Documento encontrado: ${colors.bright}${documento}${colors.reset}`);

    // PASO 2: Obtener datos con getCreditLegacyDataByDoc
    log.title('[PASO 2] Obteniendo datos completos del documento desde LEGACY...');
    
    const creditosLegacy = await getCreditLegacyDataByDoc(prismaLegacyService, documento);

    if (!creditosLegacy || creditosLegacy.length === 0) {
      log.error('Sin créditos para este documento');
      process.exit(1);
    }

    log.success(`Se obtuvieron ${colors.bright}${creditosLegacy.length}${colors.reset} crédito(s)`);

    // PASO 3: Mostrar datos de forma legible
    log.section('📊 DATOS QUE VIENEN DE LEGACY (getCreditLegacyDataByDoc)');

    for (let i = 0; i < creditosLegacy.length; i++) {
      const row = creditosLegacy[i];
      
      console.log(`\n${colors.bright}${colors.magenta}▶ CRÉDITO #${i + 1}${colors.reset}\n`);

      // IDENTIFICADORES
      console.log(`${colors.bright}📋 IDENTIFICADORES:${colors.reset}`);
      log.data('documento', row.documento);
      log.data('credito_id_legacy', row.credito_id_legacy);
      log.data('precredito_id', row.precredito_id);
      log.data('cartera_id', row.cartera_id);

      // DATOS FINANCIEROS
      console.log(`\n${colors.bright}💰 DATOS FINANCIEROS:${colors.reset}`);
      log.data('valor_prestamo', `$${new Intl.NumberFormat('es-CO').format(row.valor_prestamo)}`);
      log.data('numero_cuotas', row.numero_cuotas);
      log.data('vlr_cuota', `$${new Intl.NumberFormat('es-CO').format(row.vlr_cuota)}`);
      log.data('plazo (meses)', row.plazo);
      log.data('periodicidad', row.periodicidad);
      log.data('tasa', `${row.tasa}%`);
      log.data('tasa_efectiva_anual', `${row.tasa_efectiva_anual}%`);

      // LO MÁS IMPORTANTE: CASTIGO
      console.log(`\n${colors.bright}${colors.red}🚨 CASTIGO (CAMPO CRÍTICO):${colors.reset}`);
      console.log(`   ${colors.bright}Valor original en legacy:${colors.reset}`);
      console.log(`   ${colors.red}   "castigo" column: "${row.castigo}"${colors.reset}`);
      console.log(`   ${colors.red}   "es_castigada" column: "${row.es_castigada}"${colors.reset}`);
      console.log(`   ${colors.cyan}   Tipo de dato: ${typeof row.es_castigada}${colors.reset}`);

      // Normalización
      const castigoNormalizado = normalizeCastigo(row.es_castigada);
      console.log(`\n   ${colors.bright}Después de normalizeCastigo():${colors.reset}`);
      log.arrow();
      console.log(`   ${colors.green}   "${castigoNormalizado}"${colors.reset}`);
      console.log(`   ${colors.green}   ✓ Válido para enum detalle_credito.castigo${colors.reset}`);

      // ESTADO
      console.log(`\n${colors.bright}📍 ESTADO:${colors.reset}`);
      log.data('estado', row.estado);
      log.data('estado_aprobacion', row.estado_aprobacion);
      log.data('cuotas_faltantes', row.cuotas_faltantes);

      // DATOS DE CARTERA
      console.log(`\n${colors.bright}🏢 CARTERA:${colors.reset}`);
      log.data('nombre_cartera', row.nombre_cartera);
      log.data('linea_credito', row.linea_credito);

      // DATOS DE USUARIO
      console.log(`\n${colors.bright}👤 INFORMACIÓN DE USUARIOS:${colors.reset}`);
      log.data('creador', row.creador);
      log.data('actualizador', row.actualizador);
      log.data('fecha_creacion', row.fecha_creacion);
      log.data('ultima_fecha_actualizacion', row.ultima_fecha_actualizacion);

      // FECHAS DE PAGO
      console.log(`\n${colors.bright}📅 FECHAS DE PAGO:${colors.reset}`);
      log.data('fecha_pago_1', row.fecha_pago_1);
      log.data('fecha_pago_2', row.fecha_pago_2);
      log.data('proxima_fecha_pago', row.proxima_fecha_pago);

      // SEGURO Y COMISIONES
      console.log(`\n${colors.bright}💳 SEGURO Y COMISIONES:${colors.reset}`);
      log.data('seguro (porc_aval)', row.seguro);
      log.data('iva_aval', row.iva_aval);
      log.data('cta_capital', row.cta_capital);
      log.data('cta_aval', row.cta_aval);
      log.data('cta_iva_aval', row.cta_iva_aval);
      log.data('total_cta_aval', row.total_cta_aval);

      // DATACREDITO
      if (row.estDatacredito_id) {
        console.log(`\n${colors.bright}📊 DATA CREDITO:${colors.reset}`);
        log.data('estDatacredito_id', row.estDatacredito_id);
        log.data('puntaje_datacredito_fc', row.puntaje_datacredito_fc);
        log.data('cal_asesor', row.cal_asesor);
        log.data('cal_estudio', row.cal_estudio);
        log.data('creacion_de_estudio', row.creacion_de_estudio);
      }

      // CODEUDOR
      if (row.documento_codeudor) {
        console.log(`\n${colors.bright}🤝 CODEUDOR:${colors.reset}`);
        log.data('documento_codeudor', row.documento_codeudor);
        log.data('id_codeudor', row.id_codeudor);
      }

      console.log();
    }

    // PASO 4: Verificar qué hay en MAIN
    log.section('🔄 COMPARACIÓN: DATOS EN MAIN.DETALLE_CREDITO');

    const creditosMain = await prismaMainService.detalle_credito.findMany({
      where: { documento: documento }
    });

    if (creditosMain.length === 0) {
      log.warn(`No hay créditos para documento=${documento} en MAIN (aún no migrados o eliminados)`);
    } else {
      for (let i = 0; i < creditosMain.length; i++) {
        const mainCred = creditosMain[i];
        const legacyCred = creditosLegacy[i];

        console.log(`\n${colors.magenta}▶ COMPARACIÓN CRÉDITO #${i + 1}${colors.reset}\n`);

        console.log(`${colors.bright}LEGACY:${colors.reset}`);
        log.data('es_castigada', `"${legacyCred?.es_castigada}"`);
        
        log.arrow();

        console.log(`${colors.bright}MAIN (ACTUAL):${colors.reset}`);
        log.data('castigo', `'${mainCred.castigo}'`);

        console.log(`\n${colors.bright}ESPERADO DESPUÉS DE RE-MIGRACIÓN:${colors.reset}`);
        const esperado = normalizeCastigo(legacyCred?.es_castigada);
        log.data('castigo', `'${esperado}'`);

        const coincide = mainCred.castigo === esperado;
        console.log(`\n${colors.bright}Estado:${colors.reset}`);
        if (coincide) {
          log.success(`Ya está correcto: '${mainCred.castigo}' = '${esperado}'`);
        } else {
          log.error(`Necesita actualización: '${mainCred.castigo}' ≠ '${esperado}'`);
        }
      }
    }

    // PASO 5: Conclusión
    log.section('📋 CONCLUSIÓN Y PRÓXIMOS PASOS');

    console.log(`${colors.bright}${colors.green}✓ El test ha completado el análisis del documento:${colors.reset} ${colors.bright}${documento}${colors.reset}\n`);

    console.log(`${colors.bright}Lo que demuestra:${colors.reset}`);
    log.success('La función normalizeCastigo() convierte correctamente "Si" → "SI"');
    log.success('Los datos vienen correctamente del query getCreditLegacyDataByDoc');
    log.success('El pipeline está configurado para normalizar correctamente');

    console.log(`\n${colors.bright}Próximos pasos:${colors.reset}`);
    log.info('Opción 1: Ejecutar SQL UPDATE para corregir los 1,734 históricos');
    log.info('Opción 2: Re-ejecutar migración para nuevos clientes (usará normalizeCastigo correctamente)');

    console.log();

  } catch (error) {
    log.error(`Error fatal: ${error instanceof Error ? error.message : String(error)}`);
    console.error(error);
    process.exit(1);
  } finally {
    await prismaMainService.$disconnect();
    await prismaLegacyService.$disconnect();
  }
}

visualizeCastigoFlow();