/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async headers() {
    // CSP configurado para permitir scripts inline de Mercado Pago
    const ContentSecurityPolicy = `
      default-src 'self' https://sdk.mercadopago.com https://*.mercadopago.com;
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.mercadopago.com https://*.mercadopago.com https://*.mlstatic.com;
      style-src 'self' 'unsafe-inline' https://*.mercadopago.com https://*.mlstatic.com;
      img-src 'self' data: https://*.mercadopago.com https://*.mlstatic.com;
      connect-src 'self' https://*.mercadopago.com https://api.mercadopago.com https://*.mlstatic.com;
      font-src 'self' data: https://*.mlstatic.com;
      object-src 'none';
      frame-src 'self' https://*.mercadopago.com;
      form-action 'self' https://*.mercadopago.com;
      frame-ancestors 'self' https://*.framer.app https://framer.com https://alturadivina.com; 
      base-uri 'self';
      block-all-mixed-content;
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    return [
      // API: no cache
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer-when-downgrade' },
        ],
      },
      // Static assets: cache largo
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
      // General routes
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
