import { supabaseAdmin } from './supabase';
import { logInfo, logError } from '../utils/logger';

/**
 * Guarda un nuevo cliente
 */
export async function saveCustomer(customerData) {
  try {
    // Generar ID único para el cliente si no existe
    const customerId = customerData.id || `CLI_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // Insertar cliente
    const { error: customerError } = await supabaseAdmin
      .from('customers')
      .upsert({
        id: customerId,
        first_name: customerData.first_name,
        last_name: customerData.last_name,
        email: customerData.email,
        phone: customerData.phone || '',
        identification_type: customerData.identification_type || '',
        identification_number: customerData.identification_number || '',
        updated_at: new Date()
      });
    
    if (customerError) throw customerError;
    
    // Insertar dirección si existe
    if (customerData.street_name || customerData.address?.street_name) {
      const address = customerData.address || customerData;
      
      const { error: addressError } = await supabaseAdmin
        .from('customer_addresses')
        .upsert({
          customer_id: customerId,
          street_name: address.street_name || '',
          street_number: address.street_number || '',
          zip_code: address.zip_code || '',
          city: address.city || '',
          state: address.state || '',
          country: address.country || '',
          updated_at: new Date()
        });
      
      if (addressError) throw addressError;
    }
    
    return {
      success: true,
      customerId: customerId,
      message: 'Cliente guardado exitosamente'
    };
  } catch (error) {
    logError('Error guardando cliente:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Crea un nuevo pedido
 */
export async function createOrder(orderData, customerData) {
  try {
    // Guardar cliente primero
    const customerResult = await saveCustomer(customerData);
    
    if (!customerResult.success) {
      throw new Error(customerResult.error || 'Error al guardar cliente');
    }
    
    const customerId = customerResult.customerId;
    const orderId = orderData.orderId || `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // Insertar pedido
    const { error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        id: orderId,
        customer_id: customerId,
        total_amount: orderData.totalAmount || orderData.order_total || 0,
        payment_status: orderData.paymentStatus || orderData.payment_status || 'pending',
        shipment_status: 'pending',
        version: 1
      });
    
    if (orderError) throw orderError;
    
    // Insertar items del pedido
    const orderItems = orderData.items || JSON.parse(orderData.order_items || '[]');
    
    for (const item of orderItems) {
      const { error: itemError } = await supabaseAdmin
        .from('order_items')
        .insert({
          order_id: orderId,
          product_id: item.productId,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.price * item.quantity
        });
      
      if (itemError) throw itemError;
    }
    
    return {
      success: true,
      orderId: orderId,
      customerId: customerId
    };
  } catch (error) {
    logError('Error creando pedido:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Actualiza el estado de un pedido con control de concurrencia
 */
export async function updateOrderStatus(orderId, status, notes, expectedVersion) {
  try {
    const { data, error } = await supabaseAdmin.rpc(
      'update_shipment_status',
      { 
        p_order_id: orderId,
        p_status: status,
        p_notes: notes || '',
        p_expected_version: expectedVersion
      }
    );
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    logError('Error actualizando estado de pedido:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Obtiene pedidos con filtros opcionales
 */
export async function getOrders(filters = {}) {
  try {
    let query = supabaseAdmin
      .from('orders')
      .select(`
        *,
        customers(first_name, last_name, email, phone),
        customer_addresses(street_name, street_number, zip_code, city, state, country),
        order_items(product_id, quantity, price, subtotal, products(name))
      `)
      .order('created_at', { ascending: false });
    
    // Aplicar filtros
    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }
    
    if (filters.orderId) {
      query = query.eq('id', filters.orderId);
    }
    
    if (filters.email) {
      query = query.eq('customers.email', filters.email);
    }
    
    if (filters.shipmentStatus) {
      query = query.eq('shipment_status', filters.shipmentStatus);
    }
    
    if (filters.paymentStatus) {
      query = query.eq('payment_status', filters.paymentStatus);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return {
      success: true,
      orders: data || []
    };
  } catch (error) {
    logError('Error obteniendo pedidos:', error);
    return {
      success: false,
      error: error.message
    };
  }
}