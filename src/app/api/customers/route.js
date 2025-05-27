import { NextResponse } from 'next/server';
import { createOrder, getOrders } from '../../../lib/orderService';
import { logInfo, logError } from '../../../utils/logger';

export async function POST(request) {
  try {
    const customerData = await request.json();
    
    // Validar datos requeridos
    if (!customerData.first_name || !customerData.last_name || !customerData.email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Datos de cliente incompletos' 
      }, { status: 400 });
    }

    // Preparar datos del pedido
    const orderData = {
      orderId: customerData.order_id || '',
      totalAmount: customerData.order_total || 0,
      paymentStatus: customerData.payment_status || 'pending',
      items: typeof customerData.order_items === 'string' 
        ? JSON.parse(customerData.order_items || '[]')
        : customerData.order_items || []
    };

    logInfo('Guardando cliente y pedido en Supabase:', {
      customerEmail: customerData.email,
      orderTotal: orderData.totalAmount
    });

    // Crear pedido (que también guarda el cliente)
    const result = await createOrder(orderData, customerData);
    
    if (result.success) {
      logInfo('Cliente y pedido guardados exitosamente');
      return NextResponse.json({ 
        success: true, 
        message: 'Cliente guardado exitosamente',
        customerId: result.customerId,
        orderId: result.orderId
      });
    } else {
      throw new Error(result.error || 'Error desconocido');
    }

  } catch (error) {
    logError('Error guardando cliente:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const orderId = searchParams.get('orderId');

    const filters = {};
    if (email) filters.email = email;
    if (orderId) filters.orderId = orderId;

    const result = await getOrders(filters);
    
    return NextResponse.json(result);
  } catch (error) {
    logError('Error obteniendo clientes:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}