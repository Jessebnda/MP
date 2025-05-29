import verifyPayments from './verify-payments.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Cargar variables de entorno
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// Función para formatear fecha YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Obtener fechas de inicio y fin
function getDateRange() {
  // Por defecto, último mes
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 1);
  
  // También se pueden usar argumentos de línea de comandos
  const args = process.argv.slice(2);
  if (args.length >= 2) {
    return {
      startDate: args[0],
      endDate: args[1]
    };
  }
  
  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate)
  };
}

// Función principal
async function run() {
  try {
    const { startDate, endDate } = getDateRange();
    
    console.log(`🔍 Iniciando verificación de pagos desde ${startDate} hasta ${endDate}...`);
    
    const results = await verifyPayments(startDate, endDate);
    
    console.log('\n📊 Resultados de la verificación:');
    console.log(`✅ Total pagos en MercadoPago: ${results.totalMercadoPago}`);
    console.log(`✅ Total pagos en Base de Datos: ${results.totalDatabase}`);
    
    if (results.discrepancies.length > 0) {
      console.log(`\n⚠️ Se encontraron ${results.discrepancies.length} discrepancias:`);
      
      // Agrupar por tipo para mejor visualización
      const byType = results.discrepancies.reduce((acc, item) => {
        acc[item.type] = acc[item.type] || [];
        acc[item.type].push(item);
        return acc;
      }, {});
      
      // Mostrar por cada tipo
      if (byType.missing_in_db) {
        console.log(`\n❌ Pagos aprobados en MercadoPago pero faltantes en Base de Datos: ${byType.missing_in_db.length}`);
        byType.missing_in_db.forEach(item => {
          console.log(`   - ID: ${item.payment_id}, Monto: $${item.amount}, Fecha: ${item.date}`);
        });
      }
      
      if (byType.missing_in_mp) {
        console.log(`\n❓ Pagos en Base de Datos pero no encontrados en MercadoPago: ${byType.missing_in_mp.length}`);
        byType.missing_in_mp.forEach(item => {
          console.log(`   - ID: ${item.payment_id}, Monto: $${item.amount}, Fecha: ${item.date}`);
        });
      }
      
      if (byType.amount_mismatch) {
        console.log(`\n💰 Pagos con montos diferentes: ${byType.amount_mismatch.length}`);
        byType.amount_mismatch.forEach(item => {
          console.log(`   - ID: ${item.payment_id}, MP: $${item.mp_amount}, DB: $${item.db_amount}`);
        });
      }
    } else {
      console.log(`\n✅ ¡Todo en orden! Los ${results.totalMercadoPago} pagos coinciden perfectamente.`);
    }
    
  } catch (error) {
    console.error('❌ Error ejecutando la verificación:', error);
    process.exit(1);
  }
}

// Ejecutar
run();