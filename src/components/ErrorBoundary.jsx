'use client';

import { Component } from 'react';
import { logSecurityEvent } from '../lib/security-logger';
import styles from '../styles/ErrorBoundary.module.css';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Registrar el error con nuestro logger de seguridad
    logSecurityEvent('react_error', { 
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    }, 'error');
    
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // Renderizar UI de fallback
      return (
        <div className={styles.errorContainer}>
          <h2>Algo salió mal</h2>
          <p>Disculpa las molestias. Por favor intenta recargar la página o contacta a soporte.</p>
          
          <button 
            onClick={() => window.location.reload()} 
            className={styles.retryButton}
          >
            Reintentar
          </button>
          
          {/* Solo mostrar detalles técnicos en desarrollo */}
          {process.env.NODE_ENV !== 'production' && (
            <details className={styles.errorDetails}>
              <summary>Detalles del error</summary>
              <p>{this.state.error?.message}</p>
              <pre>{this.state.error?.stack}</pre>
              <pre>{this.state.errorInfo?.componentStack}</pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}