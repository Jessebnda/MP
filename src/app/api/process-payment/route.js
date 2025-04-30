import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { getProductById } from '../../../data/products'; // Importación correcta
import { updateProductStock } from '../../../lib/kv';

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
    const paymentResponse = await payment.save(); // Suponiendo que este es el método para procesar el pago
    
    // Dentro del bloque donde procesas el pago exitoso:
    // Después de procesar el pago
    if (paymentResponse && paymentResponse.status === "approved") {
      // Actualizar stock
      const currentStock = await getProductStock(productId);
      if (currentStock !== null) {
        await updateProductStock(productId, currentStock - quantity);
      }
      
      return NextResponse.json({ 
        status: 'success', // Cambiar esto de "approved" a "success"
        message: 'Pago procesado correctamente'
      });
    }
    
  } catch (error) {
    console.error("Error processing payment:", error);
    return NextResponse.json({ 
      error: 'Error al procesar el pago' 
    }, { status: 500 });
  }
}