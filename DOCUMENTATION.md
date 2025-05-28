# Mercado Pago Component: Technical Documentation

Este documento describe la arquitectura, API, seguridad y personalización del componente de pago Mercado Pago para React/Next.js, ahora con backend en Supabase y control de stock seguro.

## Tabla de Contenidos
- Arquitectura de Componentes
- Flujo de Datos y Backend
- Modos de Visualización
- Referencia de API
- Hooks y Contextos
- Seguridad
- Logging
- Personalización y Estilos
- Solución de Problemas

## Arquitectura de Componentes

- `PaymentFlow.jsx`: Orquesta el flujo multi-paso (selección, carrito, confirmación, pago)
- `CartIcon.jsx`: Ícono de carrito con contador dinámico
- `CartSidebar.jsx`: Sidebar lateral con resumen, acciones y checkout
- `MercadoPagoProvider.jsx`: Renderiza el Payment Brick y maneja callbacks
- `CartItem.jsx`: Renderiza cada producto en el carrito

### Hooks y Contextos
- `useCart.js`: Estado global del carrito (agregar, quitar, limpiar, total, etc.)
- `useMercadoPagoSdk.js`: Inicializa el SDK de Mercado Pago
- `useMercadoPagoPreference.js`: Crea preferencias de pago
- `useMercadoPagoBrickSubmit.js`: Envía el pago
- `useCustomerSave.js`: Guarda datos de cliente y compra en Supabase

## Flujo de Datos y Backend
- **Todos los datos críticos (productos, stock, órdenes, clientes) se gestionan en Supabase.**
- El frontend nunca confía en datos locales: siempre consulta y valida contra el backend (Supabase).
- El stock se verifica y actualiza en Supabase tras cada compra exitosa.
- Los endpoints de la carpeta `/api` actúan como capa de seguridad y lógica de negocio.
- Integración con Google Sheets para respaldo y sincronización de pedidos/clientes.

## Modos de Visualización (`displayMode`)
- `full`: Selección de producto, ícono y sidebar de carrito, y flujo de pago
- `cartIconOnly`: Solo ícono y sidebar de carrito
- `paymentFlowOnly`: Solo flujo de pago, sin carrito ni selección

## Referencia de API

### PaymentFlow Component
| Prop                  | Tipo     | Requerido | Descripción                                  |
|-----------------------|----------|-----------|----------------------------------------------|
| apiBaseUrl            | String   | Sí        | URL base para endpoints API                  |
| mercadoPagoPublicKey  | String   | Sí        | Public key de Mercado Pago                   |
| successUrl            | String   | Sí        | Redirección tras pago exitoso                |
| pendingUrl            | String   | Sí        | Redirección tras pago pendiente              |
| failureUrl            | String   | Sí        | Redirección tras pago fallido                |
| productsEndpoint      | String   | No        | Endpoint custom para productos               |
| initialProductId      | String   | No        | Producto preseleccionado                    |
| hideTitle             | Boolean  | No        | Oculta títulos de pasos                      |
| className             | String   | No        | Clases CSS personalizadas                    |
| containerStyles       | Object   | No        | Estilos inline para el contenedor            |
| onSuccess             | Function | No        | Callback en pago exitoso                     |
| onError               | Function | No        | Callback en error de pago                    |
| displayMode           | String   | No        | "full", "cartIconOnly", "paymentFlowOnly"   |

### CartIcon Component
- Muestra el ícono de carrito y el contador de productos (`totalItems`)
- Prop: `onClick` (función para abrir el sidebar)

### CartSidebar Component
- Muestra productos, total, acciones (vaciar, checkout)
- Props: `isOpen`, `onClose`, `checkoutUrl`

### MercadoPagoProvider Component
| Prop               | Tipo     | Requerido | Descripción                          |
|--------------------|----------|-----------|--------------------------------------|
| productId          | String   | No        | ID de producto único                 |
| quantity           | Number   | No        | Cantidad (default: 1)                |
| totalAmount        | Number   | No        | Monto total override                 |
| orderSummary       | Array    | No        | Array de productos                   |
| userData           | Object   | No        | Info personal del cliente            |
| publicKey          | String   | Sí        | Public key de Mercado Pago           |
| apiBaseUrl         | String   | Sí        | URL base para endpoints API          |
| successUrl         | String   | Sí        | Redirección éxito                    |
| pendingUrl         | String   | Sí        | Redirección pendiente                |
| failureUrl         | String   | Sí        | Redirección fallido                  |
| onSuccess          | Function | No        | Callback éxito                       |
| onError            | Function | No        | Callback error                       |
| className          | String   | No        | Clases CSS personalizadas            |
| containerStyles    | Object   | No        | Estilos inline                       |
| hideTitle          | Boolean  | No        | Oculta título por defecto            |

### Backend API Preferences
| Parámetro              | Tipo   | Requerido | Descripción                          |
|------------------------|--------|-----------|--------------------------------------|
| items                  | Array  | Sí        | Productos a comprar                  |
| back_urls              | Object | Sí        | URLs de redirección                  |
| auto_return            | String | No        | Auto-redirect ("approved")           |
| payer                  | Object | No        | Info del cliente                     |
| statement_descriptor   | String | No        | Texto en estado de cuenta            |
| external_reference     | String | No        | ID de orden personalizada            |
| notification_url       | String | No        | Webhook para notificaciones          |

## Seguridad
- **CSRF:** Token por sesión, validado en endpoints y peticiones de pago
- **Sanitización:** Previene XSS, SQLi y manipulación de datos
- **Validación server-side:** Precios, stock y orden (siempre en Supabase)
- **CSP:** Headers estrictos en `next.config.mjs`
- **Stock seguro:** El stock solo se descuenta en Supabase tras pago exitoso, nunca en frontend.
- **Datos sensibles:** Nunca expuestos al cliente, solo gestionados en backend/API.

## Logging
- Utilidad centralizada (`lib/logger.js`)
- Logs solo en desarrollo, sin datos sensibles

## Personalización y Estilos
- Módulos CSS: `AddToCartButton.module.css`, `CartIcon.module.css`, `CartSidebar.module.css`, `globals.css`
- Colores y fuentes personalizables
- Responsive y mobile-first

## Solución de Problemas
- **URLs absolutas:** Todas las `back_urls` deben ser absolutas
- **Hooks:** Exporta/importa correctamente
- **Carrito:** Estado global, reflejado en todos los componentes
- **Stock:** Si el stock no se actualiza, revisa la conexión con Supabase y los endpoints
- **Errores comunes:**
  - `auto_return invalid. back_url.success must be defined`: Verifica URLs y hooks
  - `useMercadoPagoSdk is not a function`: Revisa export/import de hooks
  - `Module not found: Can't resolve 'classnames'`: Instala la dependencia con `npm install classnames`

---

Para detalles de integración, revisa el README y los comentarios en los archivos fuente.
