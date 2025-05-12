import { z } from 'zod';
import { logSecurityEvent } from './security-logger';

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