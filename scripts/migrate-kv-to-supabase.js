import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { kv } from '@vercel/kv';
import fs from 'fs';

// Importar los productos desde el archivo estático
import { products as staticProducts } from '../src/data/products.js';

// Configurar dotenv para cargar variables de entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env.local');

// Verificar si el archivo .env.local existe
if (fs.existsSync(envPath)) {
  console.log(`Cargando variables de entorno desde: ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.warn(`No se encontró el archivo .env.local en: ${envPath}`);
  dotenv.config(); // Intentar cargar de .env por defecto
}

// Verificar que las variables de entorno estén cargadas correctamente
console.log('Verificando variables de entorno:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY existe:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('KV_URL existe:', !!process.env.KV_URL);
console.log('KV_REST_API_TOKEN existe:', !!process.env.KV_REST_API_TOKEN);

// Verificar variables críticas
if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('Error: SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL es requerido');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY es requerido');
  process.exit(1);
}

// Crear cliente de Supabase con privilegios elevados
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Función para migrar datos de clientes
async function migrateCustomers() {
  console.log('Migrando datos de clientes...');
  try {
    const customerKeys = await kv.keys('customer:*');
    console.log(`Encontrados ${customerKeys.length} clientes para migrar`);
    
    for (const key of customerKeys) {
      const customerData = await kv.get(key);
      const customerId = key.replace('customer:', '');
      
      console.log(`Migrando cliente: ${customerId}`);
      
      // Extraer datos relevantes para la tabla de clientes
      const { 
        first_name, last_name, email, phone, 
        identification_type, identification_number 
      } = customerData;
      
      const { error: customerError } = await supabase
        .from('customers')
        .upsert({
          id: customerId,
          first_name,
          last_name,
          email,
          phone: phone || '',
          identification_type: identification_type || '',
          identification_number: identification_number || '',
          created_at: new Date(),
          updated_at: new Date()
        });
      
      if (customerError) {
        console.error(`Error al migrar cliente ${customerId}:`, customerError);
      } else {
        console.log(`✓ Cliente ${customerId} migrado correctamente`);
      }
      
      // Si hay datos de dirección, migrarlos a la tabla de direcciones
      if (customerData.street_name || customerData.address) {
        const address = customerData.address || customerData;
        
        const { error: addressError } = await supabase
          .from('customer_addresses')
          .upsert({
            customer_id: customerId,
            street_name: address.street_name || '',
            street_number: address.street_number || '',
            zip_code: address.zip_code || '',
            city: address.city || '',
            state: address.state || '',
            country: address.country || '',
            created_at: new Date(),
            updated_at: new Date()
          });
        
        if (addressError) {
          console.error(`Error al migrar dirección para cliente ${customerId}:`, addressError);
        } else {
          console.log(`  ✓ Dirección para cliente ${customerId} migrada correctamente`);
        }
      }
    }
  } catch (error) {
    console.error('Error migrando clientes:', error);
  }
}

// Función para migrar datos de pedidos
async function migrateOrders() {
  console.log('Migrando datos de pedidos...');
  try {
    const orderKeys = await kv.keys('order:*');
    console.log(`Encontrados ${orderKeys.length} pedidos para migrar`);
    
    for (const key of orderKeys) {
      const orderData = await kv.get(key);
      const orderId = key.replace('order:', '');
      
      console.log(`Migrando pedido: ${orderId}`);
      
      // Migrar datos principales del pedido
      const { 
        customer_id, total_amount, payment_status,
        shipment_status, shipment_notes, created_at 
      } = orderData;
      
      const { error: orderError } = await supabase
        .from('orders')
        .upsert({
          id: orderId,
          customer_id,
          total_amount: total_amount || 0,
          payment_status: payment_status || 'pending',
          shipment_status: shipment_status || 'pending',
          shipment_notes: shipment_notes || '',
          created_at: created_at || new Date(),
          updated_at: new Date(),
          version: 1
        });
      
      if (orderError) {
        console.error(`Error al migrar pedido ${orderId}:`, orderError);
      } else {
        console.log(`✓ Pedido ${orderId} migrado correctamente`);
      }
      
      // Si hay items del pedido, migrarlos a la tabla de items
      if (orderData.items && Array.isArray(orderData.items)) {
        for (const item of orderData.items) {
          const { 
            product_id, productId, quantity, price, subtotal 
          } = item;
          
          const { error: itemError } = await supabase
            .from('order_items')
            .upsert({
              order_id: orderId,
              product_id: product_id || productId,
              quantity: quantity || 1,
              price: price || 0,
              subtotal: subtotal || (price * quantity) || 0,
              created_at: new Date()
            });
          
          if (itemError) {
            console.error(`Error al migrar item para pedido ${orderId}:`, itemError);
          } else {
            console.log(`  ✓ Item ${product_id || productId} del pedido ${orderId} migrado correctamente`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error migrando pedidos:', error);
  }
}

// Función para migrar productos desde el archivo estático
async function migrateProductsFromStatic() {
  console.log('Migrando productos desde datos estáticos...');
  try {
    console.log(`Encontrados ${staticProducts.length} productos para migrar`);
    
    for (const product of staticProducts) {
      console.log(`Migrando producto: ${product.id} - ${product.name}`);
      
      const { error } = await supabase
        .from('products')
        .upsert({
          id: product.id,
          name: product.name,
          description: product.description || '',
          price: product.price,
          category: product.category || 'general',
          stock_available: product.stockAvailable || 0,
          created_at: new Date(),
          updated_at: new Date()
        });
      
      if (error) {
        console.error(`Error al migrar producto ${product.id}:`, error);
      } else {
        console.log(`✓ Producto ${product.id} - ${product.name} migrado correctamente`);
      }
    }
  } catch (error) {
    console.error('Error migrando productos:', error);
  }
}

// Función principal de migración
async function migrateData() {
  try {
    console.log('Iniciando migración de datos de Upstash KV a Supabase...');
    
    // Verificar la conexión con Supabase
    const { error } = await supabase.from('customers').select('count', { count: 'exact', head: true });
    if (error) {
      console.error('Error al conectar con Supabase:', error);
      process.exit(1);
    } else {
      console.log('✓ Conexión con Supabase verificada');
    }
    
    // Ejecutar migración de productos desde el archivo estático
    await migrateProductsFromStatic();
    
    // Ejecutar migración de clientes y pedidos desde KV
    await migrateCustomers();
    await migrateOrders();
    
    console.log('¡Migración completada con éxito!');
  } catch (error) {
    console.error('Error durante la migración:', error);
    process.exit(1);
  }
}

migrateData();