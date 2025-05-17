import { useEffect } from 'react';
import { useCart } from '../hooks/useCart';
import { useSessionId } from '../hooks/useSessionId';

/**
 * Este archivo expone la API del carrito para que componentes externos
 * como el CartButtonEmbed de Framer puedan interactuar con el carrito.
 */

// Variables para almacenar el estado
let isInitialized = false;
let currentSessionId = null;

// Inicializar el objeto global para la API del carrito
if (typeof window !== 'undefined') {
  window.AlturaDivinaCart = window.AlturaDivinaCart || {};
}

/**
 * Inicializa la integración del carrito obteniendo o creando un sessionId global
 * @param {string} [sessionIdOverride] - ID de sesión opcional para usar en lugar del global
 * @returns {string} - El sessionId actual
 */
export function initCartIntegration(sessionIdOverride = null) {
  if (typeof window === 'undefined') return null;
  
  // Si ya está inicializado y no hay override, devolver el ID actual
  if (isInitialized && !sessionIdOverride) return currentSessionId;
  
  // Usar el sessionId proporcionado o buscar/crear uno
  const sessionId = sessionIdOverride || getOrCreateSessionId();
  
  // Asegurar que el sessionId está disponible globalmente
  if (sessionId) {
    currentSessionId = sessionId;
    window.mpSessionId = sessionId;
    
    if (window.sessionStorage) {
      window.sessionStorage.setItem('mp_global_session_id', sessionId);
    }
    
    isInitialized = true;
  }
  
  return sessionId;
}

/**
 * Obtiene o crea un sessionId global
 * @returns {string} El sessionId obtenido o creado
 */
function getOrCreateSessionId() {
  // 1. Intentar obtener de la URL
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionFromUrl = urlParams.get('sessionId');
    if (sessionFromUrl) return sessionFromUrl;
  }
  
  // 2. Intentar obtener del sessionStorage
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const storedId = sessionStorage.getItem('mp_global_session_id');
    if (storedId) return storedId;
  }
  
  // 3. Intentar obtener de la propiedad global
  if (typeof window !== 'undefined' && window.mpSessionId) {
    return window.mpSessionId;
  }
  
  // 4. Crear uno nuevo y guardarlo para que sea consistente
  const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    sessionStorage.setItem('mp_global_session_id', newSessionId);
  }
  return newSessionId;
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

/**
 * Guarda localmente los datos del carrito para usar como fallback
 * @param {string} sessionId - ID de sesión asociado al carrito
 * @param {Object} cartData - Datos del carrito
 */
export function saveCartToLocalStorage(sessionId, cartData) {
  if (!sessionId || !cartData || typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(`mp_cart_${sessionId}`, JSON.stringify(cartData));
  } catch (e) {
    console.error('Error al guardar carrito en localStorage:', e);
  }
}

