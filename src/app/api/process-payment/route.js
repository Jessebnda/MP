import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
// Asumiendo que tienes una función para obtener productos de tu DB/API real
// import { getProductFromDatabase } from '@/lib/database';

export async function POST(req) {
  try {
    const {
      token,
      issuer_id, // Corregido de issuerId
      payment_method_id, // Corregido de paymentMethodId
      transaction_amount, // Usar este directamente si viene del brick
      installments,
      payer, // Objeto con email, identification, etc.
      productId,
      quantity,
      description // Opcional, puede venir del brick o generarse aquí
    } = await req.json();

    // --- Validación Crucial Server-Side ---
    if (!productId || !quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Datos de producto inválidos' }, { status: 400 });
    }

    // TODO: Reemplazar esto con la lógica real del backend del cliente
    // Obtener el producto real desde la base de datos o API del cliente
    // const product = await getProductFromDatabase(productId);
    // Simulación para el ejemplo:
    const product = { id: 'product1', name: 'Producto Premium', price: 100.00 }; // ¡REEMPLAZAR!

    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    const expectedAmount = product.price * quantity;
    const tolerance = 0.01; // Pequeña tolerancia para errores de punto flotante

    // Validar el monto recibido contra el esperado del backend
    if (Math.abs(Number(transaction_amount) - expectedAmount) > tolerance) {
      console.error(`Price manipulation detected: expected ${expectedAmount}, got ${transaction_amount}`);
      return NextResponse.json({
        error: 'Error de validación de precio'
      }, { status: 400 });
    }
    // --- Fin Validación Server-Side ---

    if (process.env.NODE_ENV === 'development') {
        console.log(`Processing payment of ${expectedAmount} for product ${productId}`);
    }

    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
    });
    const payment = new Payment(client);

    const mpPaymentData = {
      transaction_amount: Number(expectedAmount), // Usar el monto validado del backend
      token,
      description: description || `Compra de ${product.name}`, // Usar descripción del producto real
      installments: Number(installments || 1),
      payment_method_id,
      issuer_id,
      payer: { // Asegurarse que el objeto payer tenga la estructura correcta
        email: payer?.email || 'test@test.com', // Usar email real si está disponible
        identification: payer?.identification || undefined // Pasar solo si existe
      },
      metadata: { // Metadata útil para conciliación
        product_id: productId,
        quantity
      }
    };

    if (process.env.NODE_ENV === 'development') {
        console.log('Sending payment data to MercadoPago:', JSON.stringify(mpPaymentData, null, 2));
    }
    const response = await payment.create({ body: mpPaymentData });

    if (process.env.NODE_ENV === 'development') {
        console.log('MercadoPago response:', JSON.stringify(response, null, 2));
    }

    return NextResponse.json({
      status: response.status,
      status_detail: response.status_detail,
      id: response.id
    });

  } catch (error) {
    console.error('Error processing payment:', error);
    const errorMessage = process.env.NODE_ENV === 'development'
      ? `Error: ${error.message} ${error.cause ? JSON.stringify(error.cause) : ''}` // Mostrar más detalle si existe 'cause'
      : 'Hubo un problema al procesar tu pago';
    return NextResponse.json(
      { error: errorMessage },
      { status: error.status || 500 } // Usar status del error de MP si está disponible
    );
  }
}