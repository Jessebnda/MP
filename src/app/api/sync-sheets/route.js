import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { supabaseAdmin } from '../../../lib/supabase';
import { logInfo, logError } from '../../../utils/logger';

export async function GET(request) {
  try {
    // Verificar si hay alguna clave API para protección básica
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('key');
    
    if (process.env.SYNC_API_KEY && apiKey !== process.env.SYNC_API_KEY) {
      return NextResponse.json({ 
        success: false, 
        error: 'API key inválida' 
      }, { status: 401 });
    }

    const result = await syncOrdersToGoogleSheets();
    
    return NextResponse.json({ 
      success: result.success, 
      message: result.message,
      details: result.details 
    });
  } catch (error) {
    logError('Error en API de sincronización:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

async function syncOrdersToGoogleSheets() {
  try {
    logInfo('Iniciando sincronización con Google Sheets');
    
    // 1. Obtener datos de Supabase
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        customers(id, first_name, last_name, email, phone, identification_type, identification_number),
        customer_addresses(street_name, street_number, zip_code, city, state, country),
        order_items(product_id, quantity, price, subtotal)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw new Error(`Error obteniendo pedidos: ${error.message}`);
    
    if (!orders || orders.length === 0) {
      logInfo('No hay pedidos para sincronizar');
      return { success: true, message: 'No hay pedidos para sincronizar' };
    }
    
    logInfo(`Sincronizando ${orders.length} pedidos`);
    
    // 2. Configurar autenticación de Google Sheets
    const credentials = {
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
    };

    if (!credentials.private_key || !credentials.client_email) {
      throw new Error('Credenciales de Google API no configuradas');
    }

    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });
    
    // 3. Obtener ID de la hoja desde la URL
    const spreadsheetIdMatch = process.env.SHEETS_URL?.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const spreadsheetId = spreadsheetIdMatch?.[1] || process.env.SHEETS_ID;
    
    if (!spreadsheetId) {
      throw new Error('URL o ID de Google Sheets no configurado');
    }
    
    // 4. Verificar y preparar encabezados en la hoja
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Clientes!1:1',
    });
    
    let headers = headerResponse.data.values?.[0] || [];
    
    // Definir los encabezados requeridos
    const requiredHeaders = [
      'ID Cliente', 'Fecha', 'Nombre', 'Apellido', 'Email', 'Teléfono', 
      'Tipo Documento', 'Número Documento', 'Calle', 'Número', 'Código Postal',
      'Ciudad', 'Estado', 'País', 'Total', 'Estado Pago', 'Estado Envío', 'Notas Envío', 'Version'
    ];
    
    // Verificar si necesitamos actualizar los encabezados
    let needHeaderUpdate = false;
    
    for (const header of requiredHeaders) {
      if (!headers.includes(header)) {
        needHeaderUpdate = true;
        headers.push(header);
      }
    }
    
    if (needHeaderUpdate) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Clientes!1:1',
        valueInputOption: 'RAW',
        resource: { values: [headers] }
      });
      
      logInfo('Encabezados actualizados en Google Sheets');
    }
    
    // 5. Obtener todos los datos existentes para comparar
    const existingDataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Clientes!A:A', // Solo necesitamos la columna de IDs para comparar
    });
    
    const existingIds = (existingDataResponse.data.values || [])
      .slice(1) // Omitir encabezados
      .map(row => row[0]);
    
    // 6. Preparar datos para Google Sheets
    const ordersToSync = [];
    const ordersToUpdate = [];
    
    for (const order of orders) {
      const customer = order.customers || {};
      const address = order.customer_addresses?.[0] || {};
      
      const rowData = [
        order.id,
        new Date(order.created_at).toLocaleDateString('es-MX'),
        customer.first_name || '',
        customer.last_name || '',
        customer.email || '',
        customer.phone || '',
        customer.identification_type || '',
        customer.identification_number || '',
        address.street_name || '',
        address.street_number || '',
        address.zip_code || '',
        address.city || '',
        address.state || '',
        address.country || '',
        order.total_amount || '0',
        order.payment_status || 'pending',
        order.shipment_status || 'pending',
        order.shipment_notes || '',
        order.version || '1'
      ];
      
      // Determinar si es un nuevo registro o una actualización
      if (existingIds.includes(order.id)) {
        // Es una actualización - necesitamos encontrar su posición exacta
        const rowIndex = existingIds.indexOf(order.id) + 2; // +2 porque los índices empiezan en 1 y hay que saltar la fila de encabezados
        ordersToUpdate.push({
          range: `Clientes!A${rowIndex}:${columnToLetter(rowData.length)}${rowIndex}`,
          values: [rowData]
        });
      } else {
        // Es un nuevo registro
        ordersToSync.push(rowData);
      }
    }
    
    // 7. Insertar nuevos registros (al final de la hoja)
    if (ordersToSync.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Clientes!A:A',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: ordersToSync }
      });
      
      logInfo(`${ordersToSync.length} nuevos pedidos sincronizados con Google Sheets`);
    }
    
    // 8. Actualizar registros existentes
    if (ordersToUpdate.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: {
          valueInputOption: 'RAW',
          data: ordersToUpdate
        }
      });
      
      logInfo(`${ordersToUpdate.length} pedidos actualizados en Google Sheets`);
    }
    
    // 9. Sincronizar de Google Sheets a Supabase (opcional)
    await syncSheetChangesBackToSupabase(sheets, spreadsheetId);
    
    return { 
      success: true, 
      message: `Sincronización completada: ${ordersToSync.length} nuevos, ${ordersToUpdate.length} actualizados`,
      details: {
        nuevos: ordersToSync.length,
        actualizados: ordersToUpdate.length
      }
    };
    
  } catch (error) {
    logError('Error sincronizando con Google Sheets:', error);
    return { success: false, error: error.message };
  }
}

