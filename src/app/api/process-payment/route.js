import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError, logSecurityEvent } from '../../../utils/logger';
import { validateCsrfToken } from '../../../utils/csrf';
import { extractPaymentInstrumentData, validatePaymentRequestBody } from '../../../utils/requestHelper';
import { getProductById, verifyStockForOrder, updateStockAfterOrder } from './services/stockService';
import { processMercadoPagoPayment } from './services/mercadoPagoApiService';

export async function POST(req) {
  const idempotencyKey = uuidv4(); // Generar clave de idempotencia
  logInfo(`Process-payment request received. IdempotencyKey: ${idempotencyKey}`);

  try {
    await validateCsrfToken(req);

    const body = await req.json();
    logInfo("Request body en /api/process-payment:", { body, idempotencyKey }); // Incluir idempotencyKey en logs

    const { data: validatedData, error: validationError } = validatePaymentRequestBody(body);
    if (validationError) {
      logError("Error de validación en process-payment:", { error: validationError, idempotencyKey });
      return NextResponse.json({ error: validationError, idempotencyKey }, { status: 400 });
    }

    const { 
      formData, 
      totalAmount, 
      isMultipleOrder, 
      orderSummary, 
      productId: singleProductId, 
      quantity: singleProductQuantity,
      userData 
    } = validatedData;

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
    if (isMultipleOrder) {
      itemsForPayment = orderSummary;
      await verifyStockForOrder(orderSummary);
      logInfo(`Procesando pedido múltiple. Monto: ${totalAmount}`, { idempotencyKey });
    } else {
      const product = await getProductById(singleProductId);
      if (!product) {
        logError(`Producto no encontrado: ${singleProductId}`, { idempotencyKey });
        return NextResponse.json({ error: `Producto no encontrado: ${singleProductId}`, idempotencyKey }, { status: 404 });
      }
      itemsForPayment = [{ ...product, productId: singleProductId, quantity: singleProductQuantity }];
      await verifyStockForOrder(itemsForPayment);
      logInfo(`Procesando pedido simple. Producto: ${singleProductId}, Cant: ${singleProductQuantity}, Monto: ${totalAmount}`, { idempotencyKey });
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
      idempotencyKey, // Pasar la clave de idempotencia
    });

    if (paymentResponse.id && (paymentResponse.status === 'approved' || paymentResponse.status === 'authorized')) {
      logSecurityEvent('payment_success', {
        id: paymentResponse.id,
        amount: totalAmount,
        status: paymentResponse.status,
        idempotencyKey,
      });
      await updateStockAfterOrder(itemsForPayment);
      
      return NextResponse.json({
        status: paymentResponse.status,
        id: paymentResponse.id,
        amount: totalAmount,
        formattedAmount: Number(totalAmount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }),
        paymentDetails: paymentResponse.status_detail,
        message: 'Pago procesado exitosamente.',
        idempotencyKey, // Incluir en respuesta
      });
    } else {
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
    }

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
    
    // Error genérico con información para debug
    return NextResponse.json({ 
      error: 'Error interno del servidor al procesar el pago. Intente más tarde.', 
      idempotencyKey,
      debugInfo: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}