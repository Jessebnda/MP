import React from 'react';
import { useCart } from '../hooks/useCart';
import CartItem from './CartItem';
import styles from '../styles/CartSidebar.module.css';
import { cn } from '../lib/utils';

const CartSidebar = ({ isOpen, onClose, checkoutUrl = '/checkout' }) => {
  const { items, totalAmount, clearCart } = useCart();
  
  const formatPrice = (price) => {
    return price.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
    });
  };

  const handleCheckout = () => {
    onClose();
    // Use the checkoutUrl prop or default to /checkout
    window.location.href = checkoutUrl;
  };

  return (
    <>
      {isOpen && <div className={styles.overlay} onClick={onClose}></div>}
      <div className={cn(styles.cartSidebar, isOpen && styles.open)}>
        <div className={styles.header}>
          <h2>Tu Carrito</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Cerrar carrito">
            &times;
          </button>
        </div>
        
        <div className={styles.cartContent}>
          {items.length === 0 ? (
            <div className={styles.emptyCart}>
              <p>Tu carrito está vacío</p>
              <button onClick={onClose} className={styles.continueShoppingButton}>
                Seguir Comprando
              </button>
            </div>
          ) : (
            <>
              <div className={styles.cartItems}>
                {items.map((item) => (
                  <CartItem key={item.productId} item={item} />
                ))}
              </div>
              
              <div className={styles.cartSummary}>
                <div className={styles.cartTotal}>
                  <span>Total:</span>
                  <span>{formatPrice(totalAmount)}</span>
                </div>
                
                <div className={styles.cartActions}>
                  <button onClick={clearCart} className={styles.clearCartButton}>
                    Vaciar Carrito
                  </button>
                  <button 
                    onClick={handleCheckout}
                    className={styles.checkoutButton}
                  >
                    Proceder al Pago
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default CartSidebar;