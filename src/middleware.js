import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

export function middleware(request) {
  // Generar nonce único por request
  const nonce = nanoid();
  const requestHeaders = new Headers(request.headers);
  
  // Agregar nonce como header para que esté disponible en componentes
  requestHeaders.set('x-nonce', nonce);
  
  // Obtener CSP actual
  let csp = request.headers.get('content-security-policy') || '';
  
  // Reemplazar CSP con nonce
  if (csp) {
    csp = csp.replace(/'unsafe-inline'/, `'nonce-${nonce}'`);
    requestHeaders.set('content-security-policy', csp);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: '/((?!api|_next/static|favicon.ico).*)',
};