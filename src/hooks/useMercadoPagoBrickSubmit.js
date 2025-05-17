import { useState } from 'react';
import { logInfo, logError, logWarning } from '../utils/logger'; // Assuming logger utility
import { sanitizeInput } from '../utils/sanitize'; // Assuming sanitize utility

// Helper to get CSRF token (can be moved to a shared utility)
async function getCsrfToken() {
  try {
    const response = await fetch('/api/csrf-token'); // Adjust if your endpoint is different
    if (!response.ok) {
      throw new Error('Failed to fetch CSRF token');
    }
    const data = await response.json();
    return data.csrfToken;
  } catch (error) {
    logError("Error fetching CSRF token:", error);
    throw error;
  }
}

export function useMercadoPagoBrickSubmit({
  apiBaseUrl,
  orderSummary, // For multiple items
  productId,    // For single item
  quantity,     // For single item
  totalAmount,  // Can be pre-calculated or derived
  userData,
  onSuccess,    // Callback from parent
  onError,      // Callback from parent
  successUrl,   // Redirect URL
  pendingUrl,   // Redirect URL
  failureUrl,   // Redirect URL
  hostUrl,
  sessionId, // Nuevo parámetro
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  const handleSubmit = async (formDataFromBrick) => {
    if (isProcessing) return;

    setIsProcessing(true);
    setProcessingError(null);
    setStatusMsg('Procesando pago...');

    try {
      const csrfToken = await getCsrfToken();

      const tokenFromForm = formDataFromBrick.token || formDataFromBrick.formData?.token;
      const paymentMethodFromForm = formDataFromBrick.payment_method_id || formDataFromBrick.formData?.payment_method_id;

      if (!tokenFromForm || !paymentMethodFromForm) {
        logError("Campos críticos faltantes en formDataFromBrick:", {
          hasToken: !!tokenFromForm,
          hasPaymentMethodId: !!paymentMethodFromForm,
        });
        throw new Error("Datos de pago incompletos desde el Brick. Por favor intente nuevamente.");
      }
      
      const finalAmount = totalAmount || 
        (orderSummary 
          ? orderSummary.reduce((total, item) => total + (item.price * item.quantity), 0)
          : 0); // Fallback, ensure totalAmount is correctly passed or calculated

      const backendPayload = {
        paymentType: formDataFromBrick.paymentType || "credit_card",
        selectedPaymentMethod: formDataFromBrick.selectedPaymentMethod || "credit_card",
        formData: { // This structure should match what your backend /api/process-payment expects
          token: tokenFromForm,
          payment_method_id: paymentMethodFromForm,
          issuer_id: formDataFromBrick.issuer_id || formDataFromBrick.formData?.issuer_id || '',
          installments: parseInt(formDataFromBrick.installments || formDataFromBrick.formData?.installments || 1),
          payer: userData ? { email: userData.email, ...userData.identification } : { email: formDataFromBrick.payer?.email || 'cliente@example.com' }
        },
        ...(orderSummary && orderSummary.length > 0
          ? { orderSummary: orderSummary, isMultipleOrder: true }
          : { productId: sanitizeInput(productId, 'productId'), quantity: sanitizeInput(quantity, 'quantity'), isMultipleOrder: false }),
        totalAmount: finalAmount,
        userData: userData, // Send full user data if available
      };

      logInfo("Payload enviado a /api/process-payment:", backendPayload);

      const processApiUrl = apiBaseUrl.includes('localhost')
        ? apiBaseUrl.replace(/\/$/, '').replace('https://', 'http://')
        : apiBaseUrl.replace(/\/$/, '');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(`${processApiUrl}/api/process-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(backendPayload),
        signal: controller.signal,
        credentials: 'include'
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      logInfo("Respuesta de /api/process-payment:", data);

      // Handle different payment statuses
      if (data.status === 'approved') {
        setProcessingError(null);
        setStatusMsg(`¡Pago procesado correctamente! ID: ${data.id}`);
        if (onSuccess) onSuccess(data);
        
        // Notifica al contenedor del iframe antes de redirigir
        try {
          if (window.parent !== window) {
            logInfo("Notificando al contenedor sobre redirección exitosa");
            window.parent.postMessage({
              type: 'MP_PAYMENT_SUCCESS',
              redirectUrl: successUrl,
              paymentData: data,
              sessionId: sessionId // Incluir el sessionId
            }, '*');
            
            // Delay para asegurar que el mensaje llegue al contenedor
            setTimeout(() => {
              if (successUrl) window.top.location.href = successUrl;
            }, 500);
          } else if (successUrl) {
            window.location.href = successUrl;
          }
        } catch (e) {
          logError("Error al comunicarse con el contenedor:", e);
          // Fallback a la redirección directa
          if (successUrl) window.location.href = successUrl;
        }
      } 
      else if (data.status === 'in_process' || data.status === 'pending') {
        setStatusMsg(`Pago en proceso. ID: ${data.id}`);
        if (onSuccess) onSuccess(data);
        
        try {
          if (window.parent !== window) {
            logInfo("Notificando al contenedor de Framer sobre redirección a pendiente");
            window.parent.postMessage({
              type: 'MP_PAYMENT_PENDING',
              redirectUrl: pendingUrl,
              paymentData: data,
              sessionId: sessionId // Incluir el sessionId
            }, '*');
            
            setTimeout(() => {
              if (pendingUrl) window.top.location.href = pendingUrl;
            }, 500);
          } else if (pendingUrl) {
            window.location.href = pendingUrl;
          }
        } catch (e) {
          logWarning("Error al comunicarse con el contenedor:", e);
          if (pendingUrl) window.location.href = pendingUrl;
        }
      } 
      else if (data.status === 'rejected') {
        // Rejected case - payment was rejected
        setProcessingError(data.message || 'El pago fue rechazado');
        if (onError) onError(new Error(data.message || 'El pago fue rechazado'));
        if (failureUrl) window.location.href = failureUrl;
      } 
      else if (data.error) {
        // Error case
        throw new Error(data.error);
      }

    } catch (error) {
      logError("Error procesando el pago en hook:", error);
      const errMsg = `Error: ${error.name === 'AbortError' ? 'Tiempo de espera excedido' : error.message || 'Error desconocido al procesar pago'}`;
      setProcessingError(errMsg);
      setStatusMsg('');
      if (onError) onError(error);
      
      // Optional: redirect to failure on critical error after a delay
      // setTimeout(() => { window.location.href = failureUrl || `${hostUrl}/error-de-compra`; }, 1500);
    } finally {
      setIsProcessing(false);
    }
  };

  return { handleSubmit, isProcessing, processingError, statusMsg };
}