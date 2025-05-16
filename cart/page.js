import React from 'react';
import { CartProvider } from '../contexts/CartContext';
import { CartButtonEmbed } from '../components/CartButtonEmbed';
import { CartIcon } from '../components/CartIcon';
import { CartSidebar } from '../components/CartSidebar';

export default function CartPage() {
  // Obtener sessionId de la URL o generar uno nuevo
  const getSessionId = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionFromUrl = urlParams.get('sessionId');
      return sessionFromUrl || `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return null;
  };

  const sessionId = getSessionId();

  return (
    <CartProvider sessionId={sessionId}>
      <div className="cart-page-container">
        <h1>Carrito de Compras</h1>
        
        <div className="cart-button-container" style={{ position: 'fixed', top: '20px', right: '20px' }}>
          <CartButtonEmbed 
            checkoutUrl="/checkout"
            iconColor="#333333"
            badgeColor="#F26F32"
            cartBgColor="#FFFFFF"
            buttonColor="#F26F32"
            textColor="#333333"
            size={32}
            showBadge={true}
            onCartOpen={(event) => console.log('Carrito abierto:', event)}
            onCheckout={(event) => console.log('Checkout iniciado:', event)}
          />
        </div>
        
        {/* Contenedor principal */}
        <div className="cart-page-content">
          <p>Puedes usar este componente en cualquier lugar de tu sitio para acceder al carrito de compras.</p>
          <p>Todos los componentes comparten el mismo estado del carrito mediante localStorage.</p>
          
          <div className="cart-page-implementation">
            <h2>Implementación</h2>
            <pre>
              {`
// Implementación básica
import { CartButtonEmbed } from '../components/CartButtonEmbed';

export default function MiPágina() {
  return (
    <div>
      <CartButtonEmbed 
        checkoutUrl="/checkout"
        iconColor="#333333"
        badgeColor="#F26F32"
      />
    </div>
  );
}
              `}
            </pre>
          </div>
        </div>
      </div>
    </CartProvider>
  );
}