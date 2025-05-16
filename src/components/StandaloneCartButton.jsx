'use client';

import React, { useState, useEffect } from 'react';
import CartIcon from './CartIcon';
import CartSidebar from './CartSidebar';
import { useCart } from '../hooks/useCart';

const StandaloneCartButton = ({ 
  apiBaseUrl, 
  checkoutUrl = '/checkout',
  onCartUpdate = () => {},
  buttonSize = 24,
  buttonColor = '#333',
  customStyles = {} 
}) => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { items, totalAmount, totalItems } = useCart();
  
  // Notify parent component when cart changes
  useEffect(() => {
    onCartUpdate({ items, totalAmount, totalItems });
  }, [items, totalAmount, totalItems, onCartUpdate]);

  // Post message to parent if in iframe
  useEffect(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ 
        type: 'MP_CART_UPDATE',
        cart: { items, totalAmount, totalItems }
      }, '*');
    }
  }, [items, totalAmount, totalItems]);

  return (
    <>
      <CartIcon 
        onClick={() => setIsCartOpen(true)} 
        count={totalItems}
        size={buttonSize}
        color={buttonColor}
        style={customStyles.cartIcon || {}}
      />
      
      <CartSidebar 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        checkoutUrl={`${apiBaseUrl}${checkoutUrl}`}
      />
    </>
  );
};

export default StandaloneCartButton;