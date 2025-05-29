import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import { logInfo, logError, logWarn } from '../../../utils/logger';
import { logSecurityEvent } from '../../../lib/security-logger';
import { sanitizeInput } from '../../../utils/security';
import { generateReceiptPDF } from '../../../lib/pdfService';
import { sendReceiptEmail } from '../../../lib/emailService';
import { v4 as uuidv4 } from 'uuid';
import { getProductById, verifyStockForOrder, updateStockAfterOrder } from '../../../lib/productService';
import { validatePaymentRequestBody, extractPaymentInstrumentData } from '../../../lib/validation';

// Inicializar el cliente de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Agregar esta verificación después de inicializar el cliente de Supabase
if (!supabaseUrl || !supabaseKey) {
  logError('Variables de entorno de Supabase no encontradas:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey
  });
}

// Crear cliente con la sintaxis de la nueva versión
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

// Verificar importaciones críticas
logInfo('🔧 Verificando importaciones críticas:', {
  hasGenerateReceiptPDF: typeof generateReceiptPDF === 'function',
  hasSendReceiptEmail: typeof sendReceiptEmail === 'function',
  hasUpdateStockAfterOrder: typeof updateStockAfterOrder === 'function',
  hasVerifyStockForOrder: typeof verifyStockForOrder === 'function'
});

// NUEVO: Test directo del logger
console.log('🧪 CONSOLE TEST: Logger test al iniciar el archivo');
logInfo('🧪 LOGGER TEST: Logger test al iniciar el archivo');
console.log('🧪 CONSOLE TEST: Nivel de log actual:', process.env.NEXT_PUBLIC_LOG_LEVEL);

