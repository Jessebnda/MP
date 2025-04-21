'use client';

import { useState, useEffect, useCallback } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import styles from '../styles/MercadoPagoProvider.module.css';
import { cn } from '../lib/utils'; // Import the utility

// Función para sanitizar datos de entrada (sin cambios)
function sanitizeInput(value, type) {
  switch(type) {
    case 'productId':
      return typeof value === 'string' ? value.replace(/[^a-zA-Z0-9-]/g, '') : 'default-product-id';
    case 'quantity':
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
  apiBaseUrl, // Required, validated in PaymentFlow
  successUrl,
  pendingUrl,
  failureUrl,
  onSuccess = () => {},
  onError = () => {},
  className = '',
  containerStyles = {},
  hideTitle = false,
}) {
  const [loading, setLoading] = useState(true);
  const [displayError, setDisplayError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [productData, setProductData] = useState(null);
  const [isFetchingProduct, setIsFetchingProduct] = useState(false);

  const sanitizedProductId = sanitizeInput(productId, 'productId');
  const sanitizedQuantity = sanitizeInput(quantity, 'quantity');

  useEffect(() => {
    if (publicKey) {
      initMercadoPago(publicKey);
    } else {
      const configError = 'Error de configuración: Falta la clave pública.';
      console.error('MercadoPagoProvider requires a publicKey prop.');
      setDisplayError(configError);
      setLoading(false);
    }
  }, [publicKey]);

  const fetchProduct = useCallback(async () => {
    if (!sanitizedProductId) {
      setDisplayError('Falta el ID del producto');
      setLoading(false);
      return;
    }

    if (!apiBaseUrl) {
      setDisplayError('Falta la URL base de la API para obtener el producto');
      setLoading(false);
      return;
    }

    setIsFetchingProduct(true);
    setDisplayError(null);
    setLoading(true);

    try {
      const productUrl = `${apiBaseUrl.replace(/\/$/, '')}/api/products/${sanitizedProductId}`;
      if (process.env.NODE_ENV === 'development') {
        console.log('Fetching specific product from:', productUrl);
      }
      const response = await fetch(productUrl);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: No se pudo obtener el producto`);
      }
      const productInfo = await response.json();
      if (process.env.NODE_ENV === 'development') {
        console.log('Product fetched successfully:', productInfo);
      }
      setProductData(productInfo);
      setAttemptCount(0);
    } catch (err) {
      console.error('Error obteniendo producto:', err);
      setDisplayError(`Error al cargar datos del producto: ${err.message}`);
      setAttemptCount(prev => prev + 1);
      if (onError) onError(err);
    } finally {
      setLoading(false);
      setIsFetchingProduct(false);
    }
  }, [apiBaseUrl, sanitizedProductId, onError]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const handleSubmit = async (formData) => {
    if (isSubmitting || !productData) return;

    // --- LOG PARA DEBUG EN VERCEL ---
    console.log('FormData received from Payment Brick:', JSON.stringify(formData, null, 2)); 
    // ---------------------------------

    setIsSubmitting(true);
    setStatusMsg('Procesando pago...');
    setDisplayError(null);

    let redirectUrl = failureUrl;

    try {
      const paymentEndpoint = `${apiBaseUrl.replace(/\/$/, '')}/api/process-payment`;
      const backendPayload = {
        ...formData, // Asegúrate que formData realmente tenga payment_method_id aquí
        productId: sanitizedProductId,
        quantity: sanitizedQuantity,
      };

      if (process.env.NODE_ENV === 'development') {
        console.log('Sending payment data to:', paymentEndpoint);
        console.log('Payload:', JSON.stringify(backendPayload, null, 2));
      }

      const response = await fetch(paymentEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendPayload),
      });

      if (response.ok) {
        const data = await response.json();
        setStatusMsg('¡Pago procesado!');
        if (onSuccess) onSuccess(data);

        switch (data.status) {
          case 'approved': redirectUrl = successUrl; break;
          case 'in_process':
          case 'pending': redirectUrl = pendingUrl; break;
          default: redirectUrl = failureUrl; break;
        }
      } else {
        let backendErrorMsg = 'Hubo un problema al procesar tu pago. Inténtalo de nuevo.';
        try {
          const errorData = await response.json();
          backendErrorMsg = errorData.error || backendErrorMsg;
          if (process.env.NODE_ENV === 'development') {
            console.error('Error en proceso de pago (backend response):', errorData);
          }
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error en proceso de pago (backend response not JSON):', await response.text());
          }
        }
        setDisplayError(backendErrorMsg);
        redirectUrl = failureUrl;
      }
    } catch (e) {
      console.error('Error en handleSubmit:', e);
      setDisplayError('No se pudo completar el pago. Inténtalo nuevamente.');
      if (onError) onError(e);
    } finally {
      setIsSubmitting(false);
      if (redirectUrl) {
        setTimeout(() => { window.location.href = redirectUrl; }, 1500);
      }
    }
  };

  const handleError = (err) => {
    console.error("Error en Payment Brick:", err);
    setDisplayError('Error: No se pudo inicializar el formulario de pago.');
    setIsSubmitting(false);
    if (process.env.NODE_ENV === 'development') {
      console.error('Detalles del error del Payment Brick:', err);
    }
    if (onError) onError(err);
  };

  const handleReady = () => {
    // Optional: Clear status message or set a 'ready' message
    // setStatusMsg('Formulario listo.');
  };

  if (loading && !productData) {
    return (
      <div className={cn(styles.loading, className)}>
        <div className={styles.spinner}></div>
        <p>Preparando formulario de pago...</p>
      </div>
    );
  }

  if (!productData && displayError) {
    return (
      <div className={cn(styles.errorContainer, className)}>
        <p className={styles.errorMessage}>{displayError}</p>
        {attemptCount < 5 && (
          <button
            className={styles.retryButton}
            onClick={fetchProduct}
            disabled={isFetchingProduct}
          >
            {isFetchingProduct ? 'Reintentando...' : 'Reintentar'}
          </button>
        )}
        {attemptCount >= 5 && <p>Demasiados intentos fallidos.</p>}
      </div>
    );
  }

  const price = productData?.price || 0;
  const totalAmount = price * sanitizedQuantity;

  const initialization = { amount: totalAmount };
  const customization = {
    visual: { hideFormTitle: false, hidePaymentButton: false },
    paymentMethods: { creditCard: 'all', debitCard: 'all' },
  };

  return (
    <div className={cn(styles.paymentFormContainer, className)}>
      {statusMsg && <p className={styles.statusMessage}>{statusMsg}</p>}
      {displayError && !isFetchingProduct && <p className={styles.errorMessage}>{displayError}</p>}
      {productData && (
        <Payment
          key={sanitizedProductId}
          initialization={initialization}
          customization={customization}
          onSubmit={handleSubmit}
          onReady={handleReady}
          onError={handleError}
        />
      )}
    </div>
  );
}