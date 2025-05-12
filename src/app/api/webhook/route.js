import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto'; // Import Node.js crypto module
import { logSecurityEvent } from '../../../lib/security-logger'; // Importa el logger
import { logInfo, logError, logWarn } from '../../../lib/logger'; // Importa el logger

// --- Implementación de Validación de Firma ---
// Mejorar la función de validación de firma
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
// --- Fin Validación de Firma ---

// Función auxiliar para verificar estados de éxito
function isSuccessfulPayment(status) {
  // Normalizar el estado a minúsculas para comparación
  const normalizedStatus = (status || '').toLowerCase();
  
  // Aceptar cualquiera de estos estados como éxito
  return ['approved', 'success', 'succeeded', 'approved_payment'].includes(normalizedStatus);
}

export async function POST(req) {
  logInfo('Webhook received!');

  // Usar el Access Token como secreto para la validación de firma
  // (O un Webhook Secret específico si lo configuraste en Mercado Pago)
  const secret = process.env.MERCADOPAGO_ACCESS_TOKEN; 

  // 1. Validar la firma del webhook ANTES de leer el JSON
  const isValid = await isValidSignature(req, secret);
  if (!isValid) {
    logError('Invalid webhook signature. Rejecting request.');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  // Ahora que la firma es válida, podemos procesar el cuerpo JSON
  const client = new MercadoPagoConfig({ accessToken: secret }); // Reutilizamos el secret
  const paymentClient = new Payment(client);

  try {
    // 2. Obtener el cuerpo de la notificación (ahora podemos usar .json())
    const notification = await req.json();
    logInfo(`Webhook received: type=${notification.type}, data.id=${notification.data?.id || 'N/A'}`);

    // 3. Verificar si es una notificación de pago y obtener el ID
    if (notification.type === 'payment' && notification.data?.id) {
      const paymentId = notification.data.id;
      logInfo(`Processing validated webhook for payment ID: ${paymentId}`);

      // 4. Obtener el estado REAL del pago desde la API de Mercado Pago
      const paymentInfo = await paymentClient.get({ id: paymentId });
      logInfo(`Payment ${paymentId.substring(0, 4)}... status: ${paymentInfo.status}`);

      // 5. Lógica para actualizar tu base de datos
      logInfo(`Simulating database update for Order related to Payment ID ${paymentId} to status: ${paymentInfo.status}`);
      // await updateOrderStatusInDatabase(paymentId, paymentInfo.status);

      // 6. Acciones adicionales (ej. enviar email)
      if (isSuccessfulPayment(paymentInfo.status)) {
        logInfo(`Payment ${paymentId} accepted with status: ${paymentInfo.status}. Consider sending confirmation email.`);
        // sendConfirmationEmail(paymentInfo.payer.email, paymentId);
      } else if (paymentInfo.status === 'rejected') {
        logInfo(`Payment ${paymentId} rejected.`);
        // sendRejectionEmail(paymentInfo.payer.email, paymentId);
      }

    } else {
      logInfo('Validated webhook received, but not a payment notification or missing data ID.');
    }

    // 7. Responder a Mercado Pago con 200 OK
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    logError('Error processing validated webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}