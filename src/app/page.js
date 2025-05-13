'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import PaymentFlow from '../components/PaymentFlow'
import MercadoPagoProvider from '../components/MercadoPagoProvider'

// Nuevo componente que encapsula la lógica que usa useSearchParams
function HomePageContent() {
  const params = useSearchParams()
  
  const publicKey = params.get('publicKey') || process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY
  
  // Reemplazar las definiciones de URL con URLs absolutas
  const defaultSuccessUrl = "https://alturadivina.com/confirmacion-de-compra";
  const defaultPendingUrl = "https://alturadivina.com/proceso-de-compra";
  const defaultFailureUrl = "https://alturadivina.com/error-de-compra";

  // Siempre dar prioridad a las URLs absolutas, incluso si hay parámetros
  const finalSuccessUrl = (params.get('successUrl') && params.get('successUrl').startsWith('http')) 
    ? params.get('successUrl') 
    : defaultSuccessUrl;
  const finalPendingUrl = (params.get('pendingUrl') && params.get('pendingUrl').startsWith('http')) 
    ? params.get('pendingUrl') 
    : defaultPendingUrl;
  const finalFailureUrl = (params.get('failureUrl') && params.get('failureUrl').startsWith('http')) 
    ? params.get('failureUrl') 
    : defaultFailureUrl;

  const hideTitle = params.get('hideTitle') === 'true'
  const quantity = parseInt(params.get('quantity') || '1', 10)
  const initialProductId = params.get('initialProductId') || params.get('productId') || ''
  
  const buttonColor = params.get('buttonColor') || '#F26F32';
  const circleColor = params.get('circleColor') || '#009EE3';

  return (
    <PaymentFlow
      apiBaseUrl={process.env.NEXT_PUBLIC_HOST_URL || 'http://localhost:3000'}
      productsEndpoint="/api/products"
      mercadoPagoPublicKey={publicKey}
      PaymentProviderComponent={(props) => (
        <MercadoPagoProvider
          {...props}
          customStyles={{
            buttonColor: buttonColor,
            circleColor: circleColor
          }}
        />
      )}
      successUrl={finalSuccessUrl}
      pendingUrl={finalPendingUrl}
      failureUrl={finalFailureUrl}
      onSuccess={(data) => console.log('Pago exitoso', data)}
      onError={(error) => console.error('Error en el pago', error)}
      hideTitle={hideTitle}
      initialProductId={initialProductId}
    />
  )
}

export default function Home() {
  return (
    <div>
      <Suspense fallback={<div style={{ textAlign: 'center', padding: '20px' }}>Cargando configuración de pago...</div>}>
        <HomePageContent />
      </Suspense>
    </div>
  )
}
