import { useCallback, useMemo, useEffect } from 'react';

/**
 * Hook para manejar el sessionId de manera consistente en toda la aplicación
 * Este hook asegura que el sessionId sea el mismo para todos los componentes
 * y que se propague correctamente entre la página principal y los iframes de Framer
 */
export function useSessionId(sessionIdOverride = null) {
  // Función para obtener o crear el sessionId global
  const getOrCreateGlobalSessionId = useCallback(() => {
    // 1. Intentar obtener de la URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionFromUrl = urlParams.get('sessionId');
      if (sessionFromUrl) return sessionFromUrl;
    }
    
    // 2. Intentar obtener del sessionStorage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const storedId = sessionStorage.getItem('mp_global_session_id');
      if (storedId) return storedId;
    }
    
    // 3. Crear uno nuevo y guardarlo para que sea consistente
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('mp_global_session_id', newSessionId);
    }
    return newSessionId;
  }, []);
  
  // Usar el sessionId proporcionado o generarlo/obtenerlo
  const sessionId = useMemo(() => 
    sessionIdOverride || getOrCreateGlobalSessionId(), 
  [getOrCreateGlobalSessionId, sessionIdOverride]);
  
  // Asegurar que el sessionId esté disponible para los componentes Framer
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionId) {
      // Guardar en sessionStorage para que esté disponible para todos los componentes
      sessionStorage.setItem('mp_global_session_id', sessionId);
      
      // También hacer disponible como propiedad global
      window.mpSessionId = sessionId;
    }
  }, [sessionId]);
  
  return sessionId;
}