async function processMercadoPagoPayment({
  transaction_amount,
  token,
  payment_method_id,
  issuer_id,
  installments,
  payerEmail,
  payerData,
  orderItems,
  isMultipleOrder,
  idempotencyKey
}) {
  try {
    // Log for debugging
    logInfo('Processing payment with data:', { 
      amount: transaction_amount,
      payment_method: payment_method_id,
      items_count: orderItems.length,
      idempotencyKey
    });
    
    // 1. NUNCA confíes en los precios del frontend
    const preferenceItems = await Promise.all(orderItems.map(async item => {
      // Obtener siempre el precio real desde el backend
      const dbProduct = await getProductById(item.productId || item.id);
      if (!dbProduct) {
        throw new Error(`Producto no encontrado: ${item.productId || item.id}`);
      }
      
      return {
        id: item.productId || item.id,
        title: dbProduct.name || 'Producto',
        description: dbProduct.description || '',
        quantity: parseInt(item.quantity),
        unit_price: parseFloat(dbProduct.price), // ✅ Usar SIEMPRE precio de BD
        currency_id: "MXN"
      };
    }));

    // Create payment items format for additional_info
    const paymentItems = preferenceItems.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description || '',
      quantity: item.quantity,
      unit_price: item.unit_price
    }));
    
    // 2. SIEMPRE calcula el total en el backend
    const calculatedAmount = preferenceItems.reduce((total, item) => 
      total + (item.unit_price * item.quantity), 0);

    // 3. NUNCA confíes en el monto total enviado por el cliente
    let finalAmount = calculatedAmount; // ✅ Usar SOLO el monto calculado
    
    // Format phone for BOTH preference and payment
    let phoneFormatted;
    if (payerData?.phone) {
      phoneFormatted = typeof payerData.phone === 'string' ? 
        {
          area_code: payerData.phone.startsWith('+') ? payerData.phone.substring(1, 3) : '52',
          number: payerData.phone.startsWith('+') ? payerData.phone.substring(3) : payerData.phone
        } : 
        payerData.phone;
    }
    
    // Crear el cliente de preferencias
    const preferenceClient = new Preference(client);
    
    // Crear preferencia con el cliente usando preferenceItems
    const preferenceResponse = await preferenceClient.create({
      body: {
        items: preferenceItems,  // Versión con currency_id
        payer: {
          email: payerEmail,
          name: payerData?.first_name || '',
          surname: payerData?.last_name || '',
          identification: payerData?.identification || {},
          phone: phoneFormatted,  // Ahora está correctamente definida
          address: payerData?.address ? {
            street_name: payerData.address.street_name || '',
            street_number: payerData.address.street_number ? String(payerData.address.street_number) : '',
            zip_code: payerData.address.zip_code || ''
          } : {}
        },
        shipments: payerData?.address ? {
          mode: "custom",
          cost: 0, // O el costo real de envío si lo cobras
          local_pickup: false,
          receiver_address: {
            zip_code: payerData.address.zip_code || '',
            street_name: payerData.address.street_name || '',
            street_number: payerData.address.street_number ? String(payerData.address.street_number) : '',
            city_name: payerData.address.city || '',
            state_name: payerData.address.state || '',
            country_name: payerData.address.country || 'México'
          }
        } : undefined,
        back_urls: {
          success: payerData?.successUrl || "https://alturadivina.com/confirmacion-de-compra",
          failure: payerData?.failureUrl || "https://alturadivina.com/error-de-compra",
          pending: payerData?.pendingUrl || "https://alturadivina.com/proceso-de-compra"
        },
        auto_return: "approved",
        external_reference: idempotencyKey,
        metadata: {
          isMultipleOrder: isMultipleOrder
        }
      },
      requestOptions: {
        idempotencyKey: idempotencyKey  // Add idempotency key to the request
      }
    });

    // Log preference response for debugging
    logInfo(`Preference created successfully with ID: ${preferenceResponse.id}`);

    // Crear el cliente de pagos
    const paymentClient = new Payment(client);
    
    // Crear pago con el cliente usando paymentItems y vinculándolo a la preferencia
    const paymentResponse = await paymentClient.create({
      body: {
        token: token,
        description: isMultipleOrder 
          ? `Pedido de ${orderItems.length} productos` 
          : `${orderItems[0].name || 'Producto'}`,
        transaction_amount: finalAmount,
        installments: parseInt(installments),
        payment_method_id: payment_method_id,
        issuer_id: issuer_id,
        payer: {
          email: payerEmail,
          identification: payerData?.identification || {}
        },
        additional_info: {
          items: paymentItems,
          payer: {
            first_name: payerData?.first_name,
            last_name: payerData?.last_name,
            phone: phoneFormatted  // Usar la misma variable formateada para consistencia
          },
          shipments: payerData?.address ? {
            receiver_address: {
              zip_code: payerData.address.zip_code || '',
              street_name: payerData.address.street_name || '',
              street_number: payerData.address.street_number || ''
            }
          } : undefined
        },
        metadata: {
          preference_id: preferenceResponse.id,
          external_reference: idempotencyKey
        }
      },
      requestOptions: {
        idempotencyKey: idempotencyKey  // Add idempotency key to prevent duplicate transactions
      }
    });

    // Return all the data the frontend might need
    return {
      status: paymentResponse.status,
      status_detail: paymentResponse.status_detail,
      id: paymentResponse.id,
      preference_id: preferenceResponse.id,
      init_point: preferenceResponse.init_point,
      external_reference: idempotencyKey,
      amount: finalAmount,
      original_amount: transaction_amount || calculatedAmount
    };
  } catch (error) {
    logError('Error en processMercadoPagoPayment:', error);
    throw error;
  }
}

