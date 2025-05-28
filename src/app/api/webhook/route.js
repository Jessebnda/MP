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
  logInfo('⚙️ Iniciando validación de firma webhook...');
  logInfo(`🔑 Usando clave secreta: ${secret ? `${secret.substring(0, 5)}...${secret.substring(secret.length-5)}` : 'NO CONFIGURADA'}`);
  
  // Mostrar todos los headers recibidos (útil para diagnóstico)
  const allHeaders = {};
  request.headers.forEach((value, key) => {
    allHeaders[key] = key.toLowerCase().includes('signature') ? `${value.substring(0, 8)}...` : value;
  });
  logInfo('📋 Headers recibidos:', allHeaders);

  try {
    // Buscar la firma en varios posibles headers que usa Mercado Pago
    const receivedSignature = request.headers.get('x-signature') || 
                            request.headers.get('x-webhook-signature') || 
                            request.headers.get('x-hmac-signature') ||
                            '';
    
    // Mostrar qué header de firma se encontró
    if (receivedSignature) {
      if (request.headers.get('x-signature')) {
        logInfo('✅ Firma encontrada en header: x-signature');
      } else if (request.headers.get('x-webhook-signature')) {
        logInfo('✅ Firma encontrada en header: x-webhook-signature');
      } else if (request.headers.get('x-hmac-signature')) {
        logInfo('✅ Firma encontrada en header: x-hmac-signature');
      }
    }
    
    // Si no hay firma, loguear y posiblemente permitir en desarrollo
    if (!receivedSignature) {
      logWarn('⚠️ No se encontró firma en el webhook request');
      logInfo(`🔧 Modo: ${process.env.NODE_ENV || 'no definido'}`);
      // En producción deberías rechazar, pero para tests podrías permitir
      return process.env.NODE_ENV === 'development';
    }
    
    // Obtener el cuerpo como texto para firmar
    const body = await request.text();
    logInfo(`📦 Cuerpo del webhook recibido (primeros 100 caracteres): ${body.substring(0, 100)}...`);
    
    // Calcular la firma esperada usando HMAC SHA-256
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(body);
    const calculatedSignature = hmac.digest('hex');
    
    // Mostrar información de ambas firmas para comparación
    logInfo(`🔏 Firma recibida (primeros/últimos 10 caracteres): ${receivedSignature.substring(0, 10)}...${receivedSignature.substring(receivedSignature.length-10)}`);
    logInfo(`🔏 Firma calculada (primeros/últimos 10 caracteres): ${calculatedSignature.substring(0, 10)}...${calculatedSignature.substring(calculatedSignature.length-10)}`);
    logInfo(`📏 Longitudes - Recibida: ${receivedSignature.length}, Calculada: ${calculatedSignature.length}`);
    
    try {
      // Usar constantes de tiempo para comparar (evitar timing attacks)
      const isValid = crypto.timingSafeEqual(
        Buffer.from(calculatedSignature, 'hex'),
        Buffer.from(receivedSignature, 'hex')
      );
      
      // Registrar el resultado
      const validationMsg = isValid ? '✅ Firma válida!' : '❌ Firma inválida';
      logInfo(validationMsg);
      logSecurityEvent(
        isValid ? 'webhook_signature_valid' : 'webhook_signature_invalid',
        { receivedSignature: receivedSignature.substring(0, 10) + '...' },
        isValid ? 'info' : 'warn'
      );
      
      return isValid;
    } catch (compareError) {
      logError('❌ Error al comparar firmas:', compareError);
      logSecurityEvent('webhook_signature_comparison_error', { error: compareError.message }, 'error');
      return false;
    }
  } catch (error) {
    logError('❌ Error general en validación de firma:', error);
    logSecurityEvent('webhook_signature_error', { error: error.message }, 'error');
    return false;
  }
}

function isSuccessfulPayment(status) {
  const normalizedStatus = (status || '').toLowerCase();
  return ['approved', 'success', 'succeeded', 'approved_payment'].includes(normalizedStatus);
}

