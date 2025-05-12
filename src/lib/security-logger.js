/**
 * Sistema de logs de seguridad para monitorear eventos de seguridad
 */
import { logInfo, logWarn, logError } from './logger';

export function logSecurityEvent(type, details, severity = 'info') {
  const event = {
    timestamp: new Date().toISOString(),
    type,
    details,
    severity,
    environment: process.env.NODE_ENV,
    url: typeof window !== 'undefined' ? window.location.href : null,
  };
  
  // Log using our centralized logger instead of direct console
  switch(severity) {
    case 'error':
      logError(`[SEGURIDAD] ${type}`, details);
      break;
    case 'warn':
      logWarn(`[SEGURIDAD] ${type}`, details);
      break;
    default:
      logInfo(`[SEGURIDAD] ${type}`, details);
  }
  
  // En producción, enviar a un servicio de monitoreo
  if (process.env.NODE_ENV === 'production') {
    // Descomenta y configura según tu sistema de monitoreo
    // sendToSecurityMonitoring(event);
  }
  
  // Almacenar localmente SOLO en desarrollo para debugging
  if (process.env.NODE_ENV === 'development') {
    try {
      const securityLogs = JSON.parse(localStorage.getItem('mp_security_logs') || '[]');
      securityLogs.push(event);
      // Limitar a los últimos 100 eventos para evitar llenar localStorage
      while (securityLogs.length > 100) securityLogs.shift();
      localStorage.setItem('mp_security_logs', JSON.stringify(securityLogs));
    } catch (e) {
      // Silenciar errores de localStorage
    }
  }
  
  return event;
}

/**
 * Función para validar tokens y firmas
 */
export function validateSignature(data, signature, secret) {
  // Implementación específica de validación de firma
  try {
    // En una implementación real, usarías crypto para validar HMAC o similar
    return true; // Placeholder
  } catch (error) {
    logSecurityEvent('signature_validation_error', { error: error.message }, 'error');
    return false;
  }
}