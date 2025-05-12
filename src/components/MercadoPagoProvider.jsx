'use client';

import { useState, useEffect, useCallback } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import styles from '../styles/MercadoPagoProvider.module.css';
import '../styles/mercadopago-globals.css'; // Changed to import the non-module CSS file
import { cn } from '../lib/utils'; // Import the utility

// Función para sanitizar datos de entrada (actualizada)
function sanitizeInput(value, type) {
  switch(type) {
    case 'productId':
      // Validación más estricta para IDs de producto
      return typeof value === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(value) 
        ? value 
        : 'default-product-id';
        
    case 'quantity':
      const qty = parseInt(value);
      // Establecer un límite razonable superior para evitar DoS
      const MAX_SAFE_QTY = 100000; 
      return !isNaN(qty) && qty > 0 && qty <= MAX_SAFE_QTY ? qty : 1;
      
    case 'url':
      // Sanitizar URLs para evitar redireccionamientos maliciosos
      if (typeof value !== 'string') return '';
      try {
        const url = new URL(value, window.location.origin);
        return url.toString();
      } catch (e) {
        console.error("URL inválida:", value);
        return '';
      }
      
    case 'email':
      // Validación básica de email
      return typeof value === 'string' && 
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)
        ? value
        : 'cliente@example.com';
        
    default:
      return value;
  }
}

