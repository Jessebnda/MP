import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto';
import { logInfo, logError, logWarn } from '../../../utils/logger';
import { createClient } from '@supabase/supabase-js';
import { updateStockAfterOrder } from '../../../lib/productService';
import { generateReceiptPDF } from '../../../lib/pdfService';
import { sendReceiptEmail } from '../../../lib/emailService';

// Verificar variables críticas al cargar el módulo
if (!process.env.MERCADOPAGO_WEBHOOK_KEY) {
  console.error('❌ CRITICAL: MERCADOPAGO_WEBHOOK_KEY no está definida');
}

if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
  console.error('❌ CRITICAL: MERCADOPAGO_ACCESS_TOKEN no está definida');
}

console.log('🔧 Webhook variables check:', {
  hasWebhookKey: !!process.env.MERCADOPAGO_WEBHOOK_KEY,
  hasAccessToken: !!process.env.MERCADOPAGO_ACCESS_TOKEN,
  environment: process.env.NODE_ENV,
  webhookKeyLength: process.env.MERCADOPAGO_WEBHOOK_KEY?.length
});

// Inicializar Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Validación de firma webhook CORREGIDA según documentación oficial de MercadoPago
async function isValidSignature(rawBody, secret, receivedSignature, queryParams) {
  try {
    if (!receivedSignature || !secret) {
      logWarn('❌ Webhook: Firma o secret faltante', {
        hasSignature: !!receivedSignature,
        hasSecret: !!secret
      });
      return false;
    }
    
    logInfo('🔍 Validando firma webhook', {
      signatureHeader: receivedSignature,
      queryParams: queryParams || {},
      bodyLength: rawBody.length
    });

    // Extraer timestamp y signature del header x-signature
    let timestamp, signature;
    
    if (receivedSignature.includes('ts=') && receivedSignature.includes('v1=')) {
      const parts = receivedSignature.split(',').reduce((acc, part) => {
        const [key, value] = part.split('=');
        acc[key] = value;
        return acc;
      }, {});
      
      timestamp = parts.ts;
      signature = parts.v1;
    } else {
      logWarn('❌ Formato de signature no reconocido:', receivedSignature);
      return false;
    }
    
    if (!timestamp || !signature) {
      logWarn('❌ Webhook: Timestamp o signature faltante en header', {
        timestamp,
        signature: signature ? 'presente' : 'faltante'
      });
      return false;
    }

    // CORRECCIÓN: Usar múltiples formatos según la documentación de MercadoPago
    const dataId = queryParams?.['data.id'] || '';
    const requestId = queryParams?.id || queryParams?.['request-id'] || '';
    
    // Probar diferentes formatos de string de validación
    const formats = [
      // Formato oficial v2 (más reciente)
      `id:${dataId};request-id:${requestId};ts:${timestamp};`,
      // Formato alternativo sin request-id
      `id:${dataId};ts:${timestamp};`,
      // Formato legacy
      `${timestamp}.${rawBody}`,
      // Formato solo con timestamp y body (para casos específicos)
      `ts=${timestamp}&id=${dataId}`
    ];
    
    for (const format of formats) {
      const calculatedSignature = crypto
        .createHmac('sha256', secret)
        .update(format)
        .digest('hex');
      
      try {
        const isValid = crypto.timingSafeEqual(
          Buffer.from(signature, 'hex'),
          Buffer.from(calculatedSignature, 'hex')
        );
        
        if (isValid) {
          logInfo(`🔐 Webhook: Validación exitosa con formato: ${format}`, {
            received: signature.substring(0, 10) + '...',
            calculated: calculatedSignature.substring(0, 10) + '...'
          });
          return true;
        }
      } catch (err) {
        // Continuar con el siguiente formato
        continue;
      }
    }
    
    logError(`🔐 Webhook: Validación fallida con todos los formatos`, {
      received: signature.substring(0, 10) + '...',
      testedFormats: formats,
      queryParams
    });
    
    return false;
    
  } catch (error) {
    logError('❌ Webhook: Error validando firma:', error);
    return false;
  }
}

