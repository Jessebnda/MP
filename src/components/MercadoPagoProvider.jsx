'use client';

import { useState, useEffect, useCallback } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { products } from '../data/products'; // Import local products as fallback

// Función para sanitizar datos de entrada
function sanitizeInput(value, type) {
  switch(type) {
    case 'productId':
      // Solo permitir letras, números y guiones
      return typeof value === 'string' ? value.replace(/[^a-zA-Z0-9-]/g, '') : 'default-product-id';
    case 'quantity':
      // Convertir a entero y validar rango
      const qty = parseInt(value);
      return !isNaN(qty) && qty > 0 && qty <= 100 ? qty : 1;
    default:
      return value;
  }
}

export default function MercadoPagoProvider({
  productId,
  quantity = 1,
  publicKey,
  apiBaseUrl,
  successUrl,
  pendingUrl,
  failureUrl,
  onSuccess = () => {},
  onError = () => {}
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);
  const [productData, setProductData] = useState(null);

  // Sanear inputs del componente
  const sanitizedProductId = sanitizeInput(productId, 'productId');
  const sanitizedQuantity = sanitizeInput(quantity, 'quantity');

  // Inicializar SDK de MercadoPago
  useEffect(() => {
    if (publicKey) {
      initMercadoPago(publicKey);
    } else {
      console.error('MercadoPagoProvider requires a publicKey prop.');
      setError('Error de configuración: Falta la clave pública.');
      setLoading(false);
    }
  }, [publicKey]);

  // Obtener datos del producto - con fallback a productos locales
  useEffect(() => {
    async function fetchProduct() {
      if (!sanitizedProductId) {
        setError('Falta el ID del producto');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // IMPROVED: First check if we have the product locally (as fallback)
        let productInfo = null;
        
        // If the product ID matches a local product ID, use that
        if (products && products[sanitizedProductId]) {
          console.log('Using local product data');
          productInfo = products[sanitizedProductId];
          setProductData(productInfo);
          setLoading(false);
          return;
        }
        
        // Try fetching from endpoint if apiBaseUrl is provided
        if (apiBaseUrl) {
          // First try with products endpoint (list endpoint)
          const productsUrl = `${apiBaseUrl.replace(/\/$/, '')}/api/products`;
          console.log('Fetching products from:', productsUrl);
          
          const response = await fetch(productsUrl);
          
          if (response.ok) {
            const allProducts = await response.json();
            // Find the product in the list
            productInfo = Array.isArray(allProducts) ? 
              allProducts.find(p => p.id === sanitizedProductId) : null;
            
            if (productInfo) {
              console.log('Product found in list:', productInfo);
              setProductData(productInfo);
              setLoading(false);
              return;
            }
          }
          
          // If not found, try with specific product endpoint
          if (!productInfo) {
            const productUrl = `${apiBaseUrl.replace(/\/$/, '')}/api/products/${sanitizedProductId}`;
            console.log('Fetching specific product from:', productUrl);
            
            const productResponse = await fetch(productUrl);
            if (productResponse.ok) {
              productInfo = await productResponse.json();
              console.log('Product fetched successfully:', productInfo);
              setProductData(productInfo);
              setLoading(false);
              return;
            }
          }
        }
        
        // Fallback to hardcoded product if not found anywhere
        if (!productInfo) {
          console.log('Using hardcoded product data as fallback');
          // Default hardcoded fallback for testing
          productInfo = {
            id: sanitizedProductId,
            name: 'Producto (Fallback)',
            description: 'Este es un producto de respaldo cuando no se puede cargar el original',
            price: 100.00
          };
          setProductData(productInfo);
        }
        
      } catch (err) {
        console.error('Error obteniendo producto:', err);
        setError(`Error: ${err.message}`);
        setAttemptCount(prev => prev + 1);
        if (onError) onError(err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchProduct();
  }, [apiBaseUrl, sanitizedProductId, sanitizedQuantity, onError]);

  // Manejar el envío del formulario de pago
  const handleSubmit = async (formData) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setStatusMsg('Procesando pago...');
    setErrorMsg('');
    
    let redirectUrl = failureUrl;
    
    try {
      // Validar que tenemos los datos necesarios
      if (!productData || !sanitizedProductId) {
        throw new Error('Datos del producto no disponibles');
      }
      
      // Prepare the API endpoint - fallback to window.location if apiBaseUrl is not provided
      const baseUrl = apiBaseUrl || window.location.origin;
      const paymentEndpoint = `${baseUrl.replace(/\/$/, '')}/api/process-payment`;
      
      console.log('Sending payment data to:', paymentEndpoint);
      const response = await fetch(paymentEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          productId: sanitizedProductId,
          quantity: sanitizedQuantity,
          transaction_amount: productData.price * sanitizedQuantity,
          description: `Compra de ${productData.name}`
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setStatusMsg('¡Pago procesado!');
        
        // Llamar al callback de éxito con los datos del pago
        if (onSuccess) onSuccess(data);
        
        // Determinar URL de redirección según estado
        switch (data.status) {
          case 'approved':
            redirectUrl = successUrl;
            break;
          case 'in_process':
          case 'pending':
            redirectUrl = pendingUrl;
            break;
          case 'rejected':
          case 'cancelled':
          default:
            redirectUrl = failureUrl;
            break;
        }
        
      } else {
        // Mostrar error genérico
        setErrorMsg(`Hubo un problema al procesar tu pago. Inténtalo de nuevo.`);
        redirectUrl = failureUrl;
        
        // Solo para desarrollo: mostrar detalle del error
        if (process.env.NODE_ENV === 'development') {
          try {
            const errorData = await response.json();
            console.error('Error en proceso de pago:', errorData);
          } catch (e) {}
        }
      }
    } catch (e) {
      console.error('Error en handleSubmit:', e);
      setErrorMsg(`No se pudo completar el pago. Inténtalo nuevamente.`);
      if (onError) onError(e);
    } finally {
      setIsSubmitting(false);
      // Redireccionar después de un breve retraso
      if (redirectUrl) {
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 500);
      }
    }
  };

  // Manejar errores del Payment Brick
  const handleError = (err) => {
    console.error("Error en Payment Brick:", err);
    setErrorMsg(`Error: No se pudo procesar el formulario de pago`);
    setIsSubmitting(false);
    
    // Solo mostrar detalles en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.error('Detalles del error:', err);
    }
    
    if (onError) onError(err);
  };

  const handleReady = () => {
    setStatusMsg('Formulario listo.');
  };

  // Estados de interfaz
  if (loading) {
    return (
      <div className="mp-loading">
        <div className="mp-spinner"></div>
        <p>Preparando formulario de pago...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mp-error">
        <p>Error: {error}</p>
        <button 
          className="mp-button mp-secondary" 
          onClick={() => window.location.reload()}
          disabled={attemptCount >= 5}
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Mostrar error si no tenemos datos del producto
  if (!productData) {
    return (
      <div className="mp-error">
        <p>No se pudieron cargar los datos del producto</p>
        <button 
          className="mp-button mp-secondary" 
          onClick={() => window.location.reload()}
        >
          Reintentar
        </button>
      </div>
    );
  }

  const price = productData.price || 0;
  const totalAmount = price * sanitizedQuantity;

  // Configuración para Payment Brick para procesar pagos con tarjeta directamente
  const initialization = {
    amount: totalAmount,
  };
  
  const customization = {
    paymentMethods: {
      creditCard: 'all',
      debitCard: 'all',
      // Comentamos ticket para evitar redirecciones
      // ticket: 'all',
    },
    visual: {
      hideFormTitle: false,
      hidePaymentButton: false,
    },
  };

  // Renderizar Payment Brick para procesar tarjetas
  return (
    <div className="mp-payment-form-container">
      {statusMsg && <p className="mp-status-message">{statusMsg}</p>}
      {errorMsg && <p className="mp-error-message">{errorMsg}</p>}
      
      <Payment
        initialization={initialization}
        customization={customization}
        onSubmit={handleSubmit}
        onReady={handleReady}
        onError={handleError}
      />
    </div>
  );
}