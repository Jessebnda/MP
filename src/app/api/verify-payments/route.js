import { NextResponse } from 'next/server';
import verifyPayments from '../../../scripts/verify-payments';

export const dynamic = 'force-dynamic'; // No caché para esta API

export async function GET(req) {
  try {
    // Obtener fechas de los parámetros de consulta
    const url = new URL(req.url);
    const startDate = url.searchParams.get('startDate') || getDefaultStartDate();
    const endDate = url.searchParams.get('endDate') || getDefaultEndDate();

    // Ejecutar la verificación
    console.log(`🔍 API: Iniciando verificación desde ${startDate} hasta ${endDate}`);
    const results = await verifyPayments(startDate, endDate);

    // Devolver resultados
    return NextResponse.json({
      success: true,
      startDate,
      endDate,
      results
    });
  } catch (error) {
    console.error('❌ Error en API de verificación:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message 
      },
      { status: 500 }
    );
  }
}

// Función auxiliar para obtener la fecha de inicio por defecto (hace un mes)
function getDefaultStartDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().split('T')[0];
}

// Función auxiliar para obtener la fecha de fin por defecto (hoy)
function getDefaultEndDate() {
  return new Date().toISOString().split('T')[0];
}