import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { getProductById } from '../../../data/products'; // Importación correcta

export async function POST(req) {
  try {
    const body = await req.json();
    console.log('Received payment request:', JSON.stringify(body, null, 2));
    
    const { formData: formDataWrapper, productId, quantity } = body;
    const formData = formDataWrapper?.formData || formDataWrapper;
    
    if (!formData || !productId || !quantity) {
      return NextResponse.json({ 
        error: 'Faltan datos requeridos para el pago' 
      }, { status: 400 });
    }

    // Obtén el producto usando la función
    const product = getProductById(productId);
    
    if (!product) {
      return NextResponse.json({
        error: `Producto no encontrado: ${productId}`
      }, { status: 404 });
    }

    // Verificar stock disponible
    const currentStock = product.stockAvailable;
    if (currentStock < quantity) {
      return NextResponse.json({
        error: `Stock insuficiente para "${product.name}". Solo quedan ${currentStock} unidades disponibles.`
      }, { status: 400 });
    }
    
    // Procesar el pago con MercadoPago...
    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const payment = new Payment(client);
    
    // Resto de tu código para procesar el pago...
    
    return NextResponse.json({ 
      status: 'success',
      message: 'Pago procesado correctamente' 
    });
    
  } catch (error) {
    console.error("Error processing payment:", error);
    return NextResponse.json({ 
      error: 'Error al procesar el pago' 
    }, { status: 500 });
  }
}