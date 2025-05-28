import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializar el cliente de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    // Buscar eventos de webhook recientes en la tabla 'webhook_events'
    const { data, error } = await supabase
      .from('webhook_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(20);
    
    if (error) {
      console.error('Error fetching webhook events:', error);
      return NextResponse.json(
        { error: 'Error al obtener eventos de webhook' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ events: data || [] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}