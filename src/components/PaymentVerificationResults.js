'use client';
import { useState } from 'react';
import styles from './PaymentVerificationResults.module.css';

export default function PaymentVerificationResults({ results }) {
  const [activeTab, setActiveTab] = useState('summary');
  
  // Organizar discrepancias por tipo
  const discrepanciesByType = results.discrepancies.reduce((acc, item) => {
    acc[item.type] = acc[item.type] || [];
    acc[item.type].push(item);
    return acc;
  }, {});
  
  const missingInDb = discrepanciesByType.missing_in_db || [];
  const missingInMp = discrepanciesByType.missing_in_mp || [];
  const amountMismatch = discrepanciesByType.amount_mismatch || [];
  
  return (
    <div className={styles.resultsContainer}>
      <div className={styles.tabs}>
        <button 
          className={`${styles.tabButton} ${activeTab === 'summary' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Resumen
        </button>
        
        {missingInDb.length > 0 && (
          <button 
            className={`${styles.tabButton} ${activeTab === 'missingInDb' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('missingInDb')}
          >
            Faltantes en DB ({missingInDb.length})
          </button>
        )}
        
        {missingInMp.length > 0 && (
          <button 
            className={`${styles.tabButton} ${activeTab === 'missingInMp' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('missingInMp')}
          >
            Faltantes en MP ({missingInMp.length})
          </button>
        )}
        
        {amountMismatch.length > 0 && (
          <button 
            className={`${styles.tabButton} ${activeTab === 'amountMismatch' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('amountMismatch')}
          >
            Montos Diferentes ({amountMismatch.length})
          </button>
        )}
      </div>
      
      <div className={styles.tabContent}>
        {activeTab === 'summary' && (
          <div className={styles.summary}>
            <div className={styles.summaryCard}>
              <h3>MercadoPago</h3>
              <div className={styles.stat}>{results.totalMercadoPago}</div>
              <div className={styles.label}>Pagos Encontrados</div>
            </div>
            
            <div className={styles.summaryCard}>
              <h3>Base de Datos</h3>
              <div className={styles.stat}>{results.totalDatabase}</div>
              <div className={styles.label}>Pagos Encontrados</div>
            </div>
            
            <div className={`${styles.summaryCard} ${results.discrepancies.length > 0 ? styles.warning : styles.success}`}>
              <h3>Discrepancias</h3>
              <div className={styles.stat}>{results.discrepancies.length}</div>
              <div className={styles.label}>
                {results.discrepancies.length === 0 ? '✅ Todo en orden' : '⚠️ Requiere atención'}
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'missingInDb' && (
          <div>
            <h3 className={styles.tableTitle}>Pagos en MercadoPago no encontrados en Base de Datos</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID de Pago</th>
                  <th>Monto</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {missingInDb.map((item) => (
                  <tr key={item.payment_id}>
                    <td>{item.payment_id}</td>
                    <td>${item.amount}</td>
                    <td>{formatDate(item.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {activeTab === 'missingInMp' && (
          <div>
            <h3 className={styles.tableTitle}>Pagos en Base de Datos no encontrados en MercadoPago</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID de Pago</th>
                  <th>Monto</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {missingInMp.map((item) => (
                  <tr key={item.payment_id}>
                    <td>{item.payment_id}</td>
                    <td>${item.amount}</td>
                    <td>{formatDate(item.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {activeTab === 'amountMismatch' && (
          <div>
            <h3 className={styles.tableTitle}>Pagos con montos diferentes</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID de Pago</th>
                  <th>Monto en MP</th>
                  <th>Monto en DB</th>
                  <th>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {amountMismatch.map((item) => (
                  <tr key={item.payment_id}>
                    <td>{item.payment_id}</td>
                    <td>${item.mp_amount}</td>
                    <td>${item.db_amount}</td>
                    <td>${Math.abs(item.mp_amount - item.db_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Función auxiliar para formatear fechas
function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateString;
  }
}