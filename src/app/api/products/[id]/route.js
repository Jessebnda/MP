import { NextResponse } from 'next/server';
import { getProductById } from '../../../../data/products';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    console.log("Fetching product with ID:", id);

    const product = getProductById(id);
    
    if (!product) {
      console.log("Product not found for ID:", id);
      return NextResponse.json(
        { error: 'Producto no encontrado' }, 
        { status: 404 }
      );
    }
    
    return NextResponse.json(product);
  } catch (error) {
    console.error("Error fetching product:", error); 
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    );
  }
}