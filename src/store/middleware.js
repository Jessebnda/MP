import { broadcastCartUpdate } from '../utils/broadcastChannel';

export const syncCartMiddleware = store => next => action => {
  // Primero, deja que la acción sea procesada
  const result = next(action);

  // Luego, si es una acción que afecta al carrito, sincroniza
  if (
    action.type === 'cart/addItem' || 
    action.type === 'cart/removeItem' || 
    action.type === 'cart/updateQuantity' || 
    action.type === 'cart/clearCart'
  ) {
    const { cart } = store.getState();
    
    // 1. Guardar en localStorage con sessionId
    try {
      localStorage.setItem(`mp_cart_${cart.sessionId}`, JSON.stringify({
        items: cart.items,
        totalAmount: cart.totalAmount,
        totalItems: cart.totalItems,
        timestamp: new Date().toISOString()
      }));
      
      // 2. Notificar a otras pestañas/ventanas
      broadcastCartUpdate(cart, cart.sessionId);
      
      // 3. Disparar evento para componentes que no usen Redux
      if (typeof window !== 'undefined') {
        const updateEvent = new CustomEvent('ALTURA_DIVINA_CART_UPDATE', {
          detail: { 
            source: 'redux_store', 
            sessionId: cart.sessionId,
            action: action.type
          }
        });
        window.dispatchEvent(updateEvent);
      }
    } catch (e) {
      console.error('Error sincronizando carrito:', e);
    }
  }

  return result;
};