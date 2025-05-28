import nodemailer from 'nodemailer';
import { logInfo, logError, logWarn } from '../utils/logger';

// Crear el transporter de nodemailer con mejor manejo de errores
let transporter;
try {
  const emailConfig = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    // Mostrar más logs de debug
    logger: true,
    debug: true
  };
  
  // Verificar configuración
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    throw new Error('Credenciales de email no configuradas en variables de entorno');
  }
  
  transporter = nodemailer.createTransport(emailConfig);
  logInfo('📧 Transporter de correo inicializado correctamente', {
    host: emailConfig.host,
    user: emailConfig.auth.user,
  });
} catch (error) {
  logError('❌ Error al crear transporter de email:', error);
  // Crear un transporter nulo que registre mensajes pero no envíe realmente
  transporter = {
    sendMail: async (options) => {
      logError('❓ Intento de enviar email con transporter fallido:', options);
      return { messageId: 'error', success: false };
    }
  };
}

/**
 * Envía un correo con el recibo de compra
 * @param {Object} options - Opciones de envío
 * @param {Buffer} options.pdfBuffer - Buffer del PDF a adjuntar
 * @param {String} options.customerEmail - Email del cliente
 * @param {String} options.orderId - ID de la orden
 * @param {Boolean} options.isApproved - Si el pago está aprobado
 * @param {Object} options.orderData - Datos de la orden completa
 * @returns {Promise} - Promesa con el resultado del envío
 */
