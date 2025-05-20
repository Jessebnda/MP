import React from 'react';
import { useCart } from '../hooks/useCart';
import styles from '../styles/CartIcon.module.css';

const CartIcon = ({ onClick, color = "currentColor" }) => {
  const { totalItems } = useCart();
  
  return (
    <button className={styles.cartIcon} onClick={onClick} aria-label="Ver carrito">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="21" r="1"></circle>
        <circle cx="19" cy="21" r="1"></circle>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
      </svg>
      {totalItems > 0 && <span className={styles.cartCount}>{totalItems}</span>}
    </button>
  );
};

export default CartIcon;