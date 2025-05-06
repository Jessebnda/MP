import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Obtener la ruta correcta al directorio actual
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Cargar variables de entorno ANTES de importar otros módulos
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Verificar que las variables estén cargadas
console.log('Testing KV connection...');
console.log('KV_URL:', process.env.KV_URL ? 'Presente' : 'Ausente');
console.log('KV_REST_API_URL:', process.env.KV_REST_API_URL ? 'Presente' : 'Ausente');
console.log('KV_REST_API_TOKEN:', process.env.KV_REST_API_TOKEN ? 'Presente' : 'Ausente (longitud: ' + (process.env.KV_REST_API_TOKEN?.length || 0) + ')');

// IMPORTANTE: Solo importar kv después de cargar las variables de entorno
import { kv } from '@vercel/kv';

async function testConnection() {
  try {
    // Intenta una operación simple
    await kv.set('test-key', 'test-value');
    const result = await kv.get('test-key');
    
    console.log('Conexión exitosa! Resultado:', result);
    return true;
  } catch (error) {
    console.error('KV connection failed:', error);
    return false;
  } finally {
    process.exit(0);
  }
}

testConnection();