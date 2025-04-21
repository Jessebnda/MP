# MP Payment Component

A reusable React component for integrating Mercado Pago payment processing into your applications.

## Features

- Complete payment flow with product selection, confirmation, and checkout
- Seamless integration with Mercado Pago Wallet
- Responsive design with mobile-friendly UI
- Customizable styling and behavior
- Secure payment processing

## Installation

```bash
npm install mp-payment-component
# or
yarn add mp-payment-component
```

## Configuration

Create a `.env.local` file in your project root with the following variables:

## Basic Usage

```jsx
import { PaymentFlow, MercadoPagoProvider } from 'mp-payment-component';

function CheckoutPage() {
  return (
    <PaymentFlow
      apiBaseUrl=""
      productsEndpoint="/api/products"
      mercadoPagoPublicKey={process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY}
      PaymentProvider={MercadoPagoProvider}
      successUrl="/success"
      pendingUrl="/pending"
      failureUrl="/failure"
      onSuccess={(data) => console.log('Payment successful', data)}
      onError={(error) => console.error('Payment error', error)}
    />
  );
}
```
