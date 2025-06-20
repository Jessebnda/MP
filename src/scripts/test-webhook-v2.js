import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Configurar la ruta para .env.local (igual que en tus otros scripts)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env.local desde la raíz del proyecto
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

console.log('🔧 Variables de entorno cargadas desde:', path.resolve(__dirname, '../../.env.local'));

// Test con el formato correcto de firma v2.6
async function testWebhookV2(paymentId, status = 'approved') {
  console.log('🧪 Test Webhook v2.6 - Formato oficial MercadoPago');
  console.log('═'.repeat(60));
  
  const baseUrl = process.env.NEXT_PUBLIC_HOST_URL || 'http://localhost:3000';
  const secret = process.env.MERCADOPAGO_WEBHOOK_KEY;
  
  console.log('🔧 Variables de entorno:');
  console.log(`   Base URL: ${baseUrl}`);
  console.log(`   Secret: ${secret ? '✅ Configurado (' + secret.length + ' chars)' : '❌ No encontrado'}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Access Token: ${process.env.MERCADOPAGO_ACCESS_TOKEN ? '✅ Configurado' : '❌ No encontrado'}`);
  
  if (!secret) {
    console.error('❌ MERCADOPAGO_WEBHOOK_KEY no encontrada en .env.local');
    console.error('💡 Revisa que el archivo .env.local contenga:');
    console.error('   MERCADOPAGO_WEBHOOK_KEY=tu_webhook_secret');
    console.error('\n📍 Ubicación del archivo .env.local:', path.resolve(__dirname, '../../.env.local'));
    process.exit(1);
  }
  
  // Generar IDs realistas
  const numericPaymentId = parseInt(paymentId);
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = Math.floor(Date.now() / 1000);
  
  console.log('\n📋 Datos del test:');
  console.log(`   Payment ID: ${numericPaymentId}`);
  console.log(`   Request ID: ${requestId}`);
  console.log(`   Timestamp: ${timestamp}`);
  console.log(`   Base URL: ${baseUrl}`);
  
  const payload = {
    action: 'payment.updated',
    api_version: 'v1',
    data: { id: numericPaymentId },
    date_created: new Date().toISOString(),
    id: Math.floor(Math.random() * 1000000),
    live_mode: !baseUrl.includes('localhost'),
    type: 'payment',
    user_id: '2379483292'
  };

  const rawBody = JSON.stringify(payload);
  
  // Crear firma con formato oficial: id:{id};request-id:{request-id};ts:{ts};
  const manifest = `id:${numericPaymentId};request-id:${requestId};ts:${timestamp};`;
  const signature = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  
  console.log('\n🔐 Validación de firma:');
  console.log(`   Manifest: ${manifest}`);
  console.log(`   Signature: ${signature.substring(0, 16)}...`);
  console.log(`   Full signature: ${signature}`);
  
  const headers = {
    'Content-Type': 'application/json',
    'x-signature': `ts=${timestamp},v1=${signature}`,
    'x-request-id': requestId,
    'User-Agent': 'MercadoPago/1.0'
  };

  const webhookUrl = `${baseUrl}/api/webhook?data.id=${numericPaymentId}`;
  
  console.log('\n📡 Enviando webhook:');
  console.log(`   URL: ${webhookUrl}`);
  console.log(`   Headers:`);
  Object.entries(headers).forEach(([key, value]) => {
    console.log(`     ${key}: ${value}`);
  });
  console.log(`   Body length: ${rawBody.length} bytes`);

  try {
    console.log('\n⏳ Enviando solicitud...');
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: rawBody
    });
    
    const result = await response.text();
    
    console.log('\n📥 Respuesta del servidor:');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Content-Type: ${response.headers.get('content-type') || 'N/A'}`);
    console.log(`   Content-Length: ${response.headers.get('content-length') || 'N/A'}`);
    console.log(`   Body: ${result}`);
    
    if (response.ok) {
      console.log('\n✅ Test exitoso - Firma validada correctamente');
      
      // Parse response para verificar estructura
      try {
        const jsonResult = JSON.parse(result);
        console.log('📊 Respuesta parseada:', jsonResult);
      } catch (e) {
        console.log('ℹ️ Respuesta no es JSON válido');
      }
      
    } else {
      console.log('\n❌ Test fallido - Revisar logs del servidor');
      
      if (response.status === 401) {
        console.log('💡 Error 401: Problema con la validación de firma');
        console.log('   - Verifica que MERCADOPAGO_WEBHOOK_KEY sea correcto');
        console.log('   - Verifica que el servidor esté usando la misma secret');
      } else if (response.status === 400) {
        console.log('💡 Error 400: Datos de solicitud inválidos');
        console.log('   - Verifica el formato del payload');
        console.log('   - Verifica los headers requeridos');
      } else if (response.status === 500) {
        console.log('💡 Error 500: Error interno del servidor');
        console.log('   - Revisa los logs del servidor para más detalles');
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error enviando webhook:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 El servidor Next.js no está ejecutándose.');
      console.error('   Ejecuta: npm run dev');
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error('💡 Problema con la solicitud HTTP.');
      console.error('   Verifica la URL y que el servidor esté accesible');
    }
  }
  
  console.log('\n' + '═'.repeat(60));
}

// Función para mostrar ayuda
function showHelp() {
  console.log(`
🧪 Test de Webhook v2.6 - Formato Oficial MercadoPago

Uso: 
  npm run test:webhook:v2 <payment_id> [status]

Ejemplos:
  npm run test:webhook:v2 123456789
  npm run test:webhook:v2 123456789 approved
  npm run test:webhook:v2 987654321 pending

Requisitos:
  1. Archivo .env.local con MERCADOPAGO_WEBHOOK_KEY
  2. NEXT_PUBLIC_HOST_URL configurado (opcional)
  3. Servidor Next.js ejecutándose (npm run dev)

Variables de entorno actuales:
  MERCADOPAGO_WEBHOOK_KEY: ${process.env.MERCADOPAGO_WEBHOOK_KEY ? '✅ Configurado' : '❌ No encontrado'}
  NEXT_PUBLIC_HOST_URL: ${process.env.NEXT_PUBLIC_HOST_URL || 'No configurado (usará localhost:3000)'}
  MERCADOPAGO_ACCESS_TOKEN: ${process.env.MERCADOPAGO_ACCESS_TOKEN ? '✅ Configurado' : '❌ No encontrado'}
`);
}

// Función principal
async function main() {
  console.log('🚀 Iniciando test webhook v2.6...\n');
  
  const paymentId = process.argv[2];
  const status = process.argv[3] || 'approved';
  
  if (!paymentId) {
    showHelp();
    process.exit(1);
  }
  
  try {
    await testWebhookV2(paymentId, status);
    console.log('\n🏁 Test completado exitosamente');
  } catch (error) {
    console.error('\n💥 Error fatal:', error.message);
    console.error('📚 Stack:', error.stack);
    process.exit(1);
  }
}

// Detectar si se está ejecutando directamente usando fileURLToPath
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  main();
}

export { testWebhookV2 };