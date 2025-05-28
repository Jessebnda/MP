'use client';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './webhook-tester.module.css';

export default function WebhookTester() {
  const [amount, setAmount] = useState('10.00');
  const [loading, setLoading] = useState(false);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [preference, setPreference] = useState(null);
  const [webhookEvents, setWebhookEvents] = useState([]);
  const [error, setError] = useState('');
  const [webhookKey, setWebhookKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  
  // Get query params for payment status
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const orderId = searchParams.get('order_id');
  
  useEffect(() => {
    // Cargar los valores actuales del webhook
    const fetchWebhookConfig = async () => {
      try {
        const response = await fetch('/api/webhook-config');
        if (response.ok) {
          const data = await response.json();
          setWebhookUrl(data.webhookUrl || '');
          setWebhookKey(data.webhookKey || '');
        }
      } catch (err) {
        console.error('Error fetching webhook config:', err);
      }
    };
    
    fetchWebhookConfig();
  }, []);
  
  // Cargar eventos de webhook
  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/webhook-logs');
      if (response.ok) {
        const data = await response.json();
        setWebhookEvents(data.events || []);
      } else {
        console.error('Error fetching webhook events');
      }
    } catch (err) {
      console.error('Failed to fetch webhook events:', err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    // Fetch initially
    fetchEvents();
    
    // Set up polling
    const intervalId = setInterval(fetchEvents, 5000);
    
    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, []);
  
  // Show success/failure message after redirect
  useEffect(() => {
    if (status && orderId) {
      if (status === 'success') {
        setError('');
        setPreference(null);
      } else if (status === 'failure') {
        setError('El pago no fue exitoso. Intente nuevamente.');
        setPreference(null);
      }
      // Forzar una actualización inmediata de eventos
      fetchEvents();
    }
  }, [status, orderId]);

  const createTestPayment = async () => {
    setCreatingPayment(true);
    setError('');
    setPreference(null);
    
    try {
      const response = await fetch('/api/create-test-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount: parseFloat(amount) })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al crear pago de prueba');
      }

      setPreference(data);
      
      // Redirect to Mercado Pago checkout
      window.location.href = data.init_point;
      
    } catch (err) {
      setError(err.message);
      console.error('Error creating test payment:', err);
    } finally {
      setCreatingPayment(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1>MercadoPago Webhook Tester</h1>
      
      {status && orderId && (
        <div className={status === 'success' ? styles.success : styles.warning}>
          <h3>Pago {status === 'success' ? 'Exitoso' : status === 'pending' ? 'Pendiente' : 'Fallido'}</h3>
          <p>Order ID: {orderId}</p>
          <p>Verifique abajo los eventos de webhook relacionados con este pago</p>
          <button className={styles.refreshButton} onClick={fetchEvents}>
            Refrescar Eventos
          </button>
        </div>
      )}
      
      <div className={styles.formSection}>
        <h2>Crear Pago de Prueba</h2>
        <div className={styles.formGroup}>
          <label>Monto ($):</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
            step="0.01"
          />
        </div>
        
        <button 
          className={styles.button}
          onClick={createTestPayment} 
          disabled={creatingPayment}
        >
          {creatingPayment ? 'Creando...' : 'Crear Pago de Prueba'}
        </button>
        
        {error && <div className={styles.error}>{error}</div>}
      </div>
      
      <div className={styles.webhookSection}>
        <h2>Configuración Actual de Webhook</h2>
        <div className={styles.configItem}>
          <strong>URL:</strong> 
          <code>{webhookUrl || 'No configurado'}</code>
        </div>
        <div className={styles.configItem}>
          <strong>Webhook Key:</strong> 
          <code>{webhookKey ? `${webhookKey.substring(0, 8)}...${webhookKey.substring(webhookKey.length-8)}` : 'No configurado'}</code>
        </div>
      </div>
      
      <div className={styles.webhookSection}>
        <h2>Eventos de Webhook</h2>
        <p>Se actualiza automáticamente cada 5 segundos</p>
        <button className={styles.refreshButton} onClick={fetchEvents}>
          Refrescar Ahora
        </button>
        
        {loading ? (
          <div className={styles.loading}>Cargando eventos...</div>
        ) : webhookEvents.length > 0 ? (
          <div className={styles.events}>
            {webhookEvents.map((event, index) => (
              <div key={index} className={styles.event}>
                <h4>Evento {new Date(event.timestamp).toLocaleString()}</h4>
                <div className={styles.eventType}>Tipo: {event.type}</div>
                <div className={styles.eventId}>ID: {event.data?.id || 'N/A'}</div>
                <div className={styles.eventStatus}>
                  Estado: <span className={event.is_valid ? styles.valid : styles.invalid}>
                    {event.is_valid ? 'Firma Válida ✓' : 'Firma Inválida ✗'}
                  </span>
                </div>
                <details>
                  <summary>Detalles</summary>
                  <pre>{JSON.stringify(event.raw_notification || event, null, 2)}</pre>
                </details>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.noEvents}>No hay eventos de webhook recibidos</div>
        )}
      </div>
      
      <div className={styles.webhookDocs}>
        <h2>Diagnóstico de WebHook</h2>
        <p>Para que el webhook funcione correctamente:</p>
        <ul>
          <li>URL debe ser accesible desde Internet (no puede ser localhost)</li>
          <li>La firma se valida con MERCADOPAGO_WEBHOOK_KEY</li>
          <li>La configuración debe coincidir exactamente con el panel de MercadoPago</li>
        </ul>
      </div>
    </div>
  );
}