import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'MercadoPago Webhook Handler',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    config: {
      hasWebhookKey: !!process.env.MERCADOPAGO_WEBHOOK_KEY,
      hasAccessToken: !!process.env.MERCADOPAGO_ACCESS_TOKEN,
      hasSupabaseConfig: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      webhookUrl: process.env.MERCADOPAGO_WEBHOOK_URL || 'Not configured'
    }
  });
}