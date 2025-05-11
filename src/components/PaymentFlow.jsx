'use client';

import { useState, useEffect } from 'react';
import styles from '../styles/PaymentFlow.module.css'; 
import MercadoPagoProvider from './MercadoPagoProvider';
import { cn } from '../lib/utils';

export default function PaymentFlow({
  apiBaseUrl,
  productsEndpoint = '/api/products',
  mercadoPagoPublicKey,
  PaymentProviderComponent = MercadoPagoProvider,
  successUrl,
  pendingUrl,
  failureUrl,
  onSuccess,
  onError,
  containerStyles = {},
  hideTitle = false,
  className = '',
}) {
  if (!apiBaseUrl) {
    console.error("PaymentFlow Error: 'apiBaseUrl' prop is required.");
    return <div className={styles['mp-error-container']}>Error de configuración: Falta apiBaseUrl.</div>;
  }
  if (!mercadoPagoPublicKey) {
    console.error("PaymentFlow Error: 'mercadoPagoPublicKey' prop is required.");
    return <div className={styles['mp-error-container']}>Error de configuración: Falta mercadoPagoPublicKey.</div>;
  }
  if (!successUrl || !pendingUrl || !failureUrl) {
    console.error("PaymentFlow Error: 'successUrl', 'pendingUrl', and 'failureUrl' props are required.");
    return <div className={styles['mp-error-container']}>Error de configuración: Faltan URLs de redirección.</div>;
  }
  if (!PaymentProviderComponent) {
    console.error("PaymentFlow Error: 'PaymentProviderComponent' prop is required.");
    return <div className={styles['mp-error-container']}>Error de configuración: Falta PaymentProviderComponent.</div>;
  }

  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const fullProductsUrl = `${apiBaseUrl.replace(/\/$/, '')}${productsEndpoint}`;
        const response = await fetch(fullProductsUrl);
        if (!response.ok) {
          throw new Error('Error al cargar productos');
        }
        const data = await response.json();
        setProducts(data);
        if (data.length > 0) {
          setSelectedProductId(data[0].id);
          setSelectedProduct(data[0]);
        }
      } catch (e) {
        setError(e.message);
        if (onError) onError(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [apiBaseUrl, productsEndpoint, onError]);

  const handleProductChange = (e) => {
    const newProductId = e.target.value;
    setSelectedProductId(newProductId);
    const product = products.find(p => p.id === newProductId);
    setSelectedProduct(product);
  };

  const handleQuantityChange = (e) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0 && value <= 100) {
      setQuantity(value);
    }
  };

  const handleContinueToConfirmation = () => {
    if (!selectedProduct || quantity < 1) {
      alert('Por favor selecciona un producto válido y cantidad');
      return;
    }
    setCurrentStep(2);
  };

  const handleConfirmOrder = () => {
    setConfirmedOrder({
      productId: selectedProduct.id,
      quantity: quantity,
      price: selectedProduct.price,
      totalPrice: selectedProduct.price * quantity
    });
    setCurrentStep(3);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCancel = () => {
    if (window.confirm('¿Seguro que deseas cancelar este pedido?')) {
      setCurrentStep(1);
      setSelectedProductId(products[0]?.id || null);
      setSelectedProduct(products[0] || null);
      setQuantity(1);
      setConfirmedOrder(null);
    }
  };

  const handlePaymentSuccess = (data) => {
    if (onSuccess) onSuccess(data);
  };

  const renderPaymentProvider = () => {
    if (!selectedProduct || !mercadoPagoPublicKey) return null;

    return (
      <PaymentProviderComponent
        productId={selectedProduct.id}
        quantity={quantity}
        publicKey={mercadoPagoPublicKey}
        apiBaseUrl={apiBaseUrl}
        successUrl={successUrl}
        pendingUrl={pendingUrl}
        failureUrl={failureUrl}
        onSuccess={handlePaymentSuccess}
        onError={onError}
        hideTitle={true}
      />
    );
  };

  if (loading) {
    return (
      <div className={cn(styles['mp-container'], className)} style={containerStyles}>
        <div className={styles['mp-loading']}>
          <div className={styles['mp-spinner']}></div>
          <p>Cargando productos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(styles['mp-container'], className)} style={containerStyles}>
        <div className={styles['mp-error-container']}>
          <h2>Error</h2>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className={styles['mp-button']}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className={cn(styles['mp-container'], className)} style={containerStyles}>
        <div className={styles['mp-empty-state']}>
          <h2>No hay productos disponibles</h2>
          <p>Vuelve a intentarlo más tarde o contacta con el administrador.</p>
        </div>
      </div>
    );
  }

  if (currentStep === 1) {
    return (
      <div className={cn(styles['mp-container'], className)} style={containerStyles}>
        {!hideTitle && <h2 className={styles['mp-page-title']}>Selecciona tu Producto</h2>}
        
        <div className={styles['mp-product-selection-container']}>
          <div className={styles['mp-form-group']}>
            <label htmlFor="mp-product-select">Producto:</label>
            <select 
              id="mp-product-select"
              value={selectedProductId || ''}
              onChange={handleProductChange}
              className={styles['mp-select-input']}
            >
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} - ${product.price.toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles['mp-form-group']}>
            <label htmlFor="mp-quantity-input">Cantidad:</label>
            <input
              id="mp-quantity-input"
              type="number"
              min="1"
              max="100"
              value={quantity}
              onChange={handleQuantityChange}
              className={styles['mp-number-input']}
            />
          </div>
          
          {selectedProduct && (
            <div className={styles['mp-product-details']}>
              <h3>{selectedProduct.name}</h3>
              <p className={styles['mp-product-description']}>{selectedProduct.description}</p>
              <div className={styles['mp-product-price']}>
                <span>Precio Total:</span>
                <span className={styles['mp-price-value']}>${(selectedProduct.price * quantity).toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className={styles['mp-button-container']}>
            <button className={cn(styles['mp-button'], styles['mp-primary'])} onClick={handleContinueToConfirmation}>
              Continuar al Pago
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  if (currentStep === 2) {
    return (
      <div className={cn(styles['mp-container'], className)} style={containerStyles}>
        {!hideTitle && <h2 className={styles['mp-page-title']}>Confirmar Pedido</h2>}
        
        <div className={styles['mp-confirmation-container']}>
          <div className={styles['mp-summary']}>
            <div className={styles['mp-summary-item']}>
              <span>Producto:</span>
              <span>{selectedProduct.name}</span>
            </div>
            <div className={styles['mp-summary-item']}>
              <span>Descripción:</span>
              <span>{selectedProduct.description}</span>
            </div>
            <div className={styles['mp-summary-item']}>
              <span>Precio Unitario:</span>
              <span>${selectedProduct.price.toFixed(2)}</span>
            </div>
            <div className={styles['mp-summary-item']}>
              <span>Cantidad:</span>
              <span>{quantity}</span>
            </div>
            <div className={cn(styles['mp-summary-item'], styles['mp-total'])}>
              <span>Total a Pagar:</span>
              <span>${(selectedProduct.price * quantity).toFixed(2)}</span>
            </div>
          </div>

          <div className={styles['mp-confirmation-actions']}>
            <p className={styles['mp-confirmation-note']}>
              Al confirmar esta orden, procederás al proceso de pago.
              Los datos mostrados quedarán bloqueados.
            </p>
            
            <div className={styles['mp-button-container']}>
              <button className={cn(styles['mp-button'], styles['mp-secondary'])} onClick={handleBack}>
                Volver
              </button>
              <button className={cn(styles['mp-button'], styles['mp-primary'])} onClick={handleConfirmOrder}>
                Confirmar y Proceder al Pago
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (currentStep === 3 && confirmedOrder) {
    return (
      <div className={cn(styles['mp-container'], className)} style={containerStyles}>
        {!hideTitle && <h2 className={styles['mp-page-title']}>Proceso de Pago</h2>}
        
        <div className={styles['mp-payment-container']}>
          <div className={styles['mp-order-preview']}>
            <h3>Resumen del Pedido (Confirmado)</h3>
            <div className={styles['mp-summary-item']}>
              <span>Total a pagar:</span>
              <span className={styles['mp-locked-value']}>${confirmedOrder.totalPrice.toFixed(2)}</span>
            </div>
          </div>
          
          <div className={styles['mp-payment-wrapper']}>
            {renderPaymentProvider()}
          </div>
          
          <div className={styles['mp-payment-actions']}>
            <button className={cn(styles['mp-button'], styles['mp-secondary'])} onClick={handleCancel}>
              Cancelar Pedido
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}