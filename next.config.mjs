// Archivo: next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  async headers() {
    // Content Security Policy más permisivo para Framer
    const ContentSecurityPolicy = `
      default-src 'self' https://*.mercadopago.com https://*.mercadopago.com.ar https://*.mercadopago.com.br https://*.mercadopago.com.mx https://*.mlstatic.com https://*.framer.com https://framer.com https://*.framer.app https://alturadivina.com https://*.mercadolibre.com https://*.mercadolivre.com https://fonts.googleapis.com data: https://*.framerusercontent.com https://api.mercadopago.com;
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.mercadopago.com https://*.mercadopago.com.ar https://*.mercadopago.com.br https://*.mercadopago.com.mx https://*.mlstatic.com https://*.framer.com https://framer.com https://*.framer.app https://*.mercadolibre.com https://*.mercadolivre.com https://*.framerusercontent.com https://api.mercadopago.com;
      style-src 'self' 'unsafe-inline' https://*.mercadopago.com https://*.mercadopago.com.ar https://*.mercadopago.com.br https://*.mercadopago.com.mx https://*.mlstatic.com https://*.mercadolibre.com https://*.mercadolivre.com https://fonts.googleapis.com;
      img-src 'self' data: https://*.mercadopago.com https://*.mercadopago.com.ar https://*.mercadopago.com.br https://*.mercadopago.com.mx https://*.mlstatic.com https://*.mercadolibre.com https://*.mercadolivre.com https://*.framerusercontent.com;
      font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com;
      connect-src 'self' https://*.mercadopago.com https://*.mercadopago.com.ar https://*.mercadopago.com.br https://*.mercadopago.com.mx https://*.mlstatic.com https://*.framer.com https://framer.com https://*.framer.app https://alturadivina.com https://*.mercadolibre.com https://*.mercadolivre.com https://api.mercadopago.com;
      
      /* Estas son las directivas más importantes para Framer */
      frame-src 'self' https://*.mercadopago.com https://*.mercadopago.com.ar https://*.mercadopago.com.br https://*.mercadopago.com.mx https://*.mlstatic.com https://*.framer.com https://framer.com https://*.framer.app https://*.framercanvas.com https://alturadivina.com https://*.mercadolibre.com https://*.mercadolivre.com;
    `.replace(/\s{2,}/g, ' ').trim();

    return [
      {
        source: '/(.*)',
        headers: [
          {
            // CRÍTICO: Usar CSP para frame-ancestors en vez de X-Frame-Options
            key: 'Content-Security-Policy',
            value: `${ContentSecurityPolicy}; frame-ancestors 'self' https://*.framer.com https://framer.com https://*.framer.app https://*.framercanvas.com https://framercanvas.com https://alturadivina.com;`,
          },
          // IMPORTANTE: Eliminar X-Frame-Options para evitar conflictos
          // {
          //   key: 'X-Frame-Options',
          //   value: 'SAMEORIGIN',
          // },
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
          // CRÍTICO: Hacer más permisiva la política de permisos para payment
          {
            key: 'Permissions-Policy',
            value: 'payment=(self "https://*.framer.com" "https://framer.com"), camera=(), microphone=(), geolocation=()',
          }
        ],
      },
    ];
  },
};

export default nextConfig;