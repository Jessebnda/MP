import { logInfo, logError } from '../../../../utils/logger';

// Simulación de base de datos de productos con información de stock
const products = [
  {
    id: "1",
    name: "Reposado",
    description: "Envejecido 9 meses en roble blanco, ofrece suavidad y sabores de caramelo.",
    price: 1500,
    category: "tequilas",
    stockAvailable: 10
  },
  {
    id: "2",
    name: "Blanco",
    description: "Tequila puro y cristalino.",
    price: 1200,
    category: "tequilas",
    stockAvailable: 15
  }
];

/**
 * Obtiene un producto por su ID
 */
export async function getProductById(productId) {
  // En una app real, esto sería una consulta a la base de datos
  const product = products.find(p => p.id === productId);
  return product || null;
}

/**
 * Verifica la disponibilidad de stock para un pedido
 */
export async function verifyStockForOrder(orderItems) {
  for (const item of orderItems) {
    const product = await getProductById(item.productId);
    if (!product) {
      throw new Error(`Producto no encontrado: ${item.productId}`);
    }
    
    if (product.stockAvailable < item.quantity) {
      throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${product.stockAvailable}`);
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
    const productIndex = products.findIndex(p => p.id === item.productId);
    if (productIndex >= 0) {
      products[productIndex].stockAvailable -= item.quantity;
      logInfo(`Stock actualizado para ${products[productIndex].name}. Nuevo stock: ${products[productIndex].stockAvailable}`);
    }
  }
  
  return true;
}