import React from 'react';
import { useCart } from '../hooks/useCart';
import styles from '../styles/CartItem.module.css';

const CartItem = ({ item }) => {
  const { updateQuantity, removeItem } = useCart();
  
  const formatPrice = (price) => {
    return price.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
    });
  };
  
  const handleQuantityChange = (e) => {
    const quantity = parseInt(e.target.value);
    if (!isNaN(quantity) && quantity >= 0) {
      updateQuantity(item.productId, quantity);
    }
  };
  
  const handleIncrement = () => {
    updateQuantity(item.productId, item.quantity + 1);
  };
  
  const handleDecrement = () => {
    if (item.quantity > 1) {
      updateQuantity(item.productId, item.quantity - 1);
    }
  };

  return (
    <div className={styles.cartItem}>
      <div className={styles.itemInfo}>
        <h4 className={styles.itemName}>{item.name}</h4>
        <p className={styles.itemPrice}>{formatPrice(item.price)} / unidad</p>
      </div>
      
      <div className={styles.itemActions}>
        <div className={styles.quantityControl}>
          <button 
            onClick={handleDecrement} 
            className={styles.quantityButton}
            disabled={item.quantity <= 1}
          >
            -
          </button>
          <input
            type="number"
            min="1"
            value={item.quantity}
            onChange={handleQuantityChange}
            className={styles.quantityInput}
          />
          <button 
            onClick={handleIncrement}
            className={styles.quantityButton}
          >
            +
          </button>
        </div>
        
        <div className={styles.itemTotal}>
          <span>{formatPrice(item.price * item.quantity)}</span>
          <button 
            onClick={() => removeItem(item.productId)}
            className={styles.removeButton}
            aria-label="Eliminar item"
          >
            &times;
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartItem;