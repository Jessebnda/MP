import { NextResponse } from 'next/server';

// Sample products data
const products = [
  {
    id: '1',
    name: 'Reposado',
    description: 'Envejecido 9 meses en roble blanco, ofrece suavidad y sabores de caramelo, vainilla, miel y agave. Perfecto solo o en cocteles.',
    price: 1500,
    category: 'tequilas',
    stockAvailable: 5
  },
  {
    id: '2',
    name: 'Blanco',
    description: 'Tequila puro y vibrante, con notas frescas de agave cocido, miel, cítricos y florales. Ideal para cocteles.',
    price: 1500,
    category: 'tequilas',
    stockAvailable: 50
  },
  {
    id: '3',
    name: 'Cristalino',
    description: 'Filtrado tras su reposo, es suave y elegante, con notas de piña, miel y caramelo. Disfrútalo solo o con hielo.',
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