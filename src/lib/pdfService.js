import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { logInfo, logError } from '../utils/logger';

/**
 * Genera un PDF de recibo de compra con los detalles del pedido
 */
export async function generateReceiptPDF(order, customer) {
  try {
    // Crear un nuevo documento PDF
    const pdfDoc = await PDFDocument.create();
    // Cambiar const page a let page para permitir reasignación
    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    
    // Obtener fuentes
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Dimensiones
    const { width, height } = page.getSize();
    const margin = 50;
    let y = height - margin;
    const lineHeight = 25;
    
    // Cabecera
    page.drawText('ALTURA DIVINA - RECIBO DE COMPRA', {
      x: margin,
      y,
      size: 16,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });
    
    y -= lineHeight * 2;
    
    // Fecha y número de orden
    const orderDate = new Date(order.created_at || Date.now()).toLocaleDateString('es-MX');
    page.drawText(`Fecha: ${orderDate}`, {
      x: margin,
      y,
      size: 10,
      font: helvetica,
    });
    
    y -= lineHeight;
    
    page.drawText(`Orden #: ${order.id}`, {
      x: margin,
      y,
      size: 10,
      font: helvetica,
    });
    
    y -= lineHeight;
    
    if (order.payment_id) {
      page.drawText(`ID de Pago: ${order.payment_id}`, {
        x: margin,
        y,
        size: 10,
        font: helvetica,
      });
      y -= lineHeight;
    }
    
    page.drawText(`Estado: ${getStatusText(order.payment_status)}`, {
      x: margin,
      y,
      size: 10,
      font: helveticaBold,
      color: order.payment_status === 'approved' ? rgb(0, 0.5, 0) : rgb(0, 0, 0),
    });
    
    y -= lineHeight * 1.5;
    
    // Información del cliente
    page.drawText('INFORMACIÓN DEL CLIENTE', {
      x: margin,
      y,
      size: 12,
      font: helveticaBold,
    });
    
    y -= lineHeight;
    
    page.drawText(`Nombre: ${customer.first_name} ${customer.last_name}`, {
      x: margin,
      y,
      size: 10,
      font: helvetica,
    });
    
    y -= lineHeight;
    
    page.drawText(`Email: ${customer.email}`, {
      x: margin,
      y,
      size: 10,
      font: helvetica,
    });
    
    y -= lineHeight;
    
    if (customer.phone) {
      page.drawText(`Teléfono: ${customer.phone}`, {
        x: margin,
        y,
        size: 10,
        font: helvetica,
      });
      y -= lineHeight;
    }
    
    if (customer.identification?.type && customer.identification?.number) {
      page.drawText(`${customer.identification.type}: ${customer.identification.number}`, {
        x: margin,
        y,
        size: 10,
        font: helvetica,
      });
      y -= lineHeight;
    }
    
    y -= lineHeight;
    
    // Dirección de envío si existe
    if (customer.address) {
      page.drawText('DIRECCIÓN DE ENVÍO', {
        x: margin,
        y,
        size: 12,
        font: helveticaBold,
      });
      
      y -= lineHeight;
      
      const address = [
        `${customer.address.street_name} ${customer.address.street_number || ''}`,
        customer.address.zip_code ? `C.P. ${customer.address.zip_code}` : '',
        customer.address.city || '',
        customer.address.state || '',
        customer.address.country || 'México'
      ].filter(Boolean).join(', ');
      
      page.drawText(`Dirección: ${address}`, {
        x: margin,
        y,
        size: 10,
        font: helvetica,
        maxWidth: width - (margin * 2),
      });
      
      y -= lineHeight * 2;
    }
    
    // Detalles de producto
    page.drawText('PRODUCTOS ADQUIRIDOS', {
      x: margin,
      y,
      size: 12,
      font: helveticaBold,
    });
    
    y -= lineHeight;
    
    // Encabezados de tabla
    const col1 = margin;
    const col2 = margin + 240;
    const col3 = margin + 320;
    const col4 = margin + 400;
    
    page.drawText('Producto', {
      x: col1,
      y,
      size: 10,
      font: helveticaBold,
    });
    
    page.drawText('Cant.', {
      x: col2,
      y,
      size: 10,
      font: helveticaBold,
    });
    
    page.drawText('Precio', {
      x: col3,
      y,
      size: 10,
      font: helveticaBold,
    });
    
    page.drawText('Subtotal', {
      x: col4,
      y,
      size: 10,
      font: helveticaBold,
    });
    
    y -= lineHeight;
    
    // Línea separadora
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });
    
    y -= lineHeight;
    
    // Productos
    if (order.items && Array.isArray(order.items) && order.items.length > 0) {
      for (const item of order.items) {
        // Verificar que hay suficiente espacio en la página actual
        if (y < margin + 100) {
          // Crear nueva página
          page = pdfDoc.addPage([595.28, 841.89]);
          y = height - margin;
        }
        
        page.drawText(truncateText(item.name || `Producto #${item.product_id}`, 40), {
          x: col1,
          y,
          size: 10,
          font: helvetica,
          maxWidth: 230,
        });
        
        page.drawText(`${item.quantity}`, {
          x: col2,
          y,
          size: 10,
          font: helvetica,
        });
        
        page.drawText(`$${formatPrice(item.price)}`, {
          x: col3,
          y,
          size: 10,
          font: helvetica,
        });
        
        page.drawText(`$${formatPrice(item.price * item.quantity)}`, {
          x: col4,
          y,
          size: 10,
          font: helvetica,
        });
        
        y -= lineHeight;
      }
    } else {
      page.drawText('No hay productos en esta orden', {
        x: col1,
        y,
        size: 10,
        font: helvetica,
        color: rgb(0.5, 0, 0),
      });
      
      y -= lineHeight;
    }
    
    // Línea separadora
    y -= lineHeight / 2;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });
    
    y -= lineHeight;
    
    // Total
    page.drawText('TOTAL', {
      x: col3,
      y,
      size: 12,
      font: helveticaBold,
    });
    
    page.drawText(`$${formatPrice(order.total_amount)}`, {
      x: col4,
      y,
      size: 12,
      font: helveticaBold,
    });
    
    y -= lineHeight * 2;
    
    // Notas al pie
    page.drawText('Gracias por tu compra. Para cualquier duda, contáctanos al correo ventas@alturadivina.com', {
      x: margin,
      y,
      size: 10,
      font: helvetica,
      color: rgb(0.3, 0.3, 0.3),
    });
    
    // Generar el PDF como bytes
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
    
  } catch (error) {
    logError('Error generando PDF de recibo:', error);
    throw new Error('No se pudo generar el recibo PDF');
  }
}

// Función auxiliar para formatear estados
function getStatusText(status) {
  const statusMap = {
    'approved': 'APROBADO',
    'in_process': 'EN PROCESO',
    'pending': 'PENDIENTE',
    'rejected': 'RECHAZADO',
    'cancelled': 'CANCELADO',
    'refunded': 'REEMBOLSADO',
    'charged_back': 'CONTRACARGO'
  };
  
  return statusMap[status?.toLowerCase()] || status || 'Desconocido';
}

// Función para truncar texto largo
function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Formatear precio con dos decimales
function formatPrice(price) {
  return Number(price).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}