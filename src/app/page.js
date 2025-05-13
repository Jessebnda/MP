'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import PaymentFlow from '../components/PaymentFlow'
import MercadoPagoProvider from '../components/MercadoPagoProvider'

// Nuevo componente que encapsula la lógica que usa useSearchParams
function HomePageContent() {
  const params = useSearchParams()
  
  // FIX: Set a proper apiBaseUrl - this should be the base URL of your app
  const apiBaseUrl = 'http://localhost:3000'  // For local development
  
  const publicKey = params.get('publicKey') || process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY
  const successUrl = params.get('successUrl') || '/success'
  const pendingUrl = params.get('pendingUrl') || '/pending'
  const failureUrl = params.get('failureUrl') || '/failure'
  const hideTitle  = params.get('hideTitle') === 'true'
  const quantity   = parseInt(params.get('quantity') || '1', 10)
  const initialProductId = params.get('initialProductId') || params.get('productId') || ''

  return (
    <PaymentFlow
      apiBaseUrl={apiBaseUrl}
      productsEndpoint="/api/products"
      mercadoPagoPublicKey={publicKey}
      PaymentProviderComponent={MercadoPagoProvider}
      successUrl={successUrl}
      pendingUrl={pendingUrl}
      failureUrl={failureUrl}
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
