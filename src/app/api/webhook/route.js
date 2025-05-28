import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto';
import { logSecurityEvent } from '../../../lib/security-logger';
import { logInfo, logError, logWarn } from '../../../lib/logger';
import { createClient } from '@supabase/supabase-js';
import { generateReceiptPDF } from '../../../lib/pdfService';
import { sendReceiptEmail } from '../../../lib/emailService';
import { createOrder } from '../../../lib/orderService';
import { updateStockAfterOrder } from '../../../lib/productService'; // Cambiar la importación

// Inicializar el cliente de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Implementación de Validación de Firma ---
async function isValidSignature(request, secret) {
  try {
    // Obtener la firma del encabezado
    const receivedSignature = request.headers.get('x-signature') || '';
    
    // Obtener el cuerpo como texto para firmar
    const body = await request.text();
    
    // Calcular la firma esperada usando HMAC SHA-256
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(body);
    const calculatedSignature = hmac.digest('hex');
    
    // Usar constantes de tiempo para comparar (evitar timing attacks)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(calculatedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
    
    // Registrar el resultado
    logSecurityEvent(
      isValid ? 'webhook_signature_valid' : 'webhook_signature_invalid',
      { receivedSignature: receivedSignature.substring(0, 10) + '...' },
      isValid ? 'info' : 'warn'
    );
    
    return isValid;
  } catch (error) {
    logSecurityEvent('webhook_signature_error', { error: error.message }, 'error');
    return false;
  }
}

// Función auxiliar para verificar estados de éxito
function isSuccessfulPayment(status) {
  const normalizedStatus = (status || '').toLowerCase();
  return ['approved', 'success', 'succeeded', 'approved_payment'].includes(normalizedStatus);
}

