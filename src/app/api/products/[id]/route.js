import { NextResponse } from 'next/server';
import { getProductById } from '../../../../lib/productService';
import { logInfo, logError } from '../../../../utils/logger';

export async function GET(request, { params }) {
  const { id } = params;
  logInfo(`--- HIT /api/products/${id} ---`);
  
  try {
    const product = await getProductById(id);
    
    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }
    
    return NextResponse.json(product);
  } catch (error) {
    logError(`Error al obtener producto ${id}:`, error);
    return NextResponse.json({ error: 'Error al obtener producto' }, { status: 500 });
  }
}