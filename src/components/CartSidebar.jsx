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
    
    // Obtener los parámetros actuales de la URL
    const currentParams = new URLSearchParams(window.location.search);
    const sessionId = currentParams.get('sessionId') || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Construir la URL de checkout con los parámetros necesarios
    let checkoutUrl = `${apiBaseUrl}/checkout`;
    let params = new URLSearchParams();
    
    // Mantener los parámetros de color y sesión
    const colorParams = ['buttonColor', 'circleColor', 'primaryButtonColor', 'secondaryButtonColor'];
    colorParams.forEach(param => {
      if (currentParams.get(param)) {
        params.append(param, currentParams.get(param));
      }
    });
    
    // Añadir el sessionId para persistencia del carrito
    params.append('sessionId', sessionId);
    
    // Añadir los parámetros a la URL
    if (params.toString()) {
      checkoutUrl += `?${params.toString()}`;
    }
    
    // Redireccionar
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