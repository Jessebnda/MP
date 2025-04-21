'use client';

import PaymentFlow from '../components/PaymentFlow';
import MercadoPagoProvider from '../components/MercadoPagoProvider';

export default function Home() {
  return (
    <div>
      <PaymentFlow
        apiBaseUrl={process.env.NEXT_PUBLIC_HOST_URL}
        productsEndpoint="/api/products"
        mercadoPagoPublicKey={process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || ''}
        PaymentProviderComponent={MercadoPagoProvider}
        successUrl="https://alturadivina.com/confirmacion-de-compra"
        pendingUrl="https://alturadivina.com/proceso-de-compra"
        failureUrl="https://alturadivina.com/error-de-compra"
        onSuccess={(data) => console.log('Pago exitoso', data)}
        onError={(error) => console.error('Error en el pago', error)}
        hideTitle={false}
        productId="product1" // Specifying an existing product ID
      />
    </div>
  );
}