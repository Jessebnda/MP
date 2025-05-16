import React from 'react';
import { useCart } from '../hooks/useCart';
import styles from '../styles/CartIcon.module.css';

const CartIcon = ({ onClick }) => {
  const { totalItems } = useCart();
  
  return (
    <button className={styles.cartIcon} onClick={onClick} aria-label="Ver carrito">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="21" r="1"></circle>
        <circle cx="19" cy="21" r="1"></circle>
        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
      </svg>
      {totalItems > 0 && (
        <span className={styles.cartCount}>{totalItems}</span>
      )}
    </button>
  );
};

export default CartIcon;