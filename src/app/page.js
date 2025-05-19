'use client'

import { Suspense, useState, useEffect } from 'react'
import PaymentFlow from '../components/PaymentFlow'
import MercadoPagoProvider from '../components/MercadoPagoProvider'
import CartIcon from '../components/CartIcon'; // Added
import CartSidebar from '../components/CartSidebar'; // Added

export default function Home() {
  const [params, setParams] = useState({});
  const [isCartOpen, setIsCartOpen] = useState(false); // Added for cartIconOnly mode

  useEffect(() => {
    // Obtener parámetros de URL
    const urlParams = new URLSearchParams(window.location.search);
    
    // Asegurar que los colores tengan formato hexadecimal con #
    const formatColor = (color) => {
      if (!color) return null;
      return color.startsWith('#') ? color : `#${color}`;
    };
    
    const buttonColor = formatColor(urlParams.get('buttonColor')) || '#F26F32';
    const circleColor = formatColor(urlParams.get('circleColor')) || '#009EE3'; // Default from original page.js
    const primaryButtonColor = formatColor(urlParams.get('primaryButtonColor')) || '#F26F32';
    const secondaryButtonColor = formatColor(urlParams.get('secondaryButtonColor')) || '#E5E5E5';
    
    const hideTitle = urlParams.get('hideTitle') === 'true';
    const initialProductId = urlParams.get('initialProductId') || null;
    const publicKey = urlParams.get('publicKey') || process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;

    // Default URLs based on current origin if not provided
    const defaultSuccessUrl = typeof window !== 'undefined' ? `${window.location.origin}/success` : '/success';
    const defaultPendingUrl = typeof window !== 'undefined' ? `${window.location.origin}/pending` : '/pending';
    const defaultFailureUrl = typeof window !== 'undefined' ? `${window.location.origin}/failure` : '/failure';

    const finalSuccessUrl = urlParams.get('successUrl') || defaultSuccessUrl;
    const finalPendingUrl = urlParams.get('pendingUrl') || defaultPendingUrl;
    const finalFailureUrl = urlParams.get('failureUrl') || defaultFailureUrl;

    // New parameters for display mode and initial step
    const displayMode = urlParams.get('displayMode') || 'full'; // Options: 'full', 'cartIconOnly', 'paymentFlowOnly'
    const initialStep = urlParams.has('initialStep') ? parseInt(urlParams.get('initialStep'), 10) : undefined;

    setParams({
      buttonColor,
      circleColor,
      primaryButtonColor,
      secondaryButtonColor,
      hideTitle,
      initialProductId,
      publicKey,
      finalSuccessUrl,
      finalPendingUrl,
      finalFailureUrl,
      displayMode, // Added
      initialStep, // Added
      apiBaseUrl: process.env.NEXT_PUBLIC_HOST_URL || 'http://localhost:3000'
    });

    // Establecer variables CSS globales con alta prioridad (directo al :root)
    document.documentElement.style.setProperty('--mp-button-color', buttonColor);
    document.documentElement.style.setProperty('--mp-circle-color', circleColor);
    document.documentElement.style.setProperty('--mp-primary-button-color', primaryButtonColor);
    document.documentElement.style.setProperty('--mp-secondary-button-color', secondaryButtonColor);
    
    console.log('Params loaded:', {
      displayMode, initialStep, buttonColor, circleColor, primaryButtonColor, secondaryButtonColor, hideTitle, initialProductId, publicKey
    });

  }, []);

  if (Object.keys(params).length === 0) {
    return <div style={{ textAlign: 'center', padding: '20px' }}>Cargando configuración...</div>;
  }

  if (params.displayMode === 'cartIconOnly') {
    const checkoutBase = params.apiBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    const checkoutUrl = checkoutBase ? `${checkoutBase.replace(/\/$/, '')}/checkout` : '/checkout';

    return (
      <div style={{ padding: '20px' }}> {/* Add styling as needed */}
        <CartIcon onClick={() => setIsCartOpen(true)} />
        <CartSidebar
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          checkoutUrl={checkoutUrl}
        />
      </div>
    );
  }

  // For 'full' or 'paymentFlowOnly' modes, render PaymentFlow
  const paymentFlowProps = {
    apiBaseUrl: params.apiBaseUrl,
    productsEndpoint: "/api/products",
    mercadoPagoPublicKey: params.publicKey,
    PaymentProviderComponent: (props) => (
      <MercadoPagoProvider
        {...props}
        customStyles={{
          buttonColor: params.buttonColor,
          circleColor: params.circleColor,
          primaryButtonColor: params.primaryButtonColor,
          secondaryButtonColor: params.secondaryButtonColor
        }}
      />
    ),
    successUrl: params.finalSuccessUrl,
    pendingUrl: params.finalPendingUrl,
    failureUrl: params.finalFailureUrl,
    onSuccess: (data) => console.log('Pago exitoso (Home Page):', data),
    onError: (error) => console.error('Error en el pago (Home Page):', error),
    hideTitle: params.hideTitle,
    initialProductId: params.initialProductId,
    customStyles: { // These are for PaymentFlow's own styling elements
      primaryButtonColor: params.primaryButtonColor,
      secondaryButtonColor: params.secondaryButtonColor
    },
    ...(params.initialStep !== undefined && { initialStep: params.initialStep }),
  };
  
  return (
    <div>
      <Suspense fallback={<div style={{ textAlign: 'center', padding: '20px' }}>Cargando componente de pago...</div>}>
        <PaymentFlow {...paymentFlowProps} />
      </Suspense>
    </div>
  );
}
