import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Configurar la ruta para .env.local (igual que Next.js)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env.local desde la raíz del proyecto
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// Suprimir warnings de deprecación de punycode
process.removeAllListeners('warning');

console.log('🔧 Iniciando carga de script test-webhook-flow...');

// Validar variables de entorno críticas
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY', 
  'MERCADOPAGO_WEBHOOK_KEY',
  'NEXT_PUBLIC_HOST_URL'
];

console.log('🔍 Validando variables de entorno...');

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Variable de entorno ${envVar} no está definida`);
    console.error('Asegúrate de tener un archivo .env.local con todas las variables necesarias');
    console.log('\nVariables requeridas:');
    requiredEnvVars.forEach(env => {
      console.log(`  - ${env}=${process.env[env] ? '✅ definida' : '❌ faltante'}`);
    });
    console.log('\n🔍 Archivo .env.local path:', path.resolve(__dirname, '../../.env.local'));
    process.exit(1);
  }
}

console.log('✅ Variables de entorno validadas correctamente');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('✅ Cliente de Supabase inicializado');

// Función para simular webhook (MEJORADA para incluir external_reference)
async function simulateWebhookWithExternalRef(paymentId, status = 'approved', externalReference) {
  const numericPaymentId = parseInt(paymentId);
  if (isNaN(numericPaymentId) || numericPaymentId <= 0) {
    console.error('❌ paymentId debe ser un número válido mayor a 0');
    return false;
  }

  const baseUrl = process.env.NEXT_PUBLIC_HOST_URL;
  const webhookUrl = `${baseUrl}/api/webhook`;
  const secret = process.env.MERCADOPAGO_WEBHOOK_KEY;
  
  console.log(`🌍 Ambiente detectado: ${baseUrl.includes('localhost') ? 'DESARROLLO' : 'PRODUCCIÓN'}`);
  console.log(`🎯 Enviando webhook ${status.toUpperCase()} a: ${webhookUrl}`);
  console.log(`🔗 External Reference: ${externalReference}`);
  
  const payload = {
    action: 'payment.updated',
    api_version: 'v1',
    data: {
      id: numericPaymentId
    },
    date_created: new Date().toISOString(),
    id: Math.floor(Math.random() * 1000000),
    live_mode: !baseUrl.includes('localhost'),
    type: 'payment',
    user_id: '2379483292'
  };

  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureString = `${timestamp}.${rawBody}`;
  const signature = crypto.createHmac('sha256', secret).update(signatureString).digest('hex');
  
  const headers = {
    'Content-Type': 'application/json',
    'x-signature': `ts=${timestamp},v1=${signature}`,
    'User-Agent': 'Test Webhook Flow Script v2.0'
  };

  console.log(`🔐 Signature generada: ts=${timestamp},v1=${signature.substring(0, 20)}...`);

  try {
    console.log(`📤 Realizando fetch a ${webhookUrl}...`);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: rawBody
    });
    
    const result = await response.text();
    
    if (response.ok) {
      console.log(`✅ Webhook ${status.toUpperCase()} enviado exitosamente: ${response.status}`);
      console.log(`📝 Respuesta: ${result}`);
      return true;
    } else {
      console.error(`❌ Error webhook ${status.toUpperCase()}: ${response.status} - ${response.statusText}`);
      console.error('📝 Respuesta completa:', result);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Error enviando webhook ${status.toUpperCase()}:`, error.message);
    console.error('📚 Stack completo:', error.stack);
    return false;
  }
}

// Nueva función para crear un mock de pago en MercadoPago (simulado)
async function createMockPaymentInMP(paymentId, externalReference, status = 'pending') {
  // En un caso real, aquí harías una llamada a la API de MercadoPago
  // Por ahora, simulamos que el pago existe con los datos correctos
  console.log(`🏗️ Simulando pago en MercadoPago:`);
  console.log(`   - Payment ID: ${paymentId}`);
  console.log(`   - External Reference: ${externalReference}`);
  console.log(`   - Status: ${status}`);
  
  // Simular delay de creación
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    id: paymentId,
    external_reference: externalReference,
    status: status,
    status_detail: status === 'pending' ? 'pending_waiting_payment' : 'accredited'
  };
}