export async function POST(req) {
  const idempotencyKey = req.headers.get('X-Idempotency-Key') || uuidv4();
  
  try {
    // Add additional security headers check
    const requestId = req.headers.get('X-Request-ID') || 'no-id';
    const clientFingerprint = req.headers.get('X-Client-Fingerprint') || 'no-fingerprint';
    
    // Log security-relevant information with the idempotency key
    logInfo(`Payment request initiated: ${idempotencyKey}`, {
      requestId,
      fingerprint: clientFingerprint.substring(0, 10) + '...' // Log only partial fingerprint for privacy
    });
    
    // Your existing origin validation
    const origin = req.headers.get('Origin');
    const referer = req.headers.get('Referer');
    
    // Add requestId to trusted checks log
    logInfo(`Request security check: origin=${origin || 'none'}, referer=${referer || 'none'}, requestId=${requestId}`, { idempotencyKey });

    // Resto del código...
    logInfo(`Process-payment request received. IdempotencyKey: ${idempotencyKey}`);

    try {
      // Always bypass CSRF for critical payment processing
      logInfo("Bypassing CSRF validation for process-payment endpoint");

      const body = await req.json();
      logInfo("Request body en /api/process-payment:", { body, idempotencyKey }); // Incluir idempotencyKey en logs

      const { data: validatedData, error: validationError } = validatePaymentRequestBody(body);
      if (validationError) {
        logError("Error de validación en process-payment:", { error: validationError, idempotencyKey });
        return NextResponse.json({ error: validationError, idempotencyKey }, { status: 400 });
      }

      const { 
        formData, 
        isMultipleOrder, 
        orderSummary, 
        productId: singleProductId, 
        quantity: singleProductQuantity,
        userData 
      } = validatedData;

      // Declare totalAmount separately with let so it can be modified later
      let totalAmount = validatedData.totalAmount;

      const { 
        token, 
        paymentMethodId, 
        issuerId, 
        installments, 
        payerEmail, 
        error: paymentInstrumentError 
      } = extractPaymentInstrumentData(formData);

      if (paymentInstrumentError) {
        logError("Error extrayendo datos del instrumento de pago:", { error: paymentInstrumentError, idempotencyKey });
        return NextResponse.json({ error: `Datos de pago incompletos: ${paymentInstrumentError}`, idempotencyKey }, { status: 400 });
      }

      let itemsForPayment = [];
      let secureTotal = 0;

      if (isMultipleOrder) {
        // Construir array con datos seguros (solo IDs y cantidades del frontend)
        const secureOrderItems = await Promise.all(orderSummary.map(async item => {
          const dbProduct = await getProductById(item.productId);
          if (!dbProduct) {
            throw new Error(`Producto no encontrado: ${item.productId}`);
          }
          
          // Modificar esta validación para mostrar un mensaje más claro
          if (dbProduct.stock_available < item.quantity) {
            // Mensaje de error más específico
            const errorMessage = `Stock insuficiente para ${dbProduct.name}. Disponible: ${dbProduct.stock_available}, solicitado: ${item.quantity}`;
            logError(errorMessage);
            throw new Error(errorMessage);
          }
          
          // Calcular de manera segura
          secureTotal += parseFloat(dbProduct.price) * parseInt(item.quantity);
          
          return {
            ...dbProduct,
            productId: item.productId,
            quantity: parseInt(item.quantity)
          };
        }));
        
        itemsForPayment = secureOrderItems;
        
        // ✅ Comparar con el total enviado para detectar manipulación
        if (Math.abs(secureTotal - parseFloat(totalAmount)) > 0.01) {
          logSecurityEvent('total_price_mismatch', {
            frontend_total: totalAmount,
            calculated_total: secureTotal,
            idempotencyKey
          });
          // Podrías rechazar o continuar con el precio correcto
          totalAmount = secureTotal; // Usar siempre el cálculo del servidor
        }
      } else {
        // Procesar pedidos simples de manera similar
      }

      // ✅ 1. Verificar stock ANTES de hablar con MP
      try {
        if (orderSummary && orderSummary.length > 0) {
          await verifyStockForOrder(orderSummary);
        }
      } catch (err) {
        logInfo('stock_insufficient', { message: err.message, idempotencyKey });
        return NextResponse.json(
          { code: 'stock_insufficient', message: err.message, idempotencyKey },
          { status: 409 }
        );
      }

      const paymentResponse = await processMercadoPagoPayment({
        transaction_amount: totalAmount,
        token,
        payment_method_id: paymentMethodId,
        issuer_id: issuerId,
        installments,
        payerEmail: userData?.email || payerEmail,
        payerData: userData,
        orderItems: itemsForPayment,
        isMultipleOrder,
        idempotencyKey,
      });

      // NUEVO: Console.log directo que SIEMPRE aparece
      console.log(`🔍 CONSOLE DEBUG [${idempotencyKey}] Payment response:`, {
        status: paymentResponse.status,
        id: paymentResponse.id,
        status_detail: paymentResponse.status_detail
      });

      // NUEVO: Log inmediato del payment response (el que ya tienes)
      logInfo(`🔍 [${idempotencyKey}] Payment response recibido:`, {
        status: paymentResponse.status,
        id: paymentResponse.id,
        status_detail: paymentResponse.status_detail
      });

      // ✅ 2. NUEVO: Si MP aprobó, actualizar stock YA (UBICACIÓN CORRECTA)
      if (paymentResponse.status === 'approved') {
        try {
          await updateStockAfterOrder(itemsForPayment || orderSummary);
          logInfo(`✅ [${idempotencyKey}] Stock actualizado correctamente`);
        } catch (stockError) {
          logError(`❌ [${idempotencyKey}] Error actualizando stock:`, stockError);
          // No bloquear el flujo por errores de stock
        }
      }

      // En la línea 365 (diagnóstico pre-email):
      logInfo(`🔍 [${idempotencyKey}] Diagnóstico pre-email:`, {
        hasPaymentId: !!paymentResponse.id,
        paymentStatus: paymentResponse.status,
        condition1: !!paymentResponse.id,
        condition2: paymentResponse.status === 'approved',
        condition3: paymentResponse.status === 'in_process',
        overallCondition: paymentResponse.id && (paymentResponse.status === 'approved' || paymentResponse.status === 'in_process')
      });
      
      // NUEVO: Console.log directo
      console.log(`🔍 CONSOLE DEBUG [${idempotencyKey}] Diagnóstico pre-email:`, {
        hasPaymentId: !!paymentResponse.id,
        paymentStatus: paymentResponse.status,
        overallCondition: paymentResponse.id && (paymentResponse.status === 'approved' || paymentResponse.status === 'in_process')
      });
      
      if (paymentResponse.id && (paymentResponse.status === 'approved' || paymentResponse.status === 'in_process')) {
        console.log(`🟢 CONSOLE DEBUG [${idempotencyKey}] ENTRANDO al bloque principal`);
        
        logInfo(`🟢 [${idempotencyKey}] ENTRANDO al bloque principal de payment request`);
        
        // Almacenar la información del pago en payment_requests
        const paymentRequestData = {
          id: idempotencyKey,
          payment_id: paymentResponse.id,
          customer_data: userData,
          order_items: itemsForPayment,
          total_amount: totalAmount,
          payment_status: paymentResponse.status,
          payment_detail: paymentResponse.status_detail,
          created_at: new Date(),
          updated_at: new Date(),
        };

        await supabase
          .from('payment_requests')
          .insert([paymentRequestData]);

        logInfo(`✅ Payment request creado: ${idempotencyKey}`);

        // 🚀 NUEVO: Enviar emails inmediatamente después de crear el payment request
        logInfo(`🔵 [${idempotencyKey}] CHECKPOINT: Llegué al bloque de emails`);
        logInfo(`🔵 [${idempotencyKey}] Payment status: ${paymentResponse.status}`);
        logInfo(`🔵 [${idempotencyKey}] Payment ID exists: ${!!paymentResponse.id}`);

        try {
          console.log(`📧 CONSOLE DEBUG [${idempotencyKey}] Iniciando emails...`);
          logInfo(`📧 [${idempotencyKey}] Iniciando proceso de envío de emails para payment request`);
          
          // Verificar que todas las dependencias están disponibles
          logInfo(`🔧 [${idempotencyKey}] Verificando dependencias de email:`, {
            hasGenerateReceiptPDF: typeof generateReceiptPDF === 'function',
            hasSendReceiptEmail: typeof sendReceiptEmail === 'function',
            userData: !!userData,
            userDataEmail: userData?.email,
            itemsForPayment: itemsForPayment?.length || 0
          });
          
          // Preparar datos para el email en el formato esperado
          const orderDataForEmail = {
            userData: userData,
            items: itemsForPayment.map(item => ({
              name: item.name || `Producto #${item.product_id}`,
              quantity: item.quantity,
              price: item.price,
              product_id: item.product_id
            })),
            total_amount: totalAmount,
            payment_id: paymentResponse.id,
            payment_status: paymentResponse.status
          };

          logInfo(`📋 Datos preparados para email:`, {
            customerEmail: userData.email,
            orderId: idempotencyKey,
            isApproved: paymentResponse.status === 'approved',
            itemsCount: orderDataForEmail.items.length
          });

          // Generar PDF del recibo
          logInfo(`📄 [${idempotencyKey}] INICIANDO generación de PDF...`);
          logInfo(`📄 [${idempotencyKey}] Datos para PDF:`, {
            orderId: idempotencyKey,
            hasCustomerData: !!userData,
            itemsCount: orderDataForEmail.items?.length || 0,
            totalAmount: totalAmount
          });

          const pdfBuffer = await generateReceiptPDF({
            orderId: idempotencyKey,
            customerData: userData,
            items: orderDataForEmail.items,
            totalAmount: totalAmount,
            paymentStatus: paymentResponse.status,
            paymentId: paymentResponse.id
          });

          logInfo(`✅ [${idempotencyKey}] PDF generado exitosamente, tamaño: ${pdfBuffer.length} bytes`);

          // Enviar emails
          logInfo(`📤 Enviando emails para orden: ${idempotencyKey}`);
          const emailResult = await sendReceiptEmail({
            pdfBuffer,
            customerEmail: userData.email,
            orderId: idempotencyKey,
            isApproved: paymentResponse.status === 'approved',
            orderData: orderDataForEmail
          });

          if (emailResult.success) {
            logInfo(`✅ Emails enviados exitosamente para orden: ${idempotencyKey}`);
          } else {
            logError(`❌ Error enviando emails para orden: ${idempotencyKey}`, emailResult.error);
          }

        } catch (emailError) {
          // No bloquear el flujo de pago por errores de email
          console.error(`❌ CONSOLE DEBUG [${idempotencyKey}] Error en emails:`, emailError.message);
          logError(`❌ Error en proceso de emails para payment request ${idempotencyKey}:`, {
            error: emailError.message,
            stack: emailError.stack
          });
        }

        // En línea 404 aproximadamente, donde se usa userMessage sin definir:
        const userMessage = paymentResponse.status === 'approved'
          ? 'Pago procesado correctamente.'
          : `El estado del pago es: ${paymentResponse.status}. Detalle: ${paymentResponse.status_detail || 'N/A'}.`;

        // Devolver la respuesta sin crear la orden
        return NextResponse.json({
          status: paymentResponse.status,
          status_detail: paymentResponse.status_detail,
          id: paymentResponse.id,
          message: userMessage,
          idempotencyKey,
        }, { status: 200 });
      }

      logSecurityEvent('payment_non_approved', {
        id: paymentResponse.id,
        status: paymentResponse.status,
        status_detail: paymentResponse.status_detail,
        amount: totalAmount,
        idempotencyKey,
        mp_response: paymentResponse 
      }, 'warn');
      
      const userMessage = paymentResponse.status === 'rejected' 
        ? `El pago fue rechazado. Motivo: ${paymentResponse.status_detail || 'Desconocido'}. Por favor, intente con otro medio de pago o verifique sus datos.`
        : `El estado del pago es: ${paymentResponse.status}. Detalle: ${paymentResponse.status_detail || 'N/A'}.`;

      return NextResponse.json({
        status: paymentResponse.status,
        id: paymentResponse.id,
        error: userMessage,
        paymentDetails: paymentResponse.status_detail,
        message: userMessage,
        idempotencyKey, // Incluir en respuesta
      }, { status: paymentResponse.status === 'rejected' ? 400 : 200 });
    } catch (error) {
      logError("Error general en POST /api/process-payment:", { 
        message: error.message, 
        stack: error.stack, // Incluir stack para debugging
        idempotencyKey,
        isCsrfError: error.isCsrfError,
        errorObject: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });
      
      if (error.isCsrfError) {
        return NextResponse.json({ error: error.message, idempotencyKey }, { status: 403 });
      }
      
      if (error.message && error.message.startsWith('Stock insuficiente')) {
        return NextResponse.json({ error: error.message, idempotencyKey }, { status: 400 });
      }
      
      if (error.message && error.message.startsWith('Error de MercadoPago:')) {
        return NextResponse.json({ 
          error: `Error con el proveedor de pagos: ${error.message.replace('Error de MercadoPago: ', '')}`, 
          idempotencyKey,
          details: error.cause || error.data // Incluir detalles adicionales
        }, { status: 502 });
      }

      // In the catch block around line 265, add specific MP error detection
      if (error.message && (
          error.message.includes('card payment requires a higher amount') || 
          error.message.includes('minimum amount required'))) {
        return NextResponse.json({ 
          error: `El monto mínimo para pagos con tarjeta es de 100 MXN. Por favor aumente el monto de su compra.`, 
          idempotencyKey,
          details: error.cause || error.data,
          code: 'AMOUNT_TOO_LOW'
        }, { status: 400 });
      }
      
      // Error genérico con información para debug
      return NextResponse.json({ 
        error: 'Error interno del servidor al procesar el pago. Intente más tarde.', 
        idempotencyKey,
        debugInfo: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, { status: 500 });
    }
  } catch (error) {
    logError('Error en el manejo de la solicitud:', error);
    return NextResponse.json({ error: 'Error interno del servidor', idempotencyKey }, { status: 500 });
  }
}