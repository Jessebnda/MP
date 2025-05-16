import React from 'react';
import { useCart } from '../hooks/useCart';
import styles from '../styles/AddToCartButton.module.css';

const AddToCartButton = ({ product, quantity = 1 }) => {
  const { addItem } = useCart();
  
  const handleAddToCart = () => {
    addItem(product, quantity);
  };
  
  return (
    <button 
      className={styles.addToCartButton}
      onClick={handleAddToCart}
    >
      Agregar al Carrito
    </button>
  );
};

export default AddToCartButton;