import { NextResponse } from 'next/server';
import { kv, populateProductsFromData, getProductStock } from '../../../lib/kv';
import { products as staticProducts } from '../../../data/products';

// Flag to track initialization
let initialized = false;

export async function GET() {
  try {
    // Initialize products in KV if not already there
    if (!initialized) {
      const testProduct = await kv.get('product:1');
      
      if (!testProduct) {
        console.log('Initializing products in KV from static data...');
        await populateProductsFromData(staticProducts);
      }
      
      initialized = true;
    }
    
    // Fetch products from KV
    const productsFromKV = [];
    
    // Get all products by ID 1-3 (or use a products list from KV if you have many)
    for (const product of staticProducts) {
      const kvProduct = await kv.get(`product:${product.id}`);
      
      if (kvProduct) {
        // Get latest stock from KV
        const stock = await getProductStock(product.id);
        
        productsFromKV.push({
          ...kvProduct,
          stockAvailable: stock
        });
      }
    }
    
    // Only fall back to static if we couldn't get anything from KV
    if (productsFromKV.length === 0) {
      console.log('Falling back to static product data');
      return NextResponse.json(staticProducts);
    }
    
    return NextResponse.json(productsFromKV);
  } catch (error) {
    console.error('Error getting products:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}