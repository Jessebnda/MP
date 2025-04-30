import { NextResponse } from 'next/server';
import { kv } from '../../../lib/kv';
import { products as staticProducts } from '../../../data/products';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// IMPORTANTE: Clave secreta para autorizar las peticiones desde Google Sheets
const API_SECRET_KEY = process.env.SHEETS_API_SECRET;

// Información de la hoja de cálculo
const SPREADSHEET_ID = "1FSXyB6QjepDO9SgcWmb-9HwQKSEFJNHlGJQr2LW5JiQ"; // Reemplaza con tu ID real
const SHEET_CREDENTIALS = {
  client_email: "altura-divina-sheets@divinaaltura.iam.gserviceaccount.com", // Reemplaza con tu email
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwgg...", // Reemplaza con tu clave privada
};

export async function POST(req) {
  try {
    const body = await req.json();
    
    // Verificar la clave secreta
    if (body.secretKey !== API_SECRET_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Clave de API inválida'
      }, { status: 401 });
    }
    
    // Procesar acción según el tipo
    switch (body.action) {
      case 'fetch':
        const data = await fetchData();
        return NextResponse.json(data);
        
      case 'update_stock':
        if (!body.updates || !Array.isArray(body.updates)) {
          return NextResponse.json({
            success: false,
            error: 'Formato de datos inválido para actualización de stock'
          }, { status: 400 });
        }
        const stockResult = await updateStock(body.updates);
        return NextResponse.json(stockResult);
        
      case 'update_products':
        if (!body.products || !Array.isArray(body.products)) {
          return NextResponse.json({
            success: false,
            error: 'Formato de datos inválido para actualización de productos'
          }, { status: 400 });
        }
        const productsResult = await updateProducts(body.products);
        return NextResponse.json(productsResult);
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Acción no reconocida'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Error en la sincronización con Sheets:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error del servidor' 
    }, { status: 500 });
  }
}

// Obtiene todos los productos y su stock actual
async function fetchData() {
  try {
    // Obtener las claves de productos y stock
    const productKeys = await kv.keys('product:*');
    const stockKeys = await kv.keys('product:*:stock');
    
    // Si no hay productos, usar los datos estáticos
    let products;
    if (!productKeys || productKeys.length === 0) {
      products = staticProducts;
    } else {
      // Obtener los datos de productos desde KV
      const productValues = await kv.mget(...productKeys);
      products = productValues.filter(p => p !== null);
    }
    
    // Obtener datos de stock
    const stock = {};
    if (stockKeys && stockKeys.length > 0) {
      const stockValues = await kv.mget(...stockKeys);
      
      // Construir objeto de stock
      stockKeys.forEach((key, index) => {
        // Extraer ID del formato 'stock:ID'
        const id = key.split(':')[1];
        stock[id] = stockValues[index];
      });
    }
    
    return {
      success: true,
      products: products,
      stock: stock
    };
    
  } catch (error) {
    console.error('Error obteniendo datos para Google Sheets:', error);
    throw error;
  }
}

// Actualiza el stock de productos
async function updateStock(updates) {
  if (!updates || !Array.isArray(updates)) {
    return { success: false, error: 'Formato de actualizaciones inválido' };
  }
  
  const results = {};
  
  try {
    // Procesar cada actualización
    for (const update of updates) {
      if (!update.id || typeof update.change !== 'number') {
        results[update.id || 'unknown'] = 'Error: datos inválidos';
        continue;
      }
      
      const stockKey = `product:${update.id}:stock`;
      
      // Obtener stock actual
      let currentStock = await kv.get(stockKey) || 0;
      
      // Calcular nuevo stock (incremento/decremento según el valor)
      const newStock = currentStock + update.change;
      
      // No permitir stock negativo (opcional)
      const finalStock = Math.max(0, newStock);
      
      // Actualizar en KV
      await kv.set(stockKey, finalStock);
      
      // Guardar resultado
      results[update.id] = finalStock;
    }
    
    return {
      success: true,
      results: results
    };
    
  } catch (error) {
    console.error('Error actualizando stock desde Google Sheets:', error);
    throw error;
  }
}

// Actualiza información de productos
async function updateProducts(products) {
  if (!products || !Array.isArray(products)) {
    return { success: false, error: 'Formato de productos inválido' };
  }
  
  const results = {};
  
  try {
    // Procesar cada producto
    for (const product of products) {
      if (!product.id || !product.name || typeof product.price !== 'number') {
        results[product.id || 'unknown'] = 'Error: datos inválidos';
        continue;
      }
      
      const productKey = `product:${product.id}`;
      
      // Actualizar en KV
      await kv.set(productKey, {
        id: product.id,
        name: product.name,
        description: product.description || '',
        price: product.price,
        category: product.category || 'general'
      });
      
      // Guardar resultado
      results[product.id] = 'Actualizado';
    }
    
    return {
      success: true,
      results: results
    };
    
  } catch (error) {
    console.error('Error actualizando productos desde Google Sheets:', error);
    throw error;
  }
}

// Función para conectar con la hoja de Google
async function connectToSheet() {
  try {
    const jwt = new JWT({
      email: SHEET_CREDENTIALS.client_email,
      key: SHEET_CREDENTIALS.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, jwt);
    await doc.loadInfo();
    return doc;
  } catch (error) {
    console.error('Error conectando a Google Sheets:', error);
    throw new Error('No se pudo conectar a Google Sheets');
  }
}