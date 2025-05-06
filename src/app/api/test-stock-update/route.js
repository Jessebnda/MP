import { NextResponse } from 'next/server';
import { kv, updateProductStock } from '../../../lib/kv';

export async function GET() {
  try {
    // Obtener el stock actual DIRECTAMENTE desde KV
    const productId = '1';
    
    // Forzar lectura directa de KV
    const stockKey = `product:${productId}:stock`;
    const beforeStock = await kv.get(stockKey);
    
    console.log(`Stock actual leído directamente: ${beforeStock}`);
    
    // Intentar actualizar el stock (incrementando en 1)
    const newStock = (beforeStock || 0) + 1;
    
    // Actualizar directamente sin usar la función auxiliar
    await kv.set(stockKey, newStock);
    
    // Verificar que se actualizó correctamente
    const afterStock = await kv.get(stockKey);
    
    // Devolver todos los resultados para diagnóstico
    return NextResponse.json({
      directUpdate: true,
      beforeUpdate: beforeStock,
      afterUpdate: afterStock,
      kv_url_present: !!process.env.KV_URL,
      kv_rest_api_url_present: !!process.env.KV_REST_API_URL,
      kv_rest_api_token_length: process.env.KV_REST_API_TOKEN?.length || 0
    });
  } catch (error) {
    console.error('Error en test de actualización de stock:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}