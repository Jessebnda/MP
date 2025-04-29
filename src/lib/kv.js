import { kv as vercelKV } from '@vercel/kv';export const kv = vercelKV;export async function getProductStock(productId) {  try {    const stock = await kv.get(`product:${productId}:stock`);    return stock !== null ? stock : null;  } catch (error) {    console.error('Error obteniendo stock:', error);    return null;  }}

export async function updateProductStock(productId, newStock) {
  try {
    await kv.set(`product:${productId}:stock`, newStock);
    return true;
  } catch (error) {
    console.error('Error actualizando stock:', error);
    return false;
  }
}