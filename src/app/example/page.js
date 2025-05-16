'use client';

import { useState, Suspense } from 'react';
import { StandaloneCartFrame } from '../../components/StandaloneCartFrame';
import PaymentFlow from '../../components/PaymentFlow';
import { CartBridgeProvider } from '../../contexts/CartBridge';

function ExampleContent() {
  const [cartData, setCartData] = useState({ items: [], totalAmount: 0, totalItems: 0 });
  const [showPayment, setShowPayment] = useState(false);
  
  const handleCartUpdate = (data) => {
    setCartData(data);
  };
  
  return (
    <div style={{ padding: '20px' }}>
      <h1>Integración Separada de Carrito y Pago</h1>
      
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000 }}>
        <StandaloneCartFrame 
          onCartUpdate={handleCartUpdate}
          buttonColor="#F26F32"
          buttonSize="32"
        />
      </div>
      
      {cartData.totalItems > 0 && !showPayment && (
        <div style={{ margin: '20px 0', textAlign: 'center' }}>
          <p>Tienes {cartData.totalItems} productos en el carrito.</p>
          <button 
            onClick={() => setShowPayment(true)}
            style={{ 
              padding: '10px 20px', 
              background: '#F26F32', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Proceder al Pago
          </button>
        </div>
      )}
      
      {showPayment && (
        <PaymentFlow
          apiBaseUrl={process.env.NEXT_PUBLIC_HOST_URL || 'http://localhost:3000'}
          productsEndpoint="/api/products"
          mercadoPagoPublicKey={process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY}
          successUrl="https://alturadivina.com/confirmacion-de-compra"
          pendingUrl="https://alturadivina.com/proceso-de-compra"
          failureUrl="https://alturadivina.com/error-de-compra"
          initialStep={2} // Skip product selection, go directly to customer info
          externalCartItems={cartData.items}
          customStyles={{
            buttonColor: "#F26F32",
            primaryButtonColor: "#F26F32"
          }}
        />
      )}
    </div>
  );
}

export default function ExamplePage() {
  return (
    <CartBridgeProvider>
      <Suspense fallback={<div>Cargando ejemplo...</div>}>
        <ExampleContent />
      </Suspense>
    </CartBridgeProvider>
  );
}