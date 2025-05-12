'use client';

import { useEffect } from 'react';
import styles from '../styles/ErrorBoundary.module.css';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('Error:', error);
  }, [error]);

  return (
    <div className={styles.errorContainer}>
      <h2>Algo salió mal</h2>
      <p>Disculpa las molestias. Por favor intenta recargar la página o contacta a soporte.</p>
      <button onClick={reset} className={styles.retryButton}>
        Reintentar
      </button>
    </div>
  );
}