import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';

export async function POST(req) {
  try {
    const body = await req.json();
    const { orderSummary, successUrl, pendingUrl, failureUrl } = body;
    
    console.log("Creating preference with URLs:", { successUrl, pendingUrl, failureUrl });
    
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
    
    // Crear la preferencia con URLs completas
    const preferenceData = {
      items,
      back_urls: {
        success: successUrl || "http://localhost:3000/success",
        failure: failureUrl || "http://localhost:3000/failure",
        pending: pendingUrl || "http://localhost:3000/pending"
      }
    };
    
    console.log("Sending preference data to MP:", JSON.stringify(preferenceData, null, 2));
    
    const response = await preference.create({ body: preferenceData });
    
    console.log("MercadoPago preference created:", response.id);
    
    return NextResponse.json({
      preferenceId: response.id,
      totalAmount
    });
  } catch (error) {
    console.error("Error creating preference:", error.message);
    return NextResponse.json({ 
      error: error.message, 
      details: error.cause || []
    }, { status: 500 });
  }
}