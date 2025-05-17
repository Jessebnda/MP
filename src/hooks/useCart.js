import { useSelector, useDispatch } from 'react-redux';
import { addItem, removeItem, updateQuantity, clearCart, setSessionId } from '../store/cartSlice';
import { useEffect } from 'react';

export function useCart() {
  const cart = useSelector(state => {
    // Fallback a un objeto seguro si state.cart es undefined
    return state?.cart || { items: [], totalAmount: 0, totalItems: 0, sessionId: null };
  });
  const dispatch = useDispatch();
  
  // Función para obtener/crear el sessionId
  const getOrCreateSessionId = () => {
    // Si ya tenemos un sessionId en Redux, úsalo
    if (cart.sessionId) return cart.sessionId;
    
    // Intentar de la URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const fromUrl = urlParams.get('sessionId');
      if (fromUrl) {
        dispatch(setSessionId(fromUrl));
        return fromUrl;
      }
    }
    
    // Intentar de sessionStorage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const stored = sessionStorage.getItem('mp_global_session_id');
      if (stored) {
        dispatch(setSessionId(stored));
        return stored;
      }
    }
    
    // Crear uno nuevo
    const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('mp_global_session_id', newId);
    }
    dispatch(setSessionId(newId));
    return newId;
  };
  
  // Escuchar eventos del BroadcastChannel
  useEffect(() => {
    const handleExternalUpdate = (event) => {
      // Solo procesar si viene de otro origen (no de nosotros mismos)
      if (event.detail?.source !== 'redux_store') {
        try {
          // Si el evento incluye datos completos del carrito
          if (event.detail?.cart) {
            // Actualizar Redux con los datos recibidos
            const cartData = event.detail.cart;
            if (cartData.items?.length >= 0) {
              // Actualizar todo el carrito de una vez
              cartData.items.forEach(item => {
                dispatch(addItem(item));
              });
            }
          } else if (event.detail?.sessionId) {
            // Si solo tenemos sessionId, intentar cargar del localStorage
            const sessionId = event.detail.sessionId;
            const savedCartString = localStorage.getItem(`mp_cart_${sessionId}`);
            if (savedCartString) {
              try {
                const savedCart = JSON.parse(savedCartString);
                if (savedCart.items && Array.isArray(savedCart.items)) {
                  // Limpiar carrito actual primero
                  dispatch(clearCart());
                  // Agregar todos los items del almacenamiento
                  savedCart.items.forEach(item => {
                    dispatch(addItem(item));
                  });
                }
              } catch (e) {
                console.error('Error parsing saved cart:', e);
              }
            }
          }
        } catch (e) {
          console.error('Error handling external cart update:', e);
        }
      }
    };
    
    window.addEventListener('ALTURA_DIVINA_CART_UPDATE', handleExternalUpdate);
    return () => window.removeEventListener('ALTURA_DIVINA_CART_UPDATE', handleExternalUpdate);
  }, [dispatch]);
  
  // Inicializar sessionId si es necesario
  useEffect(() => {
    if (!cart.sessionId) {
      getOrCreateSessionId();
    }
  }, [cart.sessionId]);
  
  return {
    cart,
    addToCart: (product) => dispatch(addItem(product)),
    removeFromCart: (productId) => dispatch(removeItem(productId)),
    updateQuantity: (productId, quantity) => dispatch(updateQuantity({ productId, quantity })),
    clearCart: () => dispatch(clearCart()),
    sessionId: cart.sessionId || getOrCreateSessionId()
  };
}