export async function POST(req) {
  const requestId = `req_${Date.now().toString(36)}`;
  logInfo(`📥 [${requestId}] Webhook recibido desde MercadoPago`);
  
  // Mostrar URL configurada en las variables de entorno
  logInfo(`🌐 URL configurada: ${process.env.MERCADOPAGO_WEBHOOK_URL || 'No configurada'}`);
  
  // Mostrar origen de la solicitud
  const origin = req.headers.get('origin') || req.headers.get('referer') || 'Desconocido';
  logInfo(`🔄 Origen de la solicitud: ${origin}`);

  // Usar la WEBHOOK_KEY específica en lugar del access token
  const secret = process.env.MERCADOPAGO_WEBHOOK_KEY || process.env.MERCADOPAGO_ACCESS_TOKEN;
  logInfo(`🔐 Usando clave secreta: ${secret ? `${secret.substring(0, 5)}...` : 'NO CONFIGURADA'}`);
  
  if (!secret) {
    logError('❌ Error crítico: No hay clave secreta configurada para validar el webhook');
    return NextResponse.json({ error: 'Webhook configuration error' }, { status: 500 });
  }
  
  // Acceso a la API de MercadoPago
  const mpClient = new MercadoPagoConfig({ 
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN 
  });
  logInfo(`🔑 Cliente MercadoPago inicializado con accessToken ${process.env.MERCADOPAGO_ACCESS_TOKEN ? '(configurado)' : '(no configurado)'}`);

  // 1. Validar la firma del webhook ANTES de leer el JSON
  logInfo(`🔒 [${requestId}] Iniciando validación de firma...`);
  const reqClone = req.clone();
  const signatureIsValid = await isValidSignature(reqClone, secret);
  
  if (!signatureIsValid) {
    logError(`❌ [${requestId}] Validación de firma fallida`);
    logSecurityEvent('invalid_webhook_signature', { requestId }, 'error');
    return NextResponse.json({ error: 'Signature validation failed' }, { status: 401 });
  }
  
  logInfo(`✅ [${requestId}] Validación de firma exitosa`);

  try {
    // 2. Obtener el cuerpo de la notificación
    logInfo(`📂 [${requestId}] Leyendo cuerpo JSON del webhook...`);
    const notification = await req.json();
    
    logInfo(`📣 [${requestId}] Webhook procesado: tipo=${notification.type}, data.id=${notification.data?.id || 'N/A'}`);
    logInfo(`🔍 [${requestId}] Datos completos de notificación:`, notification);

    // 3. Manejar diferentes tipos de notificaciones
    logInfo(`⚙️ [${requestId}] Procesando notificación tipo: ${notification.type}`);
    switch(notification.type) {
      case 'payment':
        logInfo(`💰 [${requestId}] Procesando notificación de pago`);
        await handlePaymentNotification(notification, mpClient, requestId);
        break;
      case 'chargebacks':
        logInfo(`🔙 [${requestId}] Procesando notificación de contracargo`);
        await handleChargebackNotification(notification, mpClient, requestId);
        break;
      case 'claim':
        logInfo(`⚠️ [${requestId}] Procesando notificación de reclamo`);
        await handleClaimNotification(notification, mpClient, requestId);
        break;
      default:
        logInfo(`❓ [${requestId}] Tipo de notificación no manejado: ${notification.type}`);
    }

    // 4. Responder con éxito a MercadoPago
    logInfo(`✅ [${requestId}] Webhook procesado exitosamente, respondiendo con 200 OK`);
    return NextResponse.json({ received: true, requestId }, { status: 200 });

  } catch (error) {
    logError(`❌ [${requestId}] Error procesando webhook:`, error);
    return NextResponse.json({ 
      error: 'Webhook processing failed', 
      message: error.message,
      requestId 
    }, { status: 500 });
  }
}

