import { NextResponse } from 'next/server';
import { products, getProductById } from '@/data/products.js';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const product = getProductById(id);
    
    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error(`Error obteniendo producto ${params.id}:`, error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}