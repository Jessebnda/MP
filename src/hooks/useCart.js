import { useContext, useEffect } from 'react';
import { CartContext } from '../contexts/CartContext';
import { useSessionId } from './useSessionId';

export function useCart(sessionIdOverride = null) {
  const context = useContext(CartContext);
  // Usar el hook unificado
  const sessionId = useSessionId(sessionIdOverride);
  
  // Detectar si estamos en iframe
  const isInIframe = typeof window !== 'undefined' && window !== window.parent;
  
  useEffect(() => {
    // Si estamos en iframe y el carrito está vacío, intentar cargar desde localStorage
    if (isInIframe && context.items.length === 0) {
      try {
        const savedCart = localStorage.getItem(`mp_cart_${sessionId}`);
        if (savedCart) {
          const cartData = JSON.parse(savedCart);
          // Restaurar el carrito desde localStorage
          if (cartData.items && Array.isArray(cartData.items)) {
            cartData.items.forEach(item => {
              if (item.product && item.quantity) {
                context.addItem(item.product, item.quantity);
              }
            });
          }
        }
      } catch (e) {
        console.error("Error al restaurar carrito:", e);
      }
    }
  }, [sessionId, isInIframe, context]);
  
  // Incluir el sessionId en el objeto retornado para que esté disponible
  return {
    ...context,
    sessionId
  };
}