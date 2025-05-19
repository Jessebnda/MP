'use client';

import React, { createContext, useReducer, useEffect, useState } from 'react'; // Added useState
import { logInfo } from '../utils/logger';

export const CartContext = createContext();

// Acciones del carrito
export const CART_ACTIONS = {
  ADD_ITEM: 'ADD_ITEM',
  REMOVE_ITEM: 'REMOVE_ITEM',
  UPDATE_QUANTITY: 'UPDATE_QUANTITY',
  CLEAR_CART: 'CLEAR_CART',
};

// Estado inicial
const initialState = {
  items: [],
  totalItems: 0,
  totalAmount: 0,
};

// Reducer para manejar las acciones del carrito
function cartReducer(state, action) {
  switch (action.type) {
    case CART_ACTIONS.ADD_ITEM: {
      const existingItemIndex = state.items.findIndex(
        item => item.productId === action.payload.productId
      );

      let updatedItems;

      if (existingItemIndex >= 0) {
        // Si el producto ya existe, actualizamos la cantidad
        updatedItems = state.items.map((item, index) => {
          if (index === existingItemIndex) {
            return {
              ...item,
              quantity: item.quantity + action.payload.quantity,
            };
          }
          return item;
        });
      } else {
        // Si es un producto nuevo, lo añadimos al carrito
        updatedItems = [...state.items, action.payload];
      }

      // Calcular totales
      const totalItems = updatedItems.reduce((total, item) => total + item.quantity, 0);
      const totalAmount = updatedItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      );

      return {
        ...state,
        items: updatedItems,
        totalItems,
        totalAmount,
      };
    }

    case CART_ACTIONS.REMOVE_ITEM: {
      const updatedItems = state.items.filter(
        item => item.productId !== action.payload.productId
      );
      
      // Calcular totales
      const totalItems = updatedItems.reduce((total, item) => total + item.quantity, 0);
      const totalAmount = updatedItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      );

      return {
        ...state,
        items: updatedItems,
        totalItems,
        totalAmount,
      };
    }

    case CART_ACTIONS.UPDATE_QUANTITY: {
      const { productId, quantity } = action.payload;
      
      // Si la cantidad es 0, eliminamos el item
      if (quantity <= 0) {
        return cartReducer(state, { 
          type: CART_ACTIONS.REMOVE_ITEM, 
          payload: { productId } 
        });
      }
      
      const updatedItems = state.items.map(item => {
        if (item.productId === productId) {
          return { ...item, quantity };
        }
        return item;
      });
      
      // Calcular totales
      const totalItems = updatedItems.reduce((total, item) => total + item.quantity, 0);
      const totalAmount = updatedItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      );

      return {
        ...state,
        items: updatedItems,
        totalItems,
        totalAmount,
      };
    }

    case CART_ACTIONS.CLEAR_CART:
      return initialState;

    default:
      return state;
  }
}

export const CartProvider = ({ children }) => {
  const getInitialState = () => {
    if (typeof window !== 'undefined') {
      const savedCart = sessionStorage.getItem('mp-cart');
      if (savedCart) {
        try {
          return JSON.parse(savedCart);
        } catch (error) {
          console.error("Error parsing saved cart:", error);
          return initialState;
        }
      }
    }
    return initialState;
  };

  const [cartState, dispatch] = useReducer(cartReducer, getInitialState());

  // Get sessionId from URL for messaging
  const [iframeSessionId, setIframeSessionId] = useState(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setIframeSessionId(params.get('sessionId'));
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('mp-cart', JSON.stringify(cartState));

      // Notify parent Framer component about cart update
      if (window.parent !== window && iframeSessionId && cartState._triggeredBy !== 'initialLoad') { // Check iframeSessionId is resolved
        console.log(`CartContext (iframe session: ${iframeSessionId}): Posting CART_UPDATE to parent.`);
        window.parent.postMessage({
          type: 'CART_UPDATE',
          sessionId: iframeSessionId, // The sessionId passed from FramerEmbed to this iframe
          cartData: {
            totalItems: cartState.totalItems,
            totalAmount: cartState.totalAmount,
            // You can include more cart details if needed by the parent
          }
        }, '*'); // IMPORTANT: In production, replace '*' with your Framer/parent domain for security
      }
      // Reset trigger after processing
      if (cartState._triggeredBy) {
        // This is a conceptual way to avoid loops on initial load.
        // Actual implementation might need more robust logic if initial state also triggers this.
        // For now, we assume cartState changes are due to user actions or programmatic updates post-load.
      }
    }
  }, [cartState, iframeSessionId]); // Add iframeSessionId

  // Funciones para interactuar con el carrito
  const addItem = (product, quantity = 1) => {
    dispatch({
      type: CART_ACTIONS.ADD_ITEM,
      payload: {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity,
        product: product
      },
    });
  };

  const removeItem = (productId) => {
    dispatch({
      type: CART_ACTIONS.REMOVE_ITEM,
      payload: { productId },
    });
  };

  const updateQuantity = (productId, quantity) => {
    dispatch({
      type: CART_ACTIONS.UPDATE_QUANTITY,
      payload: { productId, quantity },
    });
  };

  const clearCart = () => {
    dispatch({ type: CART_ACTIONS.CLEAR_CART });
  };

  const value = {
    ...cartState,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};