export default function MercadoPagoProvider({
  productId,
  quantity = 1,
  totalAmount = null, // Nuevo parámetro 
  orderSummary = null, // Nuevo parámetro para mostrar el resumen detallado
  publicKey,
  apiBaseUrl, // Required, validated in PaymentFlow
  successUrl,
  pendingUrl,
  failureUrl,
  onSuccess = () => {},
  onError = () => {},
  className = '',
  containerStyles = {},
  hideTitle = false,
}) {
  const [loading, setLoading] = useState(true);
  const [displayError, setDisplayError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [productData, setProductData] = useState(null);
  const [isFetchingProduct, setIsFetchingProduct] = useState(false);
  const [preferenceId, setPreferenceId] = useState(null); // Agregar estado para preferenceId

  const sanitizedProductId = sanitizeInput(productId, 'productId');
  const sanitizedQuantity = sanitizeInput(quantity, 'quantity');

  useEffect(() => {
    if (publicKey) {
      initMercadoPago(publicKey);
    } else {
      const configError = 'Error de configuración: Falta la clave pública.';
      console.error('MercadoPagoProvider requires a publicKey prop.');
      setDisplayError(configError);
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    // Solo generar la preferencia cuando tengamos datos y no haya error
    if (orderSummary?.length > 0 && !displayError && !preferenceId && !isSubmitting) {
      createPreference();
    }
  }, [orderSummary, displayError, preferenceId, isSubmitting]);

  const fetchProduct = useCallback(async () => {
    // Si tenemos orderSummary con múltiples productos, no necesitamos hacer fetch individual
    if (orderSummary && orderSummary.length > 0) {
      console.log('Usando datos de múltiples productos desde orderSummary:', orderSummary);
      // Crear un "productData" ficticio solo para que el flujo continúe
      setProductData({ id: 'multiple-products', name: 'Múltiples productos', price: 0 });
      setLoading(false);
      setAttemptCount(0);
      return;
    }

    // El resto del código para el caso de un solo producto
    if (!sanitizedProductId) {
      setDisplayError('Falta el ID del producto');
      setLoading(false);
      return;
    }

    if (!apiBaseUrl) {
      setDisplayError('Falta la URL base de la API para obtener el producto');
      setLoading(false);
      return;
    }

    setIsFetchingProduct(true);
    setDisplayError(null);
    setLoading(true);

    try {
      const productUrl = `${apiBaseUrl.replace(/\/$/, '')}/api/products/${sanitizedProductId}`;
      if (process.env.NODE_ENV === 'development') {
        console.log('Fetching specific product from:', productUrl);
      }
      const response = await fetch(productUrl);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: No se pudo obtener el producto`);
      }
      const productInfo = await response.json();
      if (process.env.NODE_ENV === 'development') {
        console.log('Product fetched successfully:', productInfo);
      }
      setProductData(productInfo);
      setAttemptCount(0);
    } catch (err) {
      console.error('Error obteniendo producto:', err);
      setDisplayError(`Error al cargar datos del producto: ${err.message}`);
      setAttemptCount(prev => prev + 1);
      if (onError) onError(err);
    } finally {
      setLoading(false);
      setIsFetchingProduct(false);
    }
  }, [apiBaseUrl, sanitizedProductId, orderSummary, onError]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  useEffect(() => {
    // Solo generar la preferencia cuando tengamos datos y no haya error
    if (productData && orderSummary?.length > 0 && !displayError && !preferenceId && !isSubmitting) {
      createPreference();
    }
  }, [productData, orderSummary, displayError, preferenceId, isSubmitting]);

  const createPreference = async () => {
    if (!orderSummary || orderSummary.length === 0) {
      setDisplayError("No hay productos para procesar");
      return;
    }
    
    setIsSubmitting(true);
    setStatusMsg('Generando formulario de pago...');
    
    try {
      // Asegurar que las URLs están completas
      const fullSuccessUrl = successUrl || `${window.location.origin}/success`;
      const fullPendingUrl = pendingUrl || `${window.location.origin}/pending`;
      const fullFailureUrl = failureUrl || `${window.location.origin}/failure`;
      
      console.log("Enviando solicitud de preferencia con URLs:", {
        successUrl: fullSuccessUrl,
        pendingUrl: fullPendingUrl,
        failureUrl: fullFailureUrl
      });
      
      const response = await fetch(`${apiBaseUrl}/api/create-preference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderSummary,
          successUrl: fullSuccessUrl,
          pendingUrl: fullPendingUrl,
          failureUrl: fullFailureUrl
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error("Error creando preferencia:", data);
        throw new Error(data.error || `Error del servidor: ${response.status}`);
      }
      
      console.log("Preferencia creada:", data);
      
      setPreferenceId(data.preferenceId);
      setIsSubmitting(false);
      setStatusMsg('');
    } catch (error) {
      console.error("Error creando preferencia:", error);
      setDisplayError(`Error: ${error.message || 'Error desconocido'}`);
      setIsSubmitting(false);
      setStatusMsg('');
      if (onError) onError(error);
    }
  };

  async function getCsrfToken() {
    try {
      const response = await fetch(`${apiBaseUrl}/api/csrf-token`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }
      
      const data = await response.json();
      return data.csrfToken;
    } catch (error) {
      console.error("Error fetching CSRF token:", error);
      throw error;
    }
  }

  const handleSubmit = async (formData) => {
    try {
      // Get CSRF token first
      const csrfToken = await getCsrfToken();

      // Verificar si tenemos datos de producto (ya sea múltiples o individual)
      if (isSubmitting || (!productData && (!orderSummary || orderSummary.length === 0))) {
        console.log("No hay datos de producto para procesar");
        return;
      }

      // Añadir logs detallados para depuración
      console.log("FormData original recibido del SDK:", JSON.stringify(formData, null, 2));
      
      // Identificar dónde están los datos críticos
      // Usando un enfoque flexible para adaptarnos a diferentes versiones del SDK
      const tokenFromForm = formData.token || formData.formData?.token;
      const paymentMethodFromForm = formData.payment_method_id || formData.formData?.payment_method_id;
      
      if (!tokenFromForm || !paymentMethodFromForm) {
        console.error("ERROR: Campos críticos faltantes en formData:", { 
          formDataRecibido: formData,
          hasToken: !!tokenFromForm, 
          hasPaymentMethodId: !!paymentMethodFromForm 
        });
        setDisplayError("Datos de pago incompletos. Por favor intente nuevamente.");
        return;
      }

      setIsSubmitting(true);
      setStatusMsg('Procesando pago...');
      setDisplayError(null);

      // Calcular monto final
      const finalAmount = orderSummary 
        ? orderSummary.reduce((total, item) => total + (item.price * item.quantity), 0)
        : (productData?.price || 0) * sanitizedQuantity;

      // Construir payload para el backend, asegurando que los campos críticos estén accesibles
      const backendPayload = {
        paymentType: formData.paymentType || "credit_card",
        selectedPaymentMethod: formData.selectedPaymentMethod || "credit_card",
        formData: {
          token: tokenFromForm,
          payment_method_id: paymentMethodFromForm,
          issuer_id: formData.issuer_id || formData.formData?.issuer_id || '',
          installments: parseInt(formData.installments || formData.formData?.installments || 1),
          payer: {
            email: formData.payer?.email || formData.formData?.payer?.email || 'cliente@example.com'
          },
         // Changed from currency_id to currency
        },
        // Omitir productId y quantity completamente si estamos usando orderSummary
        ...(orderSummary ? {} : { productId: sanitizedProductId, quantity: sanitizedQuantity }),
        isMultipleOrder: orderSummary ? true : false,
        orderSummary: orderSummary,
        totalAmount: finalAmount
      };

      // Log del payload para verificar la estructura
      console.log("Payload enviado al backend:", JSON.stringify(backendPayload, null, 2));
      
      // Implementar un timeout para evitar que se quede esperando infinitamente
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos de timeout
      
      console.log("Enviando solicitud al backend...");
      const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/process-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken, // Incluir token CSRF
        },
        body: JSON.stringify(backendPayload),
        signal: controller.signal,
        credentials: 'include' // Importante para enviar las cookies
      });
      
      clearTimeout(timeoutId); // Limpiar el timeout si la solicitud se completa
      
      console.log("Respuesta recibida del backend, status:", response.status);
      
      const data = await response.json();
      console.log("Datos recibidos del backend:", data);

      if (data.error) {
        throw new Error(`Error en el pago: ${data.error}`);
      }

      // El pago fue exitoso
      setIsSubmitting(false);
      setStatusMsg(`¡Pago procesado correctamente! ID: ${data.id}`);
      // Usar el monto formateado si está disponible
      const displayAmount = data.formattedAmount || data.amount.toLocaleString('es-MX');
      console.log(`Monto pagado: $${displayAmount}`);
      
      // Llamar al callback de éxito
      if (onSuccess) onSuccess(data);
      
      // Redirigir si es necesario
      if (successUrl) {
        window.location.href = successUrl;
      }
      
    } catch (error) {
      console.error("Error procesando el pago:", error);
      setDisplayError(`Error: ${error.name === 'AbortError' ? 'Tiempo de espera excedido' : error.message || 'Error desconocido'}`);
      setIsSubmitting(false);
      setStatusMsg('');
      if (onError) onError(error);
    }
  };

  const handleError = (err) => {
    console.error("Error en Payment Brick:", err);
    setDisplayError('Error: No se pudo inicializar el formulario de pago.');
    setIsSubmitting(false);
    if (process.env.NODE_ENV === 'development') {
      console.error('Detalles del error del Payment Brick:', err);
    }
    if (onError) onError(err);
  };

  const handleReady = () => {
    // Optional: Clear status message or set a 'ready' message
    // setStatusMsg('Formulario listo.');
  };

  useEffect(() => {
    // Pequeño retraso para asegurar que el DOM esté completamente renderizado
    const timer = setTimeout(() => {
      const container = document.getElementById('paymentBrick_container');
      if (container) {
        // Aquí podrías reiniciar la inicialización si es necesario
        console.log('Contenedor de pago encontrado y listo');
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  if (loading && !productData) {
    return (
      <div className={cn(styles.loading, className)}>
        <div className={styles.spinner}></div>
        <p>Preparando formulario de pago...</p>
      </div>
    );
  }

  if (!productData && displayError) {
    return (
      <div className={cn(styles.errorContainer, className)}>
        <p className={styles.errorMessage}>{displayError}</p>
        {attemptCount < 5 && (
          <button
            className={styles.retryButton}
            onClick={fetchProduct}
            disabled={isFetchingProduct}
          >
            {isFetchingProduct ? 'Reintentando...' : 'Reintentar'}
          </button>
        )}
        {attemptCount >= 5 && <p>Demasiados intentos fallidos.</p>}
      </div>
    );
  }

  const price = productData?.price || 0;
  const finalTotalAmount = totalAmount !== null ? 
    totalAmount : 
    price * sanitizedQuantity;

  return (
    <div className={cn(styles.paymentFormContainer, className)}>
      {statusMsg && <p className={styles.statusMessage}>{statusMsg}</p>}
      {displayError && !isFetchingProduct && <p className={styles.errorMessage}>{displayError}</p>}
      
      {preferenceId ? (
        <Payment
          key={`payment-${preferenceId}`}
          initialization={{
            amount: finalTotalAmount,
            preferenceId: preferenceId,
            mercadoPago: publicKey  // Cambiar marketplace por mercadoPago
          }}
          customization={{
            visual: { 
              hideFormTitle: false, 
              hidePaymentButton: false,
              style: {
                theme: 'default',
                customVariables: {
                  baseColor: '#F26F32',       // Color principal naranja
                  errorColor: '#e74c3c',      
                  
                  formBackgroundColor: '#FFFFFF', 
                  inputBackgroundColor: '#FFFFFF',
                  inputBorderColor: '#CCCCCC',
                  buttonTextColor: '#FFFFFF',
                  buttonBackground: '#F26F32', 
                  
                  elementsColor: '#F26F32',
                  
                  borderRadiusLarge: '4px',
                  borderRadiusMedium: '4px',
                  borderRadiusSmall: '4px'
                }
              }
            },
            paymentMethods: { 
              creditCard: 'all', 
              debitCard: 'all' 
            }
          }}
          onSubmit={handleSubmit}
          onReady={handleReady}
          onError={handleError}
        />
      ) : (
        <div className={styles.loadingPreference}>
          {isSubmitting ? (
            <>
              <div className={styles.spinner}></div>
              <p>Generando formulario de pago...</p>
            </>
          ) : (
            <p>Preparando formulario...</p>
          )}
        </div>
      )}
    </div>
  );
}