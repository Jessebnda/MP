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
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
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
          setSelectedProducts([
            {
              productId: data[0].id,
              product: data[0],
              quantity: 1
            }
          ]);
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

  const handleAddProduct = () => {
    if (products.length > 0) {
      setSelectedProducts([
        ...selectedProducts,
        {
          productId: products[0].id,
          product: products[0],
          quantity: 1
        }
      ]);
    }
  };

  const handleRemoveProduct = (index) => {
    const newProducts = [...selectedProducts];
    newProducts.splice(index, 1);
    setSelectedProducts(newProducts);
  };

  const handleProductChange = (e, index) => {
    const productId = e.target.value;
    const product = products.find(p => p.id === productId);
    
    const updatedProducts = [...selectedProducts];
    updatedProducts[index] = {
      ...updatedProducts[index],
      productId: productId,
      product: product
    };
    
    setSelectedProducts(updatedProducts);
  };

  const handleQuantityChange = (e, index) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0 && value <= 100) {
      const updatedProducts = [...selectedProducts];
      updatedProducts[index] = {
        ...updatedProducts[index],
        quantity: value
      };
      setSelectedProducts(updatedProducts);
    }
  };

  const calculateTotalPrice = () => {
    return selectedProducts.reduce((total, item) => {
      return total + (item.product?.price || 0) * item.quantity;
    }, 0);
  };

  const handleContinueToConfirmation = () => {
    if (selectedProducts.length === 0 || selectedProducts.some(product => product.quantity < 1)) {
      alert('Por favor selecciona productos válidos y cantidades');
      return;
    }
    setCurrentStep(2);
  };

  const handleConfirmOrder = () => {
    const totalPrice = calculateTotalPrice();
    
    console.log('====== ORDEN CONFIRMADA ======');
    console.log('Productos confirmados:');
    selectedProducts.forEach((prod, i) => {
      console.log(`${i+1}. ${prod.product.name} (ID: ${prod.productId})`);
      console.log(`   Cantidad: ${prod.quantity}`);
      console.log(`   Precio unitario: $${prod.product.price.toFixed(2)}`);
      console.log(`   Subtotal: $${(prod.product.price * prod.quantity).toFixed(2)}`);
    });
    console.log('TOTAL A PAGAR: $' + totalPrice.toFixed(2));
    console.log('============================');
    
    setConfirmedOrder({
      products: selectedProducts,
      totalPrice: totalPrice
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
      setSelectedProducts(products[0] ? [{ ...products[0], quantity: 1 }] : []);
      setConfirmedOrder(null);
    }
  };

  const handlePaymentSuccess = (data) => {
    console.log('====== PAGO EXITOSO ======');
    console.log('Detalles de la transacción:', data);
    console.log('Monto total:', calculateTotalPrice().toFixed(2));
    console.log('Productos:', selectedProducts.map(p => ({
      id: p.productId,
      nombre: p.product.name,
      cantidad: p.quantity,
      precio: p.product.price,
      subtotal: p.product.price * p.quantity
    })));
    console.log('========================');
    
    if (onSuccess) onSuccess(data);
  };

  const handlePaymentError = (error) => {
    console.error('====== ERROR EN PAGO ======');
    console.error('Detalle del error:', error);
    console.error('Productos intentados:', selectedProducts.map(p => p.product.name).join(', '));
    console.error('Monto total intentado:', calculateTotalPrice().toFixed(2));
    console.error('===========================');
    
    if (onError) onError(error);
  };

  const renderPaymentProvider = () => {
    if (selectedProducts.length === 0 || !mercadoPagoPublicKey) return null;

    // Si hay múltiples productos, envía solo el ID del primer producto
    // pero con el precio total consolidado
    const firstProduct = selectedProducts[0];
    const totalAmount = calculateTotalPrice();
    
    // Log del resumen antes de enviar a MercadoPago
    console.log('====== RESUMEN DE PAGO ======');
    console.log('Monto total a procesar:', totalAmount.toFixed(2));
    console.log('Productos en el carrito:');
    selectedProducts.forEach((prod, i) => {
      console.log(`${i+1}. ${prod.product.name} x ${prod.quantity} = $${(prod.product.price * prod.quantity).toFixed(2)}`);
    });
    console.log('============================');
    
    return (
      <PaymentProviderComponent
        productId={firstProduct.productId}
        quantity={1} // Cantidad siempre 1 cuando consolidamos
        totalAmount={totalAmount} // Pasar el precio total como prop adicional
        publicKey={mercadoPagoPublicKey}
        apiBaseUrl={apiBaseUrl}
        successUrl={successUrl}
        pendingUrl={pendingUrl}
        failureUrl={failureUrl}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
        hideTitle={true}
        // Incluir productId en el orderSummary
        orderSummary={selectedProducts.map(product => ({
          productId: product.productId,
          name: product.product.name,
          quantity: product.quantity,
          price: product.product.price,
          total: product.product.price * product.quantity
        }))}
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
        {!hideTitle && <h2 className={styles['mp-page-title']}>Selecciona tus Productos</h2>}
        
        <div className={styles['mp-product-selection-container']}>
          {selectedProducts.map((selectedProduct, index) => (
            <div key={index} className={styles['mp-product-item']}>
              <div className={styles['mp-form-group']}>
                <label htmlFor={`mp-product-select-${index}`}>Producto:</label>
                <select 
                  id={`mp-product-select-${index}`}
                  value={selectedProduct.productId || ''}
                  onChange={(e) => handleProductChange(e, index)}
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
                <label htmlFor={`mp-quantity-input-${index}`}>Cantidad:</label>
                <input
                  id={`mp-quantity-input-${index}`}
                  type="number"
                  min="1"
                  max="100"
                  value={selectedProduct.quantity || 1}
                  onChange={(e) => handleQuantityChange(e, index)}
                  className={styles['mp-number-input']}
                />
              </div>
              
              {selectedProduct.product && (
                <div className={styles['mp-product-details']}>
                  <h3>{selectedProduct.product.name}</h3>
                  <p className={styles['mp-product-description']}>{selectedProduct.product.description}</p>
                  <div className={styles['mp-product-price']}>
                    <span>Precio Total:</span>
                    <span className={styles['mp-price-value']}>${(selectedProduct.product.price * selectedProduct.quantity).toFixed(2)}</span>
                  </div>
                </div>
              )}

              <button
                className={cn(styles['mp-button'], styles['mp-secondary'])}
                onClick={() => handleRemoveProduct(index)}
              >
                Eliminar Producto
              </button>
            </div>
          ))}

          <button
            className={cn(styles['mp-button'], styles['mp-primary'])}
            onClick={handleAddProduct}
          >
            Agregar Producto
          </button>

          <div className={styles['mp-total-price']}>
            <span>Total:</span>
            <span>${calculateTotalPrice().toFixed(2)}</span>
          </div>

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
            {selectedProducts.map((product, index) => (
              <div key={index} className={styles['mp-summary-item']}>
                <span>Producto:</span>
                <span>{product.product.name}</span>
                
                <span>Descripción:</span>
                <span>{product.product.description}</span>
                
                <span>Precio Unitario:</span>
                <span>${product.product.price.toFixed(2)}</span>
                
                <span>Cantidad:</span>
                <span>{product.quantity}</span>
                
                <span>Total:</span>
                <span>${(product.product.price * product.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className={cn(styles['mp-summary-item'], styles['mp-total'])}>
              <span>Total a Pagar:</span>
              <span>${calculateTotalPrice().toFixed(2)}</span>
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
            {confirmedOrder.products.map((order, index) => (
              <div key={index} className={styles['mp-summary-item']}>
                <span>Producto:</span>
                <span>{order.productId}</span>
                <span>Cantidad:</span>
                <span>{order.quantity}</span>
                <span>Total:</span>
                <span>${(order.product.price * order.quantity).toFixed(2)}</span>
              </div>
            ))}
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