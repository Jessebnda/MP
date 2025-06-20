import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Función para simular un webhook (copiada del script)
async function simulateWebhook(paymentId, newStatus = 'approved', baseUrl) {
  const numericPaymentId = parseInt(paymentId);
  if (isNaN(numericPaymentId) || numericPaymentId <= 0) {
    throw new Error('paymentId debe ser un número válido mayor a 0');
  }

  const webhookUrl = `${baseUrl}/api/webhook`;
  const secret = process.env.MERCADOPAGO_WEBHOOK_KEY;
  
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
    'User-Agent': 'MercadoPago Webhook Test API'
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers,
    body: rawBody
  });
  
  const result = await response.text();
  
  return {
    success: response.ok,
    status: response.status,
    statusText: response.statusText,
    response: result,
    payload,
    signature: `ts=${timestamp},v1=${signature}`,
    webhookUrl
  };
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
      return { exists: false, error: `Payment request ${paymentRequestId} no encontrado en BD` };
    }
    
    return { 
      exists: true, 
      data: {
        id: data.id,
        status: data.payment_status,
        amount: data.total_amount
      }
    };
  } catch (error) {
    return { exists: false, error: error.message };
  }
}

export async function POST(req) {
  try {
    // Validar que la petición venga de un origen autorizado (opcional)
    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');
    
    // En producción, podrías validar que solo ciertos orígenes puedan usar este endpoint
    // if (process.env.NODE_ENV === 'production' && !allowedOrigins.includes(origin)) {
    //   return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    // }

    const body = await req.json();
    const { paymentId, status = 'approved', verifyPayment = false } = body;

    if (!paymentId) {
      return NextResponse.json({ 
        error: 'paymentId es requerido' 
      }, { status: 400 });
    }

    const validStatuses = ['approved', 'pending', 'rejected', 'cancelled', 'in_process'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ 
        error: `Estado no válido: ${status}. Estados válidos: ${validStatuses.join(', ')}` 
      }, { status: 400 });
    }

    // Verificar si el payment request existe si se solicita
    let paymentVerification = null;
    if (verifyPayment && paymentId.length < 10) {
      paymentVerification = await verifyPaymentExists(paymentId);
      if (!paymentVerification.exists) {
        return NextResponse.json({
          error: paymentVerification.error,
          suggestion: 'Asegúrate de que el payment_request existe en la base de datos'
        }, { status: 404 });
      }
    }

    // Determinar la URL base
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('host');
    const baseUrl = `${protocol}://${host}`;

    // Ejecutar la simulación del webhook
    const result = await simulateWebhook(paymentId, status, baseUrl);

    return NextResponse.json({
      success: true,
      message: `Webhook simulado enviado para pago ${paymentId} con estado ${status}`,
      environment: baseUrl.includes('localhost') ? 'development' : 'production',
      webhook: result,
      paymentVerification
    });

  } catch (error) {
    console.error('Error en test-webhook API:', error);
    return NextResponse.json({ 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}

export async function GET(req) {
  // Endpoint para mostrar información sobre cómo usar la API
  return NextResponse.json({
    message: 'API de prueba de webhooks de Mercado Pago',
    usage: {
      method: 'POST',
      endpoint: '/api/test-webhook',
      body: {
        paymentId: 'string (required) - ID del pago o payment_request',
        status: 'string (optional) - Estado del pago (default: approved)',
        verifyPayment: 'boolean (optional) - Verificar si el payment_request existe'
      },
      validStatuses: ['approved', 'pending', 'rejected', 'cancelled', 'in_process']
    },
    examples: [
      {
        description: 'Simular pago aprobado',
        body: { paymentId: '123456789', status: 'approved' }
      },
      {
        description: 'Simular pago pendiente con verificación',
        body: { paymentId: 'abc123', status: 'pending', verifyPayment: true }
      }
    ]
  });
}