'use client'

import { Suspense, useState, useEffect } from 'react'
import PaymentFlow from '../components/PaymentFlow'
import MercadoPagoProvider from '../components/MercadoPagoProvider'
import { logInfo, logError } from '../utils/logger'

export default function Home() {
  const [params, setParams] = useState({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Debug URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    logInfo('URL Parameters:', Object.fromEntries([...urlParams.entries()]));
    
    // Asegurar que los colores tengan formato hexadecimal con #
    const formatColor = (color) => {
      if (!color) return null;
      // Remove any existing # before adding to avoid ##color
      return '#' + color.replace(/^#/, '');
    };
    
    const buttonColor = formatColor(urlParams.get('buttonColor')) || '#F26F32';
    const circleColor = formatColor(urlParams.get('circleColor')) || '#009EE3';
    const primaryButtonColor = formatColor(urlParams.get('primaryButtonColor')) || '#F26F32';
    const secondaryButtonColor = formatColor(urlParams.get('secondaryButtonColor')) || '#E5E5E5';
    
    const hideTitle = urlParams.get('hideTitle') === 'true';
    const quantity = parseInt(urlParams.get('quantity') || '1', 10);
    const initialProductId = urlParams.get('initialProductId') || urlParams.get('productId') || '';
    const publicKey = urlParams.get('publicKey') || process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;

    const defaultSuccessUrl = "https://alturadivina.com/confirmacion-de-compra";
    const defaultPendingUrl = "https://alturadivina.com/proceso-de-compra";
    const defaultFailureUrl = "https://alturadivina.com/error-de-compra";

    const finalSuccessUrl = (urlParams.get('successUrl') && urlParams.get('successUrl').startsWith('http')) 
      ? urlParams.get('successUrl') 
      : defaultSuccessUrl;
    const finalPendingUrl = (urlParams.get('pendingUrl') && urlParams.get('pendingUrl').startsWith('http')) 
      ? urlParams.get('pendingUrl') 
      : defaultPendingUrl;
    const finalFailureUrl = (urlParams.get('failureUrl') && urlParams.get('failureUrl').startsWith('http')) 
      ? urlParams.get('failureUrl') 
      : defaultFailureUrl;

    setParams({
      buttonColor,
      circleColor,
      primaryButtonColor,
      secondaryButtonColor,
      hideTitle,
      quantity,
      initialProductId,
      publicKey,
      finalSuccessUrl,
      finalPendingUrl,
      finalFailureUrl
    });

    // Establecer variables CSS globales con alta prioridad (directo al :root)
    document.documentElement.style.setProperty('--mp-button-color', buttonColor);
    document.documentElement.style.setProperty('--mp-circle-color', circleColor);
    document.documentElement.style.setProperty('--mp-primary-button-color', primaryButtonColor);
    document.documentElement.style.setProperty('--mp-secondary-button-color', secondaryButtonColor);
    
    console.log('Colores aplicados:', {
      buttonColor,
      circleColor,
      primaryButtonColor, 
      secondaryButtonColor
    });

  }, []);

  return (
    <div>
      {Object.keys(params).length > 0 ? (
        <div>
          <div style={{marginBottom: '20px'}}>
            <strong>Debug:</strong> Parameters loaded successfully
          </div>
          
          <PaymentFlow
            apiBaseUrl={process.env.NEXT_PUBLIC_HOST_URL || 'http://localhost:3000'}
            productsEndpoint="/api/products"
            mercadoPagoPublicKey={params.publicKey}
            PaymentProviderComponent={(props) => (
              <MercadoPagoProvider
                {...props}
                customStyles={{
                  buttonColor: params.buttonColor,
                  circleColor: params.circleColor,
                  primaryButtonColor: params.primaryButtonColor,
                  secondaryButtonColor: params.secondaryButtonColor
                }}
              />
            )}
            successUrl={params.finalSuccessUrl}
            pendingUrl={params.finalPendingUrl}
            failureUrl={params.finalFailureUrl}
            onSuccess={(data) => {
              console.log('Pago exitoso', data);
              // Try to communicate with parent if in iframe
              if (window.parent !== window) {
                window.parent.postMessage({
                  type: 'MP_PAYMENT_SUCCESS',
                  data: data
                }, '*');
              }
            }}
            onError={(error) => {
              console.error('Error en el pago', error);
              // Try to communicate with parent if in iframe
              if (window.parent !== window) {
                window.parent.postMessage({
                  type: 'MP_ERROR',
                  message: error.message
                }, '*');
              }
            }}
            hideTitle={params.hideTitle}
            initialProductId={params.initialProductId}
            customStyles={{
              primaryButtonColor: params.primaryButtonColor,
              secondaryButtonColor: params.secondaryButtonColor
            }}
          />
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          Cargando parámetros...
        </div>
      )}
    </div>
  );
}
