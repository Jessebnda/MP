/**
 * Catálogo de productos centralizado
 */
const products = [
  {
    id: '1',
    name: 'Reposado',
    description: 'Descripción del producto ejemplo',
    price: 1500,
    category: 'ejemplos',
    stockAvailable: 5
  },
  {
    id: '2',
    name: 'Blanco',
    description: 'Descripción del producto ejemplo',
    price: 1500,
    category: 'ejemplos',
    stockAvailable: 50
  },
  {
    id: '3',
    name: 'Cristalino',
    description: 'Descripción del producto ejemplo',
    price: 1500, 
    category: 'ejemplos',
    stockAvailable: 100 
  }
];

/**
 * Función para obtener un producto por ID
 * @param {string} id - Identificador del producto
 * @returns {Object|null} Producto encontrado o null
 */
function getProductById(id) {
  return products.find(product => product.id === id);
}

export { products, getProductById };