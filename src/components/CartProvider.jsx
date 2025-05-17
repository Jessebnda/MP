'use client';

import React, { useEffect, useState, useCallback } from 'react';
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
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  // Función para obtener datos actualizados del carrito desde la API
  const fetchCartData = useCallback(async (force = false) => {
    // Evitar llamadas demasiado frecuentes si no es forzado
    if (!force && Date.now() - lastUpdate < 1000) return null;
    
    try {
      setLastUpdate(Date.now());
      const response = await fetch(`/api/cart?sessionId=${sessionId}`);
      const data = await response.json();
      
      if (data.success && data.cart) {
        setCartData(data.cart);
        
        // También almacenar en localStorage para componentes Framer
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`mp_cart_${sessionId}`, JSON.stringify(data.cart));
            // Actualizar contador global para compatibilidad
            window.mpCartCount = data.cart.totalItems || 0;
          } catch (storageError) {
            console.error('Error al guardar en localStorage:', storageError);
          }
        }
        
        return data.cart;
      }
    } catch (error) {
      console.error('Error al obtener datos del carrito:', error);
    }
    return null;
  }, [sessionId, lastUpdate]);
  
  // Exponer API del carrito al objeto global window
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Funciones para manipular el carrito
    const handleAction = async (action, payload = {}) => {
      try {
        // Actualizar contador global para compatibilidad inmediata
        if (action === 'add') {
          window.mpCartCount = (window.mpCartCount || 0) + (payload.quantity || 1);
        } else if (action === 'clear') {
          window.mpCartCount = 0;
        }
        
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
        
        // Actualizar el estado local y localStorage
        if (data.success && data.cart) {
          setCartData(data.cart);
          setLastUpdate(Date.now());
          
          // Guardar en localStorage para componentes Framer
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(`mp_cart_${sessionId}`, JSON.stringify(data.cart));
              // Actualizar contador global para compatibilidad
              window.mpCartCount = data.cart.totalItems || 0;
            } catch (storageError) {
              console.error('Error al guardar en localStorage:', storageError);
            }
          }
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
    
    // Manejar evento de abrir carrito
    const handleOpenCart = () => {
      setIsCartOpen(true);
    };
    
    // Escuchar eventos para abrir el carrito
    window.addEventListener('ALTURA_DIVINA_OPEN_CART', handleOpenCart);
    window.addEventListener('OPEN_CART_SIDEBAR', handleOpenCart);
    
    // Asignar API global para componentes Framer
    window.AlturaDivinaCart = {
      // Getters
      getSessionId: () => sessionId,
      getCartCount: async () => {
        const cart = await fetchCartData();
        return cart ? cart.totalItems : (cartData.totalItems || 0);
      },
      getCartItems: async () => {
        const cart = await fetchCartData();
        return cart ? cart.items : (cartData.items || []);
      },
      
      // Acciones
      addItem: (product, quantity = 1) => handleAction('add', { product, quantity }),
      updateQuantity: (productId, quantity) => handleAction('update', { productId, quantity }),
      removeItem: (productId) => handleAction('remove', { productId }),
      clearCart: () => handleAction('clear'),
      
      // UI Helpers
      openCart: () => {
        setIsCartOpen(true);
        window.dispatchEvent(new CustomEvent('ALTURA_DIVINA_OPEN_CART', { 
          detail: { sessionId }
        }));
      },
      closeCart: () => {
        setIsCartOpen(false);
      },
      checkout: () => {
        window.location.href = `/checkout?sessionId=${sessionId}`;
      }
    };
    
    return () => {
      window.removeEventListener('ALTURA_DIVINA_OPEN_CART', handleOpenCart);
      window.removeEventListener('OPEN_CART_SIDEBAR', handleOpenCart);
    };
  }, [sessionId, cartData, fetchCartData]);
  
  // Obtener datos del carrito iniciales y configurar sincronización
  useEffect(() => {
    fetchCartData(true); // Forzar primera carga
    
    // Escuchar actualizaciones de componentes externos
    const handleExternalUpdate = (event) => {
      if (event.detail && event.detail.sessionId === sessionId) {
        // Si no incluye datos completos del carrito, recargar
        if (!event.detail.cart) {
          fetchCartData(true);
        }
      }
    };
    
    window.addEventListener('ALTURA_DIVINA_CART_UPDATE', handleExternalUpdate);
    
    // Configurar una actualización periódica para mantener sincronizado
    const intervalId = setInterval(() => fetchCartData(), 5000);
    
    return () => {
      window.removeEventListener('ALTURA_DIVINA_CART_UPDATE', handleExternalUpdate);
      clearInterval(intervalId);
    };
  }, [sessionId, fetchCartData]);
  
  return (
    <CartContext.Provider value={{
      ...cartData,
      addItem: (product, quantity = 1) => window.AlturaDivinaCart?.addItem(product, quantity),
      updateQuantity: (productId, quantity) => window.AlturaDivinaCart?.updateQuantity(productId, quantity),
      removeItem: (productId) => window.AlturaDivinaCart?.removeItem(productId),
      clearCart: () => window.AlturaDivinaCart?.clearCart(),
    }}>
      {children}
      <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </CartContext.Provider>
  );
}
