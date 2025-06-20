'use client';

import React, { useEffect } from 'react';
import PaymentFlow from '../../components/PaymentFlow';
import { useCart } from '../../hooks/useCart';
import { useRouter } from 'next/navigation';
import styles from '../../styles/Checkout.module.css';

export default function Checkout() {
  const { items, totalItems } = useCart();
  const router = useRouter();
  
  // Redirect to home if cart is empty
  useEffect(() => {
    if (totalItems === 0) {
      // Optional: show a message before redirecting
      alert('Tu carrito está vacío. Selecciona productos primero.');
      router.push('/');
    }
  }, [totalItems, router]);
  
  if (totalItems === 0) {
    return (
      <div className={styles.redirecting}>
        <p>Redirigiendo al catálogo de productos...</p>
      </div>
    );
  }
  
  return (
    <div className={styles.checkoutContainer}>
      <PaymentFlow
        apiBaseUrl={process.env.NEXT_PUBLIC_HOST_URL}
        productsEndpoint="/api/products"
        mercadoPagoPublicKey={process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY}
        successUrl="https://alturadivina.com/confirmacion-de-compra"
        pendingUrl="https://alturadivina.com/proceso-de-compra"
        failureUrl="https://alturadivina.com/error-de-compra"
        initialStep={2} // Start at step 2 (customer information)
      />
    </div>
  );
}