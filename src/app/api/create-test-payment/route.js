import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError } from '../../../lib/logger';

// Inicializa el cliente de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Inicializa el cliente de MercadoPago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

export async function POST(req) {
  try {
    // Parsear el cuerpo de la solicitud
    const body = await req.json();
    const { amount = 10.00 } = body;
    
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Monto inválido. Debe ser un número positivo.' },
        { status: 400 }
      );
    }
    
    // Generar un ID único para la orden de prueba
    const orderId = `test-${uuidv4().substring(0, 8)}`;
    
    // Crear la orden en Supabase
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        id: orderId,
        customer_id: 'webhook-test@example.com',
        status: 'pending',
        payment_status: 'pending',
        payment_detail: 'Test payment initiated',
        total_amount: amount,
      })
      .select();
    
    if (orderError) {
      logError('Error creating test order in Supabase:', orderError);
      return NextResponse.json(
        { error: 'Error al crear orden de prueba' },
        { status: 500 }
      );
    }
    
    // Crear preferencia en MercadoPago
    const preferenceClient = new Preference(client);
    
    // Host URL para redirecciones
    const hostUrl = process.env.NEXT_PUBLIC_HOST_URL || 'http://localhost:3000';
    
    const preferenceData = {
      items: [
        {
          id: 'webhook-test-item',
          title: 'Pago de Prueba para Webhook',
          quantity: 1,
          unit_price: amount,
          currency_id: process.env.MERCADOPAGO_CURRENCY || 'MXN',
        },
      ],
      back_urls: {
        success: `${hostUrl}/webhook-tester?status=success&order_id=${orderId}`,
        failure: `${hostUrl}/webhook-tester?status=failure&order_id=${orderId}`,
        pending: `${hostUrl}/webhook-tester?status=pending&order_id=${orderId}`,
      },
      auto_return: 'approved',
      external_reference: orderId,
      notification_url: process.env.MERCADOPAGO_WEBHOOK_URL
    };
    
    logInfo('Creating test preference with MercadoPago:', {
      amount,
      orderId,
      notification_url: process.env.MERCADOPAGO_WEBHOOK_URL
    });
    
    const preference = await preferenceClient.create({
      body: preferenceData
    });
    
    return NextResponse.json({
      success: true,
      preference_id: preference.id,
      init_point: preference.init_point,
      external_reference: preference.external_reference,
      order_id: orderId,
      notification_url: process.env.MERCADOPAGO_WEBHOOK_URL
    });
  } catch (error) {
    logError('Error creating test preference:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear preferencia de pago' },
      { status: 500 }
    );
  }
}