// Hook para componentes que necesiten exponer la API del carrito
export function useCartIntegration() {
  const cartContext = useCart();
  const sessionId = useSessionId();
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Inicializar la integración con el sessionId actual
      initCartIntegration(sessionId);
      
      // Exportar funciones y datos al objeto global
      window.AlturaDivinaCart = {
        // Getters
        getItems: () => cartContext.items,
        getCount: () => cartContext.totalItems,
        getTotal: () => cartContext.totalAmount,
        getSessionId: () => sessionId,
        getCartCount: async () => {
          try {
            const response = await fetch(`/api/cart?sessionId=${sessionId}`);
            if (response.ok) {
              const data = await response.json();
              return data.success && data.cart ? data.cart.totalItems : 0;
            }
            return cartContext.totalItems;
          } catch (e) {
            return cartContext.totalItems;
          }
        },
        getCartItems: async () => {
          try {
            const response = await fetch(`/api/cart?sessionId=${sessionId}`);
            if (response.ok) {
              const data = await response.json();
              return data.success && data.cart ? data.cart.items : [];
            }
            return cartContext.items;
          } catch (e) {
            return cartContext.items;
          }
        },
        
        // Acciones
        addItem: (product, quantity = 1) => {
          cartContext.addItem(product, quantity);
          notifyCartUpdated(sessionId, 'add', { 
            items: cartContext.items, 
            totalItems: cartContext.totalItems,
            totalAmount: cartContext.totalAmount
          });
        },
        removeItem: (productId) => {
          cartContext.removeItem(productId);
          notifyCartUpdated(sessionId, 'remove', { 
            items: cartContext.items, 
            totalItems: cartContext.totalItems,
            totalAmount: cartContext.totalAmount
          });
        },
        updateQuantity: (productId, quantity) => {
          cartContext.updateQuantity(productId, quantity);
          notifyCartUpdated(sessionId, 'update', { 
            items: cartContext.items, 
            totalItems: cartContext.totalItems,
            totalAmount: cartContext.totalAmount
          });
        },
        clearCart: () => {
          cartContext.clearCart();
          notifyCartUpdated(sessionId, 'clear', { 
            items: [], 
            totalItems: 0,
            totalAmount: 0
          });
        },
        
        // Abrir/cerrar el carrito
        openCart: () => {
          const event = new CustomEvent('ALTURA_DIVINA_OPEN_CART', {
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
          // Si el evento viene de un componente con el mismo sessionId
          if (event.detail && event.detail.sessionId === sessionId) {
            // Si el evento incluye datos del carrito
            if (event.detail.cart) {
              const cartData = event.detail.cart;
              
              // Solo actualizar si es diferente al estado actual
              const currentCartJson = JSON.stringify(cartContext.items);
              const newCartJson = JSON.stringify(cartData.items || []);
              
              if (currentCartJson !== newCartJson && cartData.items) {
                // Primero limpiar el carrito
                cartContext.clearCart();
                
                // Luego añadir los nuevos items
                setTimeout(() => {
                  cartData.items.forEach(item => {
                    if (item.product || (item.productId && item.name && item.price)) {
                      const product = item.product || {
                        productId: item.productId,
                        name: item.name,
                        price: item.price,
                        image: item.image
                      };
                      cartContext.addItem(product, item.quantity || 1);
                    }
                  });
                }, 0);
              }
              
              // Guardar en localStorage para componentes Framer
              saveCartToLocalStorage(sessionId, {
                items: cartContext.items,
                totalItems: cartContext.totalItems,
                totalAmount: cartContext.totalAmount
              });
            } else {
              // Si no hay datos del carrito, intentar sincronizar con la API
              fetch(`/api/cart?sessionId=${sessionId}`)
                .then(res => res.json())
                .then(data => {
                  if (data.success && data.cart) {
                    const cartData = data.cart;
                    
                    // Solo actualizar si es diferente al estado actual
                    if (JSON.stringify(cartContext.items) !== JSON.stringify(cartData.items || [])) {
                      // Limpiar y añadir nuevos items
                      cartContext.clearCart();
                      
                      setTimeout(() => {
                        (cartData.items || []).forEach(item => {
                          if (item.product || (item.productId && item.name)) {
                            const product = item.product || {
                              productId: item.productId,
                              name: item.name,
                              price: item.price,
                              image: item.image
                            };
                            cartContext.addItem(product, item.quantity || 1);
                          }
                        });
                      }, 0);
                    }
                  }
                })
                .catch(err => console.error('Error al sincronizar con API:', err));
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
function notifyCartUpdated(sessionId, action = 'update', cartData = null) {
  if (typeof window !== 'undefined') {
    // Guardar en localStorage para componentes Framer
    if (cartData) {
      saveCartToLocalStorage(sessionId, cartData);
    }
    
    const event = new CustomEvent('ALTURA_DIVINA_CART_UPDATE', {
      detail: { 
        source: 'cart_context',
        sessionId: sessionId || 'default_session',
        action,
        cart: cartData
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