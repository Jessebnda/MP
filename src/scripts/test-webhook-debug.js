import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

async function testWebhookDebug() {
  const baseUrl = process.env.NEXT_PUBLIC_HOST_URL || 'http://localhost:3000';
  const secret = process.env.MERCADOPAGO_WEBHOOK_KEY;
  
  // Simular el payload que envía MercadoPago
  const payload = {
    action: 'payment.updated',
    api_version: 'v1',
    data: {
      id: '1323570332'
    },
    date_created: new Date().toISOString(),
    id: 121848418454,
    live_mode: false,
    type: 'payment',
    user_id: '2379483292'
  };
  
  const rawBody = JSON.stringify(payload);
  const timestamp = '1748768774'; // Usar el mismo timestamp de los logs
  
  // Crear la firma usando el formato que parece usar MercadoPago
  const signatureString = `${timestamp}.${rawBody}`;
  const signature = crypto.createHmac('sha256', secret).update(signatureString).digest('hex');
  
  const debugUrl = `${baseUrl}/api/webhook-debug?data.id=1323570332&type=payment`;
  
  console.log('🔍 Probando endpoint de debug...');
  console.log('URL:', debugUrl);
  console.log('Signature string:', signatureString);
  console.log('Calculated signature:', signature);
  
  try {
    const response = await fetch(debugUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': `ts=${timestamp},v1=${signature}`,
        'User-Agent': 'MercadoPago Webhook Debug Test'
      },
      body: rawBody
    });
    
    const result = await response.json();
    
    console.log('\n📋 Resultado del debug:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.matchingFormats?.length > 0) {
      console.log('\n✅ Formatos que coinciden:');
      result.matchingFormats.forEach(format => {
        console.log(`  - ${format.format}`);
      });
    } else {
      console.log('\n❌ Ningún formato coincide');
      console.log('📊 Resultados de pruebas:');
      result.debug?.formatTests?.forEach(test => {
        console.log(`  ${test.matches ? '✅' : '❌'} ${test.format} -> ${test.calculatedFirst10}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testWebhookDebug();