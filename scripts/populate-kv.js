/**
 * Script para inicializar y gestionar productos en KV
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logError, logWarn } from '../src/lib/logger';

// Obtener la ruta correcta al directorio actual
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cargar variables de entorno ANTES de importar otros módulos
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Verificar que las variables estén cargadas
logInfo('Iniciando población de datos en KV...');
logInfo('KV_URL:', process.env.KV_URL ? 'Presente' : 'Ausente');
logInfo('KV_REST_API_URL:', process.env.KV_REST_API_URL ? 'Presente' : 'Ausente');
logInfo('KV_REST_API_TOKEN:', process.env.KV_REST_API_TOKEN ? 'Presente' : 'Ausente');

// Solo importar después de cargar variables
import { populateProductsFromData } from '../src/lib/kv.js';
import { products } from '../src/data/products.js';

async function populateInitialData() {
  try {
    // Use the existing library function to populate products
    const result = await populateProductsFromData(products);
    
    if (result.success) {
      logInfo('Población completada exitosamente!');
      logInfo('Resultados:', result.results);
    } else {
      logError('Error durante la población:', result.error);
      logInfo('Resultados parciales:', result.results);
    }
  } catch (error) {
    logError('Error poblando KV:', error);
    logError(error.stack);
  }
}

// Ejecutar directamente
populateInitialData()
  .then(() => logInfo('Script completado'))
  .catch(err => logError('Error en script:', err))
  .finally(() => process.exit(0));

export { populateInitialData };