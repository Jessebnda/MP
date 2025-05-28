import { supabaseAdmin } from './supabase';
import { logInfo, logError } from '../utils/logger';

/**
 * Función simulada de guardar cliente - Ya no realiza inserciones
 */
export async function saveCustomer(customerData) {
  try {
    // Solo generamos el ID sin insertar nada
    const customerId = customerData.id || `CLI_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // Log informativo
    logInfo('Cliente no guardado (desactivado):', { email: customerData.email });
    
    return {
      success: true,
      customerId
    };
  } catch (error) {
    logError('Error en función saveCustomer:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Función simulada de crear pedido - Ya no realiza inserciones
 */
export async function createOrder(orderData, customerData) {
  try {
    // Llamar a saveCustomer que ahora solo genera un ID
    const customerResult = await saveCustomer(customerData);
    
    if (!customerResult.success) {
      throw new Error(customerResult.error || 'Error en función saveCustomer');
    }
    
    const customerId = customerResult.customerId;
    const orderId = orderData.orderId || orderData.id || `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // Log informativo
    logInfo('Orden no guardada (desactivado):', { 
      orderId, 
      customerId,
      items: (orderData.items || []).length
    });
    
    return {
      success: true,
      orderId: orderId,
      customerId: customerId
    };
  } catch (error) {
    logError('Error en función createOrder:', error);
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
 * Obtiene pedidos with filtros opcionales
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