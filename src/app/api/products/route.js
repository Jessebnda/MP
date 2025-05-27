import { NextResponse } from 'next/server';
import { getAllProducts, saveProduct } from '../../../lib/productService';
import { products as staticProducts } from '../../../data/products';
import { logInfo, logError } from '../../../utils/logger';

// Variable para controlar la inicialización (solo una vez por ejecución del servidor)
let initialized = false;

export async function GET() {
  logInfo('--- HIT /api/products ---');
  
  try {
    // Obtener todos los productos de Supabase
    let products = await getAllProducts();
    
    // Si no hay productos y no se ha inicializado, cargar desde datos estáticos
    if (products.length === 0 && !initialized) {
      logInfo('No se encontraron productos en Supabase. Inicializando desde datos estáticos...');
      
      // Procesar productos uno por uno
      for (const product of staticProducts) {
        logInfo(`Guardando producto: ${product.name}`);
        await saveProduct({
          id: product.id,
          name: product.name,
          description: product.description || '',
          price: product.price,
          category: product.category || 'general',
          stock_available: product.stockAvailable || 0,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
      
      logInfo('Productos inicializados correctamente desde datos estáticos');
      // Obtener los productos recién creados
      products = await getAllProducts();
      initialized = true;
    }
    
    return NextResponse.json(products);
  } catch (error) {
    logError('Error al obtener productos:', error);
    return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 });
  }
}