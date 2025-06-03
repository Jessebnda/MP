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
  webhookKeyLength: process.env.MERCADOPAGO_WEBHOOK_KEY?.length,
  accessTokenType: process.env.MERCADOPAGO_ACCESS_TOKEN?.substring(0, 4) // TEST o APP-
});

// Inicializar Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Función CORREGIDA para validar firma según documentación oficial de MercadoPago v2.6
function buildSignatureManifest({ ts, id, requestId }) {
  return `id:${id};request-id:${requestId};ts:${ts};`;
}

function verifyWebhookSignature({ signatureHeader, rawBody, secret, id, requestId }) {
  try {
    // Extraer timestamp y signature del header x-signature
    const signatureMatch = signatureHeader.match(/ts=(\d+),v1=([a-f0-9]+)/);
    if (!signatureMatch) {
      logWarn('❌ Formato de signature header inválido:', signatureHeader);
      return false;
    }

    const [, ts, v1] = signatureMatch;
    
    // Construir el manifest según documentación oficial
    const manifest = buildSignatureManifest({ ts, id, requestId });
    
    // Calcular firma esperada
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');
    
    // Comparación segura
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(v1, 'hex')
    );
    
    logInfo('🔍 Validación de firma webhook:', {
      manifest,
      ts,
      id,
      requestId,
      signatureValid: isValid,
      expectedStart: expectedSignature.substring(0, 10) + '...',
      receivedStart: v1.substring(0, 10) + '...'
    });
    
    return isValid;
    
  } catch (error) {
    logError('❌ Error en verificación de firma:', error);
    return false;
  }
}

export async function POST(req) {
  const startTime = Date.now();
  logInfo('🔔 Webhook: Iniciando procesamiento');

  try {
    // 1. Extraer query parameters
    const url = new URL(req.url);
    const queryParams = {};
    for (const [key, value] of url.searchParams.entries()) {
      queryParams[key] = value;
    }
    
    // 2. Obtener datos necesarios para validación
    const id = queryParams['data.id'];
    const requestId = req.headers.get('x-request-id') || req.headers.get('X-Request-Id') || '';
    const signatureHeader = req.headers.get('x-signature') || '';
    const secret = process.env.MERCADOPAGO_WEBHOOK_KEY;
    
    // 3. Obtener body
    const rawBody = await req.text();
    
    if (!rawBody) {
      logError('❌ Webhook: Cuerpo vacío recibido');
      return NextResponse.json({ error: 'Empty body' }, { status: 400 });
    }

    // Log detallado para debugging
    logInfo('📋 Datos del webhook recibidos:', {
      id,
      requestId,
      hasSignature: !!signatureHeader,
      bodyLength: rawBody.length,
      queryParams,
      userAgent: req.headers.get('user-agent')
    });

    // 4. Validar firma (obligatorio en producción)
    if (process.env.NODE_ENV === 'production') {
      if (!signatureHeader || !id || !secret) {
        logError('❌ Webhook: Datos requeridos faltantes para validación', {
          hasSignature: !!signatureHeader,
          hasId: !!id,
          hasSecret: !!secret,
          hasRequestId: !!requestId
        });
        return NextResponse.json({ error: 'Missing required data for validation' }, { status: 400 });
      }

      const isValid = verifyWebhookSignature({
        signatureHeader,
        rawBody,
        secret,
        id,
        requestId
      });

      if (!isValid) {
        logError('❌ Webhook: Firma inválida en producción');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
      
      logInfo('✅ Webhook: Firma válida');
    } else {
      logInfo('🔧 Webhook: Modo desarrollo - validación de firma omitida');
    }

    // 5. Parsear notificación
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

    // 6. Obtener payment ID de múltiples fuentes
    const paymentId = notification.data?.id || id;
    const eventType = notification.type || notification.action;
    
    if (!paymentId) {
      logWarn('⚠️ Webhook: Notificación sin payment ID');
      return NextResponse.json({ received: true }, { status: 200 });
    }
    
    logInfo(`🔔 Webhook válido: tipo=${eventType}, payment_id=${paymentId}`);

    // 7. Procesar solo notificaciones de pago
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

// Función principal para manejar notificaciones de pago - MEJORADA
async function handlePaymentNotification(paymentId) {
  try {
    logInfo(`🔍 Procesando pago: ${paymentId}`);

    // 1. Obtener información del pago desde MercadoPago con mejor manejo de errores
    const mpClient = new MercadoPagoConfig({ 
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN 
    });
    const paymentClient = new Payment(mpClient);
    
    let paymentInfo;
    let mpApiError = null;
    
    try {
      logInfo(`🌐 Consultando pago ${paymentId} en MercadoPago API...`);
      const response = await paymentClient.get({ id: paymentId });
      
      // CRITICAL: Verificar estructura de respuesta
      if (response && response.response) {
        paymentInfo = response.response;
        logInfo(`✅ Pago consultado exitosamente: ${paymentId}`);
      } else {
        logError(`❌ Respuesta de MP API inesperada:`, {
          hasResponse: !!response,
          responseKeys: response ? Object.keys(response) : [],
          paymentId
        });
        throw new Error('Estructura de respuesta inesperada de MercadoPago API');
      }
      
    } catch (mpError) {
      mpApiError = mpError;
      logError(`❌ Error consultando pago ${paymentId} en MercadoPago:`, {
        error: mpError.message,
        status: mpError.status,
        cause: mpError.cause,
        stack: mpError.stack
      });
      
      // Si es un error 404, el pago no existe en MP
      if (mpError.status === 404) {
        logWarn(`⚠️ Pago ${paymentId} no encontrado en MercadoPago - posible webhook duplicado o pago eliminado`);
        return; // Salir silenciosamente para pagos no encontrados
      }
      
      // Para otros errores, re-lanzar
      throw new Error(`MercadoPago API error: ${mpError.message} (status: ${mpError.status})`);
    }

    // 2. Verificar que paymentInfo tenga la estructura esperada
    if (!paymentInfo) {
      throw new Error(`paymentInfo es undefined después de consulta exitosa`);
    }

    if (!paymentInfo.status) {
      logError(`❌ paymentInfo sin status:`, {
        paymentInfo: Object.keys(paymentInfo),
        paymentId
      });
      throw new Error(`paymentInfo.status is undefined`);
    }

    const currentStatus = paymentInfo.status;
    const statusDetail = paymentInfo.status_detail;
    const externalReference = paymentInfo.external_reference;

    logInfo(`💰 Pago ${paymentId}: status=${currentStatus}, detail=${statusDetail}, ref=${externalReference}`);

    if (!externalReference) {
      logWarn(`⚠️ Pago ${paymentId} sin external_reference - ignorando`);
      return;
    }

    // 3. Buscar el payment_request en nuestra BD
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

    // 4. Verificar si ya fue procesado (idempotencia)
    if (previousStatus === currentStatus) {
      logInfo(`✅ Pago ${paymentId} ya tiene estado ${currentStatus} - ignorando duplicado`);
      return;
    }

    // 5. Actualizar estado en payment_requests
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

    // 6. Ejecutar acciones según el nuevo estado
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
      stack: error.stack,
      name: error.name
    });
    
    // No re-lanzar el error para evitar que el webhook falle completamente
    // MercadoPago seguirá reenviando si respondemos con error
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