import { useState, useEffect } from 'react';
import { initMercadoPago } from '@mercadopago/sdk-react';
import { logInfo, logError } from '../utils/logger';

/**
 * Hook para inicializar y gestionar el SDK de MercadoPago
 * @param {string} publicKey - La clave pública de MercadoPago
 * @returns {Object} - Estado del SDK: {sdkReady, sdkError}
 */
export function useMercadoPagoSdk(publicKey) {
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState(null);

  useEffect(() => {
    // Función para inicializar el SDK
    const initializeSdk = async () => {
      if (!publicKey) {
        const error = 'Error de configuración: Falta la clave pública de MercadoPago.';
        logError(error);
        setSdkError(error);
        return;
      }

      try {
        // Inicializar el SDK de MercadoPago
        await initMercadoPago(publicKey);
        logInfo('SDK de MercadoPago inicializado correctamente');
        setSdkReady(true);
        setSdkError(null);
      } catch (error) {
        const errorMsg = `Error al inicializar el SDK de MercadoPago: ${error.message}`;
        logError(errorMsg, error);
        setSdkError(errorMsg);
        setSdkReady(false);
      }
    };

    initializeSdk();

    // Limpieza (opcional si el SDK requiere alguna limpieza)
    return () => {
      logInfo('Limpiando SDK de MercadoPago');
      // Aquí podrías añadir código de limpieza si es necesario
    };
  }, [publicKey]);

  return { sdkReady, sdkError };
}