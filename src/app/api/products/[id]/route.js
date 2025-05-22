import { NextResponse } from 'next/server';
import { kv, getProductStock } from '../../../../lib/kv';
import { products as staticProducts } from '../../../../data/products';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    // Siempre obtener el producto estático primero para tener el precio correcto
    const staticProduct = staticProducts.find(p => p.id === id);
    
    if (!staticProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    
    // Obtener stock de KV
    const stock = await getProductStock(id);
    
    // Retornar el producto estático con el stock de KV
    return NextResponse.json({
      ...staticProduct,
      stockAvailable: stock
    });
  } catch (error) {
    console.error(`Error getting product ${params.id}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}