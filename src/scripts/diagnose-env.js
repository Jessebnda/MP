import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configurar la ruta para .env.local (igual que en tus otros scripts)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env.local desde la raíz del proyecto
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

console.log('🔍 Diagnóstico de Configuración del Proyecto\n');

// 1. Verificar archivos de configuración
console.log('📁 Archivos de configuración:');
const configFiles = [
  '.env.local',
  '.env',
  'package.json',
  'next.config.js'
];

configFiles.forEach(file => {
  const filePath = path.resolve(process.cwd(), file);
  const exists = fs.existsSync(filePath);
  console.log(`   ${file}: ${exists ? '✅' : '❌'}`);
  if (exists) {
    const stats = fs.statSync(filePath);
    console.log(`     Tamaño: ${stats.size} bytes`);
    console.log(`     Modificado: ${stats.mtime.toISOString()}`);
  }
});

// NUEVO: Mostrar ruta del archivo .env.local
console.log('\n📍 Ruta del archivo .env.local:');
const envPath = path.resolve(__dirname, '../../.env.local');
const envExists = fs.existsSync(envPath);
console.log(`   ${envPath}: ${envExists ? '✅' : '❌'}`);

// 2. Verificar variables de entorno críticas
console.log('\n🔧 Variables de entorno críticas:');
const criticalEnvVars = [
  'MERCADOPAGO_WEBHOOK_KEY',
  'MERCADOPAGO_ACCESS_TOKEN',
  'NEXT_PUBLIC_HOST_URL',
  'NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY'
];

criticalEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`   ${varName}: ✅ (${value.length} caracteres)`);
    if (varName.includes('KEY') || varName.includes('TOKEN')) {
      console.log(`     Valor: ${value.substring(0, 8)}...${value.substring(value.length - 8)}`);
    } else {
      console.log(`     Valor: ${value}`);
    }
  } else {
    console.log(`   ${varName}: ❌ No configurado`);
  }
});

// 3. Verificar variables de Supabase
console.log('\n💾 Variables de Supabase:');
const supabaseVars = [
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
];

supabaseVars.forEach(varName => {
  const value = process.env[varName];
  console.log(`   ${varName}: ${value ? '✅' : '❌'}`);
});

// 4. Verificar variables de email
console.log('\n📧 Variables de email:');
const emailVars = [
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_USER',
  'EMAIL_PASSWORD',
  'LOGISTICS_EMAIL'
];

emailVars.forEach(varName => {
  const value = process.env[varName];
  console.log(`   ${varName}: ${value ? '✅' : '❌'}`);
});

// 5. Verificar estructura de carpetas
console.log('\n📂 Estructura del proyecto:');
const folders = [
  'src/scripts',
  'src/app/api/webhook',
  'src/utils',
  'src/lib',
  'src/components'
];

folders.forEach(folder => {
  const folderPath = path.resolve(process.cwd(), folder);
  const exists = fs.existsSync(folderPath);
  console.log(`   ${folder}: ${exists ? '✅' : '❌'}`);
});

// 6. Verificar archivos clave del webhook
console.log('\n📄 Archivos clave del webhook:');
const keyFiles = [
  'src/scripts/test-webhook-v2.js',
  'src/app/api/webhook/route.js',
  'src/utils/logger.js'
];

keyFiles.forEach(file => {
  const filePath = path.resolve(process.cwd(), file);
  const exists = fs.existsSync(filePath);
  console.log(`   ${file}: ${exists ? '✅' : '❌'}`);
  if (exists) {
    const stats = fs.statSync(filePath);
    console.log(`     Tamaño: ${stats.size} bytes`);
  }
});

// 7. Información del sistema
console.log('\n🖥️ Información del sistema:');
console.log(`   Node.js: ${process.version}`);
console.log(`   Plataforma: ${process.platform}`);
console.log(`   Directorio actual: ${process.cwd()}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'No configurado'}`);

// 8. Verificar disponibilidad del servidor
console.log('\n🌐 Verificación del servidor:');
const baseUrl = process.env.NEXT_PUBLIC_HOST_URL || 'http://localhost:3000';
console.log(`   URL base: ${baseUrl}`);

// NUEVO: Test de conectividad si el servidor está corriendo
console.log('\n🔄 Test de conectividad:');
try {
  const healthUrl = `${baseUrl}/api/health`;
  console.log(`   Probando: ${healthUrl}`);
  
  // Hacer una prueba rápida con timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  
  fetch(healthUrl, { 
    signal: controller.signal,
    method: 'GET'
  })
  .then(response => {
    clearTimeout(timeoutId);
    console.log(`   ✅ Servidor responde: ${response.status}`);
  })
  .catch(error => {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.log('   ⏰ Timeout - servidor no responde');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('   ❌ Servidor no está corriendo');
    } else {
      console.log(`   ❌ Error: ${error.message}`);
    }
    console.log('   💡 Para iniciar el servidor: npm run dev');
  });
  
} catch (error) {
  console.log(`   ❌ Error: ${error.message}`);
}

console.log('\n✨ Diagnóstico completado');
console.log('\nSiguientes pasos:');
console.log('1. Asegúrate de que todas las variables ✅ estén configuradas');
console.log('2. Ejecuta: npm run dev (en otra terminal)');
console.log('3. Ejecuta: npm run test:webhook:v2 123456789');

// NUEVO: Debug adicional
console.log('\n🔧 Debug adicional:');
console.log('   Número total de variables de entorno cargadas:', Object.keys(process.env).length);
console.log('   Variables que contienen "MERCADO":', Object.keys(process.env).filter(key => key.includes('MERCADO')));
console.log('   Variables que contienen "SUPABASE":', Object.keys(process.env).filter(key => key.includes('SUPABASE')));