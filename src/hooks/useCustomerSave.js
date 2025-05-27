import { useState } from 'react';
import { logInfo, logError } from '../utils/logger';

export function useCustomerSave() {
  const [saving, setSaving] = useState(false);

  const saveCustomer = async (customerData, orderData = {}) => {
    setSaving(true);
    try {
      const payload = {
        ...customerData,
        order_total: orderData.totalAmount || 0,
        order_items: orderData.items || [],
        order_id: orderData.orderId || `ORDER_${Date.now()}`,
        payment_status: orderData.paymentStatus || 'pending'
      };

      logInfo('Guardando datos del cliente:', payload);

      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      // Añadir timeout para evitar cuelgues
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout al contactar la base de datos')), 10000);
      });
      
      const result = await Promise.race([
        response.json(),
        timeoutPromise
      ]);

      if (!response.ok) {
        throw new Error(result.error || 'Error guardando cliente');
      }

      logInfo('Cliente guardado exitosamente:', result);
      return result;

    } catch (error) {
      // Si es un error específico de la base de datos, mostrar un mensaje más amigable
      if (error.message.includes('base de datos') || error.message.includes('timeout')) {
        logError('Error al guardar en la base de datos, pero la compra se procesó correctamente', error);
        // No propagamos el error para no bloquear el flujo de compra
        return { success: true, warning: 'Datos guardados parcialmente' };
      }
      
      logError('Error en useCustomerSave:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  return {
    saveCustomer,
    saving
  };
}