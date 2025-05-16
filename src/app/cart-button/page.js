'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import StandaloneCartButton from '../../components/StandaloneCartButton';
import { CartProvider } from '../../contexts/CartContext';

function CartButtonContent() {
  const searchParams = useSearchParams();
  const [config, setConfig] = useState({
    buttonColor: '#333333',
    buttonSize: 24
  });
  
  useEffect(() => {
    if (searchParams) {
      const newConfig = {...config};
      
      const buttonColor = searchParams.get('buttonColor');
      if (buttonColor) {
        newConfig.buttonColor = `#${buttonColor}`;
      }
      
      const buttonSize = searchParams.get('buttonSize');
      if (buttonSize) {
        newConfig.buttonSize = parseInt(buttonSize, 10);
      }
      
      setConfig(newConfig);
    }
  }, [searchParams]);
  
  return (
    <div style={{ padding: 0, margin: 0 }}>
      <StandaloneCartButton
        apiBaseUrl={process.env.NEXT_PUBLIC_HOST_URL || 'http://localhost:3000'}
        buttonColor={config.buttonColor}
        buttonSize={config.buttonSize}
      />
    </div>
  );
}

export default function CartButtonPage() {
  return (
    <CartProvider>
      <Suspense fallback={<div>Cargando botón de carrito...</div>}>
        <CartButtonContent />
      </Suspense>
    </CartProvider>
  );
}