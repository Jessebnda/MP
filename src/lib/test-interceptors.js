// Interceptor para simular respuestas de MercadoPago durante testing

const mockPayments = new Map();
let originalFetch;

export function setupMercadoPagoMock() {
  console.log('🎭 Configurando mock de MercadoPago...');
  
  // Guardar fetch original
  if (typeof global !== 'undefined') {
    originalFetch = global.fetch;
    
    // Mock de fetch para interceptar llamadas a MercadoPago API
    global.fetch = async (url, options) => {
      // Si es una llamada a MercadoPago API, interceptar
      if (url.includes('api.mercadopago.com') && url.includes('/v1/payments/')) {
        const paymentId = url.split('/').pop();
        console.log(`🎭 MOCK: Interceptando consulta de pago ${paymentId}`);
        
        const mockPayment = mockPayments.get(paymentId.toString());
        
        if (!mockPayment) {
          return new Response(JSON.stringify({ error: 'payment not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        console.log(`✅ MOCK: Retornando datos simulados para pago ${paymentId}`);
        return new Response(JSON.stringify(mockPayment), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Para todas las demás llamadas, usar fetch original
      return originalFetch(url, options);
    };
  }
  
  console.log('✅ Mock de MercadoPago configurado');
}

export function teardownMercadoPagoMock() {
  if (typeof global !== 'undefined' && originalFetch) {
    global.fetch = originalFetch;
    console.log('🎭 Mock de MercadoPago removido');
  }
}

export function addMockPayment(paymentId, paymentData) {
  const mockData = {
    id: parseInt(paymentId),
    status: paymentData.status || 'pending',
    status_detail: paymentData.status_detail || 'pending_waiting_payment',
    external_reference: paymentData.external_reference,
    transaction_amount: paymentData.amount || 100,
    currency_id: 'MXN',
    date_created: new Date().toISOString(),
    date_approved: paymentData.status === 'approved' ? new Date().toISOString() : null,
    payment_method_id: 'master',
    payment_type_id: 'credit_card',
    payer: {
      email: 'test@example.com',
      identification: {
        type: 'RFC',
        number: 'TEST123456XXX'
      },
      first_name: 'Test',
      last_name: 'User'
    },
    additional_info: {
      items: [
        {
          id: 'test-product-1',
          title: 'Producto Test',
          quantity: 1,
          unit_price: paymentData.amount || 100
        }
      ]
    },
    ...paymentData
  };
  
  mockPayments.set(paymentId.toString(), mockData);
  console.log(`🎭 Mock payment agregado: ${paymentId} -> ${paymentData.external_reference}`);
}

export function updateMockPayment(paymentId, updates) {
  const existing = mockPayments.get(paymentId.toString());
  if (existing) {
    const updated = { ...existing, ...updates };
    if (updates.status === 'approved') {
      updated.date_approved = new Date().toISOString();
    }
    mockPayments.set(paymentId.toString(), updated);
    console.log(`🎭 Mock payment actualizado: ${paymentId} -> status: ${updates.status}`);
  }
}

export function clearMockPayments() {
  mockPayments.clear();
  console.log('🎭 Mock payments limpiados');
}

// Mock para servicios de correo y Google Sheets
export function setupServiceMocks() {
  console.log('📧 Configurando mocks de servicios externos...');
  
  // Mock para envío de correos (si usas algún servicio)
  if (typeof global !== 'undefined') {
    global.mockEmailSent = [];
    global.mockSheetsUpdated = [];
  }
}

export function teardownServiceMocks() {
  if (typeof global !== 'undefined') {
    delete global.mockEmailSent;
    delete global.mockSheetsUpdated;
  }
  console.log('📧 Mocks de servicios removidos');
}

export function getMockResults() {
  return {
    emailsSent: global.mockEmailSent || [],
    sheetsUpdated: global.mockSheetsUpdated || []
  };
}