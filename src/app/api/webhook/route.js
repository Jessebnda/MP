import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto';
import { logInfo, logError, logWarn } from '../../../utils/logger';
import { createClient } from '@supabase/supabase-js';
import { updateStockAfterOrder, restoreStockAfterRefund, updateOrderStatus } from '../../../lib/productService';
import { generateReceiptPDF } from '../../../lib/pdfService';
import { sendReceiptEmail, sendRefundEmail, notifyChargebackToAdmins } from '../../../lib/emailService';

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

// Función principal para manejar notificaciones de pago
// ✅ MODIFICACIÓN: Webhook como autoridad principal
async function handlePaymentNotification(paymentId) {
  try {
    logInfo(`🔍 Procesando pago: ${paymentId}`);

    // 1. Obtener información del pago desde MercadoPago
    const mpClient = new MercadoPagoConfig({ 
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN 
    });
    const paymentClient = new Payment(mpClient);
    
    let paymentInfo;
    try {
      const paymentResponse = await paymentClient.get({ id: paymentId });
      paymentInfo = paymentResponse;
      
      if (!paymentInfo || typeof paymentInfo !== 'object') {
        logError(`❌ Respuesta inválida de MercadoPago para pago ${paymentId}:`, paymentResponse);
        return;
      }
      
    } catch (apiError) {
      logError(`❌ Error consultando API de MercadoPago para pago ${paymentId}:`, {
        message: apiError.message,
        cause: apiError.cause,
        status: apiError.status
      });
      return;
    }
    
    const currentStatus = paymentInfo.status;
    const statusDetail = paymentInfo.status_detail;
    const externalReference = paymentInfo.external_reference;

    logInfo(`💰 Pago ${paymentId}: status=${currentStatus}, detail=${statusDetail}, ref=${externalReference}`);

    if (!externalReference) {
      logWarn(`⚠️ Pago ${paymentId} sin external_reference - ignorando`);
      return;
    }

    // 2. ✅ USAR: Nueva lógica de retry inteligente
    const { paymentRequest, error: fetchError } = await findPaymentRequestWithRetry(
      externalReference, 
      currentStatus
    );

    if (fetchError || !paymentRequest) {
      if (WEBHOOK_RETRY_CONFIG.RETRY_STATES.includes(currentStatus)) {
        // Ejecutar diagnóstico antes de reportar error
        await diagnoseTimingIssue(externalReference, paymentId);
        
        logError(`❌ CRÍTICO: Payment request ${externalReference} no encontrado para pago ${currentStatus}`);
        logError(`🔍 Esto puede indicar problema de sincronización o datos perdidos`);
        
        // ✅ OPCIONAL: Notificar a administradores de problema crítico
        await notifyAdminsOfMissingPaymentRequest(paymentId, externalReference, currentStatus);
      } else {
        logInfo(`ℹ️ Payment request ${externalReference} no encontrado para pago ${currentStatus} - esperado`);
      }
      return;
    }

    const previousStatus = paymentRequest.payment_status;
    logInfo(`📊 Estado: ${previousStatus} → ${currentStatus}`);

    // 3. Verificar si necesita actualización
    const needsUpdate = shouldUpdatePaymentStatus(previousStatus, currentStatus);
    
    if (!needsUpdate) {
      logInfo(`✅ Pago ${paymentId} no necesita actualización: ${previousStatus} → ${currentStatus}`);
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

    // 5. Ejecutar acciones según transición de estado
    await handleStatusTransition(previousStatus, currentStatus, paymentRequest, paymentInfo);

  } catch (error) {
    logError(`❌ Error procesando pago ${paymentId}:`, {
      message: error.message,
      stack: error.stack
    });
  }
}

// ✅ NUEVA CONFIGURACIÓN: Parámetros de retry configurables
const WEBHOOK_RETRY_CONFIG = {
  // Estados que justifican retry (pagos que deberían tener payment_request)
  RETRY_STATES: ['approved', 'pending', 'in_process'],
  // Estados que no justifican retry (pagos que pueden no tener payment_request)
  NO_RETRY_STATES: ['rejected', 'cancelled'],
  // Configuración de reintentos
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000, // 1 segundo
  MAX_DELAY: 5000,     // 5 segundos máximo
  BACKOFF_MULTIPLIER: 1.5
};

// ✅ MEJORAR: Función de retry con configuración avanzada
async function findPaymentRequestWithRetry(externalReference, paymentStatus) {
  const config = WEBHOOK_RETRY_CONFIG;
  
  // Decidir si usar retry basado en el estado del pago
  if (!config.RETRY_STATES.includes(paymentStatus)) {
    logInfo(`🚫 Estado ${paymentStatus} no requiere retry - búsqueda simple`);
    const { data, error } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('id', externalReference)
      .single();
    return { paymentRequest: data, error };
  }

  // Usar retry logic para estados que lo justifican
  let currentDelay = config.INITIAL_DELAY;
  
  for (let attempt = 1; attempt <= config.MAX_RETRIES; attempt++) {
    const startTime = Date.now();
    logInfo(`🔄 [${attempt}/${config.MAX_RETRIES}] Buscando payment_request: ${externalReference}`);
    
    const { data: paymentRequest, error: fetchError } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('id', externalReference)
      .single();

    if (!fetchError && paymentRequest) {
      const searchTime = Date.now() - startTime;
      logInfo(`✅ Payment request encontrado en intento ${attempt} (${searchTime}ms): ${externalReference}`);
      return { paymentRequest, error: null };
    }

    if (attempt < config.MAX_RETRIES) {
      logInfo(`⏳ Intento ${attempt} fallido, esperando ${currentDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      
      // Backoff exponencial con límite
      currentDelay = Math.min(currentDelay * config.BACKOFF_MULTIPLIER, config.MAX_DELAY);
    } else {
      logError(`❌ Payment request ${externalReference} no encontrado después de ${config.MAX_RETRIES} intentos`);
    }
  }

  return { paymentRequest: null, error: fetchError };
}

// ✅ NUEVA: Función para notificar problemas críticos
async function notifyAdminsOfMissingPaymentRequest(paymentId, externalReference, paymentStatus) {
  try {
    logError(`🚨 PROBLEMA CRÍTICO: Payment request perdido`, {
      paymentId,
      externalReference,
      paymentStatus,
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL'
    });
    
    // Aquí podrías enviar email, Slack, etc.
    // await sendAdminAlert({...});
    
  } catch (error) {
    logError(`❌ Error notificando problema crítico:`, error);
  }
}

// ✅ NUEVA FUNCIÓN: Determinar si necesita actualización
function shouldUpdatePaymentStatus(previousStatus, currentStatus) {
  // No actualizar si es el mismo estado
  if (previousStatus === currentStatus) {
    return false;
  }

  // Matriz de transiciones válidas
  const validTransitions = {
    'pending': ['approved', 'rejected', 'cancelled', 'in_process'],
    'in_process': ['approved', 'rejected', 'cancelled'],
    'approved': ['refunded', 'charged_back'], // Solo para reembolsos y contracargos
    'rejected': [], // Los rechazados no cambian
    'cancelled': [], // Los cancelados no cambian
    'refunded': ['charged_back'], // Reembolsado puede tener contracargo
    'charged_back': [] // Contracargo es final
  };

  const allowedNext = validTransitions[previousStatus] || [];
  return allowedNext.includes(currentStatus);
}

// ✅ NUEVA FUNCIÓN: Manejar transiciones de estado
async function handleStatusTransition(previousStatus, currentStatus, paymentRequest, paymentInfo) {
  const paymentId = paymentInfo.id;
  
  logInfo(`🔄 Procesando transición: ${previousStatus} → ${currentStatus} para pago ${paymentId}`);

  switch (currentStatus) {
    case 'approved':
      if (previousStatus !== 'approved') {
        await handlePaymentApproved(paymentRequest, paymentInfo);
      }
      break;
      
    case 'rejected':
      if (previousStatus !== 'rejected') {
        await handlePaymentRejected(paymentRequest, paymentInfo);
      }
      break;
      
    case 'refunded':
      await handlePaymentRefunded(paymentRequest, paymentInfo);
      break;
      
    case 'charged_back':
      await handlePaymentChargedBack(paymentRequest, paymentInfo);
      break;
      
    case 'cancelled':
      await handlePaymentCancelled(paymentRequest, paymentInfo);
      break;
      
    default:
      logInfo(`ℹ️ Estado ${currentStatus} no requiere acciones especiales`);
  }
}

// ✅ RENOMBRAR Y MEJORAR: Funciones específicas por estado
async function handlePaymentApproved(paymentRequest, paymentInfo) {
  const paymentId = paymentInfo.id;
  
  try {
    logInfo(`🎉 Procesando pago aprobado: ${paymentId}`);

    // 1. Actualizar stock (solo si no se hizo antes)
    let orderItems = paymentRequest.order_items;
    if (typeof orderItems === 'string') {
      orderItems = JSON.parse(orderItems);
    }

    if (Array.isArray(orderItems) && orderItems.length > 0) {
      await updateStockAfterOrder(orderItems);
      logInfo(`📦 Stock actualizado para pago ${paymentId}`);
    }

    // 2. Crear orden definitiva
    await createFinalOrder(paymentRequest, paymentInfo);

    // 3. ✅ NUEVO: Enviar email de APROBACIÓN (no de confirmación)
    await sendPaymentApprovedEmail(paymentRequest, paymentInfo);

    logInfo(`✅ Pago ${paymentId} aprobado procesado completamente`);

  } catch (error) {
    logError(`❌ Error procesando pago aprobado ${paymentId}:`, error);
  }
}

async function handlePaymentRejected(paymentRequest, paymentInfo) {
  const paymentId = paymentInfo.id;
  logInfo(`❌ Pago ${paymentId} rechazado - no se requieren acciones adicionales`);
  
  // ✅ OPCIONAL: Enviar email de rechazo si se desea
  // await sendPaymentRejectedEmail(paymentRequest, paymentInfo);
}

async function handlePaymentRefunded(paymentRequest, paymentInfo) {
  const paymentId = paymentInfo.id;
  
  try {
    logInfo(`💰 Procesando reembolso para pago: ${paymentId}`);

    // 1. Restaurar stock
    let orderItems = paymentRequest.order_items;
    if (typeof orderItems === 'string') {
      orderItems = JSON.parse(orderItems);
    }

    if (Array.isArray(orderItems) && orderItems.length > 0) {
      await restoreStockAfterRefund(orderItems);
      logInfo(`📦 Stock restaurado para reembolso ${paymentId}`);
    }

    // 2. Marcar orden como reembolsada
    await updateOrderStatus(paymentRequest.id, 'refunded');

    // 3. Enviar email de reembolso
    await sendRefundEmail(paymentRequest, paymentInfo);

  } catch (error) {
    logError(`❌ Error procesando reembolso ${paymentId}:`, error);
  }
}

async function handlePaymentChargedBack(paymentRequest, paymentInfo) {
  const paymentId = paymentInfo.id;
  
  try {
    logInfo(`⚠️ Procesando contracargo para pago: ${paymentId}`);

    // 1. Restaurar stock
    let orderItems = paymentRequest.order_items;
    if (typeof orderItems === 'string') {
      orderItems = JSON.parse(orderItems);
    }

    if (Array.isArray(orderItems) && orderItems.length > 0) {
      await restoreStockAfterRefund(orderItems);
      logInfo(`📦 Stock restaurado por contracargo ${paymentId}`);
    }

    // 2. Marcar orden como contracargo
    await updateOrderStatus(paymentRequest.id, 'charged_back');

    // 3. ✅ IMPORTANTE: Notificar a administradores
    await notifyChargebackToAdmins(paymentRequest, paymentInfo);

  } catch (error) {
    logError(`❌ Error procesando contracargo ${paymentId}:`, error);
  }
}

async function handlePaymentCancelled(paymentRequest, paymentInfo) {
  const paymentId = paymentInfo.id;
  logInfo(`🚫 Pago ${paymentId} cancelado - marcando como cancelado`);
  
  // Solo actualizar estado, no se requieren más acciones
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

// ✅ NUEVO: Enviar email de aprobación de pago
async function sendPaymentApprovedEmail(paymentRequest, paymentInfo) {
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

    // Enviar email usando función existente
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
      logInfo(`✅ Email de aprobación enviado a ${customerData.email}`);
    } else {
      logError(`❌ Error enviando email:`, emailResult.error);
    }

  } catch (error) {
    logError(`❌ Error en sendPaymentApprovedEmail:`, error);
  }
}

// ✅ ELIMINAR: Funciones duplicadas que ya existen en emailService.js
// - sendRefundEmail (ya existe)
// - notifyChargebackToAdmins (ya existe)

// ✅ NUEVA: Función de diagnóstico de timing
async function diagnoseTimingIssue(externalReference, paymentId) {
  try {
    logInfo(`🔬 Diagnóstico de timing para: ${externalReference}`);
    
    // Buscar registros relacionados con diferentes timestamps
    const { data: allRecords, error } = await supabase
      .from('payment_requests')
      .select('id, created_at, payment_id, payment_status')
      .or(`id.eq.${externalReference},payment_id.eq.${paymentId}`)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (!error && allRecords) {
      logInfo(`🔍 Registros relacionados encontrados:`, {
        count: allRecords.length,
        records: allRecords.map(r => ({
          id: r.id,
          payment_id: r.payment_id,
          created_at: r.created_at,
          status: r.payment_status
        }))
      });
    }
    
    // Buscar registros creados recientemente (últimos 30 segundos)
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
    const { data: recentRecords } = await supabase
      .from('payment_requests')
      .select('id, created_at, payment_id')
      .gte('created_at', thirtySecondsAgo)
      .order('created_at', { ascending: false });
    
    if (recentRecords && recentRecords.length > 0) {
      logInfo(`📊 Payment requests creados en últimos 30s:`, {
        count: recentRecords.length,
        records: recentRecords.slice(0, 3) // Solo los primeros 3
      });
    }
    
  } catch (error) {
    logError(`❌ Error en diagnóstico de timing:`, error);
  }
}