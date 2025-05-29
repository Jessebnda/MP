import PDFDocument from 'pdfkit';
import { logInfo, logError } from '../utils/logger';

/**
 * Genera un PDF de recibo de compra con los detalles del pedido
 */
export async function generateReceiptPDF({
  orderId,
  customerData,
  items,
  totalAmount,
  paymentStatus,
  paymentId
}) {
  return new Promise((resolve, reject) => {
    try {
      logInfo(`📄 Generando PDF para orden: ${orderId}`);
      
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        logInfo(`✅ PDF generado exitosamente: ${pdfBuffer.length} bytes`);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);
      
      // Header
      doc.fontSize(20).text('Altura Divina', 50, 50);
      doc.fontSize(16).text('Recibo de Compra', 50, 80);
      
      // Order info
      doc.fontSize(12);
      doc.text(`Pedido: #${orderId}`, 50, 120);
      doc.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, 50, 140);
      doc.text(`Estado: ${paymentStatus === 'approved' ? 'Confirmado' : 'Pendiente'}`, 50, 160);
      
      // Customer info
      doc.text('Datos del Cliente:', 50, 200);
      doc.text(`${customerData.first_name} ${customerData.last_name}`, 50, 220);
      doc.text(`${customerData.email}`, 50, 240);
      doc.text(`${customerData.phone || 'No proporcionado'}`, 50, 260);
      
      // Items
      let y = 300;
      doc.text('Productos:', 50, y);
      y += 20;
      
      items.forEach(item => {
        doc.text(`${item.name} - Cantidad: ${item.quantity} - $${item.price}`, 50, y);
        y += 20;
      });
      
      // Total
      y += 20;
      doc.fontSize(14).text(`Total: $${totalAmount}`, 50, y);
      
      doc.end();
      
    } catch (error) {
      logError(`❌ Error generando PDF para orden ${orderId}:`, error);
      reject(error);
    }
  });
}