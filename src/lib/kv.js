import { kv as vercelKV } from '@vercel/kv';
export const kv = vercelKV;

/**
 * Gets product stock from KV
 */
export async function getProductStock(productId) {
  try {
    const stock = await kv.get(`product:${productId}:stock`);
    return stock !== null ? stock : 0; // Return 0 as default when no stock found
  } catch (error) {
    console.error('Error obteniendo stock:', error);
    return 0;
  }
}

/**
 * Updates product stock in KV
 */
export async function updateProductStock(productId, newStock) {
  try {
    // Validar entrada
    if (typeof newStock !== 'number' || isNaN(newStock)) {
      console.error('Error: Stock debe ser un número válido');
      return false;
    }
    
    // Intentar actualizar con reintento
    let retries = 3;
    let success = false;
    
    while (retries > 0 && !success) {
      try {
        await kv.set(`product:${productId}:stock`, newStock);
        
        // Verificar que se actualizó correctamente
        const updatedStock = await kv.get(`product:${productId}:stock`);
        if (updatedStock === newStock) {
          success = true;
          console.log(`Stock actualizado para ${productId}: ${newStock}`);
        } else {
          console.warn(`Verificación fallida para ${productId}, obtenido: ${updatedStock}, esperado: ${newStock}`);
        }
      } catch (retryError) {
        console.error(`Intento ${4-retries} fallido:`, retryError);
      }
      
      retries--;
      if (!success && retries > 0) {
        // Esperar antes de reintentar
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return success;
  } catch (error) {
    console.error('Error actualizando stock:', error);
    return false;
  }
}

/**
 * Saves product data to KV
 */
export async function saveProduct(product) {
  if (!product || !product.id) {
    console.error('Error: Producto inválido');
    return false;
  }

  try {
    // Save product data WITHOUT price
    await kv.set(`product:${product.id}`, {
      id: product.id,
      name: product.name,
      description: product.description || '',
      // ELIMINAR price: product.price, - No guardar precio en KV
      category: product.category || 'general'
    });

    // Siempre establecer stock inicial si viene en el producto
    if (product.hasOwnProperty('stockAvailable')) {
      await kv.set(`product:${product.id}:stock`, product.stockAvailable);
      console.log(`Stock establecido para ${product.id}: ${product.stockAvailable}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error guardando producto:', error);
    return false;
  }
}

/**
 * Populates KV with products from static data
 */
export async function populateProductsFromData(products) {
  if (!products || !Array.isArray(products)) {
    console.error('Error: Datos de productos inválidos');
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
      await saveProduct(product);
      
      results[product.id] = 'Guardado exitosamente';
    }
    
    return {
      success: true,
      results: results
    };
  } catch (error) {
    console.error('Error poblando productos:', error);
    return {
      success: false,
      error: error.message,
      results
    };
  }
}