/**
 * Catálogo de productos centralizado
 */
const products = [
  {
    id: '1',
    name: 'Reposado',
    description: 'Envejecido 9 meses en roble blanco, ofrece suavidad y sabores de caramelo, vainilla, miel y agave. Perfecto solo o en cocteles.',
    price: 10,
    category: 'ejemplos',
    stockAvailable: 5
  },
  {
    id: '2',
    name: 'Blanco',
    description: 'Tequila puro y vibrante, con notas frescas de agave cocido, miel, cítricos y florales. Ideal para cocteles.',
    price: 1,
    category: 'ejemplos',
    stockAvailable: 50
  },
  {
    id: '3',
    name: 'Cristalino',
    description: 'Filtrado tras su reposo, es suave y elegante, con notas de piña, miel y caramelo. Disfrútalo solo o con hielo.',
    price: 1, 
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