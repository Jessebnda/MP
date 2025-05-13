import { NextResponse } from 'next/server';

// Sample products data
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

export async function GET() {
  try {
    // Return the products array
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}