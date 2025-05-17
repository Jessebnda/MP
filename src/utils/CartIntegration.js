import { useEffect } from 'react';
import { useCart } from '../hooks/useCart';

/**
 * Este archivo expone la API del carrito para que componentes externos
 * como el CartButtonEmbed de Framer puedan interactuar con el carrito.
 */

// Inicializar el objeto global para la API del carrito
if (typeof window !== 'undefined') {
  window.AlturaDivinaCart = window.AlturaDivinaCart || {};
  
  // Para debugging
  window.AlturaDivinaCart.__DEBUG_initTime = new Date().toISOString();
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
  // Usar la estructura correcta de Redux
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart } = useCart();
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.AlturaDivinaCart = {
        // Getters - actualizar para usar la estructura de Redux
        getItems: () => cart.items,
        getCount: () => cart.totalItems,
        getTotal: () => cart.totalAmount,
        
        // Acciones - actualizar con las funciones de Redux
        addItem: (product, quantity = 1) => {
          addToCart({ ...product, quantity });
          // El middleware ya maneja la notificación
        },
        removeItem: (productId) => {
          removeFromCart(productId);
        },
        updateQuantity: (productId, quantity) => {
          updateQuantity({ productId, quantity });
        },
        clearCart,
        
        // El resto igual
        openCart: () => {
          const event = new CustomEvent('OPEN_CART_SIDEBAR');
          window.dispatchEvent(event);
        },
        checkout: () => {
          window.location.href = '/checkout';
        }
      };
    }
  }, [cart, addToCart, removeFromCart, updateQuantity, clearCart]);
  
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