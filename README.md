# Mercado Pago Payment Component for React/Next.js

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) <!-- Optional: Add a license badge -->

A reusable React component designed for easy integration of the Mercado Pago payment gateway into Next.js applications. It provides a multi-step flow including product selection, order confirmation, and checkout via Mercado Pago's Payment Brick.

## Features

*   **Multi-Step Flow:** Guides users through product selection, confirmation, and payment.
*   **Mercado Pago Integration:** Uses `@mercadopago/sdk-react` for robust Payment Brick integration.
*   **Server-Side Validation:** Includes a necessary backend endpoint structure for secure price validation.
*   **Customizable:** Configure endpoints, keys, redirection URLs, and appearance.
*   **Style Override Support:** Built with CSS Modules and supports class merging via `clsx` and `tailwind-merge` for easy customization with utility classes.
*   **Responsive:** Basic responsive styling included.

## Project Setup

This component is designed to be integrated directly into your Next.js project.

1.  **Copy Components:** Copy the `src/components/PaymentFlow.jsx`, `src/components/MercadoPagoProvider.jsx`, and `src/lib/utils.js` files into your project's components/lib directory.
2.  **Copy Styles:** Copy the `src/styles/PaymentFlow.module.css` and `src/styles/MercadoPagoProvider.module.css` files into your project's styles directory.
3.  **Copy API Routes:** Copy the API route handlers from `src/app/api/products/`, `src/app/api/products/[id]/`, and `src/app/api/process-payment/` into your Next.js `app/api` directory. **Crucially, adapt the product fetching and validation logic in these routes to use your actual database or data source.**
4.  **Install Dependencies:** Ensure you have the necessary dependencies installed:
    ```bash
    npm install @mercadopago/sdk-react clsx tailwind-merge
    # or
    yarn add @mercadopago/sdk-react clsx tailwind-merge
    ```

## Environment Variables

Configure the following environment variables. For local development, create a `.env.local` file in your project root. **For production (e.g., on Vercel), configure these in your hosting provider's dashboard.**

*   `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`: Your Mercado Pago **Public Key**. (Required, accessible by the browser)
*   `MERCADOPAGO_ACCESS_TOKEN`: Your Mercado Pago **Access Token**. (Required, **server-side only**, keep secret)
*   `NEXT_PUBLIC_HOST_URL`: The base URL of your deployed application (e.g., `https://your-app.vercel.app`) or `http://localhost:3000` for local development. (Required, accessible by the browser)

## Basic Usage (`app/page.js` example)

```jsx
// src/app/page.js
'use client';

import PaymentFlow from '../components/PaymentFlow'; // Adjust path if needed
// Note: MercadoPagoProvider is used internally by PaymentFlow by default

export default function Home() {
  // Ensure environment variables are loaded correctly
  const mpPublicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || '';
  const hostUrl = process.env.NEXT_PUBLIC_HOST_URL || '';

  return (
    <div>
      <h1>Checkout</h1>
      <PaymentFlow
        // --- Required Props ---
        apiBaseUrl={hostUrl} // Base URL for API calls
        mercadoPagoPublicKey={mpPublicKey}
        successUrl={`${hostUrl}/checkout/success`} // Full URL for redirection
        pendingUrl={`${hostUrl}/checkout/pending`} // Full URL for redirection
        failureUrl={`${hostUrl}/checkout/failure`} // Full URL for redirection

        // --- Optional Props ---
        // productsEndpoint="/api/products" // Default endpoint
        // PaymentProviderComponent={YourCustomProvider} // If replacing MercadoPagoProvider
        // productId="your-default-product-id" // Optionally pre-select a product
        // hideTitle={false} // Set to true to hide default step titles
        // className="mt-4 p-4 border rounded" // Add custom Tailwind/utility classes
        // containerStyles={{ backgroundColor: '#f9f9f9' }} // Add inline styles to the main container

        // --- Callbacks ---
        onSuccess={(data) => {
          console.log('Payment successful:', data);
          // Handle successful payment client-side (e.g., show confirmation)
        }}
        onError={(error) => {
          console.error('Payment error:', error);
          // Handle payment error client-side (e.g., show error message)
        }}
      />
    </div>
  );
}
