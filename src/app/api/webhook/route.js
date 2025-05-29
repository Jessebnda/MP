import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto';
import { logSecurityEvent } from '../../../lib/security-logger';
import { logInfo, logError, logWarn } from '../../../utils/logger';
import { createClient } from '@supabase/supabase-js';
import { generateReceiptPDF } from '../../../lib/pdfService';
import { sendReceiptEmail } from '../../../lib/emailService';
import { updateStockAfterOrder } from '../../../lib/productService';

// Inicializar el cliente de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Implementación CORRECTA de Validación de Firma ---
async function isValidSignature(rawBody, secret, receivedSignature) {
  try {
    if (!receivedSignature || !secret) return false;
    
    // Extraer timestamp y signature de x-signature header
    const parts = receivedSignature.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {});
    
    const timestamp = parts.ts;
    const signature = parts.v1;
    
    if (!timestamp || !signature) return false;
    
    // Crear el string para firmar: ts + rawBody
    const signatureString = `${timestamp}.${rawBody}`;
    
    // Calcular HMAC SHA256
    const calculatedSignature = crypto
      .createHmac('sha256', secret)
      .update(signatureString)
      .digest('hex');
    
    return calculatedSignature === signature;
  } catch (error) {
    logError('Error validando firma webhook:', error);
    return false;
  }
}

