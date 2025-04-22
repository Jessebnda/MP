import { NextResponse } from 'next/server';

// Dominios permitidos para acceder a tus APIs
const allowedOrigins = [
  // Tu propio dominio de la app
  'https://mp-ecru-zeta.vercel.app',
  // Dominios de Framer donde estará embebido
  'https://framer.com',
  'https://framer.app',
  new RegExp('^https:\/\/.*\.framer\.app$'),
  'https://alturadivina.com',
  // Para desarrollo local
  'http://localhost:3000'
];

export function middleware(request) {
  // Solo aplicar a rutas API
  if (!request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const origin = request.headers.get('origin');
  
  // Si no hay origen (llamada directa) o es uno permitido
  const isAllowedOrigin = !origin || allowedOrigins.some(allowed => {
    if (allowed instanceof RegExp) {
      return allowed.test(origin);
    }
    return origin === allowed;
  });

  if (!isAllowedOrigin) {
    // Bloquear origen no permitido
    return new NextResponse(null, {
      status: 403,
      statusText: 'Forbidden',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  // Permitir la solicitud y configurar CORS apropiadamente
  const response = NextResponse.next();
  
  // Si hay un origen, configurar CORS solo para ese origen específico
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');

  return response;
}

export const config = {
  matcher: '/api/:path*',
};