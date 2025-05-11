'use client';

import { useState, useEffect, useCallback } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import styles from '../styles/MercadoPagoProvider.module.css';

function sanitizeInput(value, type) {
  if (type === 'productId') {
    return typeof value === 'string'
      ? value.replace(/[^a-zA-Z0-9-]/g, '')
      : 'default-product-id';
  }
  if (type === 'quantity') {
    const qty = parseInt(value, 10);
    return !isNaN(qty) && qty > 0 && qty <= 100 ? qty : 1;
  }
  return value;
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

  useEffect(() => {
    if (publicKey) {
      initMercadoPago(publicKey, { locale: 'es-AR' })
        .then(mp => {
          setMpInstance(mp);
          console.log('MercadoPago SDK initialized successfully.');
        })
        .catch(error => {
          console.error('Error initializing MercadoPago SDK:', error);
        });
    } else {
      console.warn('MercadoPagoProvider: publicKey is missing or empty. SDK not initialized.');
    }
  }, [publicKey]);

  const handleSubmit = useCallback(
    payload => onPaymentSuccess(payload),
    [onPaymentSuccess]
  );
  const handleReady = useCallback(() => console.log('Brick listo'), []);
  const handleError = useCallback(
    err => onPaymentError(err),
    [onPaymentError]
  );

  const customization = {
    visual: {
      style: {
        theme: 'default',
        customVariables: {
          /*** Colores ***/
          baseColor: '#000000',
          textPrimaryColor: '#000000',      // texto primario
          textSecondaryColor: '#999999',    // placeholder y labels secundarios
          formBackgroundColor: '#ffffff',   // fondo del formulario
          inputBackgroundColor: '#ffffff',  // fondo de cada input
          inputBorderColor: '#000000',      // borde de cada input
          inputBorderWidth: '1px',
          borderRadius: '0px',              // radio global
          /*** Tipografía y tamaños ***/
          fontFamily: '"Playfair Display", serif', // headings
          inputFontFamily: 'monospace',
          inputFontSize: '1rem',
          labelFontSize: '0.875rem',
          /*** Espaciados ***/
          inputVerticalPadding: '12px',
          inputHorizontalPadding: '16px',
          /*** Placeholder ***/
          inputPlaceholderTextColor: '#999999',
          /*** Botón ***/
          buttonTextColor: '#ffffff',
          buttonBackgroundColor: '#FF7A1A',
          buttonHoverBackgroundColor: '#E56500',
          buttonBorderRadius: '0px',
          buttonFontSize: '1rem',
          buttonPadding: '12px 24px',
          /*** Errores ***/
          errorColor: '#E00000'
        }
      },
      texts: {
        formTitle: 'Tarjeta de débito o crédito',
        cardSectionTitle: 'Número de tarjeta',
        expirationSectionTitle: 'Vencimiento',
        securityCodeSectionTitle: 'Código de seguridad',
        cardholderName: {
          label: 'Nombre del titular como aparece en la tarjeta'
        },
        cardholderId: {
          label: 'Identificación del titular'
        },
        emailSectionTitle: 'Completa tu información',
        email: {
          label: 'E-mail'
        },
        payButton: 'Pagar'
      }
    },
    paymentMethods: {
      maxInstallments: 1
    }
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
