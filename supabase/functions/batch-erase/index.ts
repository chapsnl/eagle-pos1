import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nfc_uid } = await req.json();
    if (!nfc_uid) {
      return new Response(JSON.stringify({ error: 'nfc_uid required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get active session for this NFC
    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .select('id, drink_logs(id)')
      .eq('nfc_uid', nfc_uid)
      .eq('status', 'active')
      .single();

    if (sessionErr || !session) {
      return new Response(JSON.stringify({ error: 'No active session found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Archive the session
    const { error: updateErr } = await supabase
      .from('sessions')
      .update({ status: 'archived' })
      .eq('id', session.id);

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ 
      success: true, 
      session_id: session.id,
      drink_logs_count: session.drink_logs?.length ?? 0 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
