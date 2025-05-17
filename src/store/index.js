import { configureStore } from '@reduxjs/toolkit';
import { combineReducers } from 'redux';
import { 
  persistStore, 
  persistReducer,
  FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import cartReducer from './cartSlice';
import { syncCartMiddleware } from './middleware';

const persistConfig = {
  key: 'root',
  version: 1,
  storage,
  whitelist: ['cart'] // Solo persistir el carrito
};

const rootReducer = combineReducers({
  cart: cartReducer,
  // otros reducers aquí
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(syncCartMiddleware),
});

// Exponer el estado de Redux globalmente (para debugging y para componentes externos)
if (typeof window !== 'undefined') {
  store.subscribe(() => {
    window.__REDUX_STATE__ = store.getState();
  });
}

export const persistor = persistStore(store);