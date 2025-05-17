import { NextResponse } from 'next/server';
import { kv } from '../../lib/kv';
import { logInfo, logError } from '../../lib/logger';

/**
 * API para manejar operaciones del carrito
 * Esta API centraliza la lógica del carrito y permite
 * que los componentes Framer se comuniquen con ella
 */

// Obtener el estado actual del carrito
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Se requiere un sessionId' }, 
        { status: 400 }
      );
    }
    
    // Obtener el carrito de KV storage o del localStorage fallback
    const cartKey = `cart:${sessionId}`;
    let cart = await kv.get(cartKey);
    
    // Si no hay carrito en KV, devolver uno vacío
    if (!cart) {
      cart = {
        items: [],
        totalItems: 0,
        totalAmount: 0,
        sessionId,
        updatedAt: new Date().toISOString()
      };
    }
    
    return NextResponse.json({ success: true, cart });
  } catch (error) {
    logError('Error al obtener el carrito:', error);
    return NextResponse.json(
      { error: 'Error al obtener el carrito' }, 
      { status: 500 }
    );
  }
}

// Actualizar el carrito (añadir, eliminar, actualizar)
export async function POST(request) {
  try {
    const { sessionId, action, product, productId, quantity } = await request.json();
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Se requiere un sessionId' },
        { status: 400 }
      );
    }
    
    // Obtener el carrito actual
    const cartKey = `cart:${sessionId}`;
    let cart = await kv.get(cartKey) || {
      items: [],
      totalItems: 0,
      totalAmount: 0,
    };
    
    // Procesar la acción
    switch (action) {
      case 'add':
        if (!product) {
          return NextResponse.json(
            { error: 'Se requiere un producto para añadir al carrito' },
            { status: 400 }
          );
        }
        
        // Verificar si el producto ya existe en el carrito
        const existingItemIndex = cart.items.findIndex(
          item => item.productId === product.productId
        );
        
        if (existingItemIndex >= 0) {
          // Actualizar cantidad si ya existe
          cart.items[existingItemIndex].quantity += (quantity || 1);
        } else {
          // Agregar nuevo producto
          cart.items.push({
            ...product,
            quantity: quantity || 1
          });
        }
        break;
        
      case 'update':
        if (!productId || quantity === undefined) {
          return NextResponse.json(
            { error: 'Se requieren productId y quantity para actualizar' },
            { status: 400 }
          );
        }
        
        // Si la cantidad es cero o negativa, eliminar el producto
        if (quantity <= 0) {
          cart.items = cart.items.filter(item => item.productId !== productId);
        } else {
          // Actualizar cantidad
          const itemIndex = cart.items.findIndex(item => item.productId === productId);
          if (itemIndex >= 0) {
            cart.items[itemIndex].quantity = quantity;
          }
        }
        break;
        
      case 'remove':
        if (!productId) {
          return NextResponse.json(
            { error: 'Se requiere un productId para eliminar' },
            { status: 400 }
          );
        }
        
        cart.items = cart.items.filter(item => item.productId !== productId);
        break;
        
      case 'clear':
        cart.items = [];
        break;
        
      default:
        return NextResponse.json(
          { error: 'Acción no válida. Use add, update, remove o clear' },
          { status: 400 }
        );
    }
    
    // Recalcular totales
    cart.totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);
    cart.totalAmount = cart.items.reduce(
      (total, item) => total + (item.price * item.quantity), 0
    );
    
    // Guardar en KV
    cart.updatedAt = new Date().toISOString();
    await kv.set(cartKey, cart, { ex: 60 * 60 * 24 * 7 }); // Expirar en 1 semana
    
    // Notificar al cliente que escucha eventos
    logInfo(`Carrito actualizado para sesión ${sessionId}`);
    
    return NextResponse.json({
      success: true,
      cart,
    });
  } catch (error) {
    logError('Error al actualizar el carrito:', error);
    return NextResponse.json(
      { error: 'Error al actualizar el carrito' },
      { status: 500 }
    );
  }
}
