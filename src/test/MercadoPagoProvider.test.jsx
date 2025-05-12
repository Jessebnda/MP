// src/__tests__/MercadoPagoProvider.test.jsx
// Asegúrate que la primera línea sea:
jest.mock('../lib/utils', () => ({
  cn: jest.fn((...classes) => classes.filter(Boolean).join(' '))
}));

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MercadoPagoProvider from '../components/MercadoPagoProvider';

// Mock de los módulos externos
jest.mock('@mercadopago/sdk-react', () => ({
  initMercadoPago: jest.fn(),
  Payment: jest.fn(() => <div data-testid="mock-payment">Payment Mock</div>)
}));

// Mock de fetch
global.fetch = jest.fn();

describe('MercadoPagoProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    
    // Mock para preferencias
    fetch.mockImplementation((url) => {
      if (url.includes('/api/create-preference')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ preferenceId: 'test-preference-id', totalAmount: 1500 })
        });
      }
      
      // Mock para productos
      if (url.includes('/api/products/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 
            id: '1', 
            name: 'Test Product', 
            price: 1500,
            description: 'Test product description' 
          })
        });
      }
      
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' })
      });
    });
  });

  test('muestra error cuando falta la clave pública', () => {
    render(<MercadoPagoProvider apiBaseUrl="https://example.com" />);
    expect(screen.getByText(/Error de configuración/i)).toBeInTheDocument();
  });
  
  test('muestra pantalla de carga al inicio', () => {
    render(
      <MercadoPagoProvider 
        publicKey="TEST-123456"
        apiBaseUrl="https://example.com"
        productId="1"
      />
    );
    expect(screen.getByText(/Preparando formulario/i)).toBeInTheDocument();
  });
  
  test('carga datos del producto correctamente', async () => {
    render(
      <MercadoPagoProvider 
        publicKey="TEST-123456"
        apiBaseUrl="https://example.com"
        productId="1"
      />
    );
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("https://example.com/api/products/1");
    });
  });

  test('maneja múltiples productos con orderSummary', async () => {
    const orderSummary = [
      { productId: '1', name: 'Producto 1', quantity: 2, price: 100, total: 200 },
      { productId: '2', name: 'Producto 2', quantity: 1, price: 150, total: 150 }
    ];

    render(
      <MercadoPagoProvider 
        publicKey="TEST-123456"
        apiBaseUrl="https://example.com"
        orderSummary={orderSummary}
        totalAmount={350}
      />
    );
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/create-preference'));
    });
  });
  
  test('muestra error cuando falla la carga del producto', async () => {
    // Override del mock para simular error
    fetch.mockImplementationOnce(() => 
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' })
      })
    );
    
    render(
      <MercadoPagoProvider 
        publicKey="TEST-123456"
        apiBaseUrl="https://example.com"
        productId="error-id"
      />
    );
    
    await waitFor(() => {
      expect(screen.getByText(/Error al cargar datos del producto/i)).toBeInTheDocument();
    });
  });
});