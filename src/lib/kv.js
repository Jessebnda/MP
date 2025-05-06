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
    // Only update the stock key with a consistent format
    await kv.set(`product:${productId}:stock`, newStock);
    return true;
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
    // Save product data
    await kv.set(`product:${product.id}`, {
      id: product.id,
      name: product.name,
      description: product.description || '',
      price: product.price,
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