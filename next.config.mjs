// Archivo: next.config.mjs
// Colócalo en la raíz de tu proyecto y reemplaza tu actual next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  async headers() {
    // CSP permisivo pero que mantiene protección básica contra script injection
    const ContentSecurityPolicy = `
      default-src 'self' https://*.mercadopago.com https://*.mlstatic.com https://*.framer.com https://*.framer.app https://*.mercadolibre.com https://*.mercadolivre.com;
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.mercadopago.com https://*.mlstatic.com https://*.framer.com https://*.mercadolibre.com https://*.mercadolivre.com;
      style-src 'self' 'unsafe-inline' https://*.mercadopago.com https://*.mlstatic.com https://*.mercadolibre.com https://*.mercadolivre.com;
      img-src 'self' data: blob: https://*.mercadopago.com https://*.mlstatic.com https://*.framer.com https://*.mercadolibre.com https://*.mercadolivre.com;
      connect-src 'self' https://*.mercadopago.com https://api.mercadopago.com https://*.mlstatic.com https://*.framer.com https://*.mercadolibre.com https://*.mercadolivre.com https://api.mercadolibre.com https://api.mercadolivre.com;
      font-src 'self' data: https://*.mlstatic.com https://*.mercadolibre.com https://*.mercadolivre.com;
      object-src 'none';
      frame-src 'self' * https://*.mercadolibre.com https://*.mercadolivre.com;
      frame-ancestors *; 
      base-uri 'self';
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    return [
      // API: sin cache
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
      // Assets estáticos: cache largo
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Resto de rutas: CSP básico + headers de seguridad
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
    ];
  },
};

export default nextConfig;