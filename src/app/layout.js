import { Inter, Bodoni_Moda, Playfair_Display_SC } from 'next/font/google'
import '../styles/globals.css'
import { CartProvider } from '../contexts/CartContext';

// Fuente para texto general y campos
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700']
})

// Fuente para títulos principales - estilo condensado y elegante
const bodoni = Bodoni_Moda({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bodoni',
  weight: ['400', '500', '600', '700'],
})

// Alternativa para títulos principales
const playfair = Playfair_Display_SC({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
  weight: ['400', '700'],
})

export const metadata = {
  title: 'Componente de Pago MercadoPago',
  description: 'Componente React para integraciones con MercadoPago',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${inter.variable} ${bodoni.variable} ${playfair.variable}`}>
      <head>
        <link 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Bodoni+Moda:wght@400;500;600;700&family=Playfair+Display+SC:wght@400;700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body>
        <CartProvider>
          {children}
        </CartProvider>
      </body>
    </html>
  )
}