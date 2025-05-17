let cartChannel;

// Crear canal de comunicación
export const setupCartChannel = () => {
  if (typeof window === 'undefined') return;
  
  try {
    cartChannel = new BroadcastChannel('altura_divina_cart');
    
    // Escuchar mensajes de otras pestañas
    cartChannel.onmessage = (event) => {
      if (event.data && event.data.type === 'CART_UPDATE') {
        // Notificar a los componentes locales
        const localEvent = new CustomEvent('ALTURA_DIVINA_CART_UPDATE', {
          detail: event.data
        });
        window.dispatchEvent(localEvent);
      }
    };
    
    return cartChannel;
  } catch (e) {
    console.warn('BroadcastChannel no soportado en este navegador', e);
    return null;
  }
};

// Transmitir cambios del carrito a otras pestañas
export const broadcastCartUpdate = (cartData, sessionId) => {
  if (!cartChannel) return;
  
  try {
    cartChannel.postMessage({
      type: 'CART_UPDATE',
      cart: cartData,
      sessionId,
      timestamp: Date.now()
    });
  } catch (e) {
    console.error('Error al transmitir actualización del carrito', e);
  }
};