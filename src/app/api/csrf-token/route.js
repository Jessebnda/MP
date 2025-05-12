import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { logSecurityEvent } from '../../../lib/security-logger';

export async function GET() {
  // Generar un token aleatorio seguro
  const csrfToken = crypto.randomBytes(32).toString('hex');
  
  // Almacenar en cookie httpOnly con configuraciones de seguridad
  cookies().set('csrf-token', csrfToken, { 
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 // 1 hora de validez
  });
  
  // Registrar creación de token para auditoría
  logSecurityEvent('csrf_token_created', {
    tokenLength: csrfToken.length
  });
  
  // Devolver el token al cliente para incluirlo en los headers
  return NextResponse.json({ csrfToken });
}