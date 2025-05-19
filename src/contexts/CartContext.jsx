'use client';

import React, { createContext, useReducer, useEffect, useState } from 'react';
import { logInfo } from '../utils/logger';

export const CartContext = createContext();

export const CART_ACTIONS = {
  ADD_ITEM: 'ADD_ITEM',
  REMOVE_ITEM: 'REMOVE_ITEM',
  UPDATE_QUANTITY: 'UPDATE_QUANTITY',
  CLEAR_CART: 'CLEAR_CART',
};

const initialState = {
  items: [],
  totalItems: 0,
  totalAmount: 0,
};

function cartReducer(state, action) {
  switch (action.type) {
    case CART_ACTIONS.ADD_ITEM: {
      const existingItemIndex = state.items.findIndex(
        item => item.productId === action.payload.productId
      );
      let updatedItems;
      if (existingItemIndex >= 0) {
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
        updatedItems = [...state.items, action.payload];
      }
      const totalItems = updatedItems.reduce((total, item) => total + item.quantity, 0);
      const totalAmount = updatedItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      );
      return { ...state, items: updatedItems, totalItems, totalAmount };
    }
    case CART_ACTIONS.REMOVE_ITEM: {
      const updatedItems = state.items.filter(
        item => item.productId !== action.payload.productId
      );
      const totalItems = updatedItems.reduce((total, item) => total + item.quantity, 0);
      const totalAmount = updatedItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      );
      return { ...state, items: updatedItems, totalItems, totalAmount };
    }
    case CART_ACTIONS.UPDATE_QUANTITY: {
      const { productId, quantity } = action.payload;
      if (quantity <= 0) {
        // Delegate to REMOVE_ITEM logic
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
      const totalItems = updatedItems.reduce((total, item) => total + item.quantity, 0);
      const totalAmount = updatedItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      );
      return { ...state, items: updatedItems, totalItems, totalAmount };
    }
    case CART_ACTIONS.CLEAR_CART:
      return {...initialState}; // Ensure new object for state change
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
          return {...initialState};
        }
      }
    }
    return {...initialState};
  };

  const [cartState, dispatch] = useReducer(cartReducer, undefined, getInitialState); // Use lazy initialization for reducer
  const [iframeSessionId, setIframeSessionId] = useState(null);
  // This flag helps prevent postMessage on initial load/remount after reading from sessionStorage
  const [isInitialMountOrRefresh, setIsInitialMountOrRefresh] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setIframeSessionId(params.get('sessionId'));
      setIsInitialMountOrRefresh(true); // Set true on mount or if sessionId changes
    }
  }, []); // Runs on mount

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('mp-cart', JSON.stringify(cartState));

      // If this effect runs due to initial mount/refresh, consume the flag and don't postMessage
      if (isInitialMountOrRefresh) {
        setIsInitialMountOrRefresh(false);
        return;
      }

      // Only post message if it's not the initial mount/refresh cycle
      if (window.parent !== window && iframeSessionId) {
        logInfo(`CartContext (iframe session: ${iframeSessionId}): Posting CART_UPDATE to parent due to cartState change.`);
        window.parent.postMessage({
          type: 'CART_UPDATE',
          sessionId: iframeSessionId,
          cartData: {
            totalItems: cartState.totalItems,
            totalAmount: cartState.totalAmount,
          }
        }, '*'); // IMPORTANT: In production, replace '*' with your Framer/parent domain
      }
    }
  }, [cartState, iframeSessionId, isInitialMountOrRefresh]); // Add isInitialMountOrRefresh to dependencies

  const addItem = (product, quantity = 1) => {
    dispatch({
      type: CART_ACTIONS.ADD_ITEM,
      payload: { productId: product.id, name: product.name, price: product.price, quantity, product },
    });
  };

  const removeItem = (productId) => {
    dispatch({ type: CART_ACTIONS.REMOVE_ITEM, payload: { productId } });
  };

  const updateQuantity = (productId, quantity) => {
    dispatch({ type: CART_ACTIONS.UPDATE_QUANTITY, payload: { productId, quantity } });
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