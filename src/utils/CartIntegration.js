import { useEffect } from 'react';
import { useCart } from '../hooks/useCart';

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
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Exportar funciones y datos al objeto global
      window.AlturaDivinaCart = {
        // Getters
        getItems: () => cartContext.items,
        getCount: () => cartContext.totalItems,
        getTotal: () => cartContext.totalAmount,
        
        // Acciones
        addItem: (product, quantity = 1) => {
          cartContext.addItem(product, quantity);
          notifyCartUpdated();
        },
        removeItem: (productId) => {
          cartContext.removeItem(productId);
          notifyCartUpdated();
        },
        updateQuantity: (productId, quantity) => {
          cartContext.updateQuantity(productId, quantity);
          notifyCartUpdated();
        },
        clearCart: () => {
          cartContext.clearCart();
          notifyCartUpdated();
        },
        
        // Abrir/cerrar el carrito
        openCart: () => {
          // Implementa el código para abrir tu carrito
          const event = new CustomEvent('OPEN_CART_SIDEBAR');
          window.dispatchEvent(event);
        },
        checkout: () => {
          // Implementa el código para ir al checkout
          window.location.href = '/checkout';
        }
      };
    }
  }, [cartContext]);
  
  return null;
}

// Función auxiliar para notificar a los componentes externos sobre cambios en el carrito
function notifyCartUpdated() {
  if (typeof window !== 'undefined') {
    // Obtener el sessionId del mismo lugar donde lo obtienen los componentes Framer
    let sessionId;
    
    // 1. Intentar obtener de la URL
    const urlParams = new URLSearchParams(window.location.search);
    sessionId = urlParams.get('sessionId');
    
    // 2. Si no hay en URL, intentar obtener del sessionStorage
    if (!sessionId) {
      sessionId = sessionStorage.getItem('mp_global_session_id');
    }
    
    // 3. Crear el evento con el sessionId en los detalles
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