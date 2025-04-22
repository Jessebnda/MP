/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true, // Para eliminar comentarios en producción

  async headers() {
    // Mejor implementación de CSP usando restricciones más específicas
    const ContentSecurityPolicy = `
      default-src 'self';
      script-src 'self' https://*.mercadopago.com https://*.mlstatic.com https://*.mercadolibre.com 'unsafe-inline' 'unsafe-eval';
      style-src 'self' https://*.mercadopago.com https://*.mlstatic.com 'unsafe-inline';
      img-src 'self' data: https://*.mercadopago.com https://*.mlstatic.com https://*.mercadolibre.com;
      connect-src 'self' https://*.mercadopago.com https://api.mercadopago.com https://*.mlstatic.com;
      font-src 'self' data: https://*.mlstatic.com;
      object-src 'none';
      frame-src 'self' https://*.mercadopago.com;
      form-action 'self' https://*.mercadopago.com;
      frame-ancestors 'self' https://*.framer.app https://framer.com; 
      base-uri 'self';
      block-all-mixed-content;
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    return [
      // Reglas para endpoints API - no cachear
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      // Reglas para assets estáticos - cache agresivo
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Reglas para archivos estáticos
      {
        source: '/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Reglas generales para todo lo demás
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;