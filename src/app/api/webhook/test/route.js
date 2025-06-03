import { NextResponse } from 'next/server';

export async function POST(req) {
  const url = new URL(req.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());
  const rawBody = await req.text();
  
  // Extraer todos los headers
  const headers = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });
  
  return NextResponse.json({
    message: 'Webhook test endpoint - verifica headers y datos',
    data: {
      queryParams,
      headers,
      bodyLength: rawBody.length,
      bodyPreview: rawBody.substring(0, 200),
      timestamp: new Date().toISOString()
    }
  });
}

export async function GET(req) {
  return NextResponse.json({
    message: 'Webhook test endpoint',
    instructions: 'Usa POST para simular un webhook de MercadoPago',
    testUrl: '/api/webhook/test'
  });
}