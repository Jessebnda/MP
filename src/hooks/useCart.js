import { useContext, useEffect } from 'react';
import { CartContext } from '../contexts/CartContext';

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }

  // Opcional: Si CartContext ya maneja la carga inicial desde sessionStorage,
  // este useEffect podría ya no ser necesario o necesitar ajustes.
  // useEffect(() => {
  //   const sessionId = getSessionIdFromUrl();
  //   if (sessionId) {
  //     try {
  //       const savedCart = localStorage.getItem(`mp_cart_${sessionId}`);
  //       if (savedCart) {
  //         const parsedCart = JSON.parse(savedCart);
  //         // Aquí necesitarías una forma de 'hidratar' el CartContext si decides mantener esto.
  //         // Pero es preferible que CartContext maneje su propia carga inicial.
  //       }
  //     } catch (e) {
  //       console.error("Error al restaurar carrito:", e);
  //     }
  //   }
  // }, []); 
  
  // REVISAR/ELIMINAR: Si CartContext.jsx es la fuente de verdad para la persistencia
  // y sincronización, este useEffect que escribe a localStorage podría ser redundante
  // o causar conflictos.
  /*
  useEffect(() => {
    const sessionId = getSessionIdFromUrl();
    if (sessionId) {
      try {
        localStorage.setItem(`mp_cart_${sessionId}`, JSON.stringify({
          items: context.items,
          totalAmount: context.totalAmount,
          timestamp: new Date().toISOString()
        }));
      } catch (e) {
        console.error("Error al guardar carrito:", e);
      }
    }
  }, [context.items, context.totalAmount]); // Asegúrate de que las dependencias sean correctas
  */
  
  return context;
}