import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';

export async function POST(req) {
  try {
    console.log('Process payment request received');
    
    // Extract all data from request
    const data = await req.json();
    console.log('Payment data received:', JSON.stringify(data));

    // FIXED: Check if data has formData structure and extract properly
    let paymentData = data;
    
    // If the data is nested in formData, use that structure
    if (data.formData && typeof data.formData === 'object') {
      // Merge formData with other top-level fields to ensure we have all data
      paymentData = {
        ...data,
        ...data.formData  // This will extract token, payment_method_id etc to top level
      };
    }

    // Extract specific fields we need from normalized data
    const { 
      token, 
      issuer_id,
      payment_method_id, 
      installments,
      payer = {},
      productId,
      quantity,
      transaction_amount,
      description
    } = paymentData;

    console.log('Normalized payment data:', {
      token: token ? 'present' : 'missing',
      payment_method_id,
      productId,
      transaction_amount,
    });

    // Basic validation
    if (!token || !payment_method_id) {
      console.error('Missing required payment data');
      return NextResponse.json({ 
        error: 'Faltan datos requeridos para el pago' 
      }, { status: 400 });
    }

    // Use provided transaction_amount or calculate from product
    let amount = transaction_amount;
    
    // If no amount provided, try to calculate from product (fallback)
    if (!amount && productId) {
      // Simplified product lookup - make sure this matches your data
      const products = [
        { id: 'product1', name: 'Producto Premium', price: 100.00 },
        { id: 'product2', name: 'Producto Básico', price: 50.00 },
        { id: 'default-product-id', name: 'Producto Estelar', price: 150.00 } // Added the default product
      ];
      
      const product = products.find(p => p.id === productId);
      if (!product) {
        return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
      }
      
      amount = product.price * (quantity || 1);
    }

    // Calculate the expected amount independently
    const expectedAmount = (() => {
      // Find product using the same hardcoded products array
      const product = [
        { id: 'product1', name: 'Producto Premium', price: 100.00 },
        { id: 'product2', name: 'Producto Básico', price: 50.00 },
        { id: 'default-product-id', name: 'Producto Estelar', price: 150.00 }
      ].find(p => p.id === productId);
      
      if (!product) return null;
      return product.price * (quantity || 1);
    })();

    // Security check - verify amount matches expectation
    if (expectedAmount !== null) {
      const tolerance = 0.01; // Small tolerance for floating point comparison
      if (Math.abs(Number(amount) - expectedAmount) > tolerance) {
        console.error(`Price manipulation detected: expected ${expectedAmount}, got ${amount}`);
        return NextResponse.json({ 
          error: 'Error de validación de precio' 
        }, { status: 400 });
      }
    }

    console.log(`Processing payment of ${amount} for product ${productId}`);

    // Configure Mercado Pago client
    const client = new MercadoPagoConfig({ 
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN 
    });
    
    const payment = new Payment(client);

    // Create payment - adapt fields to match what the Payment Brick sends
    const mpPaymentData = {
      transaction_amount: Number(amount),
      token,
      description: description || `Compra de producto ID: ${productId}`,
      installments: Number(installments || 1),
      payment_method_id,
      issuer_id,
      payer: {
        email: payer.email || 'test@test.com',
        identification: payer.identification || {}
      },
      metadata: {
        product_id: productId,
        quantity
      }
    };

    console.log('Sending payment data to MercadoPago:', JSON.stringify(mpPaymentData));
    const response = await payment.create({ body: mpPaymentData });
    console.log('MercadoPago response:', JSON.stringify(response));
    
    // Return simplified response
    return NextResponse.json({
      status: response.status,
      status_detail: response.status_detail,
      id: response.id
    });
    
  } catch (error) {
    console.error('Error processing payment:', error);
    
    // Provide more details in development
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `Error: ${error.message}` 
      : 'Hubo un problema al procesar tu pago';
    
    return NextResponse.json(
      { error: errorMessage }, 
      { status: 500 }
    );
  }
}