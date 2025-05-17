// filepath: c:\Users\Owner\Downloads\MP\src\store\cartSlice.js
import { createSlice } from '@reduxjs/toolkit';

// Asegurar que el estado inicial tenga todas las propiedades necesarias
const initialState = {
  items: [], // Este array debe existir SIEMPRE
  totalAmount: 0,
  totalItems: 0,
  sessionId: null,
  lastUpdated: null
};

export const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    setSessionId: (state, action) => {
      state.sessionId = action.payload;
    },
    addItem: (state, action) => {
      const { productId, name, price, quantity = 1 } = action.payload;
      const existingItem = state.items.find(item => item.productId === productId);
      
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        state.items.push({ productId, name, price, quantity });
      }
      
      // Recalcular totales
      state.totalItems = state.items.reduce((total, item) => total + item.quantity, 0);
      state.totalAmount = state.items.reduce((total, item) => total + (item.price * item.quantity), 0);
      state.lastUpdated = new Date().toISOString();
    },
    removeItem: (state, action) => {
      const productId = action.payload;
      state.items = state.items.filter(item => item.productId !== productId);
      
      // Recalcular totales
      state.totalItems = state.items.reduce((total, item) => total + item.quantity, 0);
      state.totalAmount = state.items.reduce((total, item) => total + (item.price * item.quantity), 0);
      state.lastUpdated = new Date().toISOString();
    },
    updateQuantity: (state, action) => {
      const { productId, quantity } = action.payload;
      
      if (quantity <= 0) {
        state.items = state.items.filter(item => item.productId !== productId);
      } else {
        const item = state.items.find(item => item.productId === productId);
        if (item) item.quantity = quantity;
      }
      
      // Recalcular totales
      state.totalItems = state.items.reduce((total, item) => total + item.quantity, 0);
      state.totalAmount = state.items.reduce((total, item) => total + (item.price * item.quantity), 0);
      state.lastUpdated = new Date().toISOString();
    },
    clearCart: (state) => {
      state.items = [];
      state.totalItems = 0;
      state.totalAmount = 0;
      state.lastUpdated = new Date().toISOString();
    },
  },
});

export const { setSessionId, addItem, removeItem, updateQuantity, clearCart } = cartSlice.actions;

export default cartSlice.reducer;