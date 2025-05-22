import { logInfo, logError } from '../../../../utils/logger';
import { kv, getProductStock, updateProductStock } from '../../../../lib/kv';
import { products as defaultProducts } from '../../../../data/products';

/**
 * Obtiene un producto por su ID
 */
export async function getProductById(productId) {
  try {
    // Siempre usar el producto estático para los datos base (incluido precio)
    const staticProduct = defaultProducts.find(p => p.id === productId);
    
    if (!staticProduct) {
      return null;
    }
    
    // Obtener solo el stock de KV
    const stock = await getProductStock(productId);
    
    // Combinar datos estáticos con stock dinámico
    return { 
      ...staticProduct, 
      stockAvailable: stock 
    };
  } catch (error) {
    logError(`Error fetching product ${productId}:`, error);
    
    // Fallback a datos estáticos en caso de error
    const staticProduct = defaultProducts.find(p => p.id === productId);
    return staticProduct || null;
  }
}

/**
 * Verifica la disponibilidad de stock para un pedido
 */
export async function verifyStockForOrder(orderItems) {
  for (const item of orderItems) {
    // Get current stock from KV
    const currentStock = await getProductStock(item.productId);
    const product = await getProductById(item.productId);
    
    if (!product) {
      throw new Error(`Producto no encontrado: ${item.productId}`);
    }
    
    if (currentStock < item.quantity) {
      throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${currentStock}`);
    }
  }
  
  logInfo(`Stock verificado para ${orderItems.length} productos`);
  return true;
}

/**
 * Actualiza niveles de stock después de una orden exitosa
 */
export async function updateStockAfterOrder(orderItems) {
  for (const item of orderItems) {
    // Get current stock
    const currentStock = await getProductStock(item.productId);
    // Calculate new stock
    const newStock = Math.max(0, currentStock - item.quantity);
    
    // Update in KV
    const updated = await updateProductStock(item.productId, newStock);
    
    if (updated) {
      logInfo(`Stock actualizado para producto ${item.productId}. Nuevo stock: ${newStock}`);
    } else {
      logError(`Error actualizando stock para producto ${item.productId}`);
    }
  }
  
  return true;
}