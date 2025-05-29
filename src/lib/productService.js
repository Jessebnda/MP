import { createClient } from '@supabase/supabase-js';
import { logInfo, logError } from '../utils/logger';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Obtiene un producto por su ID
 */
export async function getProductById(productId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();
      
    if (error) throw error;
    return data;
  } catch (error) {
    logError(`Error obteniendo producto ${productId}:`, error);
    return null;
  }
}

/**
 * Obtiene todos los productos
 */
export async function getAllProducts() {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    logError('Error obteniendo productos:', error);
    return [];
  }
}

/**
 * Obtiene el stock de un producto
 */
export async function getProductStock(productId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('stock_available')
      .eq('id', productId)
      .single();
      
    if (error) throw error;
    return data?.stock_available || 0;
  } catch (error) {
    logError(`Error obteniendo stock del producto ${productId}:`, error);
    return 0;
  }
}

/**
 * Actualiza el stock de un producto de forma segura
 */
export async function updateProductStock(productId, quantity) {
  try {
    // Usando la función personalizada de PostgreSQL
    const { data, error } = await supabaseAdmin.rpc(
      'update_stock_safely',
      { 
        p_product_id: productId, 
        p_quantity: quantity 
      }
    );
    
    if (error) throw error;
    
    // Verificar que se actualizó correctamente
    if (data) {
      logInfo(`Stock actualizado para ${productId}`);
      return true;
    } else {
      logError(`Stock insuficiente para ${productId}`);
      return false;
    }
  } catch (error) {
    logError(`Error actualizando stock del producto ${productId}:`, error);
    return false;
  }
}

/**
 * Guarda un producto completo
 */
export async function saveProduct(product) {
  if (!product || !product.id) {
    logError('Producto inválido para guardar');
    return false;
  }

  try {
    const { error } = await supabaseAdmin
      .from('products')
      .upsert({
        id: product.id,
        name: product.name,
        description: product.description || '',
        price: product.price,
        category: product.category || 'general',
        stock_available: product.stockAvailable || 0,
        updated_at: new Date()
      });
      
    if (error) throw error;
    
    logInfo(`Producto guardado: ${product.id} - ${product.name}`);
    return true;
  } catch (error) {
    logError('Error guardando producto:', error);
    return false;
  }
}

/**
 * Verifica disponibilidad de stock para un pedido
 */
export async function verifyStockForOrder(orderItems) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    logError('orderItems inválido en verifyStockForOrder:', orderItems);
    throw new Error('No hay items para verificar');
  }
  
  logInfo(`Verificando stock para ${orderItems.length} productos`);
  
  for (const item of orderItems) {
    // Asegurar que los datos necesarios están presentes
    const productId = item.productId || item.product_id;
    const quantity = parseInt(item.quantity);
    
    if (!productId || !quantity || isNaN(quantity)) {
      logError('Item inválido en verifyStockForOrder:', item);
      throw new Error('Datos de producto inválidos');
    }
    
    // Obtener el producto de la base de datos
    const product = await getProductById(productId);
    
    if (!product) {
      logError(`Producto no encontrado: ${productId}`);
      throw new Error(`Producto no encontrado: ${productId}`);
    }
    
    // Verificar stock
    const stockAvailable = parseInt(product.stock_available) || 0;
    if (stockAvailable < quantity) {
      logError(`Stock insuficiente para ${product.name || productId}: disponible ${stockAvailable}, solicitado ${quantity}`);
      throw new Error(`Stock insuficiente para ${product.name || productId}. Disponible: ${stockAvailable}, solicitado: ${quantity}`);
    }
  }
  
  logInfo('✅ Stock verificado correctamente para todos los productos');
  return true;
}

/**
 * Actualiza el stock después de una orden
 */
export async function updateStockAfterOrder(orderItems) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    logError('orderItems inválido en updateStockAfterOrder:', orderItems);
    return false;
  }
  
  logInfo(`Actualizando stock para ${orderItems.length} productos`);
  
  try {
    // Preparar los items para la RPC batch
    const items = orderItems.map(item => ({
      product_id: item.productId || item.product_id,
      quantity: parseInt(item.quantity)
    }));
    
    // Llamar al RPC batch
    const { error } = await supabaseAdmin.rpc(
      'update_stock_safely_batch',
      { items: items }
    );
    
    if (error) {
      logError('Error actualizando stock en batch:', error);
      throw error;
    }
    
    logInfo('✅ Stock actualizado correctamente para todos los productos');
    return true;
  } catch (error) {
    logError('Error actualizando stock:', error);
    throw error;
  }
}

/**
 * Inicializa productos desde datos estáticos
 */
export async function populateProductsFromData(products) {
  if (!products || !Array.isArray(products)) {
    logError('Datos de productos inválidos');
    return { success: false, message: 'Datos de productos inválidos' };
  }

  const results = {};
  
  try {
    for (const product of products) {
      // Skip invalid products
      if (!product.id || !product.name || typeof product.price !== 'number') {
        results[product.id || 'unknown'] = 'Error: datos inválidos';
        continue;
      }
      
      // Save product
      const success = await saveProduct(product);
      
      results[product.id] = success ? 'Guardado exitosamente' : 'Error al guardar';
    }
    
    return {
      success: true,
      results: results
    };
  } catch (error) {
    logError('Error poblando productos:', error);
    return {
      success: false,
      error: error.message,
      results
    };
  }
}