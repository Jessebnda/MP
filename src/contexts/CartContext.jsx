'use client';

import React, { createContext, useReducer, useEffect } from 'react';
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
  // Recuperar estado del carrito del localStorage
  const getInitialState = () => {
    if (typeof window !== 'undefined') {
      const savedCart = sessionStorage.getItem('mp-cart');
      if (savedCart) {
        try {
          return JSON.parse(savedCart);
        } catch (error) {
          return initialState;
        }
      }
    }
    return initialState;
  };

  const [cartState, dispatch] = useReducer(cartReducer, getInitialState());

  // Guardar el estado del carrito en localStorage cuando cambie
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Obtener sessionId de la misma manera que los componentes Framer
      const sessionId = getSessionIdFromUrl() || 
                        sessionStorage.getItem('mp_global_session_id') || 
                        'default_session';
      
      // Usar localStorage con la misma estructura de clave que usan los componentes Framer
      localStorage.setItem(`mp_cart_${sessionId}`, JSON.stringify({
        items: cartState.items,
        totalAmount: cartState.totalAmount,
        totalItems: cartState.totalItems,
        timestamp: new Date().toISOString()
      }));
      
      // Mantener también sessionStorage para compatibilidad con código existente
      sessionStorage.setItem('mp-cart', JSON.stringify(cartState));
    }
  }, [cartState]);

  // Funciones para interactuar con el carrito
  const addItem = (product, quantity = 1) => {
    dispatch({
      type: CART_ACTIONS.ADD_ITEM,
      payload: {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity,
        product: product // Mantener referencia al objeto producto completo
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

// Añadir esta función para obtener sessionId de URL
const getSessionIdFromUrl = () => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    return params.get('sessionId');
  }
  return null;
};