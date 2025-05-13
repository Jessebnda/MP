# Mercado Pago Component: Technical Documentation

This document provides comprehensive technical details about the Mercado Pago payment component.

## Table of Contents

- Component Architecture
- API Reference
- Security Implementation
- Logging System
- Customization Guide
- Troubleshooting
- Common Errors and Solutions

## Component Architecture

The payment integration consists of several key components:

- `PaymentFlow.jsx` – Orchestrates the multi-step payment process
- `MercadoPagoProvider.jsx` – Handles direct integration with Mercado Pago SDK
- `MercadoPagoFrame.jsx` – Optional component for iframe embedding

### Custom Hooks

- `useMercadoPagoSdk.js` – Manages SDK initialization
- `useMercadoPagoPreference.js` – Manages preference creation
- `useMercadoPagoBrickSubmit.js` – Handles payment submission

### Flow Diagram

```
User → Product Selection → Order Confirmation → Payment Processing → Redirect
```

## API Reference

### PaymentFlow Component

| Prop               | Type     | Required | Description                          |
|--------------------|----------|----------|--------------------------------------|
| apiBaseUrl         | String   | Yes      | Base URL for API endpoints           |
| mercadoPagoPublicKey | String | Yes      | Your Mercado Pago public key         |
| successUrl         | String   | Yes      | URL to redirect after successful payment |
| pendingUrl         | String   | Yes      | URL to redirect for pending payments |
| failureUrl         | String   | Yes      | URL to redirect after failed payment |
| productsEndpoint   | String   | No       | Custom endpoint for products API     |
| initialProductId   | String   | No       | Pre-selected product ID              |
| hideTitle          | Boolean  | No       | Hide step titles if true             |
| className          | String   | No       | Custom CSS classes                   |
| containerStyles    | Object   | No       | Inline styles for container          |
| onSuccess          | Function | No       | Callback for successful payment      |
| onError            | Function | No       | Callback for payment errors          |

### MercadoPagoProvider Component

| Prop               | Type     | Required | Description                          |
|--------------------|----------|----------|--------------------------------------|
| productId          | String   | No       | Single product ID to purchase        |
| quantity           | Number   | No       | Product quantity (default: 1)        |
| totalAmount        | Number   | No       | Override calculated amount           |
| orderSummary       | Array    | No       | Array of products with quantity/price |
| userData           | Object   | No       | Customer personal information        |
| publicKey          | String   | Yes      | Mercado Pago public key              |
| apiBaseUrl         | String   | Yes      | Base URL for API endpoints           |
| successUrl         | String   | Yes      | Success redirect URL                 |
| pendingUrl         | String   | Yes      | Pending payment redirect URL         |
| failureUrl         | String   | Yes      | Failed payment redirect URL          |
| onSuccess          | Function | No       | Success callback                     |
| onError            | Function | No       | Error callback                       |
| className          | String   | No       | Custom CSS classes                   |
| containerStyles    | Object   | No       | Inline styles                        |
| hideTitle          | Boolean  | No       | Hide default title if true           |

### Backend API Preferences

| Parameter              | Type   | Required | Description                          |
|------------------------|--------|----------|--------------------------------------|
| items                  | Array  | Yes      | Products to be purchased             |
| back_urls              | Object | Yes      | URLs for redirect after payment      |
| auto_return            | String | No       | Auto-redirect behavior ("approved")  |
| payer                  | Object | No       | Customer information                 |
| statement_descriptor   | String | No       | Text shown in bank statement         |
| external_reference     | String | No       | Custom order identifier              |
| notification_url       | String | No       | Webhook URL for notifications        |

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

```js
import { logInfo, logError } from '../lib/logger'

logInfo("Processing payment", { orderId: "12345" });
logError("Payment failed", { error: errorObject });
```

## Customization Guide

### Styling Options

- CSS Modules – Override component styles
- Class merging – Use `className` prop for custom Tailwind classes
- Inline styles – Apply dynamic `containerStyles`

### Brick Customization

```js
customization={{
  visual: {
    theme: 'default',
    customVariables: {
      baseColor: '#F26F32',
      formBackgroundColor: '#FFFFFF',
      inputBorderColor: '#CCCCCC'
    }
  }
}}
```

## Troubleshooting

### CSRF Token Errors

**Error:** `Token CSRF inválido`

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

## Common Errors and Solutions

### `"auto_return invalid. back_url.success must be defined"`

Occurs when MercadoPago API receives an invalid configuration for `back_urls`.

**Solution:**

- Ensure all URLs are absolute
- Verify `back_urls` has `success`, `failure`, `pending`
- Set `auto_return: "approved"`

### `"useMercadoPagoSdk is not a function"`

Occurs when the SDK hook isn't properly exported or imported.

**Solution:**

- Check that `useMercadoPagoSdk.js` exports the function correctly
- Ensure it's properly imported
- Verify it returns `sdkReady`, `sdkError`

## Getting Help

- [Mercado Pago Docs](https://www.mercadopago.com.mx/developers)
- [SDK Documentation](https://www.mercadopago.com.mx/developers/en/docs)
- Checkout API Reference
- Review environment variables
- Ensure all API endpoints respond correctly