async function syncSheetChangesBackToSupabase(sheets, spreadsheetId) {
  try {
    // Obtener filas con actualizaciones de estado desde la hoja
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Clientes!A2:S', // Todos los datos sin los encabezados
    });
    
    const rows = response.data.values || [];
    if (!rows.length) return { success: true, message: 'No hay datos para sincronizar de vuelta' };
    
    // Mapear columnas
    const headerRow = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Clientes!1:1',
    });
    
    const headers = headerRow.data.values?.[0] || [];
    const idIndex = headers.indexOf('ID Cliente');
    const statusIndex = headers.indexOf('Estado Envío');
    const notesIndex = headers.indexOf('Notas Envío');
    const versionIndex = headers.indexOf('Version');
    
    if (idIndex === -1 || statusIndex === -1) return;
    
    let updateCount = 0;
    
    for (const row of rows) {
      if (row.length <= idIndex || row.length <= statusIndex) continue;
      
      const orderId = row[idIndex];
      const status = row[statusIndex];
      const notes = notesIndex !== -1 && row.length > notesIndex ? row[notesIndex] : '';
      let version = 1;
      
      if (versionIndex !== -1 && row.length > versionIndex && row[versionIndex]) {
        version = parseInt(row[versionIndex], 10) || 1;
      }
      
      // Verificar si hay cambios en la base de datos
      const { data, error } = await supabaseAdmin
        .from('orders')
        .select('id, shipment_status, shipment_notes, version')
        .eq('id', orderId)
        .single();
      
      if (error || !data) continue;
      
      // Si hay diferencias, actualizar en Supabase
      if (data.shipment_status !== status || 
          data.shipment_notes !== notes || 
          data.version !== version) {
        
        const { error: updateError } = await supabaseAdmin
          .from('orders')
          .update({
            shipment_status: status,
            shipment_notes: notes,
            version: version,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);
        
        if (!updateError) {
          updateCount++;
          logInfo(`Pedido ${orderId} actualizado desde Google Sheets a Supabase`);
        }
      }
    }
    
    return { success: true, updateCount };
  } catch (error) {
    logError('Error sincronizando desde Google Sheets a Supabase:', error);
    return { success: false, error: error.message };
  }
}

function columnToLetter(column) {
  let temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter || 'A';
}