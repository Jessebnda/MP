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
      const kvProduct = await kv.get(`product:${sp.id}`);
      console.log(`Loop: kv.get(\`product:${sp.id}\`) result:`, JSON.stringify(kvProduct, null, 2));
      if (kvProduct) {
        // Get latest stock from KV
        const stock = await getProductStock(sp.id);
        
        productsFromKV.push({
          ...kvProduct, // Spread other details from KV product (like name, description, category if they can change)
          price: sp.price, // ALWAYS use the price from staticProducts
          stockAvailable: stock
        });
        console.log(`Loop: Pushed product ${sp.id}. Price used (from staticProducts): ${sp.price}. KV price was: ${kvProduct.price}`);
      } else {
        // If product not in KV at all, use static product entirely
        console.log(`Loop: Product ${sp.id} NOT found in KV. Using static data including stock.`);
        productsFromKV.push({
          ...sp, // Use all data from static product
          // stockAvailable is already part of sp if defined in products.js
        });
      }
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