import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Devolver la configuración actual del webhook desde las variables de entorno
    return NextResponse.json({
      webhookUrl: process.env.MERCADOPAGO_WEBHOOK_URL || '',
      webhookKey: process.env.MERCADOPAGO_WEBHOOK_KEY || '',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error al obtener configuración de webhook' },
      { status: 500 }
    );
  }
}