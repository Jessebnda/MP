export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}

export const metadata = {
  title: 'Componente de Pago MercadoPago',
  description: 'Componente React para integraciones con MercadoPago',
};