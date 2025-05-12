# Mercado Pago Payment Component for React/Next.js

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A secure, customizable React component for integrating the Mercado Pago payment gateway into Next.js applications. It provides a multi-step flow including product selection, order confirmation, and checkout via Mercado Pago's Payment Brick.

![Mercado Pago Flow](https://via.placeholder.com/800x400?text=Mercado+Pago+Flow) <!-- Replace with an actual screenshot -->

## Features

- **Multi-Step Flow:** Guided experience from product selection to payment completion  
- **Secure Payment Processing:** Server-side validation with CSRF protection  
- **Mercado Pago Integration:** Seamless integration with Payment Brick  
- **Responsive Design:** Mobile-optimized checkout experience  
- **Configurable Redirects:** Custom success, pending, and failure pages  
- **Enhanced Logging:** Development-only logging with sensitive data protection  
- **Framer Integration:** Easily embed as an iframe in Framer sites  
- **Vercel Ready:** Optimized for deployment on Vercel  

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install @mercadopago/sdk-react clsx tailwind-merge
   ```
2. **Configure environment variables:**
   ```env
   NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=your_public_key
   MERCADOPAGO_ACCESS_TOKEN=your_access_token
   NEXT_PUBLIC_HOST_URL=https://your-deployment-url.com
   ```
3. **Import and use the component:**
   ```jsx
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

Released under the [MIT License](https://opensource.org/licenses/MIT).