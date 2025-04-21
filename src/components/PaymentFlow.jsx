'use client';

import { useState, useEffect } from 'react';
import '../styles/payment-component.css';
import MercadoPagoProvider from './MercadoPagoProvider'; // Importación por defecto correcta

export default function PaymentFlow({
  apiBaseUrl,
  productsEndpoint = '/api/products',
  mercadoPagoPublicKey,
  PaymentProviderComponent = MercadoPagoProvider, // Usa el componente importado como valor por defecto
  successUrl,
  pendingUrl,
  failureUrl,
  onSuccess,
  onError,
  containerStyles = {},
  hideTitle = false,
}) {
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
      if (!apiBaseUrl) { 
        console.error("PaymentFlow requires an apiBaseUrl prop.");
        setError('Error de configuración: Falta la URL base de la API.');
        setLoading(false);
        return;
      }
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
      />
    );
  };

  if (loading) {
    return (
      <div className="mp-container" style={containerStyles}>
        <div className="mp-loading-spinner">
          <div className="mp-spinner"></div>
          <p>Cargando productos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mp-container" style={containerStyles}>
        <div className="mp-error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mp-button"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="mp-container" style={containerStyles}>
        <div className="mp-empty-state">
          <h2>No hay productos disponibles</h2>
          <p>Vuelve a intentarlo más tarde o contacta con el administrador.</p>
        </div>
      </div>
    );
  }

  if (currentStep === 1) {
    return (
      <div className="mp-container" style={containerStyles}>
        {!hideTitle && <h2 className="mp-page-title">Selecciona tu Producto</h2>}
        
        <div className="mp-product-selection-container">
          <div className="mp-form-group">
            <label htmlFor="mp-product-select">Producto:</label>
            <select 
              id="mp-product-select"
              value={selectedProductId || ''}
              onChange={handleProductChange}
              className="mp-select-input"
            >
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} - ${product.price.toFixed(2)}
                </option>
              ))}
            </select>
          </div>
          
          <div className="mp-form-group">
            <label htmlFor="mp-quantity-input">Cantidad:</label>
            <input
              id="mp-quantity-input"
              type="number"
              min="1"
              max="100"
              value={quantity}
              onChange={handleQuantityChange}
              className="mp-number-input"
            />
          </div>
          
          <div className="mp-button-container">
            <button className="mp-button mp-primary" onClick={handleContinueToConfirmation}>
              Continuar al Pago
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Paso 2: Confirmación de pedido
  if (currentStep === 2) {
    return (
      <div className="mp-container" style={containerStyles}>
        {!hideTitle && <h2 className="mp-page-title">Confirmar Pedido</h2>}
        
        <div className="mp-confirmation-container">
          <div className="mp-order-summary">
            <h3>Resumen del Pedido</h3>
            <div className="mp-summary-item">
              <span>Producto:</span>
              <span>{selectedProduct.name}</span>
            </div>
            <div className="mp-summary-item">
              <span>Descripción:</span>
              <span>{selectedProduct.description}</span>
            </div>
            <div className="mp-summary-item">
              <span>Precio unitario:</span>
              <span>${selectedProduct.price.toFixed(2)}</span>
            </div>
            <div className="mp-summary-item">
              <span>Cantidad:</span>
              <span>{quantity}</span>
            </div>
            <div className="mp-summary-item mp-total">
              <span>Total a pagar:</span>
              <span>${(selectedProduct.price * quantity).toFixed(2)}</span>
            </div>
          </div>
          
          <div className="mp-confirmation-actions">
            <p className="mp-confirmation-note">
              Al confirmar esta orden, procederás al proceso de pago.
              Los datos mostrados quedarán bloqueados.
            </p>
            
            <div className="mp-button-container">
              <button className="mp-button mp-secondary" onClick={handleBack}>
                Volver
              </button>
              <button className="mp-button mp-primary" onClick={handleConfirmOrder}>
                Confirmar y Proceder al Pago
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Paso 3: Proceso de pago
  if (currentStep === 3 && confirmedOrder) {
    return (
      <div className="mp-container" style={containerStyles}>
        {!hideTitle && <h2 className="mp-page-title">Proceso de Pago</h2>}
        
        <div className="mp-payment-container">
          <div className="mp-order-preview">
            <h3>Resumen del Pedido (Confirmado)</h3>
            <div className="mp-summary-item">
              <span>Total a pagar:</span>
              <span className="mp-locked-value">${confirmedOrder.totalPrice.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="mp-payment-wrapper">
            {renderPaymentProvider()}
          </div>
          
          <div className="mp-payment-actions">
            <button className="mp-button mp-secondary" onClick={handleCancel}>
              Cancelar Pedido
            </button>
          </div>
        </div>
      </div>
    );
  }
}