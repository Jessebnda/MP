import React, { useState, useEffect } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import cn from 'classnames';
import styles from '../styles/MercadoPagoProvider.module.css';
import '../styles/mercadopago-globals.css'; 
import { logInfo, logError } from '../utils/logger';
import { sanitizeInput } from '../utils/sanitize';

import { useMercadoPagoSdk } from '../hooks/useMercadoPagoSdk';
import { useMercadoPagoPreference } from '../hooks/useMercadoPagoPreference';
import { useMercadoPagoBrickSubmit } from '../hooks/useMercadoPagoBrickSubmit';

export default function MercadoPagoProvider({
  productId,
  quantity = 1,
  totalAmount = null,
  orderSummary = null,
  userData = null,
  publicKey,
  apiBaseUrl,
  successUrl,
  pendingUrl,
  failureUrl,
  onSuccess: onSuccessCallback = () => {},
  onError: onErrorCallback = () => {},
  className = '',
  containerStyles = {},
  hideTitle = false,
}) {
  const hostUrl = process.env.NEXT_PUBLIC_HOST_URL || 'http://localhost:3000';

  const { sdkReady, sdkError, mercadoPagoSdkInstance } = useMercadoPagoSdk(publicKey);
  
  const { preferenceId, isLoadingPreference, preferenceError } = useMercadoPagoPreference({
    orderSummary,
    userData,
    apiBaseUrl,
    successUrl,
    pendingUrl,
    failureUrl,
    hostUrl,
    isSdkReady: sdkReady,
  });

  const { 
    handleSubmit: processPayment, 
    isProcessing, 
    processingError: submitError, 
    statusMsg: submitStatusMsg 
  } = useMercadoPagoBrickSubmit({
    apiBaseUrl,
    orderSummary,
    productId,
    quantity,
    totalAmount: totalAmount !== null ? totalAmount : (orderSummary ? orderSummary.reduce((sum, item) => sum + item.price * item.quantity, 0) : 0),
    userData,
    onSuccess: onSuccessCallback,
    onError: onErrorCallback,
    successUrl,
    pendingUrl,
    failureUrl,
    hostUrl,
  });

  const [displayError, setDisplayError] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (sdkError) setDisplayError(sdkError);
    else if (preferenceError) setDisplayError(preferenceError);
    else if (submitError) setDisplayError(submitError);
    else setDisplayError(null);
  }, [sdkError, preferenceError, submitError]);

  useEffect(() => {
    if (submitStatusMsg) setStatusMsg(submitStatusMsg);
    else if (isLoadingPreference) setStatusMsg('Generando formulario de pago...');
    else if (isProcessing) setStatusMsg('Procesando pago...');
    else setStatusMsg('');
  }, [submitStatusMsg, isLoadingPreference, isProcessing]);

  // Usa colores fijos en la configuración visual
  const paymentCustomization = {
    visual: {
      hideFormTitle: hideTitle,
      hidePaymentButton: false,
      style: {
        theme: 'default',
        colors: {
          primary: '#F26F32',
          secondary: '#E5E5E5',
          error: '#e74c3c',
          background: '#FFFFFF',
          text: '#333333'
        },
        borderRadius: '4px'
      }
    },
    paymentMethods: {
      creditCard: 'all',
      debitCard: 'all'
    }
  };

  useEffect(() => {
    // Send ready message to parent when loaded
    if (window.parent !== window) {
      window.parent.postMessage({ 
        type: 'MP_COMPONENT_READY',
        status: 'ready'
      }, '*');
    }
    
    // Listen for messages from parent
    const handleMessage = (event) => {
      // Only process messages from trusted domains
      if (!event.origin.includes('framer.com') && !event.origin.includes('framer.app')) {
        return;
      }
      
      if (event.data.type === 'MP_CREATE_PREFERENCE') {
        // Trigger preference creation
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Error handler for Payment component
  const handleError = (err) => {
    logError("Error en Payment:", err);
    setDisplayError('Error: No se pudo inicializar el formulario de pago.');
    if (process.env.NODE_ENV === 'development') {
      logError('Detalles del error de Payment:', err);
    }
    onErrorCallback(err);
  };

  // Ready handler for Payment component
  const handleReady = () => {
    logInfo('Payment está listo.');
  };
  
  // Overall loading state
  const isLoading = !sdkReady || isLoadingPreference;

  if (isLoading && !preferenceId) {
    return (
      <div className={cn(styles.loading, className)} style={containerStyles}>
        <div className={styles.spinner}></div>
        <p>{sdkError ? 'Error de configuración.' : 'Preparando formulario de pago...'}</p>
      </div>
    );
  }

  if (displayError && !isProcessing) {
    return (
      <div className={cn(styles.errorContainer, className)} style={containerStyles}>
        <p className={styles.errorMessage}>{displayError}</p>
      </div>
    );
  }
  
  const finalTotalAmount = totalAmount !== null 
    ? totalAmount 
    : (orderSummary && orderSummary.length > 0
        ? orderSummary.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        : 0);

  return (
    <div className={cn(styles.paymentFormContainer, className)} style={containerStyles}>
      {statusMsg && <p className={styles.statusMessage}>{statusMsg}</p>}
      {isProcessing && displayError && <p className={styles.errorMessage}>{displayError}</p>}
      
      {preferenceId && sdkReady ? (
        <Payment
          key={`payment-${preferenceId}`}
          initialization={{
            amount: finalTotalAmount,
            preferenceId: preferenceId || '',  // Asegurarte que nunca sea undefined
            mercadoPago: sdkInstance // Referencia a la instancia de SDK inicializada
          }}
          customization={paymentCustomization}
          onSubmit={processPayment}
          onReady={handleReady}
          onError={handleError}
        />
      ) : (
        <div className={styles.loadingPreference}>
          {isLoadingPreference || !sdkReady ? (
            <>
              <div className={styles.spinner}></div>
              <p>Cargando formulario de pago...</p>
            </>
          ) : (
            <p>Error al preparar el formulario. Verifique la configuración.</p>
          )}
        </div>
      )}
    </div>
  );
}
