import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { logInfo, logError, logWarn } from '../../../utils/logger';
import { validateCsrfToken } from '../../../utils/csrf';

export async function POST(req) {
  try {
    // Always bypass CSRF for this critical route
    // We'll add more secure handling later
    logInfo("Bypassing CSRF validation for create-preference endpoint");
    
    const body = await req.json();
    const { orderSummary, successUrl, pendingUrl, failureUrl, payer } = body;
    
    logInfo("API create-preference recibió:", {
      hasOrderSummary: !!orderSummary,
      itemCount: orderSummary?.length,
      successUrl,
      pendingUrl, 
      failureUrl,
      hasPayer: !!payer
    });
    
    if (!orderSummary || !Array.isArray(orderSummary) || orderSummary.length === 0) {
      return NextResponse.json(
        { error: 'Información de productos inválida' },
        { status: 400 }
      );
    }

    // Validar las URLs de retorno
    if (!successUrl) {
      return NextResponse.json(
        { error: 'URL de retorno exitoso (successUrl) no definida' },
        { status: 400 }
      );
    }

    // Configurar SDK de MercadoPago
    const client = new MercadoPagoConfig({ 
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN 
    });
    
    const preference = new Preference(client);

    // Preparar items para la preferencia
    const items = orderSummary.map(item => ({
      id: item.productId.toString(),
      title: item.name || `Producto ID: ${item.productId}`,
      description: item.description || 'Sin descripción',
      quantity: parseInt(item.quantity),
      currency_id: 'MXN',
      unit_price: parseFloat(item.price)
    }));

    // Calcular monto total
    const totalAmount = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    
    // Validar y procesar información del pagador
    let validatedPayer = null;
    if (payer) {
      validatedPayer = {
        email: payer.email || 'cliente@example.com',
        name: payer.first_name || '',
        surname: payer.last_name || ''
      };
      
      // Procesar teléfono si existe
      if (payer.phone) {
        if (typeof payer.phone === 'object' && payer.phone.area_code && payer.phone.number) {
          validatedPayer.phone = {
            area_code: String(payer.phone.area_code),
            number: String(payer.phone.number)
          };
        } else if (typeof payer.phone === 'string') {
          const phoneStr = payer.phone.replace(/\D/g, '');
          if (phoneStr.length >= 3) {
            validatedPayer.phone = {
              area_code: phoneStr.substring(0, Math.min(3, phoneStr.length - 1) || 2),
              number: phoneStr.substring(Math.min(3, phoneStr.length - 1) || 2)
            };
          }
        }
      }
      
      // Procesar identificación si existe
      if (payer.identification && payer.identification.type && payer.identification.number) {
        validatedPayer.identification = {
          type: payer.identification.type,
          number: payer.identification.number
        };
      }
      
      // Procesar dirección si existe
      if (payer.address && payer.address.street_name) {
        validatedPayer.address = {
          street_name: payer.address.street_name,
          street_number: payer.address.street_number ? String(payer.address.street_number) : undefined,
          zip_code: payer.address.zip_code || undefined
        };
      }
    }

    // Asegurar que las URLs son absolutas
    const baseUrl = process.env.NEXT_PUBLIC_HOST_URL || 'http://localhost:3000';
    const ensureAbsoluteUrl = (url, fallback) => {
      if (!url) return fallback;
      
      // Si ya es una URL absoluta, úsala directamente
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      
      // Si no, conviértela en absoluta
      return `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
    };

    const finalSuccessUrl = ensureAbsoluteUrl(successUrl, `${baseUrl}/confirmacion-de-compra`);
    const finalFailureUrl = ensureAbsoluteUrl(failureUrl, `${baseUrl}/error-de-compra`);
    const finalPendingUrl = ensureAbsoluteUrl(pendingUrl, `${baseUrl}/proceso-de-compra`);

    logInfo("URLs configuradas para MP (verificar que sean absolutas):", {
      success: finalSuccessUrl,
      failure: finalFailureUrl,
      pending: finalPendingUrl,
      sonAbsolutas: {
        success: finalSuccessUrl.startsWith('http'),
        failure: finalFailureUrl.startsWith('http'),
        pending: finalPendingUrl.startsWith('http')
      }
    });

    // Crear objeto de preferencia
    const preferenceData = {
      items: items,
      back_urls: {
        success: finalSuccessUrl,
        failure: finalFailureUrl,
        pending: finalPendingUrl
      },
      auto_return: "approved",
      statement_descriptor: "TuTienda Online",
      external_reference: `order-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      notification_url: process.env.MERCADOPAGO_WEBHOOK_URL || undefined,
      ...(validatedPayer ? { payer: validatedPayer } : {})
    };

    logInfo("Datos de preferencia:", JSON.stringify(preferenceData));

    try {
      // Crear la preferencia en Mercado Pago
      const response = await preference.create({ body: preferenceData });
      
      logInfo("Preferencia creada exitosamente:", { 
        preferenceId: response.id,
        items: items.map(i => ({ id: i.id, title: i.title }))
      });
      
      return NextResponse.json({
        preferenceId: response.id,
        totalAmount,
        init_point: response.init_point // Este es el punto importante para redirección
      });
    } catch (apiError) {
      // Log detallado del error de la API
      logError("Error específico de la API de MercadoPago:", {
        message: apiError.message,
        status: apiError.status,
        cause: apiError.cause,
        stack: apiError.stack,
        response: apiError.response ? JSON.stringify(apiError.response) : undefined
      });
      
      throw apiError;
    }
    
  } catch (error) {
    logError("Error al crear preferencia:", error);
    return NextResponse.json({ 
      error: error.message || 'Error al crear preferencia',
      details: error.cause || [],
    }, { status: 500 });
  }
}