export async function POST(req) {
  logInfo('Webhook recibido desde MercadoPago');

  // Usar la WEBHOOK_KEY específica en lugar del access token
  const secret = process.env.MERCADOPAGO_WEBHOOK_KEY || process.env.MERCADOPAGO_ACCESS_TOKEN;
  
  // Acceso a la API de MercadoPago
  const mpClient = new MercadoPagoConfig({ 
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN 
  });

  // 1. Validar la firma del webhook ANTES de leer el JSON
  const reqClone = req.clone();
  if (!await isValidSignature(reqClone, secret)) {
    logSecurityEvent('invalid_webhook_signature', {}, 'error');
    return NextResponse.json({ error: 'Signature validation failed' }, { status: 401 });
  }

  try {
    // 2. Obtener el cuerpo de la notificación
    const notification = await req.json();
    
    logInfo(`Webhook recibido: tipo=${notification.type}, data.id=${notification.data?.id || 'N/A'}`);

    // 3. Manejar diferentes tipos de notificaciones
    switch(notification.type) {
      case 'payment':
        await handlePaymentNotification(notification, mpClient);
        break;
      case 'chargebacks':
        await handleChargebackNotification(notification, mpClient);
        break;
      case 'claim':
        await handleClaimNotification(notification, mpClient);
        break;
      default:
        logInfo(`Tipo de notificación no manejado: ${notification.type}`);
    }

    // 4. Responder con éxito a MercadoPago
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    logError('Error procesando webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// Maneja notificaciones de pago
async function handlePaymentNotification(notification, mpClient) {
  if (!notification.data?.id) {
    logWarn('Notificación de pago sin ID');
    return;
  }

  const paymentId = notification.data.id;
  const paymentClient = new Payment(mpClient);
  
  try {
    // Obtener detalles del pago desde la API de MercadoPago
    const paymentInfo = await paymentClient.get({ id: paymentId });
    logInfo(`Pago ${paymentId}: ${paymentInfo.status} (${paymentInfo.status_detail})`);
    
    // Identificar la solicitud de pago por external_reference (idempotencyKey)
    const externalReference = paymentInfo.external_reference;
    
    if (!externalReference) {
      logWarn(`Pago ${paymentId} sin referencia externa para identificar la solicitud`);
      return;
    }
    
    // Buscar la solicitud de pago en la tabla payment_requests
    const { data: paymentRequestData, error: paymentRequestError } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('id', externalReference)
      .single();
    
    if (paymentRequestError || !paymentRequestData) {
      logError(`No se encontró la solicitud de pago ${externalReference}:`, paymentRequestError);
      return;
    }

    // Actualizar el estado del pago en payment_requests
    await supabase
      .from('payment_requests')
      .update({
        payment_status: paymentInfo.status,
        payment_detail: paymentInfo.status_detail,
        updated_at: new Date()
      })
      .eq('id', externalReference);
      
    // Si el pago fue aprobado, actualizar el stock
    if (paymentInfo.status === 'approved') {
      try {
        // Obtener los items del pedido
        let orderItems = paymentRequestData.order_items;
        
        // Asegurarnos de que orderItems es un array
        if (typeof orderItems === 'string') {
          try {
            orderItems = JSON.parse(orderItems);
          } catch (e) {
            logError('Error parseando order_items:', e);
          }
        }
        
        if (Array.isArray(orderItems) && orderItems.length > 0) {
          // Actualizar el stock en la base de datos
          await updateStockAfterOrder(orderItems);
          logInfo(`✅ Stock actualizado correctamente para pago ${paymentId}`);
        } else {
          logError(`No se encontraron items para actualizar stock en pago ${paymentId}`);
        }
      } catch (error) {
        logError(`Error actualizando stock para pago ${paymentId}:`, error);
      }
    }

    // REMOVIDO: La lógica de envío de emails ya no va aquí
    // Los emails se envían desde process-payment inmediatamente
    
  } catch (error) {
    logError(`Error procesando notificación de pago ${paymentId}:`, error);
  }
}

// Maneja notificaciones de contracargos
async function handleChargebackNotification(notification, mpClient) {
  if (!notification.data?.id) return;
  
  const chargebackId = notification.data.id;
  logInfo(`Procesando contracargo: ${chargebackId}`);
  
  try {
    // Aquí implementarías la lógica específica para contracargos
    // Necesitarías usar mpClient.get para obtener los detalles del contracargo
    
    // Por ahora, solo registramos el evento
    logInfo(`Contracargo recibido: ${chargebackId}`);
    
    // Actualiza la orden relacionada con un estado especial de contracargo
    // Primero necesitas identificar qué pago está relacionado con este contracargo
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
          
        logInfo(`Orden ${orderData.id} actualizada con contracargo`);
      }
    }
  } catch (error) {
    logError(`Error procesando contracargo ${chargebackId}:`, error);
  }
}

// Maneja notificaciones de reclamos
async function handleClaimNotification(notification, mpClient) {
  if (!notification.data?.id) return;
  
  const claimId = notification.data.id;
  logInfo(`Procesando reclamo: ${claimId}`);
  
  try {
    // Código para obtener los detalles del reclamo desde MercadoPago
    
    // Por ahora, solo registramos el evento
    logInfo(`Reclamo recibido: ${claimId}`);
    
    // Similar al contracargo, necesitas identificar la orden y actualizarla
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
            payment_status: 'claimed',
            payment_detail: `Reclamo: ${claimId}`,
            updated_at: new Date()
          })
          .eq('id', orderData.id);
          
        logInfo(`Orden ${orderData.id} actualizada con reclamo`);
      }
    }
  } catch (error) {
    logError(`Error procesando reclamo ${claimId}:`, error);
  }
}

// Función auxiliar para actualizar stock
async function updateStockForItems(items) {
  for (const item of items) {
    try {
      const { productId, quantity } = item;
      if (!productId || !quantity) continue;
      
      // Obtener producto actual
      const { data: product } = await supabase
        .from('products')
        .select('stock_available')
        .eq('id', productId)
        .single();
        
      if (!product) continue;
      
      // Calcular nuevo stock
      const newStock = Math.max(0, product.stock_available - quantity);
      
      // Actualizar stock
      await supabase
        .from('products')
        .update({ 
          stock_available: newStock,
          updated_at: new Date()
        })
        .eq('id', productId);
        
      logInfo(`Stock actualizado para producto ${productId}: ${newStock}`);
    } catch (error) {
      logError('Error actualizando stock:', error);
    }
  }
}

// Recuperar los datos del payment_request y crear la orden definitiva