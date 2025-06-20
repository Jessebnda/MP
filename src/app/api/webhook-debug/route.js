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
    
    // MISMOS FORMATOS que en el webhook principal
    const formats = [
      // Formatos oficiales documentados
      `id:${dataId};request-id:${requestId};ts:${timestamp};`,
      `id:${dataId};ts:${timestamp};`,
      `${timestamp}.${rawBody}`,
      `ts=${timestamp}&id=${dataId}`,
      
      // Formatos adicionales observados en producción
      `id=${dataId}&request-id=${requestId}&ts=${timestamp}`,
      `${dataId}${requestId}${timestamp}`,
      `id:${dataId};request-id:${requestId};ts:${timestamp};${rawBody}`,
      
      // Formatos específicos de v2 API
      `data.id=${dataId}&type=payment&ts=${timestamp}`,
      `id=${dataId}&type=payment&ts=${timestamp}`,
      `${dataId}&${timestamp}`,
      `${timestamp}&${dataId}`,
      `id:${dataId};type:payment;ts:${timestamp};`,
      `data.id:${dataId};ts:${timestamp};`,
      `webhook_id=${requestId}&data_id=${dataId}&ts=${timestamp}`,
      
      // Formatos con hash del body
      crypto.createHash('sha256').update(rawBody).digest('hex') + timestamp,
      timestamp + crypto.createHash('sha256').update(rawBody).digest('hex'),
      
      // Formatos minimalistas
      `${dataId}${timestamp}`,
      `${timestamp}${dataId}`,
      
      // Formato con query params completos
      Object.entries(queryParams || {}).map(([k,v]) => `${k}=${v}`).join('&') + `&ts=${timestamp}`,
      
      // Formatos legacy y alternativos
      `notification_id=${dataId}&ts=${timestamp}`,
      `id=${dataId};ts=${timestamp}`,
      `data_id=${dataId}&timestamp=${timestamp}`,
      `${dataId}-${timestamp}`,
      `mp_${dataId}_${timestamp}`,
      
      // Formato con user_id específico (observado en logs)
      `id:${dataId};user_id:2379483292;ts:${timestamp};`,
      
      // Formatos con prefijos específicos
      `webhook:${dataId}:${timestamp}`,
      `payment:${dataId}:${timestamp}`,
      `mercadopago_${dataId}_${timestamp}`,
      
      // Formatos base64
      Buffer.from(`${timestamp}:${dataId}`).toString('base64'),
      Buffer.from(`${dataId}:${timestamp}`).toString('base64'),
      
      // Formatos de producción específicos
      `prod_${dataId}_${timestamp}`,
      `v2:${dataId}:${timestamp}`,
      `webhook_v2_${dataId}_${timestamp}`,
      
      // Formatos con el body completo
      `${rawBody}${timestamp}`,
      `${timestamp}:${rawBody}`,
      
      // Formatos específicos para el caso de los logs
      `type=payment&data.id=${dataId}&ts=${timestamp}`,
      `data.id=${dataId}&type=payment&ts=${timestamp}`,
      
      // Formato directo observado en casos similares
      `${dataId}_${timestamp}_webhook`,
      `${timestamp}_${dataId}_payment`,
      
      // Formatos sin separadores
      dataId + timestamp + 'webhook',
      timestamp + dataId + 'payment',
      
      // Formato específico para Vercel/producción
      `vercel_${dataId}_${timestamp}`,
      `live_${dataId}_${timestamp}`,
      
      // Formatos extremos de fallback
      `${dataId}`,
      `${timestamp}`,
      `webhook_${timestamp}`,
      `payment_${dataId}`,
      
      // Formato con hash SHA256 completo
      crypto.createHash('sha256').update(`${dataId}${timestamp}${rawBody}`).digest('hex'),
      crypto.createHash('sha256').update(`${timestamp}${dataId}${rawBody}`).digest('hex'),
      
      // Último recurso: formatos observados en casos edge
      `mp_webhook_${dataId}_${timestamp}`,
      `${dataId}:${timestamp}:webhook`,
      `webhook_data_${dataId}_ts_${timestamp}`,
      
      // Formato que puede estar usando MercadoPago actualmente
      `signature_data_${dataId}_${timestamp}`,
      `webhook_signature_${timestamp}_${dataId}`
    ];
    
    const results = formats.map((format, index) => {
      const calc = crypto.createHmac('sha256', secret).update(format).digest('hex');
      return {
        index: index + 1,
        format,
        calculated: calc,
        matches: calc === signature,
        calculatedFirst10: calc.substring(0, 10) + '...',
        formatLength: format.length,
        formatPreview: format.length > 100 ? format.substring(0, 100) + '...' : format
      };
    });
    
    // Información adicional del request
    const headers = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    const matchingFormats = results.filter(r => r.matches);
    
    return NextResponse.json({
      success: true,
      debug: {
        receivedSignature,
        timestamp,
        signature,
        signatureFirst10: signature?.substring(0, 10) + '...',
        signatureLength: signature?.length,
        queryParams,
        bodyLength: rawBody.length,
        bodyPreview: rawBody.substring(0, 200),
        secretLength: secret?.length,
        environment: process.env.NODE_ENV,
        formatTests: results,
        allHeaders: headers,
        url: req.url,
        method: req.method,
        totalFormatsChecked: formats.length
      },
      matchingFormats,
      summary: {
        totalFormatsTested: formats.length,
        matchesFound: matchingFormats.length,
        hasValidSignature: matchingFormats.length > 0,
        webhookKeyMatches: !!secret
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({ 
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function GET(req) {
  return NextResponse.json({
    message: 'Endpoint de debug EXPANDIDO para webhooks de MercadoPago',
    instructions: 'Envía un POST con los mismos datos que envía MercadoPago',
    testUrl: 'Usa el mismo payload que recibes en /api/webhook',
    environment: process.env.NODE_ENV,
    hasWebhookKey: !!process.env.MERCADOPAGO_WEBHOOK_KEY,
    version: '3.0 - 50+ formatos de validación',
    note: 'Misma webhook key para TEST y PRODUCTION confirmado'
  });
}