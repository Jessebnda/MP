'use client'

import { Suspense, useState, useEffect } from 'react'
import PaymentFlow from '../components/PaymentFlow'
import MercadoPagoProvider from '../components/MercadoPagoProvider'
import CartIcon from '../components/CartIcon'; // Added
import CartSidebar from '../components/CartSidebar'; // Added

export default function Home() {
  const [params, setParams] = useState({});
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);

    const hideTitle = urlParams.get('hideTitle') === 'true';
    const initialProductId = urlParams.get('initialProductId') || null;
    const publicKey = urlParams.get('publicKey') || process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;

    // URLs FIJAS DE ALTURA DIVINA
    const finalSuccessUrl = "https://alturadivina.com/confirmacion-de-compra";
    const finalPendingUrl = "https://alturadivina.com/proceso-de-compra";
    const finalFailureUrl = "https://alturadivina.com/error-de-compra";

    const displayMode = urlParams.get('displayMode') || 'full';
    const initialStep = urlParams.has('initialStep') ? parseInt(urlParams.get('initialStep'), 10) : undefined;

    setParams({
      hideTitle,
      initialProductId,
      publicKey,
      successUrl: "https://alturadivina.com/confirmacion-de-compra",
      pendingUrl: "https://alturadivina.com/proceso-de-compra",
      failureUrl: "https://alturadivina.com/error-de-compra",
      displayMode,
      initialStep,
      apiBaseUrl: process.env.NEXT_PUBLIC_HOST_URL || 'http://localhost:3000'
    });
  }, []);

  if (Object.keys(params).length === 0) {
    return <div style={{ textAlign: 'center', padding: '20px' }}>Cargando configuración...</div>;
  }

  if (params.displayMode === 'cartIconOnly') {
    const checkoutBase = params.apiBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    const checkoutUrl = checkoutBase ? `${checkoutBase.replace(/\/$/, '')}/checkout` : '/checkout';

    return (
      <div style={{ padding: '20px' }}>
        <CartIcon onClick={() => setIsCartOpen(true)} />
        <CartSidebar
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          checkoutUrl={checkoutUrl}
        />
      </div>
    );
  }

  const paymentFlowProps = {
    apiBaseUrl: params.apiBaseUrl,
    productsEndpoint: "/api/products",
    mercadoPagoPublicKey: params.publicKey,
    PaymentProviderComponent: (props) => (
      <MercadoPagoProvider
        {...props}
        // No customStyles
      />
    ),
    successUrl: params.successUrl,      // <--- Cambia esto
    pendingUrl: params.pendingUrl,      // <--- Cambia esto
    failureUrl: params.failureUrl,      // <--- Cambia esto
    onSuccess: (data) => console.log('Pago exitoso (Home Page):', data),
    onError: (error) => console.error('Error en el pago (Home Page):', error),
    hideTitle: params.hideTitle,
    initialProductId: params.initialProductId,
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
