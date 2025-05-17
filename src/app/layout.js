'use client';
import { Inter, Bodoni_Moda, Playfair_Display_SC } from 'next/font/google'
import '../styles/globals.css'
import { CartProvider } from '../contexts/CartContext';
import { CartAPIProvider } from '../utils/CartIntegration';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from '../store';
import { setupCartChannel } from '../utils/broadcastChannel';
import { useEffect } from 'react';

// Crear cliente de consulta
const queryClient = new QueryClient();

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

// Componente para configurar el canal de broadcast
function BroadcastSetup() {
  useEffect(() => {
    // Configurar canal de comunicación entre pestañas
    setupCartChannel();
  }, []);
  
  return null;
}

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${inter.variable} ${bodoni.variable} ${playfair.variable}`}>
      <head>
        {/* ... */}
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <Provider store={store}>
            <PersistGate loading={<div>Cargando...</div>} persistor={persistor}>
              {/* CartProvider ahora debajo de PersistGate para asegurar que Redux exista primero */}
              <CartProvider>
                <BroadcastSetup />
                <CartAPIProvider />
                {children}
              </CartProvider>
            </PersistGate>
          </Provider>
        </QueryClientProvider>
      </body>
    </html>
  );
}