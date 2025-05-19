import React, { useEffect, useState } from 'react';
import { useCart } from '../hooks/useCart';
import CartItem from './CartItem';
import styles from '../styles/CartSidebar.module.css';
import { cn } from '../lib/utils';

const CartSidebar = ({ isOpen: externalIsOpen, onClose, checkoutUrl = '/checkout' }) => {
  const [isOpenInternal, setIsOpenInternal] = useState(externalIsOpen || false);
  const { items, totalAmount, clearCart } = useCart(); // Asegúrate que useCart está importado

  useEffect(() => {
    if (externalIsOpen !== undefined) {
      setIsOpenInternal(externalIsOpen);
    }
  }, [externalIsOpen]);

  useEffect(() => {
    const handleOpenCart = () => {
      setIsOpenInternal(true);
    };
    window.addEventListener('OPEN_CART_SIDEBAR', handleOpenCart);
    return () => window.removeEventListener('OPEN_CART_SIDEBAR', handleOpenCart);
  }, []);

  // Notificar al padre (Framer) sobre el estado del sidebar
  useEffect(() => {
    if (typeof window !== 'undefined' && window.parent !== window) {
      // Intentar obtener sessionId para dar contexto si es necesario
      const urlParams = new URLSearchParams(window.location.search);
      const sessionIdFromUrl = urlParams.get('sessionId');
      const sessionId = sessionIdFromUrl || sessionStorage.getItem('mp_global_session_id');

      window.parent.postMessage({
        type: 'MP_IFRAME_CART_SIDEBAR_STATE', // Nombre de evento claro
        isOpen: isOpenInternal,
        sessionId: sessionId, // Opcional, para contexto
      }, '*'); // Considera restringir el targetOrigin en producción
    }
  }, [isOpenInternal]);

  const handleClose = () => {
    setIsOpenInternal(false);
    if (onClose) onClose();
  };
  
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
      {isOpenInternal && <div className={styles.overlay} onClick={handleClose}></div>}
      <div className={cn(styles.cartSidebar, isOpenInternal && styles.open)}>
        <div className={styles.header}>
          <h2>Tu Carrito</h2>
          <button onClick={handleClose} className={styles.closeButton} aria-label="Cerrar carrito">
            &times;
          </button>
        </div>
        
        <div className={styles.cartContent}>
          {items.length === 0 ? (
            <div className={styles.emptyCart}>
              <p>Tu carrito está vacío</p>
              <button onClick={handleClose} className={styles.continueShoppingButton}>
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