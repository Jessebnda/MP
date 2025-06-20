'use client';

import { useState } from 'react';
import styles from './sync.module.css';

export default function SyncPage() {
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    setStatus(null);
    
    try {
      const response = await fetch(`/api/sync-sheets?key=${apiKey}`);
      const result = await response.json();
      
      if (result.success) {
        setStatus({
          type: 'success',
          message: result.message || 'Sincronización completada exitosamente'
        });
      } else {
        setStatus({
          type: 'error',
          message: result.error || 'Error en la sincronización'
        });
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: error.message || 'Error al conectar con el servidor'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1>Sincronización Manual con Google Sheets</h1>
      <p className={styles.info}>
        Esta página permite desencadenar manualmente la sincronización entre Supabase y Google Sheets.
        La sincronización automática ha sido desactivada.
      </p>
      
      <div className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="apiKey">Clave API:</label>
          <input 
            type="password" 
            id="apiKey" 
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Ingrese la clave API de sincronización"
          />
        </div>
        
        <button 
          onClick={handleSync} 
          disabled={loading || !apiKey} 
          className={styles.button}
        >
          {loading ? 'Sincronizando...' : 'Sincronizar Ahora'}
        </button>
      </div>
      
      {status && (
        <div className={`${styles.status} ${styles[status.type]}`}>
          <p>{status.message}</p>
          {status.type === 'success' && (
            <p className={styles.timestamp}>
              Última sincronización: {new Date().toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}