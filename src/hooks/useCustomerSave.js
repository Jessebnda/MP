import { useState } from 'react';
import { logInfo, logError } from '../utils/logger';

// Reemplazar la implementación de saveCustomer con una versión que no haga inserciones

export function useCustomerSave() {
  const [saving, setSaving] = useState(false);

  const saveCustomer = async (customerData, orderData = null) => {
    if (saving) return { success: true, message: "Ya se está procesando" };
    setSaving(true);
    
    try {
      // No realizamos inserciones en la base de datos
      // Solo registramos la intención para fines de logging
      logInfo('Datos del cliente preparados para guardarse cuando se confirme el pago', { 
        customerEmail: customerData.email,
        hasOrderData: !!orderData
      });
      
      // Simulamos un pequeño retraso para mantener UX consistente
      await new Promise(resolve => setTimeout(resolve, 300));
      
      return { 
        success: true, 
        customerId: `temp_${Date.now()}`,
        message: "Datos preparados para guardarse después de la confirmación del pago"
      };
    } catch (error) {
      logError('Error en useCustomerSave:', error);
      return { success: false, error: error.message };
    } finally {
      setSaving(false);
    }
  };

  return {
    saveCustomer,
    saving
  };
}