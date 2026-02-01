import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    console.log('Google Sheets sync started');
    
    // Use CSV export method - simplest and most reliable
    const sheetId = '1k4pRYDbUMix4Lecfu5tX1B-9JT1pmZweG05OK5lggd8';
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
    
    console.log('Fetching CSV from:', csvUrl);
    const csvResponse = await fetch(csvUrl);
    
    if (!csvResponse.ok) {
      const errorText = await csvResponse.text();
      console.error('CSV fetch error:', csvResponse.status, errorText);
      throw new Error(`Failed to fetch CSV: ${csvResponse.status} - ${errorText}`);
    }

    const csvText = await csvResponse.text();
    console.log('CSV received, length:', csvText.length);
    
    // Parse CSV
    const rows = csvText.split('\n')
      .filter(row => row.trim()) // Remove empty rows
      .map(row => row.split(',').map(cell => cell.trim().replace(/"/g, '')));
    
    console.log('Parsed rows:', rows.length);

    if (rows.length < 2) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No data found in sheet',
        leads: []
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Process data rows (skip header)
    const dataRows = rows.slice(1);
    const leads = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const name = row[0]?.trim() || '';
      const phone = row[1]?.trim() || '';
      const service = row[2]?.trim() || '';
      const address = row[3]?.trim() || '';

      if (name) {
        leads.push({
          name: name,
          phone: phone,
          service: service,
          address: address,
          full_name: name,
          service_interested: service,
          lead_source: 'google_sheet',
          status: 'new',
          google_sheet_row_id: `row_${i + 2}`
        });
      }
    }

    console.log(`Processed ${leads.length} leads`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Successfully processed ${leads.length} leads from Google Sheets`,
      leads: leads,
      total: leads.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
