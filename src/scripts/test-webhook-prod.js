import 'dotenv/config';
import { simulateWebhook } from './test-webhook.js';

// Configuración específica para producción
const PRODUCTION_CONFIG = {
  NEXT_PUBLIC_HOST_URL: 'https://mercadopagoiframe.vercel.app',
  // Sobrescribir variables para producción si es necesario
};

// Aplicar configuración de producción
Object.entries(PRODUCTION_CONFIG).forEach(([key, value]) => {
  process.env[key] = value;
});

console.log('🚀 Ejecutando test de webhook en PRODUCCIÓN');
console.log('📍 URL objetivo:', process.env.NEXT_PUBLIC_HOST_URL);

// Ejecutar con los argumentos proporcionados
const paymentId = process.argv[2];
const status = process.argv[3] || 'approved';

if (!paymentId) {
  console.error('❌ Debes proporcionar un payment_id');
  console.log('Uso: node src/scripts/test-webhook-prod.js <payment_id> [status]');
  process.exit(1);
}

simulateWebhook(paymentId, status)
  .then(() => {
    console.log('✅ Test completado');
  })
  .catch(error => {
    console.error('❌ Error en test:', error);
    process.exit(1);
  });