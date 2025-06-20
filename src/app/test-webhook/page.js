'use client';

import { useState } from 'react';
import styles from './test-webhook.module.css';

export default function TestWebhookPage() {
  const [paymentId, setPaymentId] = useState('');
  const [status, setStatus] = useState('approved');
  const [verifyPayment, setVerifyPayment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const validStatuses = ['approved', 'pending', 'rejected', 'cancelled', 'in_process'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/test-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId,
          status,
          verifyPayment
        })
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Error desconocido');
      }
    } catch (err) {
      setError(`Error de conexión: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>🧪 Test de Webhook de Mercado Pago</h1>
      
      <div className={styles.description}>
        <p>Esta herramienta te permite simular webhooks de Mercado Pago en <strong>producción</strong>.</p>
        <p>Útil para probar el flujo de notificaciones sin necesidad de realizar pagos reales.</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="paymentId">Payment ID:</label>
          <input
            type="text"
            id="paymentId"
            value={paymentId}
            onChange={(e) => setPaymentId(e.target.value)}
            placeholder="123456789 o abc123 (payment_request_id)"
            required
            className={styles.input}
          />
          <small className={styles.help}>
            Puede ser un ID de pago de MP (número largo) o un ID de payment_request (texto corto)
          </small>
        </div>

        <div className={styles.field}>
          <label htmlFor="status">Estado del pago:</label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={styles.select}
          >
            {validStatuses.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={verifyPayment}
              onChange={(e) => setVerifyPayment(e.target.checked)}
              className={styles.checkbox}
            />
            Verificar que el payment_request existe en BD
          </label>
          <small className={styles.help}>
            Recomendado si usas un payment_request_id corto
          </small>
        </div>

        <button 
          type="submit" 
          disabled={loading || !paymentId}
          className={styles.button}
        >
          {loading ? '🔄 Enviando...' : '🚀 Simular Webhook'}
        </button>
      </form>

      {error && (
        <div className={styles.error}>
          <h3>❌ Error</h3>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className={styles.result}>
          <h3>✅ Resultado</h3>
          <div className={styles.summary}>
            <p><strong>Mensaje:</strong> {result.message}</p>
            <p><strong>Ambiente:</strong> {result.environment}</p>
            <p><strong>Webhook URL:</strong> {result.webhook.webhookUrl}</p>
            <p><strong>Estado respuesta:</strong> {result.webhook.status} {result.webhook.statusText}</p>
          </div>

          {result.paymentVerification && (
            <div className={styles.verification}>
              <h4>🔍 Verificación de Payment Request:</h4>
              {result.paymentVerification.exists ? (
                <div className={styles.success}>
                  <p>✅ Payment request encontrado:</p>
                  <ul>
                    <li>ID: {result.paymentVerification.data.id}</li>
                    <li>Estado: {result.paymentVerification.data.status}</li>
                    <li>Monto: ${result.paymentVerification.data.amount}</li>
                  </ul>
                </div>
              ) : (
                <p className={styles.warning}>⚠️ {result.paymentVerification.error}</p>
              )}
            </div>
          )}

          <details className={styles.details}>
            <summary>📋 Detalles técnicos</summary>
            <div className={styles.technical}>
              <h4>Payload enviado:</h4>
              <pre>{JSON.stringify(result.webhook.payload, null, 2)}</pre>
              
              <h4>Firma generada:</h4>
              <code>{result.webhook.signature}</code>
              
              <h4>Respuesta del webhook:</h4>
              <pre>{result.webhook.response}</pre>
            </div>
          </details>
        </div>
      )}

      <div className={styles.instructions}>
        <h3>📖 Instrucciones de uso</h3>
        <ol>
          <li><strong>Payment ID:</strong> Introduce el ID del pago que quieres simular</li>
          <li><strong>Estado:</strong> Selecciona el nuevo estado que quieres simular</li>
          <li><strong>Verificación:</strong> Activa si quieres verificar que el payment_request existe</li>
          <li><strong>Enviar:</strong> El sistema enviará el webhook simulado a tu endpoint</li>
        </ol>
        
        <div className={styles.note}>
          <p><strong>Nota:</strong> Esta herramienta simula webhooks reales de Mercado Pago, incluyendo la firma HMAC correcta.</p>
        </div>
      </div>
    </div>
  );
}