/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async headers() {
    // Versión actualizada del CSP que permite los módulos de Framer
    const ContentSecurityPolicy = `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.framer.com https://framer.com/m/ https://*.mercadopago.com https://*.mlstatic.com https://*.mercadolibre.com;
      style-src 'self' 'unsafe-inline' https://*.framer.com https://*.mercadopago.com https://*.mlstatic.com;
      img-src 'self' data: https://*.framer.com https://*.mercadopago.com https://*.mlstatic.com https://*.mercadolibre.com;
      connect-src 'self' https://*.framer.com https://framer.com/m/ https://*.mercadopago.com https://api.mercadopago.com https://*.mlstatic.com;
      font-src 'self' data: https://*.framer.com https://*.mlstatic.com;
      object-src 'none';
      frame-src 'self' https://*.framer.com https://*.mercadopago.com;
      form-action 'self' https://*.mercadopago.com;
      frame-ancestors 'self' https://*.framer.app https://framer.com https://alturadivina.com; 
      base-uri 'self';
      block-all-mixed-content;
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    return [
      // El resto de tu configuración de headers se mantiene igual
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
      // Resto de tus reglas de headers...
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