// Maneja notificaciones de pago
async function handlePaymentNotification(notification, mpClient, requestId) {
  if (!notification.data?.id) {
    logWarn(`⚠️ [${requestId}] Notificación de pago sin ID`);
    return;
  }

  const paymentId = notification.data.id;
  logInfo(`💵 [${requestId}] Procesando pago ID: ${paymentId}`);
  const paymentClient = new Payment(mpClient);
  
  try {
    logInfo(`🔍 [${requestId}] Consultando API de MercadoPago para el pago ${paymentId}...`);
    
    // Obtener detalles del pago desde la API de MercadoPago
    const paymentInfo = await paymentClient.get({ id: paymentId });
    logInfo(`✅ [${requestId}] Datos recibidos del pago ${paymentId}: Estado=${paymentInfo.status}, Detalle=${paymentInfo.status_detail}`);
    logInfo(`📊 [${requestId}] Información completa del pago:`, {
      id: paymentInfo.id,
      status: paymentInfo.status,
      status_detail: paymentInfo.status_detail,
      external_reference: paymentInfo.external_reference,
      payment_method_id: paymentInfo.payment_method_id,
      payment_type_id: paymentInfo.payment_type_id,
      created_date: paymentInfo.date_created,
      amount: paymentInfo.transaction_amount
    });
    
    // Identificar la orden por payment_id o external_reference
    const externalReference = paymentInfo.external_reference;
    const orderId = externalReference || paymentInfo.metadata?.order_id;
    
    if (!orderId) {
      logWarn(`⚠️ [${requestId}] Pago ${paymentId} sin referencia externa para identificar la orden`);
      return;
    }
    
    logInfo(`🔍 [${requestId}] Buscando orden con ID: ${orderId} en Supabase`);
    
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
      logError(`❌ [${requestId}] No se encontró la orden ${orderId} para el pago ${paymentId}:`, orderError);
      return;
    }

    logInfo(`✅ [${requestId}] Orden ${orderId} encontrada en la base de datos`);
    logInfo(`📊 [${requestId}] Datos de la orden:`, {
      id: orderData.id,
      status: orderData.payment_status,
      customer: orderData.customer_id,
      created_at: orderData.created_at,
      items_count: orderData.items?.length || 0
    });

    // Registrar el estado anterior para logs
    const previousStatus = orderData.payment_status;
    logInfo(`ℹ️ [${requestId}] Estado anterior de la orden: ${previousStatus || 'sin estado'}`);
    logInfo(`🔄 [${requestId}] Actualizando orden ${orderId} con estado: ${paymentInfo.status}`);
    
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
      logError(`❌ [${requestId}] Error actualizando orden ${orderId}:`, updateError);
      return;
    }
    
    logInfo(`✅ [${requestId}] Orden ${orderId} actualizada correctamente en la base de datos`);
    
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
async function handleChargebackNotification(notification, mpClient, requestId) {
  if (!notification.data?.id) return;
  
  const chargebackId = notification.data.id;
  logInfo(`🔙 [${requestId}] Procesando contracargo: ${chargebackId}`);
  
  try {
    // Aquí implementarías la lógica específica para contracargos
    // Necesitarías usar mpClient.get para obtener los detalles del contracargo
    
    // Por ahora, solo registramos el evento
    logInfo(`📝 [${requestId}] Contracargo recibido: ${chargebackId}`);
    
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
async function handleClaimNotification(notification, mpClient, requestId) {
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
async function updateStockForItems(items, requestId) {
  logInfo(`📦 [${requestId}] Iniciando actualización de stock para ${items.length} items`);
  
  for (const item of items) {
    try {
      const { productId, quantity } = item;
      if (!productId || !quantity) {
        logWarn(`⚠️ [${requestId}] Item sin productId o quantity válidos`);
        continue;
      }
      
      logInfo(`🔍 [${requestId}] Verificando stock para producto ID: ${productId}`);
      
      // Obtener producto actual
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('stock_available')
        .eq('id', productId)
        .single();
        
      if (productError || !product) {
        logError(`❌ [${requestId}] Error al obtener producto ${productId}:`, productError);
        continue;
      }

      logInfo(`📊 [${requestId}] Stock actual del producto ${productId}: ${product.stock_available}`);
      
      // Calcular nuevo stock
      const newStock = Math.max(0, product.stock_available - quantity);
      logInfo(`🔄 [${requestId}] Actualizando stock de producto ${productId}: ${product.stock_available} -> ${newStock}`);
      
      // Actualizar stock
      const { error: updateError } = await supabase
        .from('products')
        .update({ 
          stock_available: newStock,
          updated_at: new Date()
        })
        .eq('id', productId);

      if (updateError) {
        logError(`❌ [${requestId}] Error al actualizar stock de producto ${productId}:`, updateError);
      } else {
        logInfo(`✅ [${requestId}] Stock actualizado para producto ${productId}: ${newStock}`);
      }
    } catch (error) {
      logError(`❌ [${requestId}] Error general actualizando stock:`, error);
    }
  }
  
  logInfo(`✅ [${requestId}] Proceso de actualización de stock completado`);
}