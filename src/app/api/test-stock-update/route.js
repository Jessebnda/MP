import { NextResponse } from 'next/server';
import { kv, updateProductStock } from '@/lib/kv';

export async function GET() {
  try {
    // Obtener el stock actual para mostrar antes y después
    const productId = '1';
    const beforeStock = await kv.get(`product:${productId}:stock`);
    
    // Intentar actualizar el stock (incrementando en 1)
    const updateResult = await updateProductStock(productId, beforeStock + 1);
    
    // Obtener el stock actualizado
    const afterStock = await kv.get(`product:${productId}:stock`);
    
    // Devolver todos los resultados para diagnóstico
    return NextResponse.json({
      success: updateResult,
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