import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';

export async function POST(req) {
  try {
    console.log("API route: Starting preference creation");
    const body = await req.json();
    const { orderSummary, successUrl, pendingUrl, failureUrl, payer } = body;
    
    console.log("API route received payer:", JSON.stringify(payer, null, 2));
    
    console.log("API route: Received body:", {
      hasOrderSummary: !!orderSummary,
      itemCount: orderSummary?.length,
      successUrl,
      pendingUrl,
      failureUrl,
      hasPayer: !!payer
    });
    
    console.log("Creating preference with URLs:", { successUrl, pendingUrl, failureUrl });
    
    // Validate payer data before sending to Mercado Pago
    let validatedPayer = null;
    if (payer) {
      validatedPayer = {
        email: payer.email || 'cliente@example.com',
        first_name: payer.first_name || '',
        last_name: payer.last_name || ''
      };
      
      // Procesar el teléfono con el formato correcto de objeto con area_code y number
      if (payer.phone) {
        // Si ya viene en formato correcto (objeto con area_code y number)
        if (typeof payer.phone === 'object' && payer.phone.area_code && payer.phone.number) {
          validatedPayer.phone = {
            area_code: String(payer.phone.area_code),
            number: String(payer.phone.number)
          };
          console.log("Usando formato de teléfono existente:", validatedPayer.phone);
        } 
        // Si viene como string, intentar parsear
        else if (typeof payer.phone === 'string') {
          const phoneStr = payer.phone.replace(/\D/g, '');
          
          if (phoneStr.length >= 3) {
            // Asumimos que los primeros 2-3 dígitos son el código de área
            // y el resto es el número (esto es un ejemplo, ajustar según necesidad)
            const areaCode = phoneStr.substring(0, 2);
            const number = phoneStr.substring(2);
            
            validatedPayer.phone = {
              area_code: areaCode,
              number: number
            };
            console.log("Teléfono parseado correctamente:", validatedPayer.phone);
          } else {
            console.log("Teléfono demasiado corto para parsear, omitiendo");
          }
        } else {
          console.log("Formato de teléfono no reconocido, omitiendo");
        }
      }
      
      // Add identification if present
      if (payer.identification && payer.identification.type && payer.identification.number) {
        validatedPayer.identification = {
          type: payer.identification.type,
          number: payer.identification.number
        };
      }
      
      // Add address if present
      if (payer.address && payer.address.street_name) {
        validatedPayer.address = {
          street_name: payer.address.street_name
        };
        
        // Only add these fields if they are present
        if (typeof payer.address.street_number === 'number') {
          validatedPayer.address.street_number = payer.address.street_number;
        }
        
        if (payer.address.zip_code) {
          validatedPayer.address.zip_code = payer.address.zip_code;
        }
        
        if (payer.address.city) {
          validatedPayer.address.city = payer.address.city;
        }
      }
      
      console.log("Validated payer data:", validatedPayer);
    }
    
    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const preference = new Preference(client);

    // Crear items para la preferencia
    const items = orderSummary.map(item => ({
      id: item.productId.toString(),
      title: item.name || "Producto",
      description: item.name || "Producto",
      unit_price: Number(item.price),
      quantity: Number(item.quantity),
      currency_id: "MXN"
    }));
    
    // Calcular el total
    const totalAmount = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    
    // Crear la preferencia con URLs completas y datos del comprador
    const preferenceData = {
      items,
      back_urls: {
        success: successUrl || "http://localhost:3000/success",
        failure: failureUrl || "http://localhost:3000/failure",
        pending: pendingUrl || "http://localhost:3000/pending"
      },
      // Add payer data if available
      ...(validatedPayer ? { payer: validatedPayer } : {})
    };
    
    console.log("Sending to Mercado Pago:", JSON.stringify(preferenceData, null, 2));
    
    const response = await preference.create({ body: preferenceData });
    
    console.log("MercadoPago preference created:", response.id);
    
    console.log("API route: Returning successful response");
    return NextResponse.json({
      preferenceId: response.id,
      totalAmount
    });
  } catch (error) {
    console.error("API route error:", error);
    return NextResponse.json({ 
      error: error.message, 
      details: error.cause || [],
      stack: error.stack
    }, { status: 500 });
  }
}