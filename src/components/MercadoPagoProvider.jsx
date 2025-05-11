'use client';

import { useState, useEffect, useCallback } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import styles from '../styles/MercadoPagoProvider.module.css';

// Sanitiza valores de entrada
function sanitizeInput(value, type) {
  switch (type) {
    case 'productId':
      return typeof value === 'string'
        ? value.replace(/[^a-zA-Z0-9-]/g, '')
        : 'default-product-id';
    case 'quantity':
      const qty = parseInt(value, 10);
      return !isNaN(qty) && qty > 0 && qty <= 100 ? qty : 1;
    default:
      return value;
  }
}

export default function MercadoPagoProvider({
  publicKey,
  productId,
  quantity,
  onPaymentSuccess,
  onPaymentError,
}) {
  const sanitizedProductId = sanitizeInput(productId, 'productId');
  const sanitizedQuantity = sanitizeInput(quantity, 'quantity');
  const [mpInstance, setMpInstance] = useState(null);

  // Inicializa el SDK
  useEffect(() => {
    initMercadoPago(publicKey, { locale: 'es-AR' })
      .then(mp => setMpInstance(mp))
      .catch(console.error);
  }, [publicKey]);

  const handleSubmit = useCallback(
    payload => {
      onPaymentSuccess(payload);
    },
    [onPaymentSuccess]
  );

  const handleReady = useCallback(() => {
    console.log('Brick listo');
  }, []);

  const handleError = useCallback(
    error => {
      onPaymentError(error);
    },
    [onPaymentError]
  );

  // Customización visual
  const customization = {
    visual: {
      style: {
        theme: 'default',
        customVariables: {
          /* Tipografías */
          '--mp-font-family-base':
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          '--mp-font-family-heading': '"Playfair Display", serif',
          /* Tamaños */
          '--mp-font-size-base': '1rem',
          '--mp-font-size-label': '0.875rem',
          '--mp-font-size-heading': '2rem',
          /* Colores */
          '--mp-base-background-color': '#ffffff',
          '--mp-text-primary-color': '#000000',
          '--mp-text-secondary-color': '#999999',
          /* Inputs */
          '--mp-input-background-color': '#ffffff',
          '--mp-input-border-color': '#000000',
          '--mp-input-border-width': '1px',
          '--mp-input-border-radius': '0',
          '--mp-input-padding': '12px 16px',
          /* Botón */
          '--mp-button-background-color': '#FF7A1A',
          '--mp-button-hover-background-color': '#E56500',
          '--mp-button-border-radius': '0',
          '--mp-button-text-transform': 'uppercase',
          '--mp-button-font-weight': '600',
          '--mp-button-font-size': '1rem',
        },
      },
      texts: {
        payButton: 'Pagar ahora',
      },
    },
  };

  return (
    <div className={styles.paymentBrickContainer}>
      {mpInstance && (
        <Payment
          initialization={mpInstance}
          customization={customization}
          onSubmit={handleSubmit}
          onReady={handleReady}
          onError={handleError}
          processing={`product=${sanitizedProductId}&quantity=${sanitizedQuantity}`}
        />
      )}
    </div>
  );
}
