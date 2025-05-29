import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto';
import { logInfo, logError, logWarn } from '../../../utils/logger';
import { createClient } from '@supabase/supabase-js';
import { updateStockAfterOrder } from '../../../lib/productService';
import { generateReceiptPDF } from '../../../lib/pdfService';
import { sendReceiptEmail } from '../../../lib/emailService';

// Inicializar Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Validación de firma webhook mejorada
async function isValidSignature(rawBody, secret, receivedSignature) {
  try {
    if (!receivedSignature || !secret) {
      logWarn('❌ Webhook: Firma o secret faltante');
      return false;
    }
    
    const parts = receivedSignature.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {});
    
    const timestamp = parts.ts;
    const signature = parts.v1;
    
    if (!timestamp || !signature) {
      logWarn('❌ Webhook: Timestamp o signature faltante en header');
      return false;
    }
    
    const signatureString = `${timestamp}.${rawBody}`;
    const calculatedSignature = crypto
      .createHmac('sha256', secret)
      .update(signatureString)
      .digest('hex');
    
    const isValid = calculatedSignature === signature;
    logInfo(`🔐 Webhook: Validación de firma ${isValid ? 'exitosa' : 'fallida'}`);
    return isValid;
    
  } catch (error) {
    logError('❌ Webhook: Error validando firma:', error);
    return false;
  }
}

export async function POST(req) {
  const startTime = Date.now();
  logInfo('🔔 Webhook: Iniciando procesamiento');

  try {
    // 1. Obtener el cuerpo como texto
    const rawBody = await req.text();
    
    if (!rawBody) {
      logError('❌ Webhook: Cuerpo vacío recibido');
      return NextResponse.json({ error: 'Empty body' }, { status: 400 });
    }

    // 2. Validar firma (opcional en desarrollo)
    const secret = process.env.MERCADOPAGO_WEBHOOK_KEY;
    const receivedSignature = req.headers.get('x-signature') || '';
    
    if (process.env.NODE_ENV === 'production') {
      if (!await isValidSignature(rawBody, secret, receivedSignature)) {
        logError('❌ Webhook: Firma inválida');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else {
      logInfo('🔧 Webhook: Modo desarrollo - saltando validación de firma');
    }

    // 3. Parsear notificación
    let notification;
    try {
      notification = JSON.parse(rawBody);
    } catch (parseError) {
      logError('❌ Webhook: Error parseando JSON:', parseError);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // 4. Validar estructura básica
    if (!notification.data?.id) {
      logWarn('⚠️ Webhook: Notificación sin data.id');
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const paymentId = notification.data.id;
    const eventType = notification.type || notification.action;
    
    logInfo(`🔔 Webhook válido: tipo=${eventType}, payment_id=${paymentId}`);

    // 5. Procesar solo notificaciones de pago
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
    
    const paymentInfo = await paymentClient.get({ id: paymentId });
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
      // Aquí podrías agregar lógica para pagos rechazados
    } else if (currentStatus === 'pending' && previousStatus !== 'pending') {
      logInfo(`⏳ Pago ${paymentId} pendiente`);
      // Aquí podrías agregar lógica para pagos pendientes
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