import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { getProductById } from '../../../data/products';

export async function POST(req) {
  try {
    
    // Desestructurar también las URLs personalizadas
    const { productId, quantity, successUrl, pendingUrl, failureUrl } = await req.json();
    
    // Validación básica
    if (!productId || !quantity) {
      return NextResponse.json({ error: 'Faltan datos del producto' }, { status: 400 });
    }
    
    // Validación de seguridad: formato de productId
    if (typeof productId !== 'string' || !productId.match(/^[a-z0-9-]+$/)) {
      return NextResponse.json({ error: 'Formato de ID de producto inválido' }, { status: 400 });
    }
    
    // Validación de seguridad: cantidad
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1 || qty > 100) {
      return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 });
    }
    
    // Obtener datos del producto desde el catálogo centralizado
    const product = getProductById(productId);
    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }
    
    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
    });
    const preference = new Preference(client);

    // Define la moneda según el país de la cuenta MercadoPago
    const CURRENCY_ID = process.env.MERCADOPAGO_CURRENCY || 'USD';

    const resp = await preference.create({
      body: {
        items: [
          { 
            id: product.id,
            title: product.name,
            description: product.description,
            unit_price: product.price, 
            quantity: qty,
            currency_id: CURRENCY_ID,
            category_id: product.category || 'general'
          },
        ],
        notification_url: `${process.env.HOST_URL}/api/webhook`,
        back_urls: {
          success: successUrl || process.env.REDIRECT_URL_APPROVED || `${process.env.HOST_URL}/confirmation`,
          failure: failureUrl || process.env.REDIRECT_URL_REJECTED || `${process.env.HOST_URL}/error`,
          pending: pendingUrl || process.env.REDIRECT_URL_PENDING || `${process.env.HOST_URL}/pending`,
        },
        auto_return: 'approved',
        metadata: {
          product_id: product.id,
          quantity: qty
        }
      },
    });
    
    return NextResponse.json({ preferenceId: resp.id });
    
  } catch (e) {
    console.error('Error creando preferencia:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}