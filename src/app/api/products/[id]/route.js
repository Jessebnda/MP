import { NextResponse } from 'next/server';

// Sample products data (same as in the main products route)
const products = [
  {
    id: '1',
    name: 'Reposado',
    description: 'Tequila reposado premium, añejado en barricas de roble por 6 meses',
    price: 1500,
    category: 'tequilas',
    stockAvailable: 5
  },
  {
    id: '2',
    name: 'Blanco',
    description: 'Tequila blanco cristalino, sabor suave y fresco',
    price: 1500,
    category: 'tequilas',
    stockAvailable: 50
  },
  {
    id: '3',
    name: 'Cristalino',
    description: 'Tequila premium cristalino, filtrado con carbón activado',
    price: 1500, 
    category: 'tequilas',
    stockAvailable: 100 
  }
];

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const product = products.find(p => p.id === id);

    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error(`Error obteniendo producto ${params.id}:`, error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}