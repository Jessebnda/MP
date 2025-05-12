'use client'

import { Suspense } from 'react' // Importa Suspense
import { useSearchParams } from 'next/navigation'
import PaymentFlow from '../components/PaymentFlow'
import MercadoPagoProvider from '../components/MercadoPagoProvider'

// Nuevo componente que encapsula la lógica que usa useSearchParams
function HomePageContent() {
  const params = useSearchParams()

  // Lee los query params con fallbacks a variables de entorno o valores por defecto
  const productId  = params.get('productId')  || ''
  const publicKey  = params.get('publicKey')  || process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || ''
  const apiBaseUrl = params.get('apiBaseUrl') || process.env.NEXT_PUBLIC_HOST_URL || ''
  
  // Construye URLs de redirección con fallbacks si no se proveen
  const hostUrl = process.env.NEXT_PUBLIC_HOST_URL || '';
  const successUrl = params.get('successUrl') || (hostUrl ? `${hostUrl}/success` : '')
  const pendingUrl = params.get('pendingUrl') || (hostUrl ? `${hostUrl}/pending` : '')
  const failureUrl = params.get('failureUrl') || (hostUrl ? `${hostUrl}/failure` : '')
  
  const hideTitle  = params.get('hideTitle') === 'true'
  const quantity   = parseInt(params.get('quantity') || '1', 10)

  // Buscar ambos parámetros para mayor compatibilidad
  const initialProductId = params.get('initialProductId') || params.get('productId') || ''

  // PaymentFlow y MercadoPagoProvider tienen sus propias validaciones para props requeridas como publicKey y apiBaseUrl.
  // Si publicKey o apiBaseUrl están vacíos aquí, los componentes hijos mostrarán sus respectivos errores de configuración.

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
      quantity={quantity}
    />
  )
}

export default function Home() {
  return (
    <div>
      {/* Envuelve el contenido dependiente del cliente con Suspense */}
      <Suspense fallback={<div style={{ textAlign: 'center', padding: '20px' }}>Cargando configuración de pago...</div>}>
        <HomePageContent />
      </Suspense>
    </div>
  )
}
