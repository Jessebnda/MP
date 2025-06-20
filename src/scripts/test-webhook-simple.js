import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testWebhook(paymentRequestId, status = 'approved') {
  try {
    console.log(`🧪 Iniciando test de webhook para payment_request: ${paymentRequestId}`);
    
    // 1. Verificar que el payment_request existe
    const { data: paymentRequest, error } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('id', paymentRequestId)
      .single();
    
    if (error || !paymentRequest) {
      console.error('❌ Payment request no encontrado:', error?.message);
      return;
    }
    
    console.log('✅ Payment request encontrado:', {
      id: paymentRequest.id,
      current_status: paymentRequest.payment_status,
      amount: paymentRequest.total_amount
    });
    
    // 2. Simular un pago ID numérico
    const fakePaymentId = Math.floor(Math.random() * 1000000000);
    
    // 3. Crear payload del webhook
    const payload = {
      action: 'payment.updated',
      api_version: 'v1',
      data: {
        id: fakePaymentId
      },
      date_created: new Date().toISOString(),
      id: Math.floor(Math.random() * 1000000),
      live_mode: false,
      type: 'payment',
      user_id: '2379483292'
    };
    
    // 4. Preparar la simulación
    const baseUrl = process.env.NEXT_PUBLIC_HOST_URL || 'http://localhost:3000';
    const webhookUrl = `${baseUrl}/api/webhook`;
    const secret = process.env.MERCADOPAGO_WEBHOOK_KEY;
    
    const rawBody = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureString = `${timestamp}.${rawBody}`;
    const signature = crypto.createHmac('sha256', secret).update(signatureString).digest('hex');
    
    const headers = {
      'Content-Type': 'application/json',
      'x-signature': `ts=${timestamp},v1=${signature}`,
      'User-Agent': 'Test Webhook Script'
    };
    
    console.log('📦 Enviando webhook a:', webhookUrl);
    console.log('🔐 Signature:', `ts=${timestamp},v1=${signature}`);
    
    // 5. Antes de enviar, simular que hay un pago real con external_reference
    // Esto simula lo que haría MercadoPago cuando consulte el pago
    console.log('🔧 Configurando mock de pago para el webhook...');
    
    // 6. Enviar webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: rawBody
    });
    
    const result = await response.text();
    
    if (response.ok) {
      console.log(`✅ Webhook enviado exitosamente: ${response.status}`);
      console.log('📝 Respuesta:', result);
      
      // 7. Verificar cambios en la BD
      setTimeout(async () => {
        const { data: updatedRequest } = await supabase
          .from('payment_requests')
          .select('*')
          .eq('id', paymentRequestId)
          .single();
        
        console.log('📊 Estado final del payment_request:', {
          id: updatedRequest.id,
          payment_status: updatedRequest.payment_status,
          payment_id: updatedRequest.payment_id,
          updated_at: updatedRequest.updated_at
        });
      }, 2000);
      
    } else {
      console.error(`❌ Error en webhook: ${response.status} - ${response.statusText}`);
      console.error('📝 Respuesta:', result);
    }
    
  } catch (error) {
    console.error('❌ Error en test:', error.message);
  }
}

// Ejecutar test
const paymentRequestId = process.argv[2];
const status = process.argv[3] || 'approved';

if (!paymentRequestId) {
  console.log(`
🧪 Test de Webhook Simplificado

Uso: 
  node src/scripts/test-webhook-simple.js <payment_request_id> [status]

Ejemplo:
  node src/scripts/test-webhook-simple.js "abc123" approved
  `);
  process.exit(1);
}

testWebhook(paymentRequestId, status)
  .then(() => console.log('🏁 Test completado'))
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });