# Mercado Pago Component: Technical Documentation

This document provides comprehensive technical details about the Mercado Pago payment component.

---

## Table of Contents

- [Component Architecture](#component-architecture)
- [API Reference](#api-reference)
- [Security Implementation](#security-implementation)
- [Logging System](#logging-system)
- [Customization Guide](#customization-guide)
- [Troubleshooting](#troubleshooting)

---

## Component Architecture

The payment integration consists of several key components:

- `PaymentFlow.jsx` – Orchestrates the multi-step payment process  
- `MercadoPagoProvider.jsx` – Handles direct integration with Mercado Pago SDK  
- `MercadoPagoFrame.jsx` – Optional component for iframe embedding  

### Flow Diagram

```
User → Product Selection → Order Confirmation → Payment Processing → Redirect
```

---

## API Reference

### PaymentFlow Component

| Prop               | Type     | Required | Description                                 |
|--------------------|----------|----------|---------------------------------------------|
| apiBaseUrl         | String   | Yes      | Base URL for API endpoints                  |
| mercadoPagoPublicKey | String | Yes      | Your Mercado Pago public key                |
| successUrl         | String   | Yes      | URL to redirect after successful payment    |
| pendingUrl         | String   | Yes      | URL to redirect for pending payments        |
| failureUrl         | String   | Yes      | URL to redirect after failed payment        |
| productsEndpoint   | String   | No       | Custom endpoint for products API            |
| initialProductId   | String   | No       | Pre-selected product ID                     |
| hideTitle          | Boolean  | No       | Hide step titles if true                    |
| className          | String   | No       | Custom CSS classes                          |
| containerStyles    | Object   | No       | Inline styles for container                 |
| onSuccess          | Function | No       | Callback for successful payment             |
| onError            | Function | No       | Callback for payment errors                 |

### MercadoPagoProvider Component

| Prop               | Type     | Required | Description                                 |
|--------------------|----------|----------|---------------------------------------------|
| productId          | String   | No       | Single product ID to purchase               |
| quantity           | Number   | No       | Product quantity (default: 1)               |
| totalAmount        | Number   | No       | Override calculated amount                  |
| orderSummary       | Array    | No       | Array of products with quantity/price       |
| publicKey          | String   | Yes      | Mercado Pago public key                     |
| apiBaseUrl         | String   | Yes      | Base URL for API endpoints                  |
| successUrl         | String   | Yes      | Success redirect URL                        |
| pendingUrl         | String   | Yes      | Pending payment redirect URL                |
| failureUrl         | String   | Yes      | Failed payment redirect URL                 |
| onSuccess          | Function | No       | Success callback                            |
| onError            | Function | No       | Error callback                              |
| className          | String   | No       | Custom CSS classes                          |
| containerStyles    | Object   | No       | Inline styles                               |
| hideTitle          | Boolean  | No       | Hide default title if true                  |

---

## Security Implementation

### CSRF Protection

- Tokens are generated per session  
- Tokens are validated on all API endpoints  
- Tokens are included in payment processing requests  

### Input Sanitization

Prevents common attacks like:

- SQL injection  
- XSS attacks  
- Malicious data manipulation  

### Server-side Validation

- Price verification  
- Stock availability check  
- Order integrity validation  

---

## Logging System

The component uses a centralized logging utility:

### Features

- Environment-aware: Logs appear only in development  
- Data sanitization: Redacts sensitive information (e.g., tokens)  
- Standardized format across modules  
- Security-focused: No secrets in production logs  

### Redacted Fields

- tokens  
- csrfToken  
- password  
- card details  
- payment method IDs  
- authorization headers  

### Example

```ts
import { logInfo, logError, logWarn } from '../lib/logger';

logInfo("Processing payment", { orderId: "12345" });
logError("Payment failed", { error });
```

---

## Customization Guide

### Styling Options

- **CSS Modules** – Override component styles  
- **Class merging** – Use `className` prop for custom Tailwind classes  
- **Inline styles** – Apply dynamic `containerStyles`

### Brick Customization

You can customize the Payment Brick appearance like so:

```tsx
customization={{
  visual: { 
    theme: 'default',
    customVariables: {
      baseColor: '#F26F32',
      formBackgroundColor: '#FFFFFF',
      inputBorderColor: '#CCCCCC',
    }
  }
}}
```

---

## Troubleshooting

### CSRF Token Errors

> _Error: Token CSRF inválido_

- Ensure sessions are working on the server  
- Verify cookies are correctly sent with requests  
- Check CORS and same-origin policies  

### Payment Processing Timeouts

- Check server latency  
- Verify Mercado Pago API uptime  
- Consider increasing timeout threshold

### Browser Console Errors

- In development: inspect logs in DevTools console  
- In production: logs are suppressed for security  

---

## Getting Help

- [Mercado Pago Docs](https://www.mercadopago.com.mx/developers/)  
- Review your environment variables  
- Ensure all API endpoints respond correctly