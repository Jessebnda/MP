import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { logInfo, logError, logWarn } from '../../../utils/logger';
import { validateCsrfToken } from '../../../utils/csrf';

export async function POST(req) {
  try {
    // Validar origen
    const origin = req.headers.get('origin') || '';
    const referer = req.headers.get('referer') || '';
    
    const allowedOrigins = [
      'https://alturadivina.com',
      'https://www.alturadivina.com',
      'https://framer.com',
      'https://mercadopagoiframe.vercel.app',
      'http://localhost:3000'
    ];
    
    const isAllowedOrigin = allowedOrigins.some(allowed => 
      origin.includes(allowed) || referer.includes(allowed)
    );
    
    if (!isAllowedOrigin && process.env.NODE_ENV === 'production') {
      logSecurityEvent('invalid_preference_origin', { origin, referer });
      return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 });
    }
    
    const body = await req.json();
    const { orderSummary, successUrl, pendingUrl, failureUrl, payer } = body;

    // Validar las URLs de retorno
    if (!successUrl || !pendingUrl || !failureUrl) {
      return NextResponse.json(
        { error: 'URLs de retorno no definidas' },
        { status: 400 }
      );
    }

    // Asegurar que las URLs sean absolutas (pero ya deben venir así del frontend)
    const finalSuccessUrl = successUrl;
    const finalPendingUrl = pendingUrl;
    const finalFailureUrl = failureUrl;

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

    // Agregar envíos a preferenceData si se proporcionan
    if (body.shipments && body.shipments.receiver_address) {
      preferenceData.shipments = {
        mode: body.shipments.mode || "custom",
        cost: body.shipments.cost || 0,
        local_pickup: body.shipments.local_pickup || false,
        receiver_address: {
          zip_code: body.shipments.receiver_address.zip_code,
          street_name: body.shipments.receiver_address.street_name,
          street_number: body.shipments.receiver_address.street_number,
          city_name: body.shipments.receiver_address.city_name,
          state_name: body.shipments.receiver_address.state_name || "",
          country_name: body.shipments.receiver_address.country_name || "México"
        }
      };
    }

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