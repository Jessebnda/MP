import { useContext, useEffect } from 'react';
import { CartContext } from '../contexts/CartContext';

export function useCart() {
  const context = useContext(CartContext);
  
  // Detectar si estamos en iframe
  const isInIframe = typeof window !== 'undefined' && window !== window.parent;
  
  // Obtener sessionId de URL si está disponible
  const getSessionIdFromUrl = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('sessionId');
    }
    return null;
  };
  
  useEffect(() => {
    const sessionId = getSessionIdFromUrl();
    
    // Si tenemos un sessionId y estamos en iframe, intentar cargar el carrito 
    // con ese ID del localStorage
    if (sessionId && isInIframe && context.items.length === 0) {
      try {
        const savedCart = localStorage.getItem(`mp_cart_${sessionId}`);
        if (savedCart) {
          const cartData = JSON.parse(savedCart);
          // Restaurar el carrito desde localStorage
          cartData.items.forEach(item => {
            context.addItem(item.product, item.quantity);
          });
        }
      } catch (e) {
        console.error("Error al restaurar carrito:", e);
      }
    }
  }, []);
  
  // Guardar carrito en localStorage cuando cambie
  useEffect(() => {
    const sessionId = getSessionIdFromUrl();
    if (sessionId) {
      try {
        localStorage.setItem(`mp_cart_${sessionId}`, JSON.stringify({
          items: context.items,
          totalAmount: context.totalAmount,
          timestamp: new Date().toISOString()
        }));
      } catch (e) {
        console.error("Error al guardar carrito:", e);
      }
    }
  }, [context.items]);
  
  return context;
}