import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { getProductById } from '../../../data/products';
import { updateProductStock,getProductStock } from '../../../lib/kv';

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

    // Verificar stock disponible - usar stockAvailable desde el objeto product
    const currentStock = await getProductStock(productId);
    if (currentStock < quantity) {
      return NextResponse.json({
        error: `Stock insuficiente para "${product.name}". Solo quedan ${currentStock} unidades disponibles.`
      }, { status: 400 });
    }
    
    // Procesar el pago con MercadoPago...
    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const payment = new Payment(client);
    
    // Simula una respuesta exitosa - no tenemos código completo para procesar el pago real
    // En producción, aquí implementarías la creación del pago con MercadoPago
    
    // Actualizar el stock tras un pago exitoso
    try {
      // Reducir el stock - usamos directamente updateProductStock con el ID y el nuevo valor
      await updateProductStock(productId, currentStock - quantity);
    } catch (stockError) {
      console.error("Error actualizando stock:", stockError);
      // Continuamos con el proceso aunque falle la actualización del stock
    }
    
    // Devolver respuesta exitosa con los dos estados posibles
    return NextResponse.json({ 
      status: 'approved',  // Cambiado de 'success' a 'approved'
      status_detail: 'success', // Mantener 'success' como detalle
      message: 'Pago procesado correctamente' 
    });
    
  } catch (error) {
    console.error("Error processing payment:", error);
    return NextResponse.json({ 
      error: 'Error al procesar el pago: ' + (error.message || 'Error desconocido')
    }, { status: 500 });
  }
}