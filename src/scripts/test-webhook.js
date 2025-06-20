import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Validar variables de entorno críticas
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY', 
  'MERCADOPAGO_WEBHOOK_KEY',
  'NEXT_PUBLIC_HOST_URL'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Variable de entorno faltante: ${envVar}`);
    process.exit(1);
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Función para simular un webhook de MercadoPago
async function simulateWebhook(paymentId, newStatus = 'approved') {
  // Validar paymentId
  const numericPaymentId = parseInt(paymentId);
  if (isNaN(numericPaymentId) || numericPaymentId <= 0) {
    console.error('❌ paymentId debe ser un número válido mayor a 0');
    return;
  }

  // Usar la URL correcta (producción vs desarrollo)
  const baseUrl = process.env.NEXT_PUBLIC_HOST_URL;
  const webhookUrl = `${baseUrl}/api/webhook`;
  const secret = process.env.MERCADOPAGO_WEBHOOK_KEY;
  
  console.log(`🌍 Ambiente detectado: ${baseUrl.includes('localhost') ? 'DESARROLLO' : 'PRODUCCIÓN'}`);
  
  const payload = {
    action: 'payment.updated',
    api_version: 'v1',
    data: {
      id: numericPaymentId
    },
    date_created: new Date().toISOString(),
    id: Math.floor(Math.random() * 1000000),
    live_mode: !baseUrl.includes('localhost'), // true en producción
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
    'User-Agent': 'MercadoPago Webhook Test Script'
  };

  console.log(`🧪 Enviando webhook simulado para pago ${numericPaymentId} con estado ${newStatus}`);
  console.log('📍 URL:', webhookUrl);
  console.log('📦 Payload:', JSON.stringify(payload, null, 2));
  console.log('🔐 Signature:', `ts=${timestamp},v1=${signature}`);
  
  try {
    // Usar fetch nativo de Node.js 18+
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: rawBody
    });
    
    const result = await response.text();
    
    if (response.ok) {
      console.log(`✅ Webhook enviado exitosamente: ${response.status}`);
      console.log(`📝 Respuesta:`, result);
    } else {
      console.error(`❌ Error en webhook: ${response.status} - ${response.statusText}`);
      console.error(`📝 Respuesta:`, result);
    }
    
  } catch (error) {
    console.error('❌ Error enviando webhook:', error.message);
    
    // Ayuda para debugging común
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Sugerencia: Verifica que tu servidor esté corriendo en:', webhookUrl);
    } else if (error.code === 'ENOTFOUND') {
      console.error('💡 Sugerencia: Verifica la URL del webhook en NEXT_PUBLIC_HOST_URL');
    }
  }
}

// Función auxiliar para verificar que el pago existe en la BD
async function verifyPaymentExists(paymentRequestId) {
  try {
    const { data, error } = await supabase
      .from('payment_requests')
      .select('id, payment_status, total_amount')
      .eq('id', paymentRequestId)
      .single();
    
    if (error || !data) {
      console.warn(`⚠️ Payment request ${paymentRequestId} no encontrado en BD`);
      return false;
    }
    
    console.log(`📊 Payment request encontrado: ID=${data.id}, Status=${data.payment_status}, Amount=${data.total_amount}`);
    return true;
  } catch (error) {
    console.error('❌ Error verificando payment request:', error.message);
    return false;
  }
}

// Función principal con mejor manejo de argumentos
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🧪 Test de Webhook de Mercado Pago

Uso: 
  node src/scripts/test-webhook.js <payment_id> [status]

Ejemplos:
  node src/scripts/test-webhook.js 123456789
  node src/scripts/test-webhook.js 123456789 approved  
  node src/scripts/test-webhook.js 123456789 pending
  node src/scripts/test-webhook.js 123456789 rejected

Estados válidos: approved, pending, rejected, cancelled
    `);
    return;
  }
  
  const paymentId = args[0];
  const newStatus = args[1] || 'approved';
  
  const validStatuses = ['approved', 'pending', 'rejected', 'cancelled', 'in_process'];
  if (!validStatuses.includes(newStatus)) {
    console.error(`❌ Estado no válido: ${newStatus}`);
    console.error(`✅ Estados válidos: ${validStatuses.join(', ')}`);
    return;
  }
  
  // Si el paymentId parece ser un payment_request_id, verificar que existe
  if (paymentId.length < 10) { // Los payment_ids de MP son números largos
    console.log('🔍 Verificando si el payment request existe en BD...');
    const exists = await verifyPaymentExists(paymentId);
    if (!exists) {
      console.error('❌ No se puede proceder sin un payment request válido');
      return;
    }
  }
  
  await simulateWebhook(paymentId, newStatus);
}

// Ejecutar solo si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
}

export { simulateWebhook, verifyPaymentExists };