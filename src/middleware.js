// middleware.js
// Middleware deshabilitado para CORS, se pasa todo al next()
import { NextResponse } from 'next/server';

export function middleware(request) {
  return NextResponse.next();
}

// No matcher = no se aplica a ninguna ruta
export const config = {};
