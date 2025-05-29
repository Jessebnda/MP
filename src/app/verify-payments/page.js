'use client';

import { useState } from 'react';
import styles from './page.module.css';
import PaymentVerificationResults from '../../components/PaymentVerificationResults';

export default function VerifyPaymentsPage() {
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(getDefaultEndDate());
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  // Manejar la verificación de pagos
  const handleVerify = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `/api/verify-payments?startDate=${startDate}&endDate=${endDate}`
      );
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error desconocido en la verificación');
      }
      
      setResults(data.results);
    } catch (err) {
      console.error('Error verificando pagos:', err);
      setError(err.message || 'Error al verificar pagos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Verificación de Pagos</h1>
      
      <div className={styles.dateSelector}>
        <div className={styles.dateField}>
          <label htmlFor="startDate">Fecha Inicial:</label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={loading}
          />
        </div>
        
        <div className={styles.dateField}>
          <label htmlFor="endDate">Fecha Final:</label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>
      
      <button 
        className={styles.verifyButton}
        onClick={handleVerify}
        disabled={loading}
      >
        {loading ? 'Verificando...' : 'Verificar Pagos'}
      </button>
      
      {error && (
        <div className={styles.error}>
          <p>❌ {error}</p>
        </div>
      )}
      
      {results && !error && (
        <PaymentVerificationResults results={results} />
      )}
    </div>
  );
}

// Funciones auxiliares para fechas por defecto
function getDefaultStartDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().split('T')[0];
}

function getDefaultEndDate() {
  return new Date().toISOString().split('T')[0];
}