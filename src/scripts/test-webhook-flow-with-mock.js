import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { 
  setupMercadoPagoMock, 
  teardownMercadoPagoMock, 
  addMockPayment, 
  updateMockPayment,
  clearMockPayments,
  setupServiceMocks,
  teardownServiceMocks,
  getMockResults
} from '../lib/test-interceptors.js';

// Configurar la ruta para .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// Suprimir warnings
process.removeAllListeners('warning');

console.log('🔧 Iniciando test COMPLETO con flujo de negocio...');

// Validar variables de entorno
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY', 
  'MERCADOPAGO_WEBHOOK_KEY',
  'NEXT_PUBLIC_HOST_URL'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Variable de entorno ${envVar} no está definida`);
    process.exit(1);
  }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Función principal del test COMPLETO con flujo de negocio
async function runCompleteBusinessFlowTest(paymentId, paymentRequestId = null, delaySeconds = 5) {
  const numericPaymentId = parseInt(paymentId);
  const testPaymentRequestId = paymentRequestId || `flow-test-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  console.log('🎭 INICIANDO TEST COMPLETO DE FLUJO DE NEGOCIO');
  console.log('📝 Este test valida: webhook response + creación de orden + envío de correo + Google Sheets');
  console.log('═'.repeat(80));
  console.log(`💰 Payment ID: ${numericPaymentId}`);
  console.log(`📋 Payment Request ID: ${testPaymentRequestId}`);
  console.log(`🌍 Ambiente: ${process.env.NEXT_PUBLIC_HOST_URL}`);
  console.log('');

  let testResults = {
    webhookResponse: false,
    paymentRequestUpdated: false,
    orderCreated: false,
    emailSent: false,
    sheetsUpdated: false
  };

  try {
    // 1. Setup de todos los mocks
    console.log('🎭 PASO 1: Configurando mocks completos...');
    setupMercadoPagoMock();
    setupServiceMocks();
    
    // 2. Crear payment_request en BD
    console.log('📝 PASO 2: Creando payment_request inicial...');
    const paymentRequest = await createTestPaymentRequest(testPaymentRequestId, numericPaymentId);
    
    if (!paymentRequest) {
      throw new Error('No se pudo crear payment_request');
    }
    
    // 3. Agregar mock payment en estado PENDING
    console.log('🎭 PASO 3: Agregando mock payment PENDING...');
    addMockPayment(numericPaymentId, {
      status: 'pending',
      status_detail: 'pending_waiting_payment',
      external_reference: testPaymentRequestId,
      amount: 100
    });
    
    // 4. Enviar webhook PENDING
    console.log('📤 PASO 4: Enviando webhook PENDING...');
    const pendingSuccess = await sendWebhook(numericPaymentId, 'pending');
    
    if (!pendingSuccess) {
      console.log('⚠️ Webhook pending falló, pero continuando...');
    }
    
    // 5. Verificar cambios después de PENDING
    await new Promise(resolve => setTimeout(resolve, 2000));
    const afterPending = await getPaymentRequestStatus(testPaymentRequestId);
    
    console.log('📊 Estado después de PENDING:', {
      payment_status: afterPending?.payment_status,
      updated_at: afterPending?.updated_at
    });
    
    // 6. Esperar delay
    console.log(`⏰ Esperando ${delaySeconds} segundos...`);
    for (let i = delaySeconds; i > 0; i--) {
      process.stdout.write(`\r⏳ ${i} segundos restantes...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('\r✅ Tiempo completado!                     ');
    
    // 7. Actualizar mock payment a APPROVED
    console.log('🎭 PASO 7: Actualizando mock payment a APPROVED...');
    updateMockPayment(numericPaymentId, {
      status: 'approved',
      status_detail: 'accredited'
    });
    
    // 8. Enviar webhook APPROVED - AQUÍ DEBERÍA PASAR TODO EL FLUJO
    console.log('📤 PASO 8: Enviando webhook APPROVED (flujo completo)...');
    const approvedSuccess = await sendWebhook(numericPaymentId, 'approved');
    testResults.webhookResponse = approvedSuccess;
    
    if (!approvedSuccess) {
      console.log('⚠️ Webhook approved falló');
    }
    
    // 9. Verificar TODOS los efectos del webhook approved
    console.log('🔍 PASO 9: Verificando efectos completos del webhook...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 9a. Verificar actualización de payment_request
    const finalPaymentRequest = await getPaymentRequestStatus(testPaymentRequestId);
    testResults.paymentRequestUpdated = finalPaymentRequest?.payment_status === 'approved';
    
    console.log('📊 Payment Request actualizado:', {
      status: `${paymentRequest.payment_status} → ${finalPaymentRequest?.payment_status}`,
      actualizado: testResults.paymentRequestUpdated ? '✅' : '❌'
    });
    
    // 9b. Verificar creación de orden
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_request_id', testPaymentRequestId)
      .single();
    
    testResults.orderCreated = !!order && !orderError;
    
    if (testResults.orderCreated) {
      console.log('✅ ORDEN CREADA:', {
        order_id: order.id,
        payment_status: order.payment_status,
        total_amount: order.total_amount,
        created_at: order.created_at
      });
    } else {
      console.log('❌ ORDEN NO CREADA');
      if (orderError) {
        console.log('Error al buscar orden:', orderError);
      }
    }
    
    // 9c. Verificar mocks de servicios externos
    const mockResults = getMockResults();
    testResults.emailSent = mockResults.emailsSent.length > 0;
    testResults.sheetsUpdated = mockResults.sheetsUpdated.length > 0;
    
    console.log('📧 Servicios externos:', {
      correos_enviados: mockResults.emailsSent.length,
      sheets_actualizados: mockResults.sheetsUpdated.length
    });
    
    // 10. Resumen completo del test
    console.log('');
    console.log('🎉 RESULTADO FINAL DEL FLUJO COMPLETO:');
    console.log('═'.repeat(80));
    
    const overallSuccess = Object.values(testResults).every(result => result === true);
    
    console.log('📋 RESUMEN DE VALIDACIONES:');
    console.log(`   • Webhook Response: ${testResults.webhookResponse ? '✅ OK' : '❌ FALLÓ'}`);
    console.log(`   • Payment Request Actualizado: ${testResults.paymentRequestUpdated ? '✅ OK' : '❌ FALLÓ'}`);
    console.log(`   • Orden Creada: ${testResults.orderCreated ? '✅ OK' : '❌ FALLÓ'}`);
    console.log(`   • Email Enviado: ${testResults.emailSent ? '✅ OK' : '❌ NO IMPLEMENTADO'}`);
    console.log(`   • Google Sheets: ${testResults.sheetsUpdated ? '✅ OK' : '❌ NO IMPLEMENTADO'}`);
    console.log('');
    console.log(`🎯 TEST GENERAL: ${overallSuccess ? '✅ ÉXITO COMPLETO' : '⚠️ REVISAR FALLOS'}`);
    
    if (overallSuccess) {
      console.log('');
      console.log('🎉 ¡FLUJO DE NEGOCIO COMPLETAMENTE FUNCIONAL!');
      console.log('📝 Tu webhook procesa correctamente:');
      console.log('   - Respuesta HTTP correcta');
      console.log('   - Actualización de payment_request');
      console.log('   - Creación de orden');
      console.log('   - Envío de correos (si implementado)');
      console.log('   - Actualización de Google Sheets (si implementado)');
      console.log('🚀 En producción real funcionará idénticamente');
    } else {
      console.log('');
      console.log('⚠️ ALGUNOS COMPONENTES DEL FLUJO NECESITAN REVISIÓN');
      console.log('💡 Revisa los logs del servidor para más detalles');
    }
    
    return testResults;
    
  } finally {
    // Cleanup
    teardownMercadoPagoMock();
    teardownServiceMocks();
    clearMockPayments();
    console.log('🧹 Cleanup completado');
  }
}

// Función auxiliar para crear payment_request más realista
async function createTestPaymentRequest(paymentRequestId, paymentId) {
  const testData = {
    id: paymentRequestId,
    payment_id: paymentId,
    customer_data: {
      email: 'test.flow@example.com',
      first_name: 'Test',
      last_name: 'Flow Business',
      phone: '+523334445566',
      identification: {
        type: 'RFC',
        number: 'TEST123456XXX'
      }
    },
    order_items: JSON.stringify([{
      id: 'test-product-flow-1',
      name: 'Producto Test Flow Completo',
      description: 'Producto para testing de flujo completo de negocio',
      quantity: 1,
      price: 100
    }]),
    total_amount: 100,
    payment_status: 'pending',
    payment_detail: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('payment_requests')
    .upsert([testData], { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('❌ Error creando payment_request:', error);
    return null;
  }

  console.log('✅ Payment request creado:', {
    id: data.id,
    email: data.customer_data.email,
    amount: data.total_amount
  });
  return data;
}

async function getPaymentRequestStatus(paymentRequestId) {
  const { data } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('id', paymentRequestId)
    .single();
  
  return data;
}

async function sendWebhook(paymentId, status) {
  const webhookUrl = `${process.env.NEXT_PUBLIC_HOST_URL}/api/webhook`;
  const secret = process.env.MERCADOPAGO_WEBHOOK_KEY;
  
  const payload = {
    action: 'payment.updated',
    api_version: 'v1',
    data: { id: parseInt(paymentId) },
    date_created: new Date().toISOString(),
    id: Math.floor(Math.random() * 1000000),
    live_mode: false,
    type: 'payment',
    user_id: '2379483292'
  };

  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': `ts=${timestamp},v1=${signature}`,
        'User-Agent': 'Complete Business Flow Test v1.0'
      },
      body: rawBody
    });
    
    const result = await response.text();
    console.log(`📤 Webhook ${status}: ${response.status} - ${result}`);
    
    // Log adicional para debugging
    if (!response.ok) {
      console.error(`❌ Webhook falló con status ${response.status}`);
      console.error(`📝 Response body: ${result}`);
    }
    
    return response.ok;
  } catch (error) {
    console.error(`❌ Error enviando webhook ${status}:`, error.message);
    return false;
  }
}

// Función para mostrar ayuda
function showHelp() {
  console.log(`
🎭 Test Completo de Flujo de Negocio v1.0

Propósito:
  Valida el flujo COMPLETO de negocio, no solo la respuesta del webhook:
  ✅ Respuesta HTTP del webhook
  ✅ Actualización de payment_request
  ✅ Creación de orden en BD
  ✅ Envío de correo de confirmación (mock)
  ✅ Actualización de Google Sheets (mock)

Uso: 
  npm run test:webhook:complete <payment_id> [payment_request_id] [delay_seconds]

Parámetros:
  payment_id         - ID numérico del pago de MercadoPago (requerido)
  payment_request_id - ID del payment_request en tu BD (opcional)
  delay_seconds      - Segundos entre pending y approved (default: 5)

Ejemplos:
  npm run test:webhook:complete 123456789
  npm run test:webhook:complete 123456789 "mi-test-001" 10

Lo que valida:
  1. 📤 Webhook responde correctamente (200 OK)
  2. 🔄 Payment request se actualiza a 'approved'
  3. 📦 Orden se crea en la tabla 'orders'
  4. 📧 Mock de correo se ejecuta (si implementado)
  5. 📊 Mock de Google Sheets se ejecuta (si implementado)

Diferencia con test-webhook-flow.js:
  - test-webhook-flow.js: Solo valida respuesta HTTP del webhook
  - test-webhook-flow-with-mock.js: Valida flujo COMPLETO de negocio
  `);
}

// Ejecutar test principal
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    return;
  }
  
  const paymentId = args[0];
  const paymentRequestId = args[1] || null;
  const delaySeconds = parseInt(args[2]) || 5;

  if (!paymentId) {
    console.log('❌ Debes proporcionar un payment_id');
    console.log('💡 Uso: node test-webhook-flow-with-mock.js <payment_id>');
    return;
  }

  console.log('🚀 Iniciando test completo de flujo de negocio...\n');
  
  const results = await runCompleteBusinessFlowTest(paymentId, paymentRequestId, delaySeconds);
  
  // Salir con código de error si el test no es completamente exitoso
  const overallSuccess = Object.values(results).every(result => result === true);
  process.exit(overallSuccess ? 0 : 1);
}

main().catch(error => {
  console.error('\n❌ Error fatal en el test:', error.message);
  console.error('📚 Stack trace:', error.stack);
  process.exit(1);
});

export { runCompleteBusinessFlowTest, sendWebhook, getPaymentRequestStatus };