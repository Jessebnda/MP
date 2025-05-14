'use client'

import { Suspense, useState, useEffect } from 'react'
import PaymentFlow from '../components/PaymentFlow'
import MercadoPagoProvider from '../components/MercadoPagoProvider'

export default function Home() {
  const [params, setParams] = useState({});

  useEffect(() => {
    // Obtener parámetros de URL
    const urlParams = new URLSearchParams(window.location.search);
    const buttonColor = urlParams.get('buttonColor') || '#F26F32';
    const circleColor = urlParams.get('circleColor') || '#009EE3';
    // Nuevos parámetros de color para botones
    const primaryButtonColor = urlParams.get('primaryButtonColor') || '#F26F32';
    const secondaryButtonColor = urlParams.get('secondaryButtonColor') || '#E5E5E5';
    
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

    // Establecer variables CSS globales para todos los tipos de botones
    document.documentElement.style.setProperty('--mp-button-color', buttonColor);
    document.documentElement.style.setProperty('--mp-circle-color', circleColor);
    document.documentElement.style.setProperty('--mp-primary-button-color', primaryButtonColor);
    document.documentElement.style.setProperty('--mp-secondary-button-color', secondaryButtonColor);

  }, []);

  return (
    <div>
      <Suspense fallback={<div style={{ textAlign: 'center', padding: '20px' }}>Cargando configuración de pago...</div>}>
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
          onSuccess={(data) => console.log('Pago exitoso', data)}
          onError={(error) => console.error('Error en el pago', error)}
          hideTitle={params.hideTitle}
          initialProductId={params.initialProductId}
          customStyles={{
            primaryButtonColor: params.primaryButtonColor,
            secondaryButtonColor: params.secondaryButtonColor
          }}
        />
      </Suspense>
    </div>
  );
}
