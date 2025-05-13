import { cookies } from 'next/headers';
import { logError, logInfo } from './logger';

/**
 * Valida el token CSRF en la solicitud
 * @param {Request} req - Objeto de solicitud de Next.js
 * @returns {Promise<void>}
 * @throws {Error} Si el token CSRF no es válido
 */
export async function validateCsrfToken(req) {
  // En desarrollo, puedes hacer que sea opcional
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  try {
    // Intenta obtener el token CSRF del encabezado
    const csrfToken = req.headers.get('X-CSRF-Token');
    
    // Si no hay token CSRF en el encabezado, verifica si estamos en desarrollo
    if (!csrfToken) {
      if (process.env.NODE_ENV === 'development') {
        logInfo('CSRF validation skipped (development mode, no token)');
        return;
      }
      throw new Error('CSRF token missing');
    }

    // Obtener el token almacenado en cookies
    const storedToken = cookies().get('csrf-token')?.value;
    
    if (!storedToken) {
      throw new Error('CSRF token not found in cookies');
    }

    // Comparar los tokens
    if (csrfToken !== storedToken) {
      throw new Error('CSRF token validation failed');
    }

    logInfo('CSRF token validated successfully');
    return true;
  } catch (error) {
    // Crear un error personalizado con un flag para identificarlo
    const csrfError = new Error(`CSRF validation failed: ${error.message}`);
    csrfError.isCsrfError = true;
    logError('CSRF Error:', error);
    throw csrfError;
  }
}