import { NextResponse } from 'next/server';
import { kv, getProductStock } from '../../../../lib/kv';
import { products as staticProducts } from '../../../../data/products';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    // Try to get product from KV first
    const kvProduct = await kv.get(`product:${id}`);
    
    if (kvProduct) {
      // Get latest stock
      const stock = await getProductStock(id);
      
      return NextResponse.json({
        ...kvProduct,
        stockAvailable: stock
      });
    }
    
    // Fall back to static data if not in KV
    const staticProduct = staticProducts.find(p => p.id === id);
    
    if (!staticProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(staticProduct);
  } catch (error) {
    console.error(`Error getting product ${params.id}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}