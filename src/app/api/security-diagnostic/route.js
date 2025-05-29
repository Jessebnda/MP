import { NextResponse } from 'next/server';
import { logInfo, logError } from '../../../utils/logger';
import { logSecurityEvent } from '../../../lib/security-logger';

export async function GET(req) {
  try {
    // Solo permitir en desarrollo
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'No disponible en producción' }, { status: 403 });
    }
    
    // Verificar cabeceras de seguridad
    const headers = {};
    headers['Content-Security-Policy'] = !!req.headers.get('content-security-policy');
    headers['X-Frame-Options'] = req.headers.get('x-frame-options');
    headers['X-Content-Type-Options'] = req.headers.get('x-content-type-options');
    headers['Referrer-Policy'] = req.headers.get('referrer-policy');
    headers['Strict-Transport-Security'] = !!req.headers.get('strict-transport-security');
    headers['X-XSS-Protection'] = req.headers.get('x-xss-protection');
    headers['Permissions-Policy'] = !!req.headers.get('permissions-policy');
    
    logSecurityEvent('security_diagnostic_requested', {}, 'info');
    
    return NextResponse.json({
      success: true,
      headers,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logError('Error en diagnóstico de seguridad:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}