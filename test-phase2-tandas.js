const axios = require('axios');

const API = 'https://demo-api-migracion.facilcreditos.co/api';
const BATCH_SIZE = 20;

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '═'.repeat(70));
  log(title, 'bright');
  console.log('═'.repeat(70) + '\n');
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForCompletion(tandaNumber, timeoutSeconds = 180) {
  log(`\n⏳ Esperando que se complete la TANDA ${tandaNumber}...`, 'cyan');
  
  let timeElapsed = 0;
  const checkInterval = 3000;
  const timeoutMs = timeoutSeconds * 1000;
  
  while (timeElapsed < timeoutMs) {
    try {
      const metrics = await axios.get(`${API}/migration/metrics`);
      const stats = metrics.data.byPhase;
      
      const clientesPending = stats.CLIENTES.pendientes;
      const creditosPending = stats.CREDITOS.pendientes;
      const amortizacionesPending = stats.AMORTIZACIONES.pendientes;
      
      const clientesTotal = stats.CLIENTES.completados + clientesPending;
      const creditosTotal = stats.CREDITOS.completados + creditosPending;
      
      process.stdout.write(
        `\r[${Math.floor(timeElapsed/1000)}s] ` +
        `CLIENTES: ${clientesPending} pendientes | ` +
        `CREDITOS: ${creditosPending} pendientes | ` +
        `AMORT: ${amortizacionesPending} pendientes`
      );
      
      if (clientesPending === 0 && creditosPending === 0) {
        log(`\n\n✅ TANDA ${tandaNumber}: CLIENTES y CREDITOS COMPLETADOS`, 'green');
        log(`   CLIENTES: ${stats.CLIENTES.completados} completados`, 'green');
        log(`   CREDITOS: ${stats.CREDITOS.completados} completados`, 'green');
        log(`   AMORTIZACIONES: ${amortizacionesPending} pendientes (esperado)`, 'yellow');
        return true;
      }
      
      timeElapsed += checkInterval;
      await sleep(checkInterval);
      
    } catch (error) {
      log(`\n❌ Error: ${error.message}`, 'red');
      return false;
    }
  }
  
  log(`\n\n⏱️ TIMEOUT: No completó en ${timeoutSeconds}s`, 'red');
  return false;
}

async function runTanda(tandaNumber) {
  logSection(`🚀 TANDA ${tandaNumber}: ${BATCH_SIZE} USUARIOS`);
  
  try {
    log(`📤 Enqueueando ${BATCH_SIZE} clientes...`, 'yellow');
    const startRes = await axios.post(`${API}/migration/start?batchSize=${BATCH_SIZE}`);
    
    if (!startRes.data.success) {
      log(`❌ Error: ${startRes.data.message}`, 'red');
      return false;
    }
    
    log(`✅ Enqueued`, 'green');
    
    if (tandaNumber === 1) {
      log(`\n🔧 Iniciando consumidores...`, 'yellow');
      await axios.post(`${API}/migration/start-consumers`);
      log(`✅ Consumidores activos`, 'green');
    }
    
    return await waitForCompletion(tandaNumber);
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  logSection('🧪 TEST: DOS TANDAS x 20 USUARIOS (FASE 1 + 2)');
  
  try {
    const ok1 = await runTanda(1);
    if (!ok1) { log('\n❌ TANDA 1 FALLÓ', 'red'); process.exit(1); }
    
    logSection('✅ TANDA 1 DONE → TANDA 2');
    await sleep(3000);
    
    const ok2 = await runTanda(2);
    if (!ok2) { log('\n❌ TANDA 2 FALLÓ', 'red'); process.exit(1); }
    
    logSection('🎉 TEST COMPLETADO');
    
    const final = await axios.get(`${API}/migration/metrics`);
    const s = final.data.byPhase;
    
    log('📊 RESULTADO FINAL:', 'bright');
    log(`\n✅ CLIENTES: ${s.CLIENTES.completados} completados, ${s.CLIENTES.pendientes} pendientes`);
    log(`✅ CREDITOS: ${s.CREDITOS.completados} completados, ${s.CREDITOS.pendientes} pendientes`);
    log(`⏳ AMORTIZACIONES: ${s.AMORTIZACIONES.completados} completados, ${s.AMORTIZACIONES.pendientes} pendientes`, 'yellow');
    log(`❌ DLQ: ${final.data.queue.dlq}`, final.data.queue.dlq > 0 ? 'red' : 'green');
    
    log('\n✨ ¡ÉXITO!', 'bright');
    
  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();
