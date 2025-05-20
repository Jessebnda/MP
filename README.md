# Mercado Pago Payment Component for React/Next.js

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

Un componente seguro y personalizable para integrar Mercado Pago en aplicaciones Next.js/React. Incluye un flujo multi-paso con selección de producto, confirmación de pedido y checkout usando el Payment Brick de Mercado Pago.

## Características

- **Flujo Multi-Paso:** Desde selección de producto hasta pago finalizado
- **Carrito Integrado:** Sidebar de carrito con control de cantidad y resumen
- **Modos de Visualización:**
  - `full`: flujo completo con carrito y selección
  - `cartIconOnly`: solo ícono y sidebar de carrito
  - `paymentFlowOnly`: solo el flujo de pago, sin carrito
- **Procesamiento Seguro:** Validación server-side y protección CSRF
- **Integración Mercado Pago:** Uso del Payment Brick y SDK oficial
- **Responsive:** Experiencia optimizada para móvil
- **Redirecciones Configurables:** URLs para éxito, pendiente y error
- **Logging Mejorado:** Logs solo en desarrollo, sin datos sensibles
- **Listo para Vercel y Framer**
- **Arquitectura Modular:** Hooks y contextos para integración flexible

## Quick Start

### Instala dependencias

```bash
npm install @mercadopago/sdk-react clsx tailwind-merge
```

### Configura variables de entorno

```env
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=your_public_key
MERCADOPAGO_ACCESS_TOKEN=your_access_token
NEXT_PUBLIC_HOST_URL=https://your-deployment-url.com
```

### Importa y usa el componente principal

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
      displayMode="full" // "full", "cartIconOnly" o "paymentFlowOnly"
    />
  );
}
```

### Modos de Visualización (`displayMode`)
- `full`: Muestra selección de producto, carrito (ícono y sidebar) y flujo de pago.
- `cartIconOnly`: Solo ícono de carrito y sidebar, sin selección de producto.
- `paymentFlowOnly`: Solo el flujo de pago, sin carrito ni selección.

### Hooks y Contextos
- `useCart.js`: Maneja el estado global del carrito (agregar, quitar, limpiar, total, etc.)
- `useMercadoPagoSdk.js`: Inicializa el SDK de Mercado Pago
- `useMercadoPagoPreference.js`: Crea preferencias de pago
- `useMercadoPagoBrickSubmit.js`: Envía el pago

### Componentes Clave
- `PaymentFlow.jsx`: Orquesta el flujo y renderiza según el paso y modo
- `CartIcon.jsx`: Ícono de carrito con contador dinámico
- `CartSidebar.jsx`: Sidebar con resumen, acciones y checkout
- `MercadoPagoProvider.jsx`: Renderiza el Payment Brick y maneja callbacks

### Props principales de `PaymentFlow`
- `apiBaseUrl` (string, requerido)
- `mercadoPagoPublicKey` (string, requerido)
- `successUrl`, `pendingUrl`, `failureUrl` (string, requerido)
- `displayMode` (string, opcional, default: "full")
- `onSuccess`, `onError` (función, opcional)
- `initialProductId` (string, opcional)

### Notas Importantes
- **URLs absolutas:** Todas las `back_urls` deben ser absolutas
- **Hooks:** Asegúrate de exportar/importar correctamente los hooks
- **Carrito:** El estado del carrito es global vía contexto y se refleja en todos los componentes
- **Estilos:** Personaliza usando los módulos CSS incluidos o sobrescribe en `globals.css`

## Documentación Completa
Consulta [DOCUMENTATION.md](./DOCUMENTATION.md) para detalles avanzados, referencia de API, seguridad, personalización y solución de problemas.

## Seguridad
- Protección CSRF
- Sanitización de entradas
- Validación de precios y stock en backend
- Manejo seguro de variables de entorno
- Content Security Policy headers

## Licencia

Publicado bajo la [MIT License](https://opensource.org/licenses/MIT)
