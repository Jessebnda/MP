import { useState, useEffect, useCallback } from 'react';
import { logInfo, logError } from '../utils/logger';

// Helper to get CSRF token if needed
async function getCsrfToken() {
  try {
    const response = await fetch('/api/csrf-token');
    if (!response.ok) {
      throw new Error('Failed to fetch CSRF token');
    }
    const data = await response.json();
    return data.csrfToken;
  } catch (error) {
    logError("Error fetching CSRF token:", error);
    return null; // Continue without token in development
  }
}

export function useMercadoPagoPreference({
  orderSummary,
  userData,
  apiBaseUrl,
  successUrl,
  pendingUrl,
  failureUrl,
  hostUrl, // e.g., process.env.NEXT_PUBLIC_HOST_URL
  isSdkReady,
}) {
  const [preferenceId, setPreferenceId] = useState(null);
  const [isLoadingPreference, setIsLoadingPreference] = useState(false);
  const [preferenceError, setPreferenceError] = useState(null);

  const createPreference = useCallback(async () => {
    if (!isSdkReady || !orderSummary || orderSummary.length === 0) {
      if (orderSummary && orderSummary.length === 0) {
        setPreferenceError("No hay productos para procesar.");
      }
      return;
    }

    setIsLoadingPreference(true);
    setPreferenceError(null);
    setPreferenceId(null);

    try {
      // Obtener token CSRF si es necesario
      let csrfToken;
      try {
        csrfToken = await getCsrfToken();
      } catch (e) {
        // Continuar sin token en desarrollo
        csrfToken = null;
      }

      // Asegurar que las URLs son absolutas
      const baseUrl = hostUrl || window.location.origin;
      
      const ensureAbsoluteUrl = (url, fallback) => {
        if (!url) return fallback;
        return url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
      };

      const finalSuccessUrl = ensureAbsoluteUrl(successUrl, `${baseUrl}/confirmacion-de-compra`);
      const finalFailureUrl = ensureAbsoluteUrl(failureUrl, `${baseUrl}/error-de-compra`);
      const finalPendingUrl = ensureAbsoluteUrl(pendingUrl, `${baseUrl}/proceso-de-compra`);

      // Log para verificar
      logInfo("Enviando solicitud de preferencia con URLs y datos de usuario:", {
        finalSuccessUrl,
        finalPendingUrl, 
        finalFailureUrl,
        hasUserData: !!userData
      });
      
      if (orderSummary && orderSummary.length > 0) {
        logInfo("Usando datos de múltiples productos desde orderSummary:", orderSummary);
      }

      let payerData = null;
      if (userData) {
        payerData = JSON.parse(JSON.stringify(userData)); // Deep copy
        
        // Formatear teléfono para la API si existe
        if (payerData.phone && typeof payerData.phone === 'string') {
          const phoneStr = payerData.phone.replace(/\D/g, '');
          if (phoneStr.length >= 3) {
            payerData.phone = { 
              area_code: phoneStr.substring(0, Math.min(3, phoneStr.length -1 ) || 2), 
              number: phoneStr.substring(Math.min(3, phoneStr.length -1 ) || 2) 
            };
            logInfo("Teléfono formateado para API:", payerData.phone);
          } else {
            delete payerData.phone;
          }
        }
        
        // Asegurar que el número de calle sea string
        if (payerData.address && payerData.address.street_number) {
            payerData.address.street_number = String(payerData.address.street_number);
        }
      }
      
      // Ajustar la URL de API para desarrollo local si es necesario
      const adjustedApiUrl = apiBaseUrl.includes('localhost')
        ? apiBaseUrl.replace('https://', 'http://')
        : apiBaseUrl;

      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await fetch(`${adjustedApiUrl.replace(/\/$/, '')}/api/create-preference`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orderSummary,
          payer: payerData,
          successUrl: finalSuccessUrl,
          pendingUrl: finalPendingUrl,
          failureUrl: finalFailureUrl,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        logError("Error creando preferencia:", data);
        throw new Error(data.error || `Error del servidor: ${response.status}`);
      }

      logInfo("Preferencia creada exitosamente:", data);
      setPreferenceId(data.preferenceId);
    } catch (error) {
      logError("Error creando preferencia en hook:", error);
      setPreferenceError(`Error: ${error.message || 'Error desconocido al crear preferencia'}`);
    } finally {
      setIsLoadingPreference(false);
    }
  }, [
    isSdkReady,
    orderSummary,
    userData,
    apiBaseUrl,
    successUrl,
    pendingUrl,
    failureUrl,
    hostUrl,
  ]);

  useEffect(() => {
    // Crear preferencia automáticamente cuando se cumplan las condiciones
    if (isSdkReady && orderSummary && orderSummary.length > 0 && !preferenceId && !isLoadingPreference) {
      createPreference();
    }
  }, [isSdkReady, orderSummary, preferenceId, isLoadingPreference, createPreference]);

  return { preferenceId, isLoadingPreference, preferenceError, createPreference };
}