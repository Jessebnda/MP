import { NextResponse } from 'next/server';
import { kv, populateProductsFromData, getProductStock } from '../../../lib/kv';
import { products as staticProducts } from '../../../data/products';

// Flag to track initialization
let initialized = false;

export async function GET() {
  console.log('--- HIT /api/products ---');
  console.log('Current staticProducts[0] (Reposado) price from src/data/products.js:', staticProducts.find(p => p.id === '1')?.price);

  try {
    // Initialize products in KV if not already there
    if (!initialized) {
      console.log('Initialization block: initialized is false.');
      const testProduct = await kv.get('product:1');
      console.log('KV check for product:1 (testProduct):', JSON.stringify(testProduct, null, 2));

      if (!testProduct) {
        console.log('testProduct is falsy. Running populateProductsFromData...');
        await populateProductsFromData(staticProducts);
        console.log('populateProductsFromData FINISHED.');
      } else {
        console.log('testProduct is truthy. Skipping populateProductsFromData.');
      }
      initialized = true;
    } else {
      console.log('Initialization block: already initialized.');
    }

    // Fetch products from KV
    const productsFromKV = [];
    console.log('Looping through staticProducts to fetch from KV...');
    for (const sp of staticProducts) {
      console.log(`Loop: staticProduct ID: ${sp.id}, staticPrice: ${sp.price}`);
      
      // Obtener solo el stock de KV
      const stock = await getProductStock(sp.id);
      
      // Usar siempre el producto estático como base
      productsFromKV.push({
        ...sp, // Todos los datos del producto estático
        stockAvailable: stock // Solo actualizar el stock desde KV
      });
      
      console.log(`Loop: Pushed product ${sp.id}. Price used: ${sp.price}, Stock: ${stock}`);
    }
    
    // Only fall back to static if we couldn't get anything from KV
    if (productsFromKV.length === 0 && staticProducts.length > 0) {
      console.log('productsFromKV is empty. Falling back to staticProducts.');
      return NextResponse.json(staticProducts);
    }
    
    console.log('Returning productsFromKV. Reposado price:', productsFromKV.find(p => p.id === '1')?.price);
    return NextResponse.json(productsFromKV);
  } catch (error) {
    console.error('Error in /api/products GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}