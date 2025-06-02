import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const url = new URL(req.url);
    const queryParams = {};
    for (const [key, value] of url.searchParams.entries()) {
      queryParams[key] = value;
    }
    
    const rawBody = await req.text();
    const receivedSignature = req.headers.get('x-signature') || '';
    const secret = process.env.MERCADOPAGO_WEBHOOK_KEY;
    
    // Extraer componentes de la firma
    let timestamp, signature;
    if (receivedSignature.includes('ts=') && receivedSignature.includes('v1=')) {
      const parts = receivedSignature.split(',').reduce((acc, part) => {
        const [key, value] = part.split('=');
        acc[key] = value;
        return acc;
      }, {});
      
      timestamp = parts.ts;
      signature = parts.v1;
    }
    
    const dataId = queryParams?.['data.id'] || '';
    const requestId = queryParams?.id || '';
    
    // Probar diferentes formatos
    const formats = [
      `id:${dataId};request-id:${requestId};ts:${timestamp};`,
      `id:${dataId};ts:${timestamp};`,
      `${timestamp}.${rawBody}`,
      `ts=${timestamp}&id=${dataId}`,
      // Formato adicional que usa MercadoPago en algunos casos
      `id=${dataId}&request-id=${requestId}&ts=${timestamp}`,
      // Formato sin separadores
      `${dataId}${requestId}${timestamp}`,
      // Formato con el body completo
      `id:${dataId};request-id:${requestId};ts:${timestamp};${rawBody}`
    ];
    
    const results = formats.map(format => {
      const calc = crypto.createHmac('sha256', secret).update(format).digest('hex');
      return {
        format,
        calculated: calc,
        matches: calc === signature,
        calculatedFirst10: calc.substring(0, 10) + '...'
      };
    });
    
    // Información adicional del request
    const headers = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    return NextResponse.json({
      success: true,
      debug: {
        receivedSignature,
        timestamp,
        signature,
        signatureFirst10: signature?.substring(0, 10) + '...',
        queryParams,
        bodyLength: rawBody.length,
        bodyPreview: rawBody.substring(0, 200),
        secretLength: secret?.length,
        environment: process.env.NODE_ENV,
        formatTests: results,
        allHeaders: headers,
        url: req.url,
        method: req.method
      },
      matchingFormats: results.filter(r => r.matches),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({ 
      success: false,
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}

export async function GET(req) {
  return NextResponse.json({
    message: 'Endpoint de debug para webhooks de MercadoPago',
    instructions: 'Envía un POST con los mismos datos que envía MercadoPago',
    testUrl: 'Usa el mismo payload que recibes en /api/webhook',
    environment: process.env.NODE_ENV,
    hasWebhookKey: !!process.env.MERCADOPAGO_WEBHOOK_KEY
  });
}