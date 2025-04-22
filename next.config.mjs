/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    // Define la política CSP asegurando que permita todo lo necesario para Mercado Pago
    // Y permitiendo que la página sea embebida en iframes (Framer)
    const ContentSecurityPolicy = `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.mercadopago.com https://*.mlstatic.com https://*.mercadolibre.com;
      style-src 'self' 'unsafe-inline' https://*.mercadopago.com https://*.mlstatic.com;
      img-src 'self' data: https://*.mercadopago.com https://*.mlstatic.com https://*.mercadolibre.com;
      connect-src 'self' https://*.mercadopago.com https://api.mercadopago.com https://*.mlstatic.com;
      font-src 'self' data: https://*.mlstatic.com;
      object-src 'none';
      frame-src 'self' https://*.mercadopago.com;
      form-action 'self' https://*.mercadopago.com;
      frame-ancestors *; 
      base-uri 'self';
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: ContentSecurityPolicy,
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Se eliminó X-Frame-Options para permitir embeber en iframes externos
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            // Se permite la API de Payment y se restringen otras APIs sensibles
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;