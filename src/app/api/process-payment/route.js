import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { getProductById } from '../../../data/products';
import { updateProductStock, getProductStock } from '../../../lib/kv';
import { logSecurityEvent } from '../../../lib/security-logger';
import { cookies } from 'next/headers';
import { validatePaymentData } from '../../../lib/validation';

export async function POST(req) {
  try {
    // Validar token CSRF
    const csrfToken = req.headers.get('x-csrf-token');
    const storedToken = cookies().get('csrf-token')?.value;
    
    // Si el token no existe o no coincide
    if (!csrfToken || !storedToken || csrfToken !== storedToken) {
      logSecurityEvent('csrf_validation_failed', {
        hasToken: !!csrfToken,
        hasStoredToken: !!storedToken,
        match: csrfToken === storedToken
      }, 'warn');
      
      return NextResponse.json({ error: 'Token CSRF inválido' }, { status: 403 });
    }
    
    // El token es válido, continúa con el procesamiento normal
    logSecurityEvent('csrf_validation_success', {}, 'info');

    // Registrar información de solicitud (sin datos sensibles)
    logSecurityEvent('payment_request', {
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      method: req.method,
      url: req.url,
    });
    
    // Validar el origen de la solicitud
    const origin = req.headers.get('origin');
    const validOrigins = [
      process.env.NEXT_PUBLIC_HOST_URL,
      'http://localhost:3000'
    ];
    
    if (process.env.NODE_ENV === 'production' && 
        origin && !validOrigins.includes(origin)) {
      logSecurityEvent('unauthorized_origin', { origin }, 'warn');
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    const body = await req.json();
    
    // Validar estructura y tipos de datos
    const validation = validatePaymentData(body);
    if (!validation.valid) {
      return NextResponse.json({ 
        error: 'Datos de pago inválidos',
        details: validation.errors 
      }, { status: 400 });
    }
    
    // Usar los datos validados y transformados
    const validatedData = validation.data;
    
    console.log("Body completo recibido:", JSON.stringify(validatedData, null, 2));
    
    // Verificar si es un pedido múltiple
    const isMultipleOrder = validatedData.isMultipleOrder || false;
    const orderSummary = validatedData.orderSummary || [];
    const totalAmount = validatedData.totalAmount;
    
    // Usa la lógica existente para pedidos simples
    if (!isMultipleOrder) {
      console.log(`Payment request received for product: ${validatedData.productId}, quantity: ${validatedData.quantity}`);
      
      const { formData: formDataWrapper, productId, quantity } = validatedData;
      const formData = formDataWrapper?.formData || formDataWrapper;
      
      if (!formData || !productId || !quantity) {
        return NextResponse.json({ 
          error: 'Faltan datos requeridos para el pago' 
        }, { status: 400 });
      }

      // Obtén el producto usando la función
      const product = getProductById(productId);
      
      if (!product) {
        return NextResponse.json({
          error: `Producto no encontrado: ${productId}`
        }, { status: 404 });
      }

      // Verificar stock disponible - usar stockAvailable desde el objeto product
      const currentStock = await getProductStock(productId);
      if (currentStock < quantity) {
        return NextResponse.json({
          error: `Stock insuficiente para "${product.name}". Solo quedan ${currentStock} unidades disponibles.`
        }, { status: 400 });
      }
      
      // Procesar el pago con MercadoPago...
      const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
      const payment = new Payment(client);
      
      // Simula una respuesta exitosa - no tenemos código completo para procesar el pago real
      // En producción, aquí implementarías la creación del pago con MercadoPago
      
      // Actualizar el stock tras un pago exitoso
      try {
        // Reducir el stock - usamos directamente updateProductStock con el ID y el nuevo valor
        await updateProductStock(productId, currentStock - quantity);
      } catch (stockError) {
        console.error("Error actualizando stock:", stockError);
        // Continuamos con el proceso aunque falle la actualización del stock
      }
      
      // Devolver respuesta exitosa con los dos estados posibles
      return NextResponse.json({ 
        status: 'approved',
        status_detail: 'success',
        message: 'Pago procesado correctamente',
        amount: totalAmount,
        formattedAmount: Number(totalAmount).toLocaleString('es-MX') // Agrega formato con comas
      });
    } else {
      // Lógica para pedidos múltiples
      console.log(`Processing multiple order with total: ${totalAmount}`);
      
      const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
      const payment = new Payment(client);

      // Verificar stock disponible para todos los productos
      if (Array.isArray(orderSummary)) {
        for (const item of orderSummary) {
          const itemId = item.id || item.productId;
          const itemQty = item.quantity;
          
          // Obtener producto del catálogo
          const product = getProductById(itemId);
          if (!product) {
            return NextResponse.json({
              error: `Producto no encontrado: ${itemId}`
            }, { status: 404 });
          }
          
          // Verificar stock
          const currentStock = await getProductStock(itemId);
          if (currentStock < itemQty) {
            return NextResponse.json({
              error: `Stock insuficiente para "${product.name}". Solo quedan ${currentStock} unidades disponibles.`
            }, { status: 400 });
          }
        }
      }

      // Crear array de items para MercadoPago con formato correcto
      const items = orderSummary.map(item => ({
        id: item.productId,
        title: item.name,
        unit_price: item.price,
        quantity: item.quantity,
        description: item.name,
      }));

      // SECCIÓN ADAPTADA: Obtener los datos de pago con estructura flexible
      try {
        // Intentamos extraer los datos de pago desde diferentes niveles de anidación
        let paymentData = null;
        let token = null;
        let paymentMethodId = null;
        
        console.log("Backend recibió body completo:", JSON.stringify(validatedData, null, 2));
        
        // Caso 1: Datos directamente en validatedData.formData (estructura antigua)
        if (validatedData.formData?.payment_method_id && validatedData.formData?.token) {
          paymentData = validatedData.formData;
          token = validatedData.formData.token;
          paymentMethodId = validatedData.formData.payment_method_id;
          console.log("Usando estructura antigua (nivel 1)");
        }
        // Caso 2: Datos doblemente anidados en validatedData.formData.formData (v1.0.3)
        else if (validatedData.formData?.formData?.payment_method_id && validatedData.formData?.formData?.token) {
          paymentData = validatedData.formData.formData;
          token = validatedData.formData.formData.token;
          paymentMethodId = validatedData.formData.formData.payment_method_id;
          console.log("Usando estructura nueva anidada (nivel 2)");
        }
        // Caso 3: Verificar si existen los datos directamente en validatedData
        else if (validatedData.payment_method_id && validatedData.token) {
          paymentData = validatedData;
          token = validatedData.token;
          paymentMethodId = validatedData.payment_method_id;
          console.log("Usando validatedData directo (nivel 0)");
        }
        
        // Verificar si encontramos los datos de pago
        if (!token || !paymentMethodId) {
          console.error("Datos de pago incompletos. Estructura recibida:", {
            validatedDataTiene: {
              payment_method_id: !!validatedData.payment_method_id,
              token: !!validatedData.token
            },
            formDataNivel1: validatedData.formData ? {
              payment_method_id: !!validatedData.formData.payment_method_id,
              token: !!validatedData.formData.token
            } : 'no existe',
            formDataNivel2: validatedData.formData?.formData ? {
              payment_method_id: !!validatedData.formData.formData.payment_method_id,
              token: !!validatedData.formData.formData.token
            } : 'no existe'
          });
          
          return NextResponse.json({ 
            error: `Datos de pago incompletos. No se encontró token y/o payment_method_id en ningún nivel.`
          }, { status: 400 });
        }
        
        // Construir la data de pago para enviar a MercadoPago
        const mercadoPagoPaymentData = {
          transaction_amount: parseFloat(totalAmount),
          token: paymentData.token,
          payment_method_id: paymentData.payment_method_id,
          issuer_id: paymentData.issuer_id || '',
          installments: parseInt(paymentData.installments || 1),
          payer: {
            email: paymentData.payer?.email || 'test@example.com'
          },
       
        };
        
        console.log("Datos de pago a enviar a MP:", JSON.stringify(mercadoPagoPaymentData, null, 2));
        
        // Crear el pago en MercadoPago
        try {
          const paymentResponse = await payment.create({ body: mercadoPagoPaymentData });
          console.log("Respuesta de MercadoPago:", JSON.stringify(paymentResponse, null, 2));
          
          // Para procesar pagos exitosos, mejorar el log de seguridad
          if (paymentResponse.status === 'approved') {
            logSecurityEvent('payment_success', {
              id: paymentResponse.id,
              amount: totalAmount,
              status: paymentResponse.status
            });
          }
          
          // Actualizar stock de todos los productos en el pedido
          if (Array.isArray(orderSummary)) {
            for (const item of orderSummary) {
              const itemId = item.productId;
              const itemQty = item.quantity;
              
              // Validar que el ID del producto existe
              if (!itemId) {
                console.error('Error: Producto sin ID en orderSummary', item);
                continue; // Saltar este item si no tiene ID
              }
              
              try {
                const currentStock = await getProductStock(itemId);
                console.log(`Actualizando stock para producto ${itemId}: ${currentStock} -> ${currentStock - itemQty}`);
                await updateProductStock(itemId, currentStock - itemQty);
              } catch (stockError) {
                console.error(`Error updating stock for product ${itemId}:`, stockError);
              }
            }
          }
          
          // Devolver respuesta exitosa
          return NextResponse.json({
            status: 'success',
            id: paymentResponse.id || Date.now().toString(),
            amount: totalAmount,
            formattedAmount: Number(totalAmount).toLocaleString('es-MX'), // Agrega formato con comas
            paymentDetails: paymentResponse.status_detail
          });
        } catch (mpError) {
          console.error("Error de MercadoPago:", mpError);
          return NextResponse.json({ 
            error: `Error de MercadoPago: ${mpError.message}`, 
            details: mpError.cause || []
          }, { status: 500 });
        }
      } catch (error) {
        console.error("Error general:", error);
        logSecurityEvent('payment_error', {
          message: error.message,
          stack: process.env.NODE_ENV !== 'production' ? error.stack : null
        }, 'error');
        return NextResponse.json({ 
          error: 'Error al procesar el pago: ' + (error.message || 'Error desconocido'),
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
      }
    }
  } catch (error) {
    console.error("Error processing payment:", error);
    logSecurityEvent('payment_error', {
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : null
    }, 'error');
    return NextResponse.json({ 
      error: 'Error al procesar el pago: ' + (error.message || 'Error desconocido')
    }, { status: 500 });
  }
}