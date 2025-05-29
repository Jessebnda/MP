'use client';

import { useState, useEffect } from 'react';
import styles from '../styles/PaymentFlow.module.css'; 
import MercadoPagoProvider from './MercadoPagoProvider';
import { cn } from '../lib/utils';
import { logInfo, logError, logWarn } from '../lib/logger';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import '../styles/mercadopago-globals.css';
import { useCart } from '../hooks/useCart';
import CartIcon from './CartIcon';
import CartSidebar from './CartSidebar';
import { useCustomerSave } from '../hooks/useCustomerSave';

const formatPrice = (price) => {
  return Number(price).toLocaleString('es-MX', {
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2
  });
};

export default function PaymentFlow({
  apiBaseUrl,
  productsEndpoint = '/api/products',
  mercadoPagoPublicKey,
  PaymentProviderComponent = MercadoPagoProvider,
  successUrl,
  pendingUrl,
  failureUrl,
  onSuccess,
  onError,
  containerStyles = {},
  hideTitle = false,
  className = '',
  initialProductId = null,
  initialStep = 1,
  displayMode = "full",
  cartIconColor = "currentColor", // Nueva prop para el color del ícono del carrito
}) {
  if (!apiBaseUrl) {
    logError("PaymentFlow Error: 'apiBaseUrl' prop is required.");
    return <div className={styles['mp-error-container']}>Error de configuración: Falta apiBaseUrl.</div>;
  }
  if (!mercadoPagoPublicKey) {
    logError("PaymentFlow Error: 'mercadoPagoPublicKey' prop is required.");
    return <div className={styles['mp-error-container']}>Error de configuración: Falta mercadoPagoPublicKey.</div>;
  }
  if (!successUrl || !pendingUrl || !failureUrl) {
    logError("PaymentFlow Error: 'successUrl', 'pendingUrl', and 'failureUrl' props are required.");
    return <div className={styles['mp-error-container']}>Error de configuración: Faltan URLs de redirección.</div>;
  }
  if (!PaymentProviderComponent) {
    logError("PaymentFlow Error: 'PaymentProviderComponent' prop is required.");
    return <div className={styles['mp-error-container']}>Error de configuración: Falta PaymentProviderComponent.</div>;
  }

  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [userData, setUserData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    identification: {
      type: 'DNI',
      number: ''
    },
    address: {
      street_name: '',
      street_number: '',
      zip_code: '',
      city: '',
      state: '',
      country: '' // Valor predeterminado
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { saveCustomer, saving: savingCustomer } = useCustomerSave();

  // Obtener datos del carrito
  const { items, totalAmount, clearCart, addItem, updateQuantity, removeItem } = useCart();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const fullProductsUrl = `${apiBaseUrl.replace(/\/$/, '')}${productsEndpoint}`;
        const response = await fetch(fullProductsUrl);
        if (!response.ok) {
          throw new Error('Error al cargar productos');
        }
        const data = await response.json();
        setProducts(data);
        
        // Verificar si hay productos en el carrito al cargar
        if (items.length > 0) {
          // Tomar solo el primer producto del carrito y establecer cantidad a 1
          const firstCartItem = items[0];
          const productData = data.find(p => p.id === firstCartItem.productId) || firstCartItem.product;
          
          setSelectedProducts([{
            productId: productData.id,
            product: productData,
            quantity: 1 // Siempre inicializar a 1
          }]);
        } else if (data.length > 0) {
          // Si no hay productos en el carrito, inicializar con uno
          let initialProduct = data[0];
          if (initialProductId) {
            const foundProduct = data.find(p => p.id === initialProductId);
            if (foundProduct) {
              initialProduct = foundProduct;
            }
          }
          setSelectedProducts([
            {
              productId: initialProduct.id,
              product: initialProduct,
              quantity: 1
            }
          ]);
        }
      } catch (e) {
        setError(e.message);
        if (onError) onError(e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProducts();
  }, [apiBaseUrl, productsEndpoint, onError, initialProductId, items]);
  
  useEffect(() => {
    return () => {
      logInfo("Limpiando el flujo de pago");
    };
  }, []);

  useEffect(() => {
    if (currentStep === 1 && confirmedOrder === null && selectedProducts.length === 0 && products.length > 0) {
      let initialProduct = products[0];
      if (initialProductId) {
        const foundProduct = products.find(p => p.id === initialProductId);
        if (foundProduct) {
          initialProduct = foundProduct;
        }
      }
      setSelectedProducts([
        {
          productId: initialProduct.id,
          product: initialProduct,
          quantity: 1
        }
      ]);
    }
  }, [currentStep, confirmedOrder, selectedProducts.length, products, initialProductId]);

  const getAvailableProducts = (currentIndex) => {
    const selectedIds = selectedProducts
      .filter((_, index) => index !== currentIndex)
      .map(item => item.productId);
    return products.filter(product => !selectedIds.includes(product.id));
  };

  const handleAddProduct = () => {
    if (products.length > 0) {
      const availableProducts = getAvailableProducts(-1);
      if (availableProducts.length === 0) {
        alert('Ya has agregado todos los productos disponibles');
        return;
      }
      
      const newProduct = availableProducts[0];
      
      // Añadir al estado local de productos seleccionados
      setSelectedProducts([
        ...selectedProducts,
        {
          productId: newProduct.id,
          product: newProduct,
          quantity: 1
        }
      ]);
      
      // Añadir también al carrito global
      addItem(newProduct, 1);
    }
  };

  const handleRemoveProduct = (index) => {
    const productToRemove = selectedProducts[index];
    const newProducts = [...selectedProducts];
    newProducts.splice(index, 1);
    setSelectedProducts(newProducts);
    
    // Eliminar también del carrito global
    removeItem(productToRemove.productId);
  };

  const handleProductChange = (e, index) => {
    const productId = e.target.value;
    const product = products.find(p => p.id === productId);
    const updatedProducts = [...selectedProducts];
    updatedProducts[index] = {
      ...updatedProducts[index],
      productId: productId,
      product: product
    };
    setSelectedProducts(updatedProducts);
  };

  const handleQuantityChange = (e, index) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      const updatedProducts = [...selectedProducts];
      updatedProducts[index] = {
        ...updatedProducts[index],
        quantity: value
      };
      setSelectedProducts(updatedProducts);
      
      // Actualizar también en el carrito global
      const product = updatedProducts[index];
      updateQuantity(product.productId, value);
    }
  };

  const calculateTotalPrice = () => {
    // Use the cart totalAmount directly instead of calculating from selectedProducts
    return totalAmount;
  };

  const handleContinueToConfirmation = () => {
    if (selectedProducts.length === 0 || selectedProducts.some(product => product.quantity < 1)) {
      alert('Por favor selecciona productos válidos y cantidades');
      return;
    }
    setCurrentStep(2);
  };

  const handleContinueToOrderConfirmation = () => {
    // Procesamiento del país personalizado
    const processedUserData = {...userData};
    
    if (processedUserData.address?.country === 'Otro') {
      if (!processedUserData.address?.customCountry) {
        alert('Por favor especifique el país');
        return;
      }
      // Usar el país personalizado en lugar de "Otro"
      processedUserData.address.country = processedUserData.address.customCountry;
    }
    
    // Check all required fields (mantén la validación existente)
    if (!processedUserData.email || !processedUserData.first_name || !processedUserData.last_name || 
        !processedUserData.phone || 
        !processedUserData.address?.street_name || !processedUserData.address?.street_number || 
        !processedUserData.address?.zip_code || !processedUserData.address?.city || 
        !processedUserData.address?.state || !processedUserData.address?.country) {
      
      alert('Por favor completa todos los campos, necesitamos estos datos para enviar tu producto');
      return;
    }
    
    // Asegúrate de que el teléfono sea una cadena limpia (mantén esto igual)
    if (processedUserData.phone) {
      processedUserData.phone = String(processedUserData.phone).replace(/[^\d+]/g, '');
    }
    
    setUserData(processedUserData);
    setCurrentStep(3);
  };

  const handleConfirmOrder = async () => {
    logInfo('====== ORDEN CONFIRMADA ======');
    logInfo('Productos confirmados del carrito:');
    
    // Use cart items instead of selectedProducts
    items.forEach((item, i) => {
      logInfo(`${i+1}. ${item.name} (ID: ${item.productId})`);
      logInfo(`   Cantidad: ${item.quantity}`);
      logInfo(`   Precio unitario: $${formatPrice(item.price)}`);
      logInfo(`   Subtotal: $${formatPrice(item.price * item.quantity)}`);
    });
    
    logInfo('TOTAL A PAGAR: $' + formatPrice(totalAmount));
    logInfo('============================');

    // Guardar datos del cliente antes de proceder al pago
    try {
      const orderData = {
        totalAmount,
        items: items.map(item => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity
        })),
        orderId: `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        paymentStatus: 'pending'
      };

      // Guardar cliente en Google Sheets
      logInfo('Datos del cliente y orden guardados temporalmente en payment_requests para ser procesados cuando se confirme el pago');

    } catch (error) {
      logError('Error guardando cliente, pero continuando con el pago:', error);
      // No bloquear el flujo de pago por errores de guardado
    }

    setConfirmedOrder({
      // Use cart items instead of selectedProducts
      products: items.map(item => ({
        productId: item.productId,
        product: item,
        quantity: item.quantity
      })),
      totalPrice: totalAmount,
      userData: userData
    });
    
    setCurrentStep(4);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCancel = () => {
    if (window.confirm('¿Seguro que deseas cancelar este pedido?')) {
      setCurrentStep(1);
      const initialProduct = initialProductId 
        ? products.find(product => product.id === initialProductId) || products[0]
        : products[0];
      setSelectedProducts(products.length > 0 
        ? [{ 
            productId: initialProduct.id,
            product: initialProduct,
            quantity: 1
          }] 
        : []);
      setConfirmedOrder(null);
    }
  };

  const handlePaymentSuccess = (data) => {
    logInfo('====== PAGO EXITOSO ======');
    logInfo('Detalles de la transacción:', data);
    logInfo('Monto total:', formatPrice(calculateTotalPrice()));
    logInfo('Productos:', selectedProducts.map(p => ({
      id: p.productId,
      nombre: p.product.name,
      cantidad: p.quantity,
      precio: p.product.price,
      subtotal: p.product.price * p.quantity
    })));
    logInfo('========================');
    // Limpiar carrito después de pago exitoso
    clearCart();
    
    if (onSuccess) onSuccess(data);
  };

  const handlePaymentError = (error) => {
    logError('====== ERROR EN PAGO ======');
    logError('Detalle del error:', error);
    logError('Productos intentados:', selectedProducts.map(p => p.product.name).join(', '));
    logError('Monto total intentado:', formatPrice(calculateTotalPrice()));
    logError('===========================');
    if (onError) onError(error);
  };

  const renderPaymentProvider = () => {
    if (!confirmedOrder || items.length === 0 || !mercadoPagoPublicKey) return null;

    return (
      <PaymentProviderComponent
        productId={items[0].productId}
        quantity={1}
        totalAmount={totalAmount}
        publicKey={mercadoPagoPublicKey}
        apiBaseUrl={apiBaseUrl}
        successUrl={successUrl}
        pendingUrl={pendingUrl}
        failureUrl={failureUrl}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
        hideTitle={true}
        userData={confirmedOrder.userData}
        // Use cart items for the order summary
        orderSummary={items.map(item => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity
        }))}
      
      />
    );
  };

  if (loading) {
    return (
      <div className={cn(styles['mp-container'], className)} style={containerStyles}>
        <div className={styles['mp-loading']}>
          <div className={styles['mp-spinner']}></div>
          <p>Cargando productos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(styles['mp-container'], className)} style={containerStyles}>
        <div className={styles['mp-error-container']}>
          <h2>Error</h2>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className={styles['mp-button']}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className={cn(styles['mp-container'], className)} style={containerStyles}>
        <div className={styles['mp-empty-state']}>
          <h2>No hay productos disponibles</h2>
          <p>Vuelve a intentarlo más tarde o contacta con el administrador.</p>
        </div>
      </div>
    );
  }

  if (currentStep === 1) {
    return (
      <div className={cn(styles['mp-container'], className)} style={containerStyles}>
        <div className={styles['mp-header']}>
          {!hideTitle && <h2 className={styles['mp-page-title']}>Selecciona un Producto</h2>}
          {/* Solo muestra el CartIcon si es full o cartIconOnly, NUNCA en paymentFlowOnly */}
          {(displayMode === "full" || displayMode === "cartIconOnly") && (
            <CartIcon onClick={() => setIsCartOpen(true)} color={cartIconColor} />
          )}
        </div>
        
        {/* Solo muestra el CartSidebar si NO es paymentFlowOnly */}
        {(displayMode === "full" || displayMode === "cartIconOnly") && (
          <CartSidebar 
            isOpen={isCartOpen} 
            onClose={() => setIsCartOpen(false)} 
            checkoutUrl={`${apiBaseUrl}/checkout`}
          />
        )}
        
        <div className={styles['mp-product-selection-container']}>
          {/* Show only one product selector */}
          <div className={styles['mp-product-item']}>
            <div className={styles['mp-form-group']}>
              <label htmlFor="mp-product-select">Producto:</label>
              <select 
                id="mp-product-select"
                value={selectedProducts[0]?.productId || ''}
                onChange={(e) => {
                  const productId = e.target.value;
                  const product = products.find(p => p.id === productId);
                  
                  if (product) {
                    const updatedProducts = [...selectedProducts];
                    updatedProducts[0] = {
                      productId: product.id,
                      product: product,
                      quantity: 1
                    };
                    setSelectedProducts(updatedProducts);
                  }
                }}
                className={styles['mp-select-input']}
              >
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} - ${formatPrice(product.price)}
                  </option>
                ))}
              </select>
            </div>
            
            <div className={styles['mp-form-group']}>
              <label htmlFor="mp-quantity-input">Cantidad:</label>
              <div className={styles['mp-quantity-control']}>
                <button 
                  type="button"
                  className={styles['mp-quantity-button']}
                  onClick={() => {
                    if (selectedProducts[0] && selectedProducts[0].quantity > 1) {
                      const newQuantity = selectedProducts[0].quantity - 1;
                      const updatedProducts = [...selectedProducts];
                      updatedProducts[0] = {
                        ...updatedProducts[0],
                        quantity: newQuantity
                      };
                      setSelectedProducts(updatedProducts);
                      
                      // Añadir esta línea:
                      updateQuantity(selectedProducts[0].productId, newQuantity);
                    }
                  }}
                >
                  -
                </button>
                <input
                  id="mp-quantity-input"
                  type="number"
                  min="1"
                  value={selectedProducts[0]?.quantity || 1}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value) && value > 0 && selectedProducts[0]) {
                      const updatedProducts = [...selectedProducts];
                      updatedProducts[0] = {
                        ...updatedProducts[0],
                        quantity: value
                      };
                      setSelectedProducts(updatedProducts);
                    }
                  }}
                  className={styles['mp-number-input']}
                />
                <button 
                  type="button"
                  className={styles['mp-quantity-button']}
                  onClick={() => {
                    if (selectedProducts[0]) {
                      const newQuantity = selectedProducts[0].quantity + 1;
                      const updatedProducts = [...selectedProducts];
                      updatedProducts[0] = {
                        ...updatedProducts[0],
                        quantity: newQuantity
                      };
                      setSelectedProducts(updatedProducts);
                    }
                  }}
                >
                  +
                </button>
              </div>
            </div>
            
            {selectedProducts[0]?.product && (
              <div className={styles['mp-product-details']}>
                <h3>{selectedProducts[0].product.name}</h3>
                <p className={styles['mp-product-description']}>{selectedProducts[0].product.description}</p>
                <div className={styles['mp-product-price']}>
                  <span>Precio Total:</span>
                  <span className={styles['mp-price-value']}>
                    ${formatPrice(selectedProducts[0].product.price * selectedProducts[0].quantity)}
                  </span>
                </div>
              </div>
            )}
            
            <div className={styles['mp-add-to-cart-container']}>
              <button 
                className={styles.addToCartButton}
                onClick={() => {
                  if (selectedProducts[0]?.product) {
                    // Primero agregar al carrito con la cantidad actual
                    addItem(selectedProducts[0].product, selectedProducts[0].quantity);
                    
                    // Visual feedback
                    const button = document.activeElement;
                    if (button) {
                      const originalText = button.textContent;
                      button.textContent = "¡Agregado!";
                      button.style.backgroundColor = "#4CAF50"; // Green success color
                      setTimeout(() => {
                        button.textContent = originalText;
                        button.style.backgroundColor = "";
                      }, 800);
                    }
                    
                    // Resetear la cantidad a 1 después de agregar al carrito
                    const updatedProducts = [...selectedProducts];
                    updatedProducts[0] = {
                      ...updatedProducts[0],
                      quantity: 1
                    };
                    setSelectedProducts(updatedProducts);
                  }
                }}
              >
                Agregar al Carrito
              </button>
            </div>
          </div>
          
          <div className={styles['mp-total-price']}>
            <span>Total en Carrito:</span>
            <span>${formatPrice(totalAmount)}</span>
          </div>
          
          {/* Button to continue to payment flow */}
          <div className={styles['mp-button-container']}>
            <button 
              className={cn(styles['mp-button'], styles['mp-primary'])} 
              onClick={handleContinueToConfirmation}
              disabled={items.length === 0}
            >
              Continuar al Pago
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 2) {
    return (
      <div className={cn(styles['mp-container'], className)} style={containerStyles}>
        <h2 className={styles['mp-page-title']}>DATOS DEL COMPRADOR</h2>
        
        <div className={styles['mp-form-container']}>
          <div className={styles['mp-form-section']}>
            <h3 className={styles['mp-form-section-title']}>Información Personal</h3>
            <p className={styles['mp-form-section-subtitle']}>Ingresa tus datos para completar la compra</p>
            
            <div className={styles['mp-form-group']}>
              <label htmlFor="mp-email">EMAIL: <span className={styles['required']}>*</span></label>
              <input
                id="mp-email"
                type="email"
                value={userData.email}
                onChange={(e) => setUserData({...userData, email: e.target.value})}
                className={styles['mp-text-input']}
                placeholder="correo@ejemplo.com"
                required
              />
            </div>
            
            <div className={styles['mp-form-row']}>
              <div className={styles['mp-form-group']}>
                <label htmlFor="mp-first-name">NOMBRE: <span className={styles['required']}>*</span></label>
                <input
                  id="mp-first-name"
                  type="text"
                  value={userData.first_name}
                  onChange={(e) => setUserData({...userData, first_name: e.target.value})}
                  className={styles['mp-text-input']}
                  required
                />
              </div>
              
              <div className={styles['mp-form-group']}>
                <label htmlFor="mp-last-name">APELLIDO: <span className={styles['required']}>*</span></label>
                <input
                  id="mp-last-name"
                  type="text"
                  value={userData.last_name}
                  onChange={(e) => setUserData({...userData, last_name: e.target.value})}
                  className={styles['mp-text-input']}
                  required
                />
              </div>
            </div>
            
            <div className={styles['mp-form-group']}>
              <label htmlFor="mp-phone">TELÉFONO: <span className={styles['required']}>*</span></label>
              {typeof window !== 'undefined' && (
                <PhoneInput
                  country={'mx'} // Default para México
                  value={userData.phone || ''}
                  onChange={(value) => {
                    if (value) {
                      setUserData({
                        ...userData, 
                        phone: value.toString()
                      });
                    }
                  }}
                  inputClass={styles['mp-phone-input']}
                  containerClass={styles['mp-phone-container']}
                  enableSearch={false}
                  disableSearchIcon={true}
                  preferredCountries={['mx', 'us', 'co', 'ar', 'pe', 'cl']}
                  placeholder="Número de teléfono"
                />
              )}
              <small className={styles['mp-form-help']}>Incluya código de país y solo números</small>
            </div>
            
            <div className={styles['mp-form-row']}>
              <div className={styles['mp-form-group']}>
                <label htmlFor="mp-id-type">TIPO DE DOCUMENTO:</label>
                <select
                  id="mp-id-type"
                  value={userData.identification?.type || 'INE'}
                  onChange={(e) => setUserData({
                    ...userData, 
                    identification: {...(userData.identification || {}), type: e.target.value}
                  })}
                  className={styles['mp-select-input']}
                >
                  <option value="INE">INE</option>
                  <option value="RFC">RFC</option>
                  <option value="PASAPORTE">PASAPORTE</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              
              <div className={styles['mp-form-group']}>
                <label htmlFor="mp-id-number">NÚMERO DE DOCUMENTO:</label>
                <input
                  id="mp-id-number"
                  type="text"
                  value={userData.identification?.number || ''}
                  onChange={(e) => setUserData({
                    ...userData, 
                    identification: {...(userData.identification || {}), number: e.target.value}
                  })}
                  className={styles['mp-text-input']}
                />
              </div>
            </div>
          </div>
          
          <div className={styles['mp-form-section']}>
            <h3 className={styles['mp-form-section-title']}>Dirección</h3>
            <p className={styles['mp-form-section-subtitle']}>Todos los campos son obligatorios para envío del producto</p>
            
            <div className={styles['mp-form-group']}>
              <label htmlFor="mp-street">CALLE: <span className={styles['required']}>*</span></label>
              <input
                id="mp-street"
                type="text"
                value={userData.address?.street_name || ''}
                onChange={(e) => setUserData({
                  ...userData, 
                  address: {...(userData.address || {}), street_name: e.target.value}
                })}
                className={styles['mp-text-input']}
              />
            </div>
            
            <div className={styles['mp-form-row']}>
              <div className={styles['mp-form-group']}>
                <label htmlFor="mp-street-number">NÚMERO: <span className={styles['required']}>*</span></label>
                <input
                  id="mp-street-number"
                  type="text"
                  value={userData.address?.street_number || ''}
                  onChange={(e) => {
                    const streetNumber = e.target.value;
                    setUserData({
                      ...userData, 
                      address: {...(userData.address || {}), street_number: streetNumber}
                    });
                  }}
                  className={styles['mp-text-input']}
                />
              </div>
              
              <div className={styles['mp-form-group']}>
                <label htmlFor="mp-zip">CÓDIGO POSTAL: <span className={styles['required']}>*</span></label>
                <input
                  id="mp-zip"
                  type="text"
                  value={userData.address?.zip_code || ''}
                  onChange={(e) => setUserData({
                    ...userData, 
                    address: {...(userData.address || {}), zip_code: e.target.value}
                  })}
                  className={styles['mp-text-input']}
                />
              </div>
            </div>
            
            <div className={styles['mp-form-group']}>
              <label htmlFor="mp-city">CIUDAD: <span className={styles['required']}>*</span></label>
              <input
                id="mp-city"
                type="text"
                value={userData.address?.city || ''}
                onChange={(e) => setUserData({
                  ...userData, 
                  address: {...(userData.address || {}), city: e.target.value}
                })}
                className={styles['mp-text-input']}
              />
            </div>

            {/* Nuevo campo para estado/provincia */}
            <div className={styles['mp-form-group']}>
              <label htmlFor="mp-state">ESTADO/PROVINCIA: <span className={styles['required']}>*</span></label>
              <input
                id="mp-state"
                type="text"
                value={userData.address?.state || ''}
                onChange={(e) => setUserData({
                  ...userData, 
                  address: {...(userData.address || {}), state: e.target.value}
                })}
                className={styles['mp-text-input']}
              />
            </div>

            {/* Nuevo campo para país */}
            <div className={styles['mp-form-group']}>
              <label htmlFor="mp-country">PAÍS: <span className={styles['required']}>*</span></label>
              <select
                id="mp-country"
                value={userData.address?.country || 'Mexico'}
                onChange={(e) => {
                  const countryValue = e.target.value;
                  setUserData({
                    ...userData, 
                    address: {
                      ...(userData.address || {}), 
                      country: countryValue,
                      // Si se selecciona "Otro", limpiar el campo personalizado
                      customCountry: countryValue === 'Otro' ? '' : userData.address?.customCountry
                    }
                  });
                }}
                className={styles['mp-select-input']}
              >
                <option value="Mexico">México</option>
                <option value="USA">Estados Unidos</option>
                <option value="Colombia">Colombia</option>
                <option value="Argentina">Argentina</option>
                <option value="Chile">Chile</option>
                <option value="Peru">Perú</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            {/* Campo adicional que aparece cuando se selecciona "Otro" */}
            {userData.address?.country === 'Otro' && (
              <div className={styles['mp-form-group']}>
                <label htmlFor="mp-custom-country">ESPECIFIQUE PAÍS: <span className={styles['required']}>*</span></label>
                <input
                  id="mp-custom-country"
                  type="text"
                  value={userData.address?.customCountry || ''}
                  onChange={(e) => setUserData({
                    ...userData, 
                    address: {...(userData.address || {}), customCountry: e.target.value}
                  })}
                  className={styles['mp-text-input']}
                  placeholder="Escriba el nombre del país"
                />
              </div>
            )}
          </div>
          
          <div className={styles['mp-form-actions']}>
            <button 
              className={cn(styles['mp-button'], styles['mp-secondary'])} 
              onClick={() => setCurrentStep(1)}
            >
              Volver
            </button>
            <button 
              className={cn(styles['mp-button'], styles['mp-primary'])} 
              onClick={handleContinueToOrderConfirmation}
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 3) {
    return (
      <div className={cn(styles['mp-container'], className)} style={containerStyles}>
        {!hideTitle && <h2 className={styles['mp-page-title']}>Confirmar Pedido</h2>}
        {savingCustomer && (
          <div className={styles['mp-saving-notice']}>
            <p>Guardando información del cliente...</p>
          </div>
        )}
        <div className={styles['mp-confirmation-container']}>
          <div className={styles['mp-summary']}>
            {items.map((item, index) => (
              <div key={index} className={styles['mp-product-card']}>
                <div className={styles['mp-product-card-header']}>
                  <h4>{item.name}</h4>
                </div>
                <div className={styles['mp-product-card-body']}>
                  <p className={styles['mp-product-description']}>{item.description}</p>
                  <div className={styles['mp-product-card-row']}>
                    <span className={styles['mp-product-card-label']}>Precio Unitario:</span>
                    <span className={styles['mp-product-card-value']}>${formatPrice(item.price)}</span>
                  </div>
                  <div className={styles['mp-product-card-row']}>
                    <span className={styles['mp-product-card-label']}>Cantidad:</span>
                    <span className={styles['mp-product-card-value']}>{item.quantity}</span>
                  </div>
                </div>
                <div className={styles['mp-product-card-footer']}>
                  <span>Total producto:</span>
                  <span className={styles['mp-product-card-total']}>${formatPrice(item.price * item.quantity)}</span>
                </div>
              </div>
            ))}
            
           
            
            {/* Tarjeta de información del comprador */}
            <div className={styles['mp-buyer-info-card']}>
              <div className={styles['mp-buyer-info-header']}>
                <span className={styles['mp-buyer-info-icon']}>👤</span>
                <h4>Información del Comprador</h4>
              </div>
              <div className={styles['mp-buyer-info-body']}>
                <div className={styles['mp-buyer-info-section']}>
                  <h5>Datos Personales</h5>
                  <div className={styles['mp-buyer-info-row']}>
                    <span className={styles['mp-buyer-info-label']}>Nombre:</span>
                    <span className={styles['mp-buyer-info-value']}>{userData.first_name} {userData.last_name}</span>
                  </div>
                  <div className={styles['mp-buyer-info-row']}>
                    <span className={styles['mp-buyer-info-label']}>Email:</span>
                    <span className={styles['mp-buyer-info-value']}>{userData.email}</span>
                  </div>
                  {userData.phone && (
                    <div className={styles['mp-buyer-info-row']}>
                      <span className={styles['mp-buyer-info-label']}>Teléfono:</span>
                      <span className={styles['mp-buyer-info-value']}>{userData.phone}</span>
                    </div>
                  )}
                </div>
                
                {(userData.identification?.type || userData.identification?.number) && (
                  <div className={styles['mp-buyer-info-section']}>
                    <h5>Documento de Identidad</h5>
                    <div className={styles['mp-buyer-info-row']}>
                      <span className={styles['mp-buyer-info-label']}>Tipo:</span>
                      <span className={styles['mp-buyer-info-value']}>{userData.identification?.type || '-'}</span>
                    </div>
                    <div className={styles['mp-buyer-info-row']}>
                      <span className={styles['mp-buyer-info-label']}>Número:</span>
                      <span className={styles['mp-buyer-info-value']}>{userData.identification?.number || '-'}</span>
                    </div>
                  </div>
                )}
                
                {(userData.address?.street_name || userData.address?.street_number || userData.address?.zip_code || userData.address?.city) && (
                  <div className={styles['mp-buyer-info-section']}>
                    <h5>Dirección</h5>
                    {userData.address?.street_name && (
                      <div className={styles['mp-buyer-info-row']}>
                        <span className={styles['mp-buyer-info-label']}>Calle:</span>
                        <span className={styles['mp-buyer-info-value']}>{userData.address.street_name}</span>
                      </div>
                    )}
                    {userData.address?.street_number && (
                      <div className={styles['mp-buyer-info-row']}>
                        <span className={styles['mp-buyer-info-label']}>Número:</span>
                        <span className={styles['mp-buyer-info-value']}>{userData.address.street_number}</span>
                      </div>
                    )}
                    {userData.address?.zip_code && (
                      <div className={styles['mp-buyer-info-row']}>
                        <span className={styles['mp-buyer-info-label']}>Código Postal:</span>
                        <span className={styles['mp-buyer-info-value']}>{userData.address.zip_code}</span>
                      </div>
                    )}
                    {userData.address?.city && (
                      <div className={styles['mp-buyer-info-row']}>
                        <span className={styles['mp-buyer-info-label']}>Ciudad:</span>
                        <span className={styles['mp-buyer-info-value']}>{userData.address.city}</span>
                      </div>
                    )}
                    {userData.address?.state && (
                      <div className={styles['mp-buyer-info-row']}>
                        <span className={styles['mp-buyer-info-label']}>Estado/Provincia:</span>
                        <span className={styles['mp-buyer-info-value']}>{userData.address.state}</span>
                      </div>
                    )}
                    {userData.address?.country && (
                      <div className={styles['mp-buyer-info-row']}>
                        <span className={styles['mp-buyer-info-label']}>País:</span>
                        <span className={styles['mp-buyer-info-value']}>{userData.address.country}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
             <div className={styles['mp-grand-total']}>
              <span className={styles['mp-grand-total-label']}>Total a Pagar:</span>
              <span className={styles['mp-grand-total-value']}>${formatPrice(totalAmount)}</span>
            </div>
          </div>
          
          <div className={styles['mp-confirmation-actions']}>
            <p className={styles['mp-confirmation-note']}>
              Al confirmar esta orden, procederás al proceso de pago.
              Los datos mostrados quedarán bloqueados y se guardarán para el envío.
            </p>
            <div className={styles['mp-button-container']}>
              <button className={cn(styles['mp-button'], styles['mp-secondary'])} onClick={handleBack}>
                Volver
              </button>
              <button className={cn(styles['mp-button'], styles['mp-primary'])} onClick={handleConfirmOrder} disabled={savingCustomer}>
                {savingCustomer ? 'Guardando...' : 'Confirmar y Proceder al Pago'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 4 && confirmedOrder) {
    return (
      <div className={cn(styles['mp-container'], className)} style={containerStyles}>
        {!hideTitle && <h2 className={styles['mp-page-title']}>Proceso de Pago</h2>}
        <div className={styles['mp-payment-container']}>
          <div className={styles['mp-order-preview']}>
            <h3>Resumen del Pedido (Confirmado)</h3>
            {confirmedOrder && confirmedOrder.products && confirmedOrder.products.map((order, index) => (
              <div key={index} className={styles['mp-product-card']}>
                <div className={styles['mp-product-card-header']}>
                  <h4>{order.product && order.product.name || 'Producto desconocido'}</h4>
                </div>
                <div className={styles['mp-product-card-body']}>
                  
                  <div className={styles['mp-product-card-row']}>
                    <span className={styles['mp-product-card-label']}>Precio unitario:</span>
                    <span className={styles['mp-product-card-value']}>${order.product && formatPrice(order.product.price)}</span>
                  </div>
                  <div className={styles['mp-product-card-row']}>
                    <span className={styles['mp-product-card-label']}>Cantidad:</span>
                    <span className={styles['mp-product-card-value']}>{order.quantity}</span>
                  </div>
                </div>
                <div className={styles['mp-product-card-footer']}>
                  <span>Total producto:</span>
                  <span className={styles['mp-product-card-total']}>${order.product && formatPrice(order.product.price * order.quantity)}</span>
                </div>
              </div>
            ))}
            
           
            
            {/* Tarjeta de información del comprador */}
            <div className={styles['mp-buyer-info-card']}>
              <div className={styles['mp-buyer-info-header']}>
                <span className={styles['mp-buyer-info-icon']}>👤</span>
                <h4>Información del Comprador</h4>
              </div>
              <div className={styles['mp-buyer-info-body']}>
                <div className={styles['mp-buyer-info-section']}>
                  <h5>Datos Personales</h5>
                  <div className={styles['mp-buyer-info-row']}>
                    <span className={styles['mp-buyer-info-label']}>Nombre:</span>
                    <span className={styles['mp-buyer-info-value']}>{confirmedOrder.userData.first_name} {confirmedOrder.userData.last_name}</span>
                  </div>
                  <div className={styles['mp-buyer-info-row']}>
                    <span className={styles['mp-buyer-info-label']}>Email:</span>
                    <span className={styles['mp-buyer-info-value']}>{confirmedOrder.userData.email}</span>
                  </div>
                  {confirmedOrder.userData.phone && (
                    <div className={styles['mp-buyer-info-row']}>
                      <span className={styles['mp-buyer-info-label']}>Teléfono:</span>
                      <span className={styles['mp-buyer-info-value']}>{confirmedOrder.userData.phone}</span>
                    </div>
                  )}
                </div>
                
                {confirmedOrder.userData.identification && (confirmedOrder.userData.identification.type || confirmedOrder.userData.identification.number) && (
                  <div className={styles['mp-buyer-info-section']}>
                    <h5>Documento de Identidad</h5>
                    <div className={styles['mp-buyer-info-row']}>
                      <span className={styles['mp-buyer-info-label']}>Tipo:</span>
                      <span className={styles['mp-buyer-info-value']}>{confirmedOrder.userData.identification.type || '-'}</span>
                    </div>
                    <div className={styles['mp-buyer-info-row']}>
                      <span className={styles['mp-buyer-info-label']}>Número:</span>
                      <span className={styles['mp-buyer-info-value']}>{confirmedOrder.userData.identification.number || '-'}</span>
                    </div>
                  </div>
                )}
                
                {confirmedOrder.userData.address && (confirmedOrder.userData.address.street_name || confirmedOrder.userData.address.street_number || confirmedOrder.userData.address.zip_code || confirmedOrder.userData.address.city) && (
                  <div className={styles['mp-buyer-info-section']}>
                    <h5>Dirección</h5>
                    {confirmedOrder.userData.address.street_name && (
                      <div className={styles['mp-buyer-info-row']}>
                        <span className={styles['mp-buyer-info-label']}>Calle:</span>
                        <span className={styles['mp-buyer-info-value']}>{confirmedOrder.userData.address.street_name}</span>
                      </div>
                    )}
                    {confirmedOrder.userData.address.street_number && (
                      <div className={styles['mp-buyer-info-row']}>
                        <span className={styles['mp-buyer-info-label']}>Número:</span>
                        <span className={styles['mp-buyer-info-value']}>{confirmedOrder.userData.address.street_number}</span>
                      </div>
                    )}
                    {confirmedOrder.userData.address.zip_code && (
                      <div className={styles['mp-buyer-info-row']}>
                        <span className={styles['mp-buyer-info-label']}>Código Postal:</span>
                        <span className={styles['mp-buyer-info-value']}>{confirmedOrder.userData.address.zip_code}</span>
                      </div>
                    )}
                    {confirmedOrder.userData.address.city && (
                      <div className={styles['mp-buyer-info-row']}>
                        <span className={styles['mp-buyer-info-label']}>Ciudad:</span>
                        <span className={styles['mp-buyer-info-value']}>{confirmedOrder.userData.address.city}</span>
                      </div>
                    )}
                    {confirmedOrder.userData.address.state && (
                      <div className={styles['mp-buyer-info-row']}>
                        <span className={styles['mp-buyer-info-label']}>Estado/Provincia:</span>
                        <span className={styles['mp-buyer-info-value']}>{confirmedOrder.userData.address.state}</span>
                      </div>
                    )}
                    {confirmedOrder.userData.address.country && (
                      <div className={styles['mp-buyer-info-row']}>
                        <span className={styles['mp-buyer-info-label']}>País:</span>
                        <span className={styles['mp-buyer-info-value']}>{confirmedOrder.userData.address.country}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
             <div className={styles['mp-grand-total']}>
              <span className={styles['mp-grand-total-label']}>Total a pagar:</span>
              <span className={styles['mp-grand-total-value']}>${formatPrice(confirmedOrder.totalPrice)}</span>
            </div>
          </div>
          <div className={styles['mp-payment-wrapper']}>
            {renderPaymentProvider()}
          </div>
          <div className={styles['mp-payment-actions']}>
            <button className={cn(styles['mp-button'], styles['mp-secondary'])} onClick={handleCancel}>
              Cancelar Pedido
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}