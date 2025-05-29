"use client";

import { useState, useEffect } from 'react';
import styles from './page.module.css';

export default function EmailDiagnostics() {
  const [testResult, setTestResult] = useState(null);
  const [testRunning, setTestRunning] = useState(false);

  // Ejecutar prueba de envío de correo
  const runEmailTest = async () => {
    setTestRunning(true);
    setTestResult(null);
    
    try {
      const response = await fetch('/api/test-email');
      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({
        success: false,
        message: `Error en la prueba: ${error.message}`
      });
    } finally {
      setTestRunning(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1>Diagnóstico de Envío de Correos</h1>
      
      <div className={styles.testSection}>
        <h2>Prueba de Envío</h2>
        <p>
          Esta herramienta enviará un correo de prueba a: <strong>{process.env.LOGISTICS_EMAIL || 'No configurado'}</strong>
        </p>
        
        <button 
          onClick={runEmailTest} 
          disabled={testRunning}
          className={styles.testButton}
        >
          {testRunning ? 'Enviando...' : 'Enviar Correo de Prueba'}
        </button>
        
        {testResult && (
          <div className={`${styles.testResult} ${testResult.success ? styles.success : styles.error}`}>
            <h3>{testResult.success ? '✅ Prueba Exitosa' : '❌ Prueba Fallida'}</h3>
            <p>{testResult.message}</p>
            
            {testResult.info && (
              <div>
                <p><strong>ID del mensaje:</strong> {testResult.info.messageId}</p>
                <p><strong>Enviado a:</strong> {testResult.info.testEmailSentTo}</p>
                <p><strong>Fecha/hora:</strong> {new Date(testResult.info.timestamp).toLocaleString()}</p>
              </div>
            )}
            
            {testResult.diagnostics && (
              <div className={styles.diagnostics}>
                <h4>Diagnóstico:</h4>
                <ul>
                  <li>Configuración: {testResult.diagnostics.configCheck ? '✅' : '❌'}</li>
                  <li>Transporter creado: {testResult.diagnostics.transporterCreated ? '✅' : '❌'}</li>
                  <li>Email enviado: {testResult.diagnostics.emailSent ? '✅' : '❌'}</li>
                </ul>
                
                {testResult.diagnostics.errors.length > 0 && (
                  <div className={styles.errors}>
                    <h4>Errores:</h4>
                    <ul>
                      {testResult.diagnostics.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className={styles.troubleshootingSection}>
        <h2>Solución de Problemas</h2>
        <ul>
          <li><strong>Revisa tu bandeja de spam</strong> - A veces los correos automáticos llegan ahí</li>
          <li><strong>Asegúrate que la contraseña de aplicación es correcta</strong> - Si has cambiado tu contraseña recientemente, necesitas generar una nueva</li>
          <li><strong>Verifica los logs en la consola</strong> - Los errores detallados aparecerán en la consola de desarrollo</li>
          <li><strong>Prueba otro servicio de correo</strong> - Si los problemas persisten, considera usar SendGrid u otro servicio especializado</li>
        </ul>
      </div>
    </div>
  );
}