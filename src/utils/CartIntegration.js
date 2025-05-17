import { useEffect } from 'react';
import { useCart } from '../hooks/useCart';
import { useSessionId } from '../hooks/useSessionId';

/**
 * Este archivo expone la API del carrito para que componentes externos
 * como el CartButtonEmbed de Framer puedan interactuar con el carrito.
 */

// Inicializar el objeto global para la API del carrito
if (typeof window !== 'undefined') {
  window.AlturaDivinaCart = window.AlturaDivinaCart || {};
}

/**
 * Función para exportar las operaciones del carrito al objeto global
 * Debe llamarse desde un componente que tenga acceso al contexto del carrito
 */
export function exposeCartAPI() {
  if (typeof window === 'undefined') return;
  
  // Solo ejecutar en el cliente
  const cart = window.AlturaDivinaCart || {};
  return cart;
}

// Hook para componentes que necesiten exponer la API del carrito
export function useCartIntegration() {
  const cartContext = useCart();
  const sessionId = useSessionId();
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Exportar funciones y datos al objeto global
      window.AlturaDivinaCart = {
        // Getters
        getItems: () => cartContext.items,
        getCount: () => cartContext.totalItems,
        getTotal: () => cartContext.totalAmount,
        getSessionId: () => sessionId,
        
        // Acciones
        addItem: (product, quantity = 1) => {
          cartContext.addItem(product, quantity);
          notifyCartUpdated(sessionId);
        },
        removeItem: (productId) => {
          cartContext.removeItem(productId);
          notifyCartUpdated(sessionId);
        },
        updateQuantity: (productId, quantity) => {
          cartContext.updateQuantity(productId, quantity);
          notifyCartUpdated(sessionId);
        },
        clearCart: () => {
          cartContext.clearCart();
          notifyCartUpdated(sessionId);
        },
        
        // Abrir/cerrar el carrito
        openCart: () => {
          const event = new CustomEvent('OPEN_CART_SIDEBAR', {
            detail: { sessionId }
          });
          window.dispatchEvent(event);
        },
        checkout: () => {
          window.location.href = `/checkout?sessionId=${sessionId}`;
        }
      };
      
      // Escuchar eventos de actualización del carrito desde componentes Framer
      const handleExternalCartUpdate = (event) => {
        try {
          // Si el evento viene de un componente Framer con el mismo sessionId
          if (event.detail && event.detail.sessionId === sessionId && 
              event.detail.source && 
              (event.detail.source === 'cart_button' || event.detail.source === 'mercadopago_iframe')) {
            
            // Intentar cargar el carrito desde localStorage
            const savedCart = localStorage.getItem(`mp_cart_${sessionId}`);
            if (savedCart) {
              const cartData = JSON.parse(savedCart);
              
              // Solo actualizar si es diferente al estado actual
              const currentCartJson = JSON.stringify(cartContext.items);
              const newCartJson = JSON.stringify(cartData.items || []);
              
              if (currentCartJson !== newCartJson && cartData.items) {
                // Primero limpiar el carrito
                cartContext.clearCart();
                
                // Luego añadir los nuevos items
                setTimeout(() => {
                  cartData.items.forEach(item => {
                    if (item.product && item.quantity) {
                      cartContext.addItem(item.product, item.quantity);
                    }
                  });
                }, 0);
              }
            }
          }
        } catch (err) {
          console.error('Error al sincronizar carrito:', err);
        }
      };
      
      window.addEventListener('ALTURA_DIVINA_CART_UPDATE', handleExternalCartUpdate);
      return () => {
        window.removeEventListener('ALTURA_DIVINA_CART_UPDATE', handleExternalCartUpdate);
      };
    }
  }, [cartContext, sessionId]);
  
  return null;
}

// Función auxiliar para notificar a los componentes externos sobre cambios en el carrito
function notifyCartUpdated(sessionId) {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('ALTURA_DIVINA_CART_UPDATE', {
      detail: { 
        source: 'cart_context',
        sessionId: sessionId || 'default_session'
      }
    });
    window.dispatchEvent(event);
  }
}

// Componente para incluir en tu _app.js o layout principal
export function CartAPIProvider() {
  useCartIntegration();
  return null;
}