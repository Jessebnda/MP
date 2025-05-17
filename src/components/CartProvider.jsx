'use client';

import React, { useEffect, useState } from 'react';
import { CartContext } from '../contexts/CartContext';
import { useSessionId } from '../hooks/useSessionId';
import CartSidebar from './CartSidebar';

/**
 * Componente que proporciona el contexto del carrito y
 * expone la API global para que los componentes Framer
 * puedan interactuar con el carrito del sitio principal
 */
export default function CartProvider({ children, initialSessionId }) {
  const sessionId = useSessionId(initialSessionId);
  const [cartData, setCartData] = useState({ items: [], totalItems: 0, totalAmount: 0 });
  
  // Función para obtener datos actualizados del carrito
  const fetchCartData = async () => {
    try {
      const response = await fetch(`/api/cart?sessionId=${sessionId}`);
      const data = await response.json();
      
      if (data.success && data.cart) {
        setCartData(data.cart);
        return data.cart;
      }
    } catch (error) {
      console.error('Error al obtener datos del carrito:', error);
    }
    return null;
  };
  
  // Exponer API del carrito al objeto global window
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Funciones para manipular el carrito
    const handleAction = async (action, payload = {}) => {
      try {
        // Enviar acción a la API
        const response = await fetch('/api/cart', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...payload,
            action,
            sessionId,
          }),
        });
        
        if (!response.ok) {
          throw new Error('Error al actualizar el carrito');
        }
        
        const data = await response.json();
        
        // Actualizar el estado local
        if (data.success && data.cart) {
          setCartData(data.cart);
        }
        
        // Notificar a los componentes externos
        window.dispatchEvent(new CustomEvent('ALTURA_DIVINA_CART_UPDATE', {
          detail: { 
            source: 'cart_api',
            sessionId,
            action,
            cart: data.cart
          }
        }));
        
        return data.cart;
      } catch (error) {
        console.error(`Error al realizar acción ${action}:`, error);
        return null;
      }
    };
    
    // Asignar API global para componentes Framer
    window.AlturaDivinaCart = {
      // Getters
      getSessionId: () => sessionId,
      getCartCount: async () => {
        const cart = await fetchCartData();
        return cart ? cart.totalItems : 0;
      },
      getCartItems: async () => {
        const cart = await fetchCartData();
        return cart ? cart.items : [];
      },
      
      // Acciones
      addItem: (product, quantity = 1) => handleAction('add', { product, quantity }),
      updateQuantity: (productId, quantity) => handleAction('update', { productId, quantity }),
      removeItem: (productId) => handleAction('remove', { productId }),
      clearCart: () => handleAction('clear'),
      
      // UI Helpers
      openCart: () => {
        window.dispatchEvent(new CustomEvent('ALTURA_DIVINA_OPEN_CART', { 
          detail: { sessionId }
        }));
      },
      checkout: () => {
        window.location.href = `/checkout?sessionId=${sessionId}`;
      }
    };
  }, [sessionId]);
  
  // Obtener datos del carrito iniciales
  useEffect(() => {
    fetchCartData();
    
    // Configurar una actualización periódica para mantener sincronizado
    const intervalId = setInterval(fetchCartData, 5000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [sessionId]);
  
  return (
    <>
      {children}
      <CartSidebar />
    </>
  );
}
