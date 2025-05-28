import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto';
import { logSecurityEvent } from '../../../lib/security-logger';
import { logInfo, logError, logWarn } from '../../../lib/logger';
import { createClient } from '@supabase/supabase-js';
import { generateReceiptPDF } from '../../../lib/pdfService';
import { sendReceiptEmail } from '../../../lib/emailService';

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
    
    // Identificar la orden por payment_id o external_reference
    const externalReference = paymentInfo.external_reference;
    const orderId = externalReference || paymentInfo.metadata?.order_id;
    
    if (!orderId) {
      logWarn(`Pago ${paymentId} sin referencia externa para identificar la orden`);
      return;
    }
    
    // Buscar la orden en Supabase - Modificar para incluir la información completa
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*)
      `)
      .eq('id', orderId)
      .single();
      
    if (orderError || !orderData) {
      logError(`No se encontró la orden ${orderId} para el pago ${paymentId}:`, orderError);
      return;
    }

    // Registrar el estado anterior para logs
    const previousStatus = orderData.payment_status;
    
    // Actualizar el estado del pago en Supabase
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: paymentInfo.status,
        payment_detail: paymentInfo.status_detail,
        payment_id: paymentId,
        updated_at: new Date()
      })
      .eq('id', orderId);
      
    if (updateError) {
      logError(`Error actualizando orden ${orderId}:`, updateError);
      return;
    }
    
    // Logs específicos para cambios de estado
    if (previousStatus !== paymentInfo.status) {
      logInfo(`Orden ${orderId}: Estado cambiado de ${previousStatus || 'sin estado'} a ${paymentInfo.status}`);
      
      // Acciones adicionales para cambios específicos de estado
      if (isSuccessfulPayment(paymentInfo.status)) {
        logInfo(`🎉 Pago aprobado para orden ${orderId}`);
        
        // Actualizar stock si es necesario
        if (orderData.items && Array.isArray(orderData.items)) {
          await updateStockForItems(orderData.items);
        }
        
        // NUEVO: Generar y enviar recibo PDF
        try {
          // Obtener datos completos del cliente
          const { data: customerData } = await supabase
            .from('customers')
            .select('*')
            .eq('email', orderData.customer_id)
            .single();
            
          if (customerData) {
            try {
              // Generar PDF
              const pdfBuffer = await generateReceiptPDF(orderData, customerData);
              
              // Enviar email con recibo - con manejo mejorado de errores
              const emailResult = await sendReceiptEmail({
                pdfBuffer,
                customerEmail: customerData.email,
                orderId: orderId,
                isApproved: isSuccessfulPayment(paymentInfo.status),
                orderData: {
                  ...orderData,
                  userData: customerData
                }
              });
              
              if (emailResult.success) {
                logInfo(`✉️ Recibo enviado por email para la orden ${orderId}`);
              } else {
                logWarn(`⚠️ Problema al enviar email para orden ${orderId}: ${emailResult.error}`);
              }
            } catch (pdfError) {
              logError(`Error generando PDF para orden ${orderId}:`, pdfError);
              // No detener el flujo por un error en la generación del PDF o envío de email
            }
          } else {
            logWarn(`No se encontraron datos del cliente para la orden ${orderId}`);
          }
        } catch (dataError) {
          logError(`Error obteniendo datos del cliente para orden ${orderId}:`, dataError);
          // No detener el flujo principal por problemas con la parte de emails
        }
      }
      
      // También podemos enviar recibo cuando el estado es pendiente, pero con mensaje diferente
      else if (paymentInfo.status === 'pending' || paymentInfo.status === 'in_process') {
        try {
          // Obtener datos completos del cliente
          const { data: customerData } = await supabase
            .from('customers')
            .select('*')
            .eq('email', orderData.customer_id)
            .single();
            
          if (customerData) {
            // Generar PDF
            const pdfBuffer = await generateReceiptPDF(orderData, customerData);
            
            // Enviar email con recibo (indicando que está pendiente)
            await sendReceiptEmail({
              pdfBuffer,
              customerEmail: customerData.email,
              orderId: orderId,
              isApproved: false, // Especificar que NO está aprobado
              orderData: {
                ...orderData,
                userData: customerData
              }
            });
            
            logInfo(`✉️ Recibo de pedido pendiente enviado por email para la orden ${orderId}`);
          }
        } catch (emailError) {
          logError(`Error enviando recibo por email para orden pendiente ${orderId}:`, emailError);
        }
      }
    }
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