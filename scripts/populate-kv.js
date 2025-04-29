/**
 * Script para inicializar y gestionar productos en KV
 */
const { kv } = require('@vercel/kv');
const { products } = require('../src/data/products');

async function populateInitialData() {
  try {
    console.log('Iniciando población de datos en KV...');
    
    // Guardar cada producto
    for (const product of products) {
      // Guardar datos del producto
      await kv.set(`product:${product.id}`, {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        category: product.category || 'general'
      });
      
      // Inicializar stock si stockAvailable está definido
      if (typeof product.stockAvailable === 'number') {
        await kv.set(`product:${product.id}:stock`, product.stockAvailable);
      }
      
      console.log(`Producto ${product.id} (${product.name}) guardado`);
    }
    
    console.log('Datos inicializados correctamente');
  } catch (error) {
    console.error('Error poblando KV:', error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  populateInitialData()
    .then(() => console.log('Script completado'))
    .catch(err => console.error('Error en script:', err))
    .finally(() => process.exit(0));
}

module.exports = { populateInitialData };