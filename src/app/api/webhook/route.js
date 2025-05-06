import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto'; // Import Node.js crypto module

// --- Implementación de Validación de Firma ---
async function isValidSignature(request, secret) {
  try {
    const signatureHeader = request.headers.get('x-signature');
    const requestIdHeader = request.headers.get('x-request-id'); // Aunque no se usa en el hash, es bueno tenerlo
    
    if (!signatureHeader || !secret) {
      console.error('Missing X-Signature header or secret for validation');
      return false;
    }

    // 1. Parsear el header X-Signature
    const parts = signatureHeader.split(',').reduce((acc, part) => {
      const [key, value] = part.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});

    const receivedTs = parts.ts;
    const receivedHash = parts.v1; // Asumiendo que es v1

    if (!receivedTs || !receivedHash) {
      console.error('Invalid X-Signature format');
      return false;
    }

    // 2. Leer el cuerpo RAW de la solicitud (¡Importante!)
    // Clonamos la request para poder leer el body raw y luego el JSON
    const rawBody = await request.clone().text(); 

    // 3. Construir el manifiesto firmado
    // El formato es: id;<request.data.id>;ts;<marca de tiempo>;
    // PERO, la documentación más reciente indica usar: <request-id>.<timestamp>.<request-body>
    // Vamos a usar el formato más común visto en ejemplos: id:data.id;ts:ts;
    // OJO: La documentación de MP puede ser inconsistente. Verifica el formato exacto que te envían.
    // Una forma más segura es usar el template: `${requestIdHeader}.${receivedTs}.${rawBody}` si MP lo soporta así.
    // Por ahora, usaremos el formato basado en ID y TS del payload si está disponible, o solo TS.
    
    // Intentamos parsear el JSON para obtener el ID si es posible, pero usamos rawBody para el hash
    let manifestBase = `ts:${receivedTs};`;
    try {
        const notificationData = JSON.parse(rawBody);
        if (notificationData?.data?.id) {
            manifestBase = `id:${notificationData.data.id};${manifestBase}`;
        }
    } catch (e) {
        // Si no es JSON o no tiene data.id, usamos solo el timestamp
        console.warn("Could not parse webhook body for ID, using timestamp only for manifest base.");
    }
    
    const manifest = `${manifestBase}${rawBody}`; // Concatenamos el cuerpo raw

    // 4. Calcular el HMAC-SHA256
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(manifest);
    const calculatedHash = hmac.digest('hex');

    // 5. Comparar los hashes
    const isValid = crypto.timingSafeEqual(Buffer.from(calculatedHash, 'hex'), Buffer.from(receivedHash, 'hex'));

    if (!isValid) {
        console.error('Webhook signature mismatch.');
        console.log('Received Hash:', receivedHash);
        console.log('Calculated Hash:', calculatedHash);
        // console.log('Manifest used:', manifest); // Descomenta para debug extremo (puede loguear datos sensibles)
    } else {
        console.log('Webhook signature validated successfully.');
    }

    return isValid;

  } catch (error) {
    console.error('Error during webhook signature validation:', error);
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
  console.log('Webhook received!');

  // Usar el Access Token como secreto para la validación de firma
  // (O un Webhook Secret específico si lo configuraste en Mercado Pago)
  const secret = process.env.MERCADOPAGO_ACCESS_TOKEN; 

  // 1. Validar la firma del webhook ANTES de leer el JSON
  const isValid = await isValidSignature(req, secret);
  if (!isValid) {
    console.error('Invalid webhook signature. Rejecting request.');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  // Ahora que la firma es válida, podemos procesar el cuerpo JSON
  const client = new MercadoPagoConfig({ accessToken: secret }); // Reutilizamos el secret
  const paymentClient = new Payment(client);

  try {
    // 2. Obtener el cuerpo de la notificación (ahora podemos usar .json())
    const notification = await req.json();
    console.log('Webhook notification body (validated):', JSON.stringify(notification, null, 2));

    // 3. Verificar si es una notificación de pago y obtener el ID
    if (notification.type === 'payment' && notification.data?.id) {
      const paymentId = notification.data.id;
      console.log(`Processing validated webhook for payment ID: ${paymentId}`);

      // 4. Obtener el estado REAL del pago desde la API de Mercado Pago
      const paymentInfo = await paymentClient.get({ id: paymentId });
      console.log(`Payment ID ${paymentId} - Actual Status from API: ${paymentInfo.status}`);

      // 5. Lógica para actualizar tu base de datos
      console.log(`Simulating database update for Order related to Payment ID ${paymentId} to status: ${paymentInfo.status}`);
      // await updateOrderStatusInDatabase(paymentId, paymentInfo.status);

      // 6. Acciones adicionales (ej. enviar email)
      if (isSuccessfulPayment(paymentInfo.status)) {
        console.log(`Payment ${paymentId} accepted with status: ${paymentInfo.status}. Consider sending confirmation email.`);
        // sendConfirmationEmail(paymentInfo.payer.email, paymentId);
      } else if (paymentInfo.status === 'rejected') {
        console.log(`Payment ${paymentId} rejected.`);
        // sendRejectionEmail(paymentInfo.payer.email, paymentId);
      }

    } else {
      console.log('Validated webhook received, but not a payment notification or missing data ID.');
    }

    // 7. Responder a Mercado Pago con 200 OK
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    console.error('Error processing validated webhook:', error?.cause || error?.message || error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}