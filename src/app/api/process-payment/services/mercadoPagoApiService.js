import { MercadoPagoConfig, Payment } from 'mercadopago';
import { logInfo, logError } from '../../../../utils/logger'; // Adjust path

export async function processMercadoPagoPayment({
  transaction_amount,
  token,
  payment_method_id,
  issuer_id,
  installments,
  payerEmail, // Extracted payer email
  payerData, // Full payer object from userData if available
  orderItems, // For description or external_reference
  isMultipleOrder,
}) {
  const client = new MercadoPagoConfig({ 
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
    options: { timeout: 15000 } // Example: 15 seconds timeout
  });
  const payment = new Payment(client);

  const paymentRequestBody = {
    transaction_amount: parseFloat(transaction_amount),
    token: token,
    description: isMultipleOrder ? `Pedido de ${orderItems.length} items.` : `Pedido de ${orderItems[0]?.name || 'producto'}`,
    installments: installments,
    payment_method_id: payment_method_id,
    issuer_id: issuer_id || undefined, // MP expects undefined if not present, not empty string for some fields
    payer: {
      email: payerData?.email || payerEmail, // Prioritize email from full userData
      // Include more payer details if available and required by MP for your region/setup
      ...(payerData?.identification && { identification: { type: payerData.identification.type, number: payerData.identification.number } }),
      ...(payerData?.first_name && { first_name: payerData.first_name }),
      ...(payerData?.last_name && { last_name: payerData.last_name }),
    },
    // external_reference: `order_${Date.now()}`, // Useful for your records
    // notification_url: `${process.env.NEXT_PUBLIC_HOST_URL}/api/mp-notifications`, // If you handle webhooks
  };
  
  // Clean up undefined payer fields
  if (paymentRequestBody.payer.first_name === undefined) delete paymentRequestBody.payer.first_name;
  if (paymentRequestBody.payer.last_name === undefined) delete paymentRequestBody.payer.last_name;
  if (paymentRequestBody.payer.identification && paymentRequestBody.payer.identification.type === undefined) delete paymentRequestBody.payer.identification;


  logInfo("Enviando datos de pago a MercadoPago:", paymentRequestBody);

  try {
    const paymentResponse = await payment.create({ body: paymentRequestBody });
    logInfo("Respuesta de MercadoPago SDK:", paymentResponse);
    return paymentResponse;
  } catch (mpError) {
    logError("Error de MercadoPago SDK:", mpError);
    // mpError.cause might contain more details from MercadoPago API
    const errorMessage = mpError.message || 'Error al procesar el pago con MercadoPago.';
    const errorDetails = mpError.cause || []; 
    throw new Error(`Error de MercadoPago: ${errorMessage} Detalles: ${JSON.stringify(errorDetails)}`);
  }
}