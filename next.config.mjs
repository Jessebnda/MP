// Archivo: next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  async headers() {
    // IMPORTANTE: Eliminar esta variable nonce que no está definida
    const ContentSecurityPolicy = `
      default-src 'self' https://*.mercadopago.com https://*.mlstatic.com https://*.framer.com https://framer.com https://*.framer.app https://alturadivina.com https://*.mercadolibre.com https://*.mercadolivre.com https://fonts.googleapis.com data: https://*.framerusercontent.com;
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.mercadopago.com https://*.mlstatic.com https://*.framer.com https://framer.com https://*.framer.app https://*.mercadolibre.com https://*.mercadolivre.com https://*.framerusercontent.com;
      style-src 'self' 'unsafe-inline' https://*.mercadopago.com https://*.mlstatic.com https://*.mercadolibre.com https://*.mercadolivre.com https://fonts.googleapis.com;
      frame-src 'self' https://*.mercadopago.com https://*.mlstatic.com https://*.framer.com https://framer.com https://*.framer.app https://*.framercanvas.com https://alturadivina.com https://*.mercadolibre.com https://*.mercadolivre.com;
      connect-src 'self' https://*.mercadopago.com https://*.mlstatic.com https://*.framer.com https://framer.com https://*.framer.app https://alturadivina.com https://*.mercadolibre.com https://*.mercadolivre.com;
      img-src 'self' data: https://*.mercadopago.com https://*.mlstatic.com https://*.mercadolibre.com https://*.mercadolivre.com https://*.framerusercontent.com;
      font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com;
    `.replace(/\s{2,}/g, ' ').trim();

    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `${ContentSecurityPolicy}; frame-ancestors 'self' https://*.framer.com https://framer.com https://*.framer.app https://alturadivina.com;`,
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'payment=*, camera=(), microphone=(), geolocation=()',
          }
        ],
      },
    ];
  },
};

export default nextConfig;