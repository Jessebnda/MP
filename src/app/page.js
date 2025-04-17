'use client';

import PaymentFlow from '../components/PaymentFlow';
import MercadoPagoProvider from '../components/MercadoPagoProvider';

export default function Home() {
  return (
    <div>
      <PaymentFlow
        apiBaseUrl=""
        productsEndpoint="/api/products"
        mercadoPagoPublicKey={process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || ''}
        PaymentProvider={MercadoPagoProvider}
        // URLs personalizadas de redirección
        successUrl="https://tudominio.com/gracias"
        pendingUrl="https://tudominio.com/en-proceso"
        failureUrl="https://tudominio.com/error"
        onSuccess={(data) => console.log('Pago exitoso', data)}
        onError={(error) => console.error('Error en el pago', error)}
        hideTitle={false}
      />
    </div>
  );
}