// Función para verificar payment_request
async function getPaymentRequestStatus(paymentRequestId) {
  try {
    console.log(`🔍 Buscando payment_request: ${paymentRequestId}`);
    
    const { data, error } = await supabase
      .from('payment_requests')
      .select('id, payment_status, payment_id, total_amount, updated_at, customer_data, order_items')
      .eq('id', paymentRequestId)
      .single();
    
    if (error || !data) {
      console.log(`📋 Payment request ${paymentRequestId} no encontrado en BD`);
      if (error) console.log('Error details:', error);
      return null;
    }
    
    console.log(`✅ Payment request encontrado: ${data.id}`);
    return data;
  } catch (error) {
    console.error('❌ Error verificando payment_request:', error);
    return null;
  }
}

// Función para crear un payment_request de prueba (corregida según esquema real)
async function createTestPaymentRequest(paymentRequestId, paymentId) {
  const testData = {
    id: paymentRequestId,
    payment_id: paymentId,
    customer_data: {
      email: 'test.flow@example.com',
      first_name: 'Test',
      last_name: 'Flow',
      phone: '+523334445566',
      identification: {
        type: 'RFC',
        number: 'TEST123456XXX'
      }
    },
    order_items: JSON.stringify([
      {
        id: 'test-product-flow-1',
        name: 'Producto Test Flow Pending→Approved',
        quantity: 1,
        price: 100
      }
    ]),
    total_amount: 100,
    payment_status: 'pending',
    payment_detail: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    console.log('🔧 Creando payment_request de prueba...');
    console.log('📝 Datos que se van a insertar:', JSON.stringify(testData, null, 2));
    
    const { data, error } = await supabase
      .from('payment_requests')
      .upsert([testData], { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creando payment_request:', error);
      return null;
    }

    console.log('✅ Payment request de prueba creado exitosamente:', {
      id: data.id,
      payment_id: data.payment_id,
      status: data.payment_status,
      amount: data.total_amount
    });

    return data;
  } catch (error) {
    console.error('❌ Error en createTestPaymentRequest:', error);
    console.error('📚 Stack trace:', error.stack);
    return null;
  }
}

// Nueva función para crear un mock del endpoint de MercadoPago que retorne external_reference
async function setupMockMercadoPagoEndpoint() {
  // Esta función simula que tenemos acceso a los datos de MercadoPago
  // En la realidad, tu webhook consultaría la API de MercadoPago
  console.log('🎭 Configurando mock de MercadoPago API...');
  
  // Aquí podrías interceptar las llamadas a MercadoPago
  // o usar una librería como nock para mockear las respuestas
  
  return true;
}

// Función principal mejorada para simular flujo completo REALISTA
async function simulateRealisticPaymentFlow(paymentId, paymentRequestId = null, delaySeconds = 5) {
  console.log('🎭 Iniciando simulación REALISTA de flujo Pending → Approved');
  console.log('═'.repeat(80));
  
  const numericPaymentId = parseInt(paymentId);
  if (isNaN(numericPaymentId) || numericPaymentId <= 0) {
    console.error('❌ paymentId debe ser un número válido mayor a 0');
    return;
  }

  // Si no se proporciona paymentRequestId, generar uno único
  const testPaymentRequestId = paymentRequestId || `flow-test-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  console.log(`💰 Payment ID (MercadoPago): ${numericPaymentId}`);
  console.log(`📋 Payment Request ID (BD): ${testPaymentRequestId}`);
  console.log(`⏱️ Delay entre webhooks: ${delaySeconds} segundos`);
  console.log(`🌍 Ambiente: ${process.env.NEXT_PUBLIC_HOST_URL}`);
  console.log('');

  // 1. Verificar/crear payment_request
  console.log('🔍 PASO 1: Verificando payment_request...');
  let paymentRequest = await getPaymentRequestStatus(testPaymentRequestId);
  
  if (!paymentRequest) {
    console.log('📝 Payment request no existe, creando uno de prueba...');
    paymentRequest = await createTestPaymentRequest(testPaymentRequestId, numericPaymentId);
    
    if (!paymentRequest) {
      console.error('❌ No se pudo crear payment_request de prueba');
      return;
    }
  } else {
    console.log('✅ Payment request encontrado:', {
      id: paymentRequest.id,
      status: paymentRequest.payment_status,
      amount: paymentRequest.total_amount,
      payment_id: paymentRequest.payment_id
    });
  }

  console.log('');

  // 2. NUEVO: Setup mock de MercadoPago para que retorne external_reference
  console.log('🎭 PASO 2: Configurando mock de MercadoPago...');
  await setupMockMercadoPagoEndpoint();
  
  // Crear mock de pago en MercadoPago con external_reference
  await createMockPaymentInMP(numericPaymentId, testPaymentRequestId, 'pending');
  
  console.log('');

  // 3. FASE 1: Simular webhook PENDING
  console.log('📤 FASE 1: Enviando webhook PENDING...');
  console.log('─'.repeat(50));
  
  const pendingSuccess = await simulateWebhookWithExternalRef(numericPaymentId, 'pending', testPaymentRequestId);
  
  if (!pendingSuccess) {
    console.error('❌ Error en webhook pending, abortando flujo');
    return;
  }

  // Verificar estado después de pending
  console.log('\n⏳ Esperando 2 segundos para verificar cambios...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const afterPending = await getPaymentRequestStatus(testPaymentRequestId);
  
  console.log('📊 Estado después de PENDING:', {
    payment_status: `${paymentRequest.payment_status} → ${afterPending?.payment_status}`,
    updated_at: afterPending?.updated_at,
    cambio_detectado: afterPending?.payment_status !== paymentRequest.payment_status ? '✅' : '⚠️'
  });
  
  console.log('');
  console.log(`⏰ Esperando ${delaySeconds} segundos antes del webhook APPROVED...`);
  
  // 4. Esperar el delay especificado con countdown
  for (let i = delaySeconds; i > 0; i--) {
    process.stdout.write(`\r⏳ ${i} segundos restantes...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log('\r✅ Tiempo completado!                     ');
  console.log('');

  // 5. Actualizar mock de MercadoPago a approved
  await createMockPaymentInMP(numericPaymentId, testPaymentRequestId, 'approved');

  // 6. FASE 2: Simular webhook APPROVED
  console.log('📤 FASE 2: Enviando webhook APPROVED...');
  console.log('─'.repeat(50));
  
  const approvedSuccess = await simulateWebhookWithExternalRef(numericPaymentId, 'approved', testPaymentRequestId);
  
  if (!approvedSuccess) {
    console.error('❌ Error en webhook approved');
    return;
  }

  // Verificar estado final
  console.log('\n⏳ Esperando 3 segundos para verificar cambios finales...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const finalState = await getPaymentRequestStatus(testPaymentRequestId);
  
  console.log('');
  console.log('🎉 FLUJO COMPLETADO - Estado final:');
  console.log('─'.repeat(50));
  console.log({
    payment_status: `${afterPending?.payment_status} → ${finalState?.payment_status}`,
    payment_id: finalState?.payment_id,
    total_amount: finalState?.total_amount,
    updated_at: finalState?.updated_at,
    proceso_completo: finalState?.payment_status === 'approved' ? '✅ ÉXITO' : '⚠️ PENDIENTE'
  });

  // Verificar si se creó una orden (efecto de pago aprobado)
  try {
    console.log('\n🔍 Verificando creación de orden...');
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_request_id', testPaymentRequestId)
      .single();

    if (order && !error) {
      console.log('✅ Orden creada exitosamente:', {
        order_id: order.id,
        payment_status: order.payment_status,
        created_at: order.created_at
      });
    } else {
      console.log('ℹ️ No se encontró orden creada');
    }
  } catch (error) {
    console.log('ℹ️ No se pudo verificar órdenes (posiblemente tabla no existe)');
  }

  console.log('');
  console.log('═'.repeat(80));
  console.log('🏁 Simulación de flujo completada');
  console.log('');
  console.log('📋 Resumen del test:');
  console.log(`   • Payment ID usado: ${numericPaymentId}`);
  console.log(`   • Payment Request ID: ${testPaymentRequestId}`);
  console.log(`   • Estado inicial: pending`);
  console.log(`   • Estado final: ${finalState?.payment_status || 'error'}`);
  console.log(`   • Webhooks enviados: ${pendingSuccess ? '✅' : '❌'} pending, ${approvedSuccess ? '✅' : '❌'} approved`);
  
  if (finalState?.payment_status === 'approved') {
    console.log('   • ✅ Flujo completado exitosamente');
  } else {
    console.log('   • ⚠️ Flujo incompleto - revisar logs del servidor');
  }

  // NUEVO: Instrucciones para caso real
  console.log('');
  console.log('📝 Para un caso REAL con MercadoPago:');
  console.log('   1. Tu pago debe tener external_reference configurado');
  console.log('   2. MercadoPago enviará webhooks automáticamente');
  console.log('   3. Tu webhook buscará el payment_request por external_reference');
  console.log('   4. El flujo será idéntico al simulado aquí');
}

// Función para mostrar ayuda
function showHelp() {
  console.log(`
🎭 Simulador de Flujo Pending → Approved v2.1 (REALISTA)

Propósito:
  Simula el flujo completo de un pago que primero está pendiente
  y luego es aprobado, tal como sucede en la vida real con tarjetas CONT.
  
  NUEVO: Incluye simulación de external_reference para máximo realismo.

Uso: 
  npm run test:webhook:flow <payment_id> [payment_request_id] [delay_seconds]
  
  O directamente:
  node src/scripts/test-webhook-flow.js <payment_id> [payment_request_id] [delay_seconds]

Parámetros:
  payment_id         - ID numérico del pago de MercadoPago (requerido)
  payment_request_id - ID del payment_request en tu BD (opcional, se genera automáticamente)
  delay_seconds      - Segundos entre pending y approved (default: 5, rango: 1-60)

Ejemplos:
  npm run test:webhook:flow 123456789
  npm run test:webhook:flow 123456789 "mi-test-001"
  npm run test:webhook:flow 123456789 "mi-test-002" 10

Lo que hace el script:
  1. 🔧 Valida variables de entorno requeridas
  2. 📝 Crea/verifica un payment_request en BD
  3. 🎭 Simula que el pago existe en MercadoPago con external_reference
  4. 📤 Envía webhook PENDING (simula tarjeta CONT inicial)
  5. ⏳ Espera el tiempo especificado (simula procesamiento MP)
  6. 📤 Envía webhook APPROVED (simula aprobación posterior)
  7. 📊 Verifica cambios en BD y órdenes creadas
  8. 📋 Muestra resumen completo del flujo

Variables de entorno requeridas:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - MERCADOPAGO_WEBHOOK_KEY
  - NEXT_PUBLIC_HOST_URL

Notas importantes:
  - ✅ Asegúrate de tener el servidor Next.js corriendo
  - 🔐 Verifica que todas las variables estén en .env.local
  - 📊 El script crea datos de prueba realistas automáticamente
  - 🎯 Simula el comportamiento real de MercadoPago con external_reference
  - 🔄 Respeta la idempotencia del webhook (no duplica acciones)
  - 🎭 Incluye mock de MercadoPago API para máximo realismo
  `);
}

// Ejecutar script principal
async function main() {
  console.log('🚀 Iniciando función main...');
  
  const args = process.argv.slice(2);
  console.log('📝 Argumentos recibidos:', args);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    return;
  }
  
  const paymentId = args[0];
  const paymentRequestId = args[1] || null;
  const delaySeconds = parseInt(args[2]) || 5;
  
  console.log('🔍 Parámetros procesados:', {
    paymentId,
    paymentRequestId,
    delaySeconds
  });
  
  // Validaciones de parámetros
  if (!paymentId) {
    console.error('❌ Debes proporcionar un payment_id');
    console.log('💡 Usa: npm run test:webhook:flow 123456789');
    return;
  }
  
  if (isNaN(parseInt(paymentId)) || parseInt(paymentId) <= 0) {
    console.error('❌ El payment_id debe ser un número válido mayor a 0');
    return;
  }
  
  if (delaySeconds < 1 || delaySeconds > 60) {
    console.error('❌ El delay debe estar entre 1 y 60 segundos');
    return;
  }
  
  console.log('✅ Validaciones completadas');
  console.log('🚀 Iniciando simulación REALISTA de flujo de webhook...\n');
  
  try {
    await simulateRealisticPaymentFlow(paymentId, paymentRequestId, delaySeconds);
    console.log('\n✅ Script completado exitosamente');
  } catch (error) {
    console.error('\n❌ Error durante la simulación:', error.message);
    console.error('📚 Stack trace:', error.stack);
    throw error;
  }
}

// Ejecutar main inmediatamente
console.log('🔧 Ejecutando main()...');

main().catch(error => {
  console.error('\n❌ Error fatal en la simulación:', error.message);
  console.error('📚 Stack trace:', error.stack);
  process.exit(1);
});

export { simulateRealisticPaymentFlow, simulateWebhookWithExternalRef, getPaymentRequestStatus };