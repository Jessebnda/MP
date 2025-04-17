import { NextResponse } from 'next/server';
import { products } from '../../../data/products';

export async function GET() {
  try {
    // Convertir el objeto de productos a un array para la API
    const productsArray = Object.values(products);
    
    return NextResponse.json(productsArray);
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}