export async function POST(req) {
  const startTime = Date.now();
  logInfo('🔔 Webhook: Iniciando procesamiento');

  try {
    // 1. Extraer query parameters (MercadoPago los incluye)
    const url = new URL(req.url);
    const queryParams = {};
    for (const [key, value] of url.searchParams.entries()) {
      queryParams[key] = value;
    }
    
    // NUEVO: Agregar logging más detallado
    logInfo('📋 Query parameters recibidos:', queryParams);
    logInfo('🔗 URL completa:', req.url);

    // 2. Obtener el cuerpo como texto
    const rawBody = await req.text();
    
    if (!rawBody) {
      logError('❌ Webhook: Cuerpo vacío recibido');
      return NextResponse.json({ error: 'Empty body' }, { status: 400 });
    }

    logInfo('📦 Raw body recibido:', {
      length: rawBody.length,
      preview: rawBody.substring(0, 200)
    });

    // NUEVO: Log completo de headers para debugging
    const allHeaders = {};
    req.headers.forEach((value, key) => {
      allHeaders[key] = value;
    });
    
    logInfo('🔍 Headers completos recibidos:', {
      'x-signature': allHeaders['x-signature'],
      'content-type': allHeaders['content-type'],
      'user-agent': allHeaders['user-agent'],
      'x-forwarded-for': allHeaders['x-forwarded-for'],
      totalHeaders: Object.keys(allHeaders).length
    });

    // 3. Validar firma
    const secret = process.env.MERCADOPAGO_WEBHOOK_KEY;
    const receivedSignature = req.headers.get('x-signature') || '';
    
    // En producción, validar firma obligatorio; en desarrollo opcional
    if (process.env.NODE_ENV === 'production') {
      const isValid = await isValidSignature(rawBody, secret, receivedSignature, queryParams);
      if (!isValid) {
        logError('❌ Webhook: Firma inválida en producción');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else {
      logInfo('🔧 Webhook: Modo desarrollo - validación de firma opcional');
      await isValidSignature(rawBody, secret, receivedSignature, queryParams);
    }

    // 4. Parsear notificación
    let notification;
    try {
      notification = JSON.parse(rawBody);
      logInfo('📋 Notificación parseada:', {
        action: notification.action,
        type: notification.type,
        dataId: notification.data?.id,
        liveMode: notification.live_mode
      });
    } catch (parseError) {
      logError('❌ Webhook: Error parseando JSON:', parseError);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // 5. Validar estructura básica - usar múltiples fuentes para payment ID
    const paymentId = notification.data?.id || queryParams['data.id'];
    const eventType = notification.type || notification.action;
    
    if (!paymentId) {
      logWarn('⚠️ Webhook: Notificación sin payment ID');
      return NextResponse.json({ received: true }, { status: 200 });
    }
    
    logInfo(`🔔 Webhook válido: tipo=${eventType}, payment_id=${paymentId}`);

    // 6. Procesar solo notificaciones de pago
    if (eventType === 'payment' || eventType === 'payment.updated' || eventType === 'payment.created') {
      await handlePaymentNotification(paymentId);
    } else {
      logInfo(`ℹ️ Webhook: Tipo de evento no procesado: ${eventType}`);
    }

    const processingTime = Date.now() - startTime;
    logInfo(`✅ Webhook procesado exitosamente en ${processingTime}ms`);
    
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logError(`❌ Webhook: Error general tras ${processingTime}ms:`, {
      message: error.message,
      stack: error.stack
    });
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Función principal para manejar notificaciones de pago
async function handlePaymentNotification(paymentId) {
  try {
    logInfo(`🔍 Procesando pago: ${paymentId}`);

    // 1. Obtener información del pago desde MercadoPago
    const mpClient = new MercadoPagoConfig({ 
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN 
    });
    const paymentClient = new Payment(mpClient);
    
    const { response: paymentInfo } = await paymentClient.get({ id: paymentId });
    const currentStatus = paymentInfo.status;
    const statusDetail = paymentInfo.status_detail;
    const externalReference = paymentInfo.external_reference;

    logInfo(`💰 Pago ${paymentId}: status=${currentStatus}, detail=${statusDetail}, ref=${externalReference}`);

    if (!externalReference) {
      logWarn(`⚠️ Pago ${paymentId} sin external_reference - ignorando`);
      return;
    }

    // 2. Buscar el payment_request en nuestra BD
    const { data: paymentRequest, error: fetchError } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('id', externalReference)
      .single();

    if (fetchError || !paymentRequest) {
      logError(`❌ Payment request ${externalReference} no encontrado:`, fetchError);
      return;
    }

    const previousStatus = paymentRequest.payment_status;
    logInfo(`📊 Estado: ${previousStatus} → ${currentStatus}`);

    // 3. Verificar si ya fue procesado (idempotencia)
    if (previousStatus === currentStatus) {
      logInfo(`✅ Pago ${paymentId} ya tiene estado ${currentStatus} - ignorando duplicado`);
      return;
    }

    // 4. Actualizar estado en payment_requests
    const { error: updateError } = await supabase
      .from('payment_requests')
      .update({
        payment_status: currentStatus,
        payment_detail: statusDetail,
        payment_id: paymentId,
        updated_at: new Date().toISOString()
      })
      .eq('id', externalReference);

    if (updateError) {
      logError(`❌ Error actualizando payment_request ${externalReference}:`, updateError);
      return;
    }

    logInfo(`✅ Payment request ${externalReference} actualizado exitosamente`);

    // 5. Ejecutar acciones según el nuevo estado
    if (currentStatus === 'approved' && previousStatus !== 'approved') {
      await handleApprovedPayment(paymentRequest, paymentInfo);
    } else if (currentStatus === 'rejected' && previousStatus !== 'rejected') {
      logInfo(`❌ Pago ${paymentId} rechazado`);
    } else if (currentStatus === 'pending' && previousStatus !== 'pending') {
      logInfo(`⏳ Pago ${paymentId} pendiente`);
    }

  } catch (error) {
    logError(`❌ Error procesando pago ${paymentId}:`, {
      message: error.message,
      stack: error.stack
    });
  }
}

// Manejar pagos aprobados
async function handleApprovedPayment(paymentRequest, paymentInfo) {
  const paymentId = paymentInfo.id;
  
  try {
    logInfo(`🎉 Procesando pago aprobado: ${paymentId}`);

    // 1. Actualizar stock
    let orderItems = paymentRequest.order_items;
    
    if (typeof orderItems === 'string') {
      try {
        orderItems = JSON.parse(orderItems);
      } catch (e) {
        logError('❌ Error parseando order_items:', e);
        orderItems = [];
      }
    }

    if (Array.isArray(orderItems) && orderItems.length > 0) {
      await updateStockAfterOrder(orderItems);
      logInfo(`📦 Stock actualizado para pago ${paymentId}`);
    }

    // 2. Crear orden definitiva
    await createFinalOrder(paymentRequest, paymentInfo);

    // 3. Enviar email de confirmación
    await sendConfirmationEmail(paymentRequest, paymentInfo);

    logInfo(`✅ Pago ${paymentId} procesado completamente`);

  } catch (error) {
    logError(`❌ Error en acciones post-aprobación para pago ${paymentId}:`, error);
  }
}

// Crear orden definitiva
async function createFinalOrder(paymentRequest, paymentInfo) {
  try {
    const orderData = {
      id: `ORDER_${paymentRequest.id}`,
      payment_id: paymentInfo.id,
      payment_request_id: paymentRequest.id,
      customer_data: paymentRequest.customer_data,
      order_items: paymentRequest.order_items,
      total_amount: paymentRequest.total_amount,
      payment_status: 'approved',
      payment_detail: paymentInfo.status_detail,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('orders')
      .insert([orderData]);

    if (error) {
      logError(`❌ Error creando orden definitiva:`, error);
    } else {
      logInfo(`✅ Orden definitiva creada: ORDER_${paymentRequest.id}`);
    }

  } catch (error) {
    logError(`❌ Error en createFinalOrder:`, error);
  }
}

// Enviar email de confirmación
async function sendConfirmationEmail(paymentRequest, paymentInfo) {
  try {
    const customerData = paymentRequest.customer_data;
    let orderItems = paymentRequest.order_items;

    if (typeof orderItems === 'string') {
      orderItems = JSON.parse(orderItems);
    }

    if (!customerData?.email) {
      logWarn(`⚠️ No hay email para enviar confirmación del pago ${paymentInfo.id}`);
      return;
    }

    // Generar PDF
    const receiptPDF = await generateReceiptPDF({
      orderId: paymentRequest.id,
      customerData,
      items: orderItems,
      totalAmount: paymentRequest.total_amount,
      paymentStatus: 'approved',
      paymentId: paymentInfo.id
    });

    // Enviar email
    const emailResult = await sendReceiptEmail({
      to: customerData.email,
      customerName: `${customerData.first_name || ''} ${customerData.last_name || ''}`.trim(),
      orderId: paymentRequest.id,
      paymentId: paymentInfo.id,
      amount: paymentRequest.total_amount,
      items: orderItems,
      pdfAttachment: receiptPDF
    });

    if (emailResult.success) {
      logInfo(`✅ Email enviado a ${customerData.email}`);
    } else {
      logError(`❌ Error enviando email:`, emailResult.error);
    }

  } catch (error) {
    logError(`❌ Error en sendConfirmationEmail:`, error);
  }
}