/**
 * Script de inicialización para componentes Framer
 * Este archivo proporciona funciones auxiliares que garantizan 
 * que los componentes Framer funcionen incluso si no están
 * integrados con la API del carrito del sitio principal
 */

// Función para inicializar el entorno de Framer
(function() {
  if (typeof window === 'undefined') return;
  
  // Marcar script como inicializado
  window.framerCartInitialized = true;

  // Crear objeto global para el carrito si no existe
  if (!window.AlturaDivinaCart) {
    console.log('Inicializando API de carrito fallback para Framer');
    
    // Obtener o crear sessionId consistente
    const getSessionId = function() {
      // 1. Intentar obtener de la URL
      const urlParams = new URLSearchParams(window.location.search);
      const sessionFromUrl = urlParams.get('sessionId');
      if (sessionFromUrl) return sessionFromUrl;
      
      // 2. Intentar obtener del sessionStorage
      if (window.sessionStorage) {
        const storedId = sessionStorage.getItem('mp_global_session_id');
        if (storedId) return storedId;
      }
      
      // 3. Crear uno nuevo y guardarlo
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      if (window.sessionStorage) {
        sessionStorage.setItem('mp_global_session_id', newSessionId);
      }
      return newSessionId;
    };
    
    // Inicializar la implementación fallback local
    const sessionId = getSessionId();
    let cartData = { items: [], totalItems: 0, totalAmount: 0 };
    
    // Intentar cargar datos existentes del localStorage
    try {
      const savedCart = localStorage.getItem(`mp_cart_${sessionId}`);
      if (savedCart) {
        cartData = JSON.parse(savedCart);
      }
    } catch (e) {
      console.error('Error al cargar datos del carrito:', e);
    }
    
    // Función auxiliar para guardar el carrito
    const saveCart = function(cart) {
      try {
        localStorage.setItem(`mp_cart_${sessionId}`, JSON.stringify(cart));
        window.mpCartCount = cart.totalItems || 0;
        
        // Notificar cambios mediante evento
        window.dispatchEvent(new CustomEvent('ALTURA_DIVINA_CART_UPDATE', {
          detail: { 
            source: 'framer_fallback', 
            sessionId,
            cart
          }
        }));
      } catch (e) {
        console.error('Error al guardar carrito:', e);
      }
    };
    
    // Implementar API fallback
    window.AlturaDivinaCart = {
      // Getters
      getSessionId: function() { return sessionId; },
      getItems: function() { return cartData.items || []; },
      getCount: function() { return cartData.totalItems || 0; },
      getTotal: function() { return cartData.totalAmount || 0; },
      
      // Versiones asíncronas para compatibilidad
      getCartCount: function() { 
        return Promise.resolve(cartData.totalItems || 0); 
      },
      getCartItems: function() {
        return Promise.resolve(cartData.items || []); 
      },
      
      // Acciones básicas
      addItem: function(product, quantity = 1) {
        if (!product || !product.productId) return;
        
        const existingIndex = cartData.items.findIndex(i => i.productId === product.productId);
        if (existingIndex >= 0) {
          cartData.items[existingIndex].quantity += quantity;
        } else {
          cartData.items.push({ ...product, quantity });
        }
        
        // Actualizar totales
        cartData.totalItems = cartData.items.reduce((sum, item) => sum + item.quantity, 0);
        cartData.totalAmount = cartData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        saveCart(cartData);
        return cartData;
      },
      
      updateQuantity: function(productId, quantity) {
        if (!productId) return;
        
        if (quantity <= 0) {
          cartData.items = cartData.items.filter(i => i.productId !== productId);
        } else {
          const itemIndex = cartData.items.findIndex(i => i.productId === productId);
          if (itemIndex >= 0) {
            cartData.items[itemIndex].quantity = quantity;
          }
        }
        
        // Actualizar totales
        cartData.totalItems = cartData.items.reduce((sum, item) => sum + item.quantity, 0);
        cartData.totalAmount = cartData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        saveCart(cartData);
        return cartData;
      },
      
      removeItem: function(productId) {
        if (!productId) return;
        
        cartData.items = cartData.items.filter(i => i.productId !== productId);
        
        // Actualizar totales
        cartData.totalItems = cartData.items.reduce((sum, item) => sum + item.quantity, 0);
        cartData.totalAmount = cartData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        saveCart(cartData);
        return cartData;
      },
      
      clearCart: function() {
        cartData = { items: [], totalItems: 0, totalAmount: 0 };
        saveCart(cartData);
        return cartData;
      },
      
      // UI Actions
      openCart: function() {
        console.log('Abriendo carrito (modo Framer)');
        window.dispatchEvent(new CustomEvent('ALTURA_DIVINA_OPEN_CART', {
          detail: { sessionId }
        }));
        window.dispatchEvent(new CustomEvent('OPEN_CART_SIDEBAR', {
          detail: { sessionId }
        }));
      },
      
      checkout: function() {
        window.location.href = `/checkout?sessionId=${sessionId}`;
      }
    };
    
    // Exponer el sessionId globalmente
    window.mpSessionId = sessionId;
    window.mpCartCount = cartData.totalItems || 0;
    
    console.log('API de carrito fallback inicializada para Framer');
  }
})();
