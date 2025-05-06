/**
 * Script para inicializar y gestionar productos en KV
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Obtener la ruta correcta al directorio actual
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cargar variables de entorno ANTES de importar otros módulos
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Verificar que las variables estén cargadas
console.log('Iniciando población de datos en KV...');
console.log('KV_URL:', process.env.KV_URL ? 'Presente' : 'Ausente');
console.log('KV_REST_API_URL:', process.env.KV_REST_API_URL ? 'Presente' : 'Ausente');
console.log('KV_REST_API_TOKEN:', process.env.KV_REST_API_TOKEN ? 'Presente' : 'Ausente');

// Solo importar después de cargar variables
import { populateProductsFromData } from '../src/lib/kv.js';
import { products } from '../src/data/products.js';

async function populateInitialData() {
  try {
    // Use the existing library function to populate products
    const result = await populateProductsFromData(products);
    
    if (result.success) {
      console.log('Población completada exitosamente!');
      console.log('Resultados:', result.results);
    } else {
      console.error('Error durante la población:', result.error);
      console.log('Resultados parciales:', result.results);
    }
  } catch (error) {
    console.error('Error poblando KV:', error);
    console.error(error.stack);
  }
}

// Ejecutar directamente
populateInitialData()
  .then(() => console.log('Script completado'))
  .catch(err => console.error('Error en script:', err))
  .finally(() => process.exit(0));

export { populateInitialData };