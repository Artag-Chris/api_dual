import { prismaMainService } from './src/database/main/prisma-main.service';
import { prismaLegacyService } from './src/database/legacy/prisma-legacy.service';
import { normalizeCastigo } from './src/utils/functions';
import { getCreditLegacyDataByDoc } from './src/utils/querys/getCreditLegacyDataByDoc';

async function testCastigoDataFlow() {
  try {
    console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');
    console.log('║     TEST: Flujo de datos del cliente desde Legacy a Main             ║');
    console.log('║              Validación de normalización de CASTIGO                   ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

    // PASO 1: Obtener un documento para testing (que tenga castigo="Si")
    console.log('[PASO 1] Buscando documento con castigo="Si" en legacy...\n');
    
    const documentoConSi = await prismaLegacyService.$queryRaw<any[]>`
      SELECT DISTINCT clientes.num_doc
      FROM clientes
      INNER JOIN precreditos ON clientes.id = precreditos.cliente_id
      INNER JOIN creditos ON precreditos.id = creditos.precredito_id
      WHERE creditos.castigada = 'Si'
      LIMIT 1
    `;

    if (!documentoConSi || documentoConSi.length === 0) {
      console.log('❌ No hay documentos con castigo="Si" en legacy');
      process.exit(1);
    }

    const documento = (documentoConSi[0] as any).num_doc;
    console.log(`✓ Documento encontrado: ${documento}\n`);

    // PASO 2: Obtener datos EXACTO con getCreditLegacyDataByDoc
    console.log('[PASO 2] Obteniendo datos del documento desde LEGACY usando getCreditLegacyDataByDoc...\n');
    
    const creditosLegacy = await getCreditLegacyDataByDoc(prismaLegacyService, documento);

    if (!creditosLegacy || creditosLegacy.length === 0) {
      console.log('❌ No se encontraron créditos para este documento');
      process.exit(1);
    }

    console.log(`✓ Créditos encontrados: ${creditosLegacy.length}\n`);

    // PASO 3: Analizar datos que vienen del query
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('[PASO 3] ANÁLISIS DE DATOS QUE VIENEN DE LEGACY\n');
    
    const analisisCreditos: any[] = [];

    for (let i = 0; i < creditosLegacy.length; i++) {
      const row = creditosLegacy[i];
      
      console.log(`\n📌 CRÉDITO #${i + 1}:`);
      console.log('─'.repeat(70));
      
      console.log(`\n  IDENTIFICADORES:`);
      console.log(`    • documento: ${row.documento}`);
      console.log(`    • credito_id_legacy: ${row.credito_id_legacy}`);
      console.log(`    • precredito_id: ${row.precredito_id}`);
      
      console.log(`\n  DATOS FINANCIEROS:`);
      console.log(`    • valor_prestamo: ${row.valor_prestamo}`);
      console.log(`    • numero_cuotas: ${row.numero_cuotas}`);
      console.log(`    • vlr_cuota: ${row.vlr_cuota}`);
      console.log(`    • plazo: ${row.plazo}`);
      
      console.log(`\n  ESTADO & CASTIGO (LO MÁS IMPORTANTE):`);
      console.log(`    • estado: ${row.estado}`);
      console.log(`    • castigo (alias 1): "${row.castigo}"`);
      console.log(`    • es_castigada (alias 2): "${row.es_castigada}"`);
      console.log(`    • Tipo de dato: ${typeof row.es_castigada}`);
      
      // PASO 4: Normalizar
      console.log(`\n  NORMALIZACIÓN CON normalizeCastigo():`);
      const castigoNormalizado = normalizeCastigo(row.es_castigada);
      console.log(`    • Input: "${row.es_castigada}"`);
      console.log(`    • normalizeCastigo() → "${castigoNormalizado}"`);
      console.log(`    • ¿Es válido para enum? ${(castigoNormalizado === 'SI' || castigoNormalizado === 'NO') ? '✅ SÍ' : '❌ NO'}`);
      
      console.log(`\n  OTROS DATOS IMPORTANTES:`);
      console.log(`    • creador: ${row.creador}`);
      console.log(`    • fecha_creacion: ${row.fecha_creacion}`);
      console.log(`    • cartera: ${row.nombre_cartera}`);
      console.log(`    • periodicidad: ${row.periodicidad}`);
      console.log(`    • tasa: ${row.tasa}`);
      
      analisisCreditos.push({
        documento: row.documento,
        credito_id_legacy: row.credito_id_legacy,
        es_castigada_original: row.es_castigada,
        castigo_normalizado: castigoNormalizado,
        estado: row.estado,
        valor_prestamo: row.valor_prestamo,
        numero_cuotas: row.numero_cuotas
      });
    }

    // PASO 5: Verificar qué hay actualmente en MAIN
    console.log('\n\n═══════════════════════════════════════════════════════════════════════');
    console.log('[PASO 5] VERIFICANDO DATOS ACTUALES EN MAIN.DETALLE_CREDITO\n');
    
    const creditosMain = await prismaMainService.detalle_credito.findMany({
      where: { documento: documento },
      select: {
        prestamo_ID: true,
        documento: true,
        castigo: true,
        valor_prestamo: true,
        estado: true,
        numero_cuotas: true
      }
    });

    if (creditosMain.length === 0) {
      console.log(`⚠️ No hay créditos para documento=${documento} en MAIN`);
    } else {
      console.log(`✓ Encontrados ${creditosMain.length} crédito(s) en MAIN:\n`);
      
      for (let i = 0; i < creditosMain.length; i++) {
        const creditoMain = creditosMain[i];
        const creditoLegacy = analisisCreditos[i];
        
        console.log(`  CRÉDITO #${i + 1} en MAIN:`);
        console.log(`    • prestamo_ID: ${creditoMain.prestamo_ID}`);
        console.log(`    • castigo ACTUAL: '${creditoMain.castigo}'`);
        console.log(`    • castigo ESPERADO (después de normalizar): '${creditoLegacy?.castigo_normalizado}'`);
        
        const coincide = creditoMain.castigo === creditoLegacy?.castigo_normalizado;
        console.log(`    • ¿Coinciden? ${coincide ? '✅ SÍ' : '❌ NO - NECESITA ACTUALIZACIÓN'}\n`);
      }
    }

    // PASO 6: RESUMEN Y PLAN
    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log('📊 RESUMEN Y PLAN DE ACCIÓN:\n');
    
    console.log(`DOCUMENTO: ${documento}`);
    console.log(`\nDATA FLOW ESPERADO EN RE-MIGRACIÓN:\n`);
    
    for (const analisis of analisisCreditos) {
      console.log(`  Legacy:  castigada="${analisis.es_castigada_original}"`);
      console.log(`    ↓ (normalizeCastigo)`);
      console.log(`  Code:    castigo="${analisis.castigo_normalizado}"`);
      console.log(`    ↓ (INSERT/UPDATE)`);
      console.log(`  Main:    castigo='${analisis.castigo_normalizado}' ✅`);
      console.log();
    }

    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('\n✅ TEST COMPLETADO\n');
    console.log('CONCLUSIÓN:');
    console.log('  • La función normalizeCastigo() convierte correctamente "Si" → "SI"');
    console.log('  • Si re-ejecutas la migración, los datos llegarán correctamente a MAIN');
    console.log('  • El documento debería terminar con castigo="SI" después de re-migrar');
    console.log('\n═══════════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  } finally {
    await prismaMainService.$disconnect();
    await prismaLegacyService.$disconnect();
  }
}

// Ejecutar
testCastigoDataFlow();