export async function POST(req) {
  // Verificar origen
  const origin = req.headers.get('origin');
  const allowedOrigins = [
    'https://api.mercadopago.com', 
    'https://webhook.mercadopago.com'
  ];
  
  if (origin && !allowedOrigins.includes(origin)) {
    logSecurityEvent('webhook_invalid_origin', { origin });
    return new Response('Forbidden', { status: 403 });
  }
  
  logInfo('🔔 Webhook recibido desde MercadoPago');

  // Usar la WEBHOOK_KEY específica
  const secret = process.env.MERCADOPAGO_WEBHOOK_KEY || process.env.MERCADOPAGO_ACCESS_TOKEN;
  
  // Acceso a la API de MercadoPago
  const mpClient = new MercadoPagoConfig({ 
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN 
  });

  try {
    // 1. Obtener el cuerpo como texto para validar firma
    const rawBody = await req.text();
    
    // 2. Obtener firma desde headers
    const receivedSignature = 
      req.headers.get('x-signature') ||
      req.headers.get('x-mp-signature') || '';
    
    // 3. Validar firma
    if (!await isValidSignature(rawBody, secret, receivedSignature)) {
      logSecurityEvent('invalid_webhook_signature', {}, 'error');
      return NextResponse.json({ error: 'Signature validation failed' }, { status: 401 });
    }

    // 4. Parsear el JSON después de validar
    const notification = JSON.parse(rawBody);
    
    logInfo(`🔔 Webhook válido recibido: tipo=${notification.type || notification.action}, data.id=${notification.data?.id || 'N/A'}`);

    // 5. Manejar diferentes tipos de notificaciones
    const eventType = notification.type || notification.action;
    
    switch(eventType) {
      case 'payment':
      case 'payment.created':
      case 'payment.updated':
        await handlePaymentNotification(notification, mpClient);
        break;
      case 'chargebacks':
        await handleChargebackNotification(notification, mpClient);
        break;
      case 'claim':
        await handleClaimNotification(notification, mpClient);
        break;
      default:
        logInfo(`ℹ️ Tipo de notificación no manejado: ${eventType}`);
    }

    // 6. Responder con éxito a MercadoPago
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    logError('❌ Error procesando webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// Maneja notificaciones de pago con IDEMPOTENCIA
async function handlePaymentNotification(notification, mpClient) {
  if (!notification.data?.id) {
    logWarn('⚠️ Notificación de pago sin ID');
    return;
  }

  const paymentId = notification.data.id;
  const paymentClient = new Payment(mpClient);
  
  try {
    logInfo(`🔍 Obteniendo detalles del pago ${paymentId} desde MercadoPago API...`);
    
    // Obtener detalles del pago desde la API de MercadoPago
    const paymentInfo = await paymentClient.get({ id: paymentId });
    const currentStatus = paymentInfo.status;
    const statusDetail = paymentInfo.status_detail;
    const externalReference = paymentInfo.external_reference;
    
    logInfo(`💰 Pago ${paymentId}: status=${currentStatus}, detail=${statusDetail}, external_ref=${externalReference}`);
    
    if (!externalReference) {
      logWarn(`⚠️ Pago ${paymentId} sin referencia externa para identificar la solicitud`);
      return;
    }
    
    // Buscar la solicitud de pago en la tabla payment_requests
    const { data: paymentRequestData, error: paymentRequestError } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('id', externalReference)
      .single();
    
    if (paymentRequestError || !paymentRequestData) {
      logError(`❌ No se encontró la solicitud de pago ${externalReference}:`, paymentRequestError);
      return;
    }

    const previousStatus = paymentRequestData.payment_status;
    logInfo(`📊 Estado anterior en BD: ${previousStatus} → Estado actual MP: ${currentStatus}`);

    // ✅ LÓGICA PRINCIPAL: Solo procesar si hay cambio de estado
    if (previousStatus === currentStatus) {
      logInfo(`✅ El pago ${paymentId} ya tiene el estado ${currentStatus} en BD. Ignorando duplicado.`);
      return;
    }

    // Actualizar el estado del pago en payment_requests
    const { error: updateError } = await supabase
      .from('payment_requests')
      .update({
        payment_status: currentStatus,
        payment_detail: statusDetail,
        updated_at: new Date()
      })
      .eq('id', externalReference);
      
    if (updateError) {
      logError(`❌ Error actualizando payment_request ${externalReference}:`, updateError);
      return;
    }

    logInfo(`✅ Payment request ${externalReference} actualizado: ${previousStatus} → ${currentStatus}`);
      
    // 🎯 ACCIONES ESPECÍFICAS SEGÚN EL NUEVO ESTADO
    if (currentStatus === 'approved' && previousStatus !== 'approved') {
      logInfo(`🎉 PAGO APROBADO: Ejecutando acciones post-aprobación para ${paymentId}`);
      
      try {
        // 1. Actualizar stock si hay items del pedido
        let orderItems = paymentRequestData.order_items;
        
        if (typeof orderItems === 'string') {
          try {
            orderItems = JSON.parse(orderItems);
          } catch (e) {
            logError('❌ Error parseando order_items:', e);
          }
        }
        
        if (Array.isArray(orderItems) && orderItems.length > 0) {
          await updateStockAfterOrder(orderItems);
          logInfo(`📦 Stock actualizado correctamente para pago ${paymentId}`);
        } else {
          logWarn(`⚠️ No se encontraron items para actualizar stock en pago ${paymentId}`);
        }

        // 2. Enviar email de confirmación
        await sendConfirmationEmailForApprovedPayment(paymentRequestData, paymentInfo);
        
        // 3. Crear orden definitiva (opcional)
        await createOrderFromPaymentRequest(paymentRequestData, paymentInfo);
        
      } catch (error) {
        logError(`❌ Error en acciones post-aprobación para pago ${paymentId}:`, error);
        // No bloquear el flujo principal por errores en acciones secundarias
      }
    } else if (currentStatus === 'rejected' && previousStatus !== 'rejected') {
      logInfo(`❌ PAGO RECHAZADO: ${paymentId} cambió a rechazado`);
      // Aquí podrías enviar un email de rechazo, liberar stock, etc.
    } else if (currentStatus === 'pending' && previousStatus !== 'pending') {
      logInfo(`⏳ PAGO PENDIENTE: ${paymentId} está en proceso`);
      // Acciones para pagos pendientes si las necesitas
    }
    
  } catch (error) {
    logError(`❌ Error procesando notificación de pago ${paymentId}:`, error);
  }
}

// Nueva función para enviar email de confirmación cuando se aprueba un pago
async function sendConfirmationEmailForApprovedPayment(paymentRequestData, paymentInfo) {
  try {
    logInfo(`📧 Enviando email de confirmación para pago aprobado: ${paymentInfo.id}`);
    
    const customerData = paymentRequestData.customer_data;
    const orderItems = typeof paymentRequestData.order_items === 'string' 
      ? JSON.parse(paymentRequestData.order_items) 
      : paymentRequestData.order_items;

    if (!customerData?.email) {
      logWarn(`⚠️ No se encontró email del cliente para pago ${paymentInfo.id}`);
      return;
    }

    // Generar PDF del recibo
    const receiptPDF = await generateReceiptPDF({
      paymentId: paymentInfo.id,
      amount: paymentRequestData.total_amount,
      items: orderItems,
      customer: customerData,
      paymentDate: new Date(),
      status: 'approved'
    });

    // Enviar email con el recibo
    const emailResult = await sendReceiptEmail({
      to: customerData.email,
      customerName: `${customerData.first_name || ''} ${customerData.last_name || ''}`.trim(),
      orderId: paymentRequestData.id,
      paymentId: paymentInfo.id,
      amount: paymentRequestData.total_amount,
      items: orderItems,
      pdfAttachment: receiptPDF
    });

    if (emailResult.success) {
      logInfo(`✅ Email de confirmación enviado exitosamente a ${customerData.email}`);
    } else {
      logError(`❌ Error enviando email de confirmación:`, emailResult.error);
    }

  } catch (error) {
    logError(`❌ Error en sendConfirmationEmailForApprovedPayment:`, error);
  }
}

// Nueva función para crear orden definitiva desde payment_request
async function createOrderFromPaymentRequest(paymentRequestData, paymentInfo) {
  try {
    logInfo(`📝 Creando orden definitiva para pago ${paymentInfo.id}`);
    
    const orderData = {
      id: `ORDER_${paymentRequestData.id}`,
      payment_id: paymentInfo.id,
      payment_request_id: paymentRequestData.id,
      customer_data: paymentRequestData.customer_data,
      order_items: paymentRequestData.order_items,
      total_amount: paymentRequestData.total_amount,
      payment_status: 'approved',
      payment_detail: paymentInfo.status_detail,
      created_at: new Date(),
      updated_at: new Date()
    };

    const { error } = await supabase
      .from('orders')
      .insert([orderData]);
      
    if (error) {
      logError(`❌ Error creando orden definitiva:`, error);
    } else {
      logInfo(`✅ Orden definitiva creada: ORDER_${paymentRequestData.id}`);
    }
    
  } catch (error) {
    logError(`❌ Error en createOrderFromPaymentRequest:`, error);
  }
}

// Maneja notificaciones de contracargos
async function handleChargebackNotification(notification, mpClient) {
  if (!notification.data?.id) return;
  
  const chargebackId = notification.data.id;
  logInfo(`💳 Procesando contracargo: ${chargebackId}`);
  
  try {
    const paymentId = notification.data.payment_id;
    
    if (paymentId) {
      // Buscar la orden por payment_id
      const { data: orderData } = await supabase
        .from('orders')
        .select('id')
        .eq('payment_id', paymentId)
        .single();
        
      if (orderData) {
        await supabase
          .from('orders')
          .update({
            payment_status: 'charged_back',
            payment_detail: `Contracargo: ${chargebackId}`,
            updated_at: new Date()
          })
          .eq('id', orderData.id);
          
        logInfo(`✅ Orden ${orderData.id} actualizada con contracargo`);
      }
    }
  } catch (error) {
    logError(`❌ Error procesando contracargo ${chargebackId}:`, error);
  }
}

// Maneja notificaciones de reclamos
async function handleClaimNotification(notification, mpClient) {
  if (!notification.data?.id) return;
  
  const claimId = notification.data.id;
  logInfo(`📋 Procesando reclamo: ${claimId}`);
  
  try {
    const paymentId = notification.data.payment_id;
    
    if (paymentId) {
      const { data: orderData } = await supabase
        .from('orders')
        .select('id')
        .eq('payment_id', paymentId)
        .single();
        
      if (orderData) {
        await supabase
          .from('orders')
          .update({
            payment_status: 'claimed',
            payment_detail: `Reclamo: ${claimId}`,
            updated_at: new Date()
          })
          .eq('id', orderData.id);
          
        logInfo(`✅ Orden ${orderData.id} actualizada con reclamo`);
      }
    }
  } catch (error) {
    logError(`❌ Error procesando reclamo ${claimId}:`, error);
  }
}