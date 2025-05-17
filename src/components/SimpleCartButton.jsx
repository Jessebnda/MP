'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionId } from '../hooks/useSessionId';
import { useCart } from '../hooks/useCart';
import styles from '../styles/CartIcon.module.css';

/**
 * Componente simple para mostrar un botón de carrito que se comunica con la API
 * Se usa como punto de entrada para el CartButtonEmbed de Framer
 */
export default function SimpleCartButton({
  iconColor = '#333333',
  badgeColor = '#F26F32',
  size = 24,
  showBadge = true,
  sessionIdOverride = null,
  onCartOpen,
}) {
  const sessionId = useSessionId(sessionIdOverride);
  const { totalItems } = useCart(sessionIdOverride);
  const [cartCount, setCartCount] = useState(totalItems || 0);
  const [isLoading, setIsLoading] = useState(false);
  
  // Función para actualizar el contador desde la API
  const fetchCartCount = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(`/api/cart?sessionId=${sessionId}`);
      const data = await response.json();
      
      if (data.success && data.cart) {
        setCartCount(data.cart.totalItems || 0);
      }
    } catch (error) {
      console.error('Error al cargar datos del carrito:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);
  
  // Actualizar contador basado en el contexto del carrito
  useEffect(() => {
    if (totalItems !== undefined) {
      setCartCount(totalItems);
    }
  }, [totalItems]);

  // Escuchar eventos de actualización externos
  useEffect(() => {
    if (!sessionId) return;
    
    const handleCartUpdate = async (event) => {
      // Solo procesar si es para esta sesión
      if (!event.detail || event.detail.sessionId !== sessionId) return;
      
      // Si el evento incluye información del carrito, usarla directamente
      if (event.detail.cart && event.detail.cart.totalItems !== undefined) {
        setCartCount(event.detail.cart.totalItems);
        return;
      }
      
      // En caso contrario, buscar en la API
      await fetchCartCount();
    };
    
    window.addEventListener('ALTURA_DIVINA_CART_UPDATE', handleCartUpdate);
    
    // Actualizar periódicamente para garantizar sincronización
    const intervalId = setInterval(fetchCartCount, 5000);
    
    // Ejecutar una actualización inicial
    fetchCartCount();
    
    return () => {
      window.removeEventListener('ALTURA_DIVINA_CART_UPDATE', handleCartUpdate);
      clearInterval(intervalId);
    };
  }, [sessionId, fetchCartCount]);

  // Abrir el carrito
  const openCart = () => {
    if (typeof window === 'undefined') return;
    
    // Emitir evento para abrir el carrito
    window.dispatchEvent(new CustomEvent('ALTURA_DIVINA_OPEN_CART', {
      detail: { sessionId }
    }));
    
    // Si hay callback, llamarlo
    if (onCartOpen) {
      onCartOpen({
        cartCount,
        sessionId
      });
    }
  };

  return (
    <button 
      onClick={openCart}
      className={styles.cartButton}
      style={{
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}
      aria-label="Ver carrito"
      disabled={isLoading}
    >
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke={iconColor} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <circle cx="9" cy="21" r="1"></circle>
        <circle cx="20" cy="21" r="1"></circle>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
      </svg>
      
      {/* Badge con contador */}
      {showBadge && cartCount > 0 && (
        <span style={{
          position: 'absolute',
          top: '-8px',
          right: '-8px',
          backgroundColor: badgeColor,
          color: '#FFFFFF',
          borderRadius: '50%',
          width: `${size * 0.45}px`,
          height: `${size * 0.45}px`,
          fontSize: `${size * 0.25}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold'
        }}>
          {cartCount > 99 ? '99+' : cartCount}
        </span>
      )}
    </button>
  );
}
