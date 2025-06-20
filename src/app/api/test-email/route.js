import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { logInfo, logError } from '../../../utils/logger';

export async function GET(req) {
  const results = {
    configCheck: false,
    transporterCreated: false,
    emailSent: false,
    errors: []
  };
  
  try {
    // 1. Verificar configuración
    const emailConfig = {
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    };
    
    logInfo('📧 Configuración de correo:', {
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      user: emailConfig.auth.user,
      passwordLength: emailConfig.auth.pass?.length || 0,
    });
    
    if (!emailConfig.auth.user || !emailConfig.auth.pass) {
      throw new Error('Credenciales de correo no configuradas');
    }
    
    results.configCheck = true;
    
    // 2. Crear transporter
    const transporter = nodemailer.createTransport(emailConfig);
    results.transporterCreated = true;
    
    // 3. Verificar conexión
    await transporter.verify();
    logInfo('✅ Conexión con servidor de correo verificada');
    
    // 4. Enviar correo de prueba
    const mailOptions = {
      from: `"Test Altura Divina" <${process.env.EMAIL_USER}>`,
      to: process.env.LOGISTICS_EMAIL, // Usar el email de logística como destinatario
      subject: `Correo de prueba ${new Date().toISOString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <h2>Prueba de envío de correo</h2>
          <p>Este es un correo de prueba enviado a las ${new Date().toLocaleTimeString()}.</p>
          <p>Si estás viendo este correo, la configuración es correcta.</p>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    results.emailSent = true;
    
    logInfo('📤 Correo de prueba enviado:', {
      messageId: info.messageId,
      response: info.response
    });
    
    return NextResponse.json({
      success: true,
      message: 'Correo de prueba enviado correctamente',
      info: {
        messageId: info.messageId,
        testEmailSentTo: process.env.LOGISTICS_EMAIL,
        timestamp: new Date().toISOString()
      },
      diagnostics: results
    });
    
  } catch (error) {
    logError('❌ Error enviando correo de prueba:', error);
    results.errors.push(error.message);
    
    return NextResponse.json({
      success: false,
      message: `Error al enviar correo de prueba: ${error.message}`,
      diagnostics: results
    }, { status: 500 });
  }
}