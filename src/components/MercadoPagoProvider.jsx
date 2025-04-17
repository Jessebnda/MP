'use client';

import { useState, useEffect, useCallback } from 'react';
import { initMercadoPago, Wallet } from '@mercadopago/sdk-react';

// Función para sanitizar datos de entrada
function sanitizeInput(value, type) {
  switch(type) {
    case 'productId':
      // Solo permitir letras, números y guiones
      return typeof value === 'string' ? value.replace(/[^a-zA-Z0-9-]/g, '') : 'default-product-id';
    case 'quantity':
      // Convertir a entero y validar rango
      const qty = parseInt(value);
      return !isNaN(qty) && qty > 0 && qty <= 100 ? qty : 1;
    default:
      return value;
  }
}

export default function MercadoPagoProvider({
  productId,
  quantity = 1,
  publicKey,
  apiBaseUrl = '',
  onSuccess = () => {},
  onError = () => {}
}) {
  const [preferenceId, setPreferenceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attemptCount, setAttemptCount] = useState(0);

  // Sanear inputs del componente
  const sanitizedProductId = sanitizeInput(productId, 'productId');
  const sanitizedQuantity = sanitizeInput(quantity, 'quantity');

  // Inicializar SDK de MercadoPago
  useEffect(() => {
    if (publicKey) {
      initMercadoPago(publicKey);
    } else {
      console.warn('Falta la clave pública de MercadoPago');
    }
  }, [publicKey]);

  // Crear preferencia de pago
  const createPreference = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!sanitizedProductId || sanitizedQuantity < 1) {
        throw new Error('Datos del producto inválidos');
      }
      
      if (attemptCount >= 5) {
        throw new Error('Demasiados intentos. Recarga la página e intenta de nuevo.');
      }

      const response = await fetch(`${apiBaseUrl}/api/create-preference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: sanitizedProductId,
          quantity: sanitizedQuantity
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Error ${response.status} creando preferencia`);
      }
      
      const data = await response.json();
      if (!data.preferenceId) {
        throw new Error('La respuesta de la API no incluyó un preferenceId');
      }
      
      setPreferenceId(data.preferenceId);
      setAttemptCount(0); // Resetear intentos con éxito
      
    } catch (e) {
      console.error("Error creando preferencia:", e);
      setError(`Error al preparar el pago: ${e.message}`);
      setAttemptCount(prev => prev + 1);
      if (onError) onError(e);
    } finally {
      setLoading(false);
    }
  }, [sanitizedProductId, sanitizedQuantity, apiBaseUrl, attemptCount, onError]);

  // Crear preferencia al montar o cambiar datos
  useEffect(() => {
    createPreference();
  }, [createPreference]);

  // Estados de interfaz
  if (loading) {
    return (
      <div className="mp-loading">
        <div className="mp-spinner"></div>
        <p>Preparando checkout...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mp-error">
        <p>Error: {error}</p>
        <button 
          className="mp-button mp-secondary" 
          onClick={createPreference}
          disabled={attemptCount >= 5}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="mp-wallet-container">
      {preferenceId ? (
        <Wallet
          initialization={{ preferenceId }}
          customization={{ texts: { action: 'pay', valueProp: 'security' } }}
          onReady={() => console.log('Wallet listo')}
          onError={(error) => {
            console.error('Error en wallet:', error);
            if (onError) onError(error);
          }}
          onSubmit={() => console.log('Pago iniciado')}
        />
      ) : (
        <p>Cargando opciones de pago...</p>
      )}
    </div>
  );
}