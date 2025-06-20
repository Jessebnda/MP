import { createClient } from '@supabase/supabase-js';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Cargar variables de entorno al inicio
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// Verificar variables críticas y mostrar mensaje claro
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

// Verificar si las variables esenciales están disponibles
if (!supabaseUrl) {
  console.error('❌ Error: SUPABASE_URL no está definida en .env.local');
  console.log('📋 Variables disponibles:', Object.keys(process.env).filter(key => key.includes('SUPA')));
  process.exit(1);
}

if (!supabaseKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no está definida en .env.local');
  process.exit(1);
}

if (!mpAccessToken) {
  console.error('❌ Error: MERCADOPAGO_ACCESS_TOKEN no está definida en .env.local');
  process.exit(1);
}

// Inicializar clientes con variables verificadas
const supabase = createClient(supabaseUrl, supabaseKey);

const client = new MercadoPagoConfig({
  accessToken: mpAccessToken
});

const payment = new Payment(client);

async function verifyPayments(startDate, endDate) {
  try {
    // 1. Obtener pagos de MercadoPago
    console.log(`📊 Consultando pagos de MercadoPago desde ${startDate} hasta ${endDate}...`);
    const mpPayments = await payment.search({
      range: 'date_created',
      begin_date: startDate,
      end_date: endDate,
      status: 'approved'
    });

    console.log(`📊 Se encontraron ${mpPayments.results?.length || 0} pagos aprobados en MercadoPago`);

    // 2. Obtener pagos de nuestra base de datos
    console.log('📊 Consultando pagos en la base de datos...');
    
    // CAMBIO 1: Usar la tabla payment_requests en lugar de orders
    const { data: dbPayments, error } = await supabase
      .from('payment_requests') // Tabla correcta según la captura
      .select('id, payment_id, total_amount, payment_status, created_at') // Campos correctos
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .eq('payment_status', 'approved'); // Usar payment_status en lugar de status

    if (error) {
      throw new Error(`Error obteniendo pagos de Supabase: ${error.message}`);
    }

    console.log(`📊 Se encontraron ${dbPayments?.length || 0} pagos en la base de datos`);

    // 3. Comparar pagos
    const mpPaymentsMap = new Map();
    mpPayments.results.forEach(p => mpPaymentsMap.set(p.id.toString(), p));

    const dbPaymentsMap = new Map();
    // CAMBIO 2: Usar payment_id como clave para la comparación, verificando que no sea null
    dbPayments.forEach(p => {
      if (p.payment_id) {
        dbPaymentsMap.set(p.payment_id.toString(), p);
      }
    });

    // 4. Encontrar discrepancias
    const discrepancies = [];

    // Pagos en MP pero no en DB
    mpPayments.results.forEach(mpPayment => {
      const paymentId = mpPayment.id.toString();
      if (!dbPaymentsMap.has(paymentId)) {
        discrepancies.push({
          type: 'missing_in_db',
          payment_id: paymentId,
          amount: mpPayment.transaction_amount,
          date: mpPayment.date_created
        });
      } else {
        // Verificar monto - CAMBIO 3: Usar total_amount en lugar de amount
        const dbPayment = dbPaymentsMap.get(paymentId);
        if (mpPayment.transaction_amount !== dbPayment.total_amount) {
          discrepancies.push({
            type: 'amount_mismatch',
            payment_id: paymentId,
            mp_amount: mpPayment.transaction_amount,
            db_amount: dbPayment.total_amount // Usar total_amount
          });
        }
      }
    });

    // Pagos en DB pero no en MP (potencialmente crítico)
    // CAMBIO 4: Filtrar registros sin payment_id para evitar errores
    dbPayments
      .filter(p => p.payment_id) // Solo incluir los que tienen payment_id
      .forEach(dbPayment => {
        const paymentId = dbPayment.payment_id.toString();
        if (!mpPaymentsMap.has(paymentId)) {
          discrepancies.push({
            type: 'missing_in_mp',
            payment_id: paymentId,
            amount: dbPayment.total_amount, // Usar total_amount
            date: dbPayment.created_at
          });
        }
      });

    // 5. Reporte
    if (discrepancies.length > 0) {
      console.error(`⚠️ Se encontraron ${discrepancies.length} discrepancias en pagos:`, discrepancies);
    } else {
      console.log(`✅ Verificación completa: ${mpPayments.results.length} pagos reconciliados correctamente`);
    }

    return {
      totalMercadoPago: mpPayments.results.length,
      totalDatabase: dbPayments.filter(p => p.payment_id).length, // Solo contar registros con payment_id
      discrepancies
    };

  } catch (error) {
    console.error('❌ Error verificando pagos:', error);
    throw error;
  }
}

export default verifyPayments;