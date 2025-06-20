// Este es solo para probar, NO lo incluyas en tu proyecto final

const testAppScript = async () => {
  const APP_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzhkRRF8aGyQbfzWeEGciybRVZ2y4iDW8LYJfrZ5ePmvZuFtJGqslfQbo-VVvuvUntfUw/exec"; // Reemplaza con tu URL real
  
  const testData = {
    action: 'save_customer',
    secretKey: '85991908a6ec59ff73241938f0e0deaaf7eae8d7924e855532d5e59db3535b28',
    customerData: {
      timestamp: new Date().toISOString(),
      first_name: 'Juan',
      last_name: 'Pérez',
      email: 'juan@example.com',
      phone: '+52 1234567890',
      identification_type: 'RFC',
      identification_number: 'PERJ850101XXX',
      street_name: 'Av. Principal',
      street_number: '123',
      zip_code: '12345',
      city: 'Ciudad de México',
      state: 'CDMX',
      country: 'México',
      order_total: 500,
      order_items: JSON.stringify([{name: 'Producto Test', quantity: 1, price: 500}]),
      order_id: 'TEST_ORDER_123',
      payment_status: 'pending'
    }
  };

  try {
    const response = await fetch(APP_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    console.log('Resultado:', result);
  } catch (error) {
    console.error('Error:', error);
  }
};

// testAppScript();