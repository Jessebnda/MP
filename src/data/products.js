/**
 * Catálogo de productos centralizado
 * Modifica este archivo para actualizar los productos disponibles
 */
export const products = {
  'default-product-id': {
    id: 'default-product-id',
    name: 'Producto Estelar',
    description: 'Mi Producto Estelar',
    price: 150,
    category: 'destacados',
    stockAvailable: 100
  },
  'otro-producto': {
    id: 'otro-producto',
    name: 'Producto Premium',
    description: 'Producto de alta calidad',
    price: 250.50,
    category: 'premium',
    stockAvailable: 50
  }
};

/**
 * Obtiene un producto por su ID
 * @param {string} productId - Identificador del producto
 * @returns {Object|null} Producto encontrado o null
 */
export const getProductById = (productId) => {
  return products[productId] || null;
};

/**
 * Verifica si un producto está disponible y valida su cantidad
 * @param {string} productId - Identificador del producto
 * @param {number} quantity - Cantidad solicitada
 * @returns {boolean} Verdadero si está disponible
 */
export const isProductAvailable = (productId, quantity = 1) => {
  const product = getProductById(productId);
  if (!product) return false;
  return product.stockAvailable >= quantity;
};

/**
 * Obtiene el precio de un producto según ID y cantidad
 * @param {string} productId - Identificador del producto
 * @param {number} quantity - Cantidad solicitada
 * @returns {number|null} Precio total o null si no existe
 */
export const getProductPrice = (productId, quantity = 1) => {
  const product = getProductById(productId);
  if (!product) return null;
  return product.price * quantity;
};