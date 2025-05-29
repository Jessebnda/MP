# Mercado Pago Payment Component for React/Next.js

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

Componente seguro y personalizable para integrar Mercado Pago en aplicaciones Next.js/React. Incluye flujo multi-paso, carrito, control de stock en Supabase y sincronización con Google Sheets.

## Características

- **Flujo Multi-Paso:** Desde selección de producto hasta pago finalizado
- **Carrito Integrado:** Sidebar de carrito con control de cantidad y resumen
- **Control de Stock Seguro:** El stock se valida y descuenta en Supabase solo tras pago exitoso
- **Backend-First:** El frontend nunca confía en datos locales, siempre consulta y valida contra el backend/API
- **Integración MercadoPago:** Checkout seguro con Payment Brick y callbacks
- **Sincronización Google Sheets:** Pedidos y clientes se respaldan automáticamente
- **Despliegue en Vercel:** Listo para serverless y crons de sincronización
- **Personalización:** Estilos, colores y modos de visualización flexibles

## Arquitectura

- **Frontend:** React/Next.js, componentes desacoplados, hooks y contextos para carrito y pagos
- **Backend:** Endpoints `/api` en Next.js, lógica de negocio y seguridad, conexión directa a Supabase
- **Base de datos:** Supabase (PostgreSQL) para productos, stock, clientes, órdenes y direcciones
- **Integraciones:** MercadoPago SDK, Google Sheets API

## Flujo de Compra
1. El usuario selecciona productos y cantidades (stock siempre consultado en Supabase)
2. Al confirmar, se crea la preferencia de pago y se inicia el Payment Brick
3. Tras pago exitoso, el stock se descuenta en Supabase y se registra la orden y el cliente
4. Los datos se sincronizan con Google Sheets para respaldo

## Seguridad
- Validación de stock, precios y datos solo en backend
- CSRF y sanitización en endpoints
- Nunca se expone lógica crítica ni datos sensibles al frontend

## Instalación y Uso

```bash
npm install
npm run dev
```

Configura tus variables de entorno en `.env.local` para Supabase, MercadoPago y Google Sheets.

## Despliegue
- Listo para Vercel (incluye `vercel.json` para crons de sincronización)
- Compatible con serverless y edge functions

## Personalización
- Modos: `full`, `cartIconOnly`, `paymentFlowOnly`
- Estilos CSS y módulos personalizables
- Hooks para integración avanzada

## Documentación Técnica
Consulta `DOCUMENTATION.md` para detalles de arquitectura, API, seguridad y solución de problemas.

---

¿Dudas o sugerencias? Revisa los comentarios en el código fuente o abre un issue.