export async function sendReceiptEmail({ 
  pdfBuffer, 
  customerEmail, 
  orderId, 
  isApproved = false,
  orderData = {} 
}) {
  // Log del inicio del intento
  logInfo(`📧 Iniciando envío de correo para orden: ${orderId}`, {
    to: customerEmail,
    isApproved
  });
  
  try {
    // Validaciones básicas
    if (!pdfBuffer) {
      throw new Error('Se requiere PDF para enviar el correo');
    }
    
    if (!customerEmail) {
      throw new Error('Se requiere email del cliente');
    }
    
    // Verificar configuración de email
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      throw new Error('Configuración de email incompleta. Verifica EMAIL_USER y EMAIL_PASSWORD en .env.local');
    }
    
    const logisticsEmail = process.env.LOGISTICS_EMAIL;
    if (!logisticsEmail) {
      logWarn('⚠️ Email de logística no configurado, solo se enviará al cliente');
    }
    
    // Email para el cliente
    const customerMailOptions = {
      from: `"Altura Divina" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: `${isApproved ? 'Confirmación' : 'Registro'} de Pedido #${orderId}`,
      html: getCustomerEmailTemplate({ 
        orderId, 
        isApproved, 
        customerName: `${orderData.userData?.first_name || ''} ${orderData.userData?.last_name || ''}`.trim() || 'Cliente'
      }),
      attachments: [{
        filename: `Pedido-${orderId}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    };

    // Enviar email al cliente con mejor logging
    try {
      logInfo('📤 Enviando correo al cliente...', customerMailOptions.to);
      
      // Verificar conexión antes de enviar
      await transporter.verify();
      
      const customerResult = await transporter.sendMail(customerMailOptions);
      logInfo(`✅ Email enviado al cliente: ${customerEmail}`, {
        messageId: customerResult.messageId,
        response: customerResult.response || "Sin respuesta"
      });
    } catch (emailError) {
      logError(`❌ Error enviando email al cliente ${customerEmail}:`, emailError);
      // Fallar silenciosamente para no interrumpir el flujo principal
    }

    // Email para el equipo de logística - solo si tenemos la configuración
    if (logisticsEmail) {
      const logisticsMailOptions = {
        from: `"Sistema Altura Divina" <${process.env.EMAIL_USER}>`,
        to: logisticsEmail,
        subject: `Nuevo Pedido #${orderId} - ${isApproved ? 'PAGO CONFIRMADO' : 'Pendiente'}`,
        html: getLogisticsEmailTemplate({ 
          orderId, 
          isApproved,
          orderData
        }),
        attachments: [{
          filename: `Pedido-${orderId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }]
      };

      // Enviar email al equipo de logística con mejor logging
      try {
        logInfo('📤 Enviando correo a logística...', logisticsEmail);
        const logisticsResult = await transporter.sendMail(logisticsMailOptions);
        logInfo(`✅ Email enviado a logística: ${logisticsEmail}`, {
          messageId: logisticsResult.messageId,
          response: logisticsResult.response || "Sin respuesta"
        });
      } catch (emailError) {
        logError(`❌ Error enviando email a logística ${logisticsEmail}:`, emailError);
      }
    }

    return { success: true };
  } catch (error) {
    logError('❌ Error general en servicio de email:', error);
    return { success: false, error: error.message };
  }
}

// Template para el email del cliente
function getCustomerEmailTemplate({ orderId, isApproved, customerName }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="https://alturadivina.com/logo.png" alt="Altura Divina" style="max-width: 150px;">
      </div>
      
      <h2 style="color: #333; text-align: center;">
        ${isApproved ? '¡Tu compra ha sido confirmada!' : 'Hemos recibido tu pedido'}
      </h2>
      
      <p style="color: #666;">Hola ${customerName},</p>
      
      <p style="color: #666;">
        ${isApproved 
          ? 'Tu pago ha sido aprobado y estamos procesando tu pedido.' 
          : 'Hemos registrado tu pedido y estamos a la espera de la confirmación de pago.'}
      </p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 0; color: #333;"><strong>Número de pedido:</strong> ${orderId}</p>
      </div>
      
      <p style="color: #666;">
        Adjuntamos el recibo con los detalles de tu compra. Por favor guárdalo para cualquier consulta futura.
      </p>
      
      ${isApproved ? `
      <p style="color: #666;">
        Te notificaremos cuando tu pedido haya sido enviado.
      </p>
      ` : `
      <p style="color: #666;">
        Te notificaremos cuando recibamos la confirmación de tu pago.
      </p>
      `}
      
      <p style="color: #666;">
        Si tienes alguna pregunta, no dudes en contactarnos a <a href="mailto:ventas@alturadivina.com">ventas@alturadivina.com</a>
      </p>
      
      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea;">
        <p style="color: #999; font-size: 12px;">
          &copy; ${new Date().getFullYear()} Altura Divina. Todos los derechos reservados.
        </p>
      </div>
    </div>
  `;
}

// Template para el email de logística
function getLogisticsEmailTemplate({ orderId, isApproved, orderData }) {
  // Extraer datos relevantes de la orden
  const customer = orderData.userData || {};
  const address = customer.address || {};
  const items = orderData.items || [];
  
  // Formatear productos para el email
  const productsHtml = items.map(item => 
    `<tr>
      <td style="padding: 8px; border-bottom: 1px solid #eaeaea;">${item.name || `Producto #${item.product_id}`}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eaeaea; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eaeaea; text-align: right;">$${Number(item.price).toFixed(2)}</td>
    </tr>`
  ).join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
      <h2 style="color: #333;">
        ${isApproved 
          ? '🚨 Nuevo pedido confirmado para envío' 
          : '📋 Nuevo pedido registrado (pago pendiente)'}
      </h2>
      
      <div style="background-color: ${isApproved ? '#e9f7ef' : '#f9f9f9'}; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Pedido:</strong> ${orderId}</p>
        <p style="margin: 10px 0 0;"><strong>Estado:</strong> ${isApproved ? 'PAGO CONFIRMADO' : 'Pago pendiente'}</p>
      </div>
      
      <h3 style="color: #555;">Datos del cliente</h3>
      <p><strong>Nombre:</strong> ${customer.first_name || ''} ${customer.last_name || ''}</p>
      <p><strong>Email:</strong> ${customer.email || 'No disponible'}</p>
      <p><strong>Teléfono:</strong> ${customer.phone || 'No disponible'}</p>
      
      <h3 style="color: #555;">Dirección de envío</h3>
      <p>
        ${address.street_name || ''} ${address.street_number || ''}<br>
        ${address.zip_code ? `C.P. ${address.zip_code}<br>` : ''}
        ${address.city || ''}, ${address.state || ''}<br>
        ${address.country || 'México'}
      </p>
      
      <h3 style="color: #555;">Productos</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f1f1f1;">
            <th style="padding: 8px; text-align: left;">Producto</th>
            <th style="padding: 8px; text-align: center;">Cant.</th>
            <th style="padding: 8px; text-align: right;">Precio</th>
          </tr>
        </thead>
        <tbody>
          ${productsHtml || '<tr><td colspan="3" style="padding: 8px;">No hay productos en la orden</td></tr>'}
        </tbody>
        <tfoot>
          <tr style="font-weight: bold;">
            <td colspan="2" style="padding: 8px; text-align: right;">Total:</td>
            <td style="padding: 8px; text-align: right;">$${Number(orderData.total_amount || 0).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      
      <p style="margin-top: 30px;">
        El recibo detallado se adjunta en formato PDF.
      </p>
    </div>
  `;
}