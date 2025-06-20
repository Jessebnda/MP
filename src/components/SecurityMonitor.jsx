'use client';

import { useEffect, useState } from 'react';

export function SecurityMonitor({ onlyDev = true }) {
  const [securityReport, setSecurityReport] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Solo ejecutar en desarrollo si onlyDev es true
    const isDev = process.env.NODE_ENV === 'development';
    if (onlyDev && !isDev) return;
    
    fetch('/api/security-diagnostic')
      .then(res => res.json())
      .then(data => {
        setSecurityReport(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error cargando reporte de seguridad:', err);
        setLoading(false);
      });
  }, [onlyDev]);
  
  // No renderizar nada en producción
  if (onlyDev && process.env.NODE_ENV === 'production') return null;
  
  if (loading) return <div>Cargando diagnóstico de seguridad...</div>;
  
  // Implementación del componente...
}