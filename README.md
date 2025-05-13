# Mercado Pago Payment Component for React/Next.js

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

A secure, customizable React component for integrating the Mercado Pago payment gateway into Next.js applications. It provides a multi-step flow including product selection, order confirmation, and checkout via Mercado Pago's Payment Brick.

## Features

- Multi-Step Flow: Guided experience from product selection to payment completion
- Secure Payment Processing: Server-side validation with CSRF protection
- Mercado Pago Integration: Seamless integration with Payment Brick
- Responsive Design: Mobile-optimized checkout experience
- Configurable Redirects: Custom success, pending, and failure pages
- Enhanced Logging: Development-only logging with sensitive data protection
- Framer Integration: Easily embed as an iframe in Framer sites
- Vercel Ready: Optimized for deployment on Vercel
- Modular Architecture: Uses React hooks for SDK integration

## Quick Start

### Install dependencies

```bash
npm install @mercadopago/sdk-react clsx tailwind-merge
```

### Configure environment variables

```env
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=your_public_key
MERCADOPAGO_ACCESS_TOKEN=your_access_token
NEXT_PUBLIC_HOST_URL=https://your-deployment-url.com
```

### Import and use the component

```tsx
import PaymentFlow from '../components/PaymentFlow';

export default function Checkout() {
  return (
    <PaymentFlow
      apiBaseUrl={process.env.NEXT_PUBLIC_HOST_URL}
      mercadoPagoPublicKey={process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY}
      successUrl="/success"
      pendingUrl="/pending"
      failureUrl="/failure"
    />
  );
}
```

### Implement the required hooks

- `useMercadoPagoSdk.js` - Initializes the SDK
- `useMercadoPagoPreference.js` - Creates payment preferences
- `useMercadoPagoBrickSubmit.js` - Handles payment submission

## Important Notes for Implementation

- **Absolute URLs:** All `back_urls` must be absolute URLs (starting with http:// or https://)
- **Hook Structure:** Ensure your hooks are properly implemented and returning required values
- **Error Handling:** Check the console for detailed error messages during development
- **Environment Variables:** Double check all environment variables are correctly set
- **Back URLs Structure:** Make sure all three required URLs are provided (success, failure, pending)

## Common Errors

### `auto_return invalid. back_url.success must be defined`
This happens when Mercado Pago API doesn't receive properly formatted URLs.

**Solution:** Ensure all `back_urls` are absolute URLs and check that the hooks are correctly implemented.

### `useMercadoPagoSdk is not a function`
This occurs when the SDK hook isn't properly exported or imported.

**Solution:** Check your hooks implementation and imports.

## Documentation

For comprehensive documentation including:

- Complete API reference
- Security considerations
- Customization options
- Troubleshooting guide
- Logging system

Please see the [DOCUMENTATION.md](./DOCUMENTATION.md) file.

## Security

This component implements several security best practices:

- CSRF protection
- Input sanitization
- Server-side price validation
- Secure environment variable handling
- Content Security Policy headers

## License

Released under the [MIT License](https://opensource.org/licenses/MIT)
