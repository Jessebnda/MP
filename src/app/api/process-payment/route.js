import { MercadoPagoConfig, Payment } from 'mercadopago';
import { NextResponse } from 'next/server';
import rateLimit from '../rate-limit';

// Función simulada para obtener producto (REEMPLAZAR CON TU BASE DE DATOS)
async function getProductById(productId) {
  // ... (lógica para buscar producto en tu DB)
  // Ejemplo:
  if (productId === 'default-product-id' || productId === 'product1') {
    return { id: productId, name: 'Producto Ejemplo', price: 150.00 };
  }
  return null;
}

export async function POST(req) {
  // Aplicar rate limiting
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || '127.0.0.1';
  const { success, limit, remaining, reset } = rateLimit.limiter(ip);
  
  // Si excedió el límite, devolver 429 Too Many Requests
  if (!success) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intente nuevamente más tarde.' },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString()
        }
      }
    );
  }

  const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
  const payment = new Payment(client);

  try {
    const body = await req.json();
    console.log('Received body in backend:', body); // Log para ver qué llega

    // --- CORRECCIÓN AQUÍ ---
    // Extraer datos del objeto formData anidado
    const { formData, productId, quantity } = body;
    const { token, issuer_id, payment_method_id, installments, payer } = formData || {}; // Usar formData
    // -----------------------

    // Validar datos esenciales (añadir más validaciones si es necesario)
    if (!token || !payment_method_id || !installments || !payer?.email || !productId || !quantity) {
      console.error('Validation Error: Missing required payment data in formData or body');
      return NextResponse.json({ error: 'Faltan datos requeridos para el pago' }, { status: 400 });
    }

    // --- Validación de Precio (CRÍTICO) ---
    const product = await getProductById(productId);
    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }
    const expectedAmount = product.price * quantity;
    // Compara el monto esperado con el que viene del frontend (transaction_amount está en formData)
    if (formData.transaction_amount !== expectedAmount) {
       console.error(`Price Mismatch: Expected ${expectedAmount}, Received ${formData.transaction_amount}`);
       return NextResponse.json({ error: 'El monto de la transacción no coincide con el precio del producto' }, { status: 400 });
    }
    // --- Fin Validación de Precio ---

    console.log('Processing payment with data:', {
        token,
        issuer_id,
        payment_method_id,
        transaction_amount: expectedAmount, // Usa el monto validado del servidor
        installments,
        payer: { email: payer.email },
        // ... otros datos si son necesarios
    });

    const paymentData = {
      token: token,
      issuer_id: issuer_id,
      payment_method_id: payment_method_id, // Usar la variable extraída
      transaction_amount: expectedAmount, // ¡IMPORTANTE! Usa el monto calculado/validado en el servidor
      installments: installments,
      payer: {
        email: payer.email,
        // Podrías necesitar más datos del payer aquí dependiendo de tu configuración
      },
      // metadata: { /* Datos adicionales si los necesitas */ },
      // notification_url: "TU_URL_DE_NOTIFICACIONES_IPN", // Recomendado para producción
    };

    const paymentResult = await payment.create({ body: paymentData });

    console.log('Mercado Pago API Response:', paymentResult);

    return NextResponse.json({
      status: paymentResult.status,
      status_detail: paymentResult.status_detail,
      id: paymentResult.id
    }, { status: 200 });

  } catch (error) {
    console.error('Error processing payment:', error?.cause || error?.message || error);
    const errorMessage = error?.cause?.[0]?.description || error?.message || 'Error interno del servidor';
    const errorStatus = error?.status || 500;
    return NextResponse.json({ error: `Error: ${errorMessage}` }, { status: errorStatus });
  }
}