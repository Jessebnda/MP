import { z } from 'zod';
import { logSecurityEvent } from './security-logger';
import { logInfo, logError } from '../utils/logger';
import { sanitizeInput } from '../utils/security';

// Esquema para datos de pago
export const PaymentSchema = z.object({
  paymentType: z.string().min(1).default('credit_card'),
  selectedPaymentMethod: z.string().min(1).default('credit_card'),
  formData: z.object({
    token: z.string().min(8),
    payment_method_id: z.string().min(1),
    issuer_id: z.string().optional().default(''),
    installments: z.number().int().positive().default(1),
    payer: z.object({
      email: z.string().email().default('cliente@example.com')
    })
  }),
  productId: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  isMultipleOrder: z.boolean().default(false),
  orderSummary: z.array(
    z.object({
      productId: z.string().min(1),
      name: z.string().min(1),
      quantity: z.number().int().positive(),
      price: z.number().positive(),
      total: z.number().positive()
    })
  ).optional(),
  totalAmount: z.number().positive()
});

// Validador que registra errores
export function validatePaymentData(data) {
  try {
    const result = PaymentSchema.safeParse(data);
    
    if (!result.success) {
      // Registrar los errores de validación
      logSecurityEvent('payment_validation_error', {
        errors: result.error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
      }, 'warn');
      
      return {
        valid: false,
        errors: result.error.errors,
        data: null
      };
    }
    
    return {
      valid: true,
      errors: null,
      data: result.data
    };
  } catch (error) {
    logSecurityEvent('validation_system_error', {
      message: error.message
    }, 'error');
    
    return {
      valid: false,
      errors: [{ message: 'Error interno de validación' }],
      data: null
    };
  }
}

/**
 * Valida el cuerpo de la solicitud de procesamiento de pago
 * @param {Object} body - Datos de la solicitud de procesamiento de pago
 * @returns {Object} - Resultado de la validación {data, error}
 */
export function validatePaymentRequestBody(body) {
  if (!body) {
    return { error: 'El cuerpo de la solicitud es requerido' };
  }
  
  try {
    // Sanitizar la entrada para evitar inyecciones
    const sanitizedBody = sanitizeInput(body);
    
    // Validaciones básicas
    const { paymentType, formData, orderSummary, totalAmount, userData } = sanitizedBody;
    
    if (!paymentType) {
      return { error: 'El tipo de pago es requerido' };
    }
    
    if (!formData) {
      return { error: 'Los datos del formulario son requeridos' };
    }
    
    // Validación para pedidos múltiples o simple
    if ((!orderSummary || !Array.isArray(orderSummary) || orderSummary.length === 0) && 
        !sanitizedBody.productId) {
      return { error: 'Información de productos inválida' };
    }
    
    // Validar userData para envío de emails
    if (!userData || !userData.email) {
      return { error: 'Datos del usuario incompletos. Se requiere al menos un email.' };
    }
    
    // Validar que el totalAmount sea un número
    if (totalAmount && isNaN(parseFloat(totalAmount))) {
      return { error: 'El monto total debe ser un número válido' };
    }
    
    // Si todo está correcto, devuelve los datos validados
    return { data: sanitizedBody };
  } catch (error) {
    logError('Error en validatePaymentRequestBody:', error);
    return { error: 'Error al validar los datos de la solicitud' };
  }
}

/**
 * Extrae los datos del instrumento de pago del objeto formData
 * @param {Object} formData - Datos del formulario de pago
 * @returns {Object} - Datos del instrumento de pago extraídos
 */
export function extractPaymentInstrumentData(formData) {
  if (!formData) {
    return { error: 'Datos del formulario no proporcionados' };
  }
  
  try {
    // Dependiendo de dónde vienen los datos (puede ser anidado o plano)
    const tokenSource = formData.token || formData.formData?.token || formData.cardTokenId;
    const paymentMethodIdSource = formData.payment_method_id || formData.formData?.payment_method_id || formData.paymentMethodId;
    const issuerIdSource = formData.issuer_id || formData.formData?.issuer_id || formData.issuerId;
    const installmentsSource = formData.installments || formData.formData?.installments || '1';
    const payerEmailSource = formData.payer?.email || formData.formData?.payer?.email || formData.payerEmail;
    
    // Validar campos críticos
    if (!tokenSource) {
      return { error: 'Token de tarjeta no proporcionado' };
    }
    
    if (!paymentMethodIdSource) {
      return { error: 'Método de pago no proporcionado' };
    }
    
    // Devolver los datos extraídos
    return {
      token: tokenSource,
      paymentMethodId: paymentMethodIdSource,
      issuerId: issuerIdSource || undefined,
      installments: installmentsSource || '1',
      payerEmail: payerEmailSource || '',
    };
  } catch (error) {
    logError('Error en extractPaymentInstrumentData:', error);
    return { error: 'Error al extraer datos del instrumento de pago' };
  }
}

/**
 * Valida la estructura y datos de un producto
 * @param {Object} product - Datos del producto
 * @returns {boolean} - Si el producto es válido
 */
export function validateProduct(product) {
  if (!product) return false;
  if (!product.id && !product.productId) return false;
  if (!product.quantity || isNaN(parseInt(product.quantity))) return false;
  
  return true;
}