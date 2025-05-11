'use client'

import { useSearchParams } from 'next/navigation'
import PaymentFlow from '../components/PaymentFlow'
import MercadoPagoProvider from '../components/MercadoPagoProvider'

export default function Home() {
  const params = useSearchParams()

  // 1. Leemos todos los query params (los que ponga tu iframe)
  const productId  = params.get('productId')  || ''
  const publicKey  = params.get('publicKey')  || ''
  const successUrl = params.get('successUrl') || ''
  const pendingUrl = params.get('pendingUrl') || ''
  const failureUrl = params.get('failureUrl') || ''
  const hideTitle  = params.get('hideTitle') === 'true'
  const quantity   = parseInt(params.get('quantity') || '1', 10)
  const apiBaseUrl = params.get('apiBaseUrl') || process.env.NEXT_PUBLIC_HOST_URL || ''

  return (
    <div>
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
        productId={productId}
        quantity={quantity}
      />
    </div>
  )
}
