/**
 * Extrae información del instrumento de pago desde formData
 * @param {Object} formData - Datos del formulario de pago
 * @returns {Object} - Datos extraídos del instrumento de pago
 */
export const extractPaymentInstrumentData = (formData) => {
  if (!formData) {
    return { error: 'Formulario de pago vacío' };
  }

  const token = formData.token;
  const paymentMethodId = formData.payment_method_id;
  const issuerId = formData.issuer_id || '';
  const installments = formData.installments || 1;
  const payerEmail = formData.payer?.email || '';

  if (!token) {
    return { error: 'Token de tarjeta no proporcionado' };
  }

  if (!paymentMethodId) {
    return { error: 'Método de pago no proporcionado' };
  }

  return {
    token,
    paymentMethodId,
    issuerId,
    installments,
    payerEmail
  };
};

/**
 * Valida el cuerpo de la solicitud para procesar un pago
 * @param {Object} body - Datos de la solicitud de procesamiento de pago
 * @returns {Object} - Resultado de la validación {data, error}
 */
export const validatePaymentRequestBody = (body) => {
  if (!body) {
    return { error: 'El cuerpo de la solicitud es requerido' };
  }
  
  // Validaciones básicas
  const { paymentType, formData, orderSummary, totalAmount } = body;
  
  if (!paymentType) {
    return { error: 'El tipo de pago es requerido' };
  }
  
  if (!formData) {
    return { error: 'Los datos del formulario son requeridos' };
  }
  
  if ((!orderSummary || !Array.isArray(orderSummary) || orderSummary.length === 0) && 
      !body.productId) {
    return { error: 'Información de productos inválida' };
  }
  
  // Si todo está correcto, devuelve los datos validados
  return { data: body };
};

/**
 * Valida que una URL sea absoluta o la convierte
 * @param {string} url - URL a validar
 * @param {string} fallback - URL de respaldo
 * @returns {string} - URL absoluta
 */
export const ensureAbsoluteUrl = (url, fallback, baseUrl = process.env.NEXT_PUBLIC_HOST_URL) => {
  if (!url) return fallback;
  
  // Si ya es una URL absoluta, úsala directamente
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Si no, conviértela en absoluta
  return `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
};