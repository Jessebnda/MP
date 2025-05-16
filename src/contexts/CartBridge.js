import { createContext, useContext, useEffect, useState } from 'react';

const CartBridgeContext = createContext(null);

export function CartBridgeProvider({ children }) {
  const [bridgeCartItems, setBridgeCartItems] = useState([]);
  const [cartUpdated, setCartUpdated] = useState(false);
  
  const updateCartItems = (items) => {
    setBridgeCartItems(items);
    setCartUpdated(true);
  };
  
  // Listen for cart updates from iframe
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'MP_CART_UPDATE') {
        updateCartItems(event.data.cart.items);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);
  
  return (
    <CartBridgeContext.Provider value={{ bridgeCartItems, updateCartItems, cartUpdated, setCartUpdated }}>
      {children}
    </CartBridgeContext.Provider>
  );
}

export function useCartBridge() {
  const context = useContext(CartBridgeContext);
  if (!context) {
    throw new Error('useCartBridge must be used within a CartBridgeProvider');
  }
  return context;
}