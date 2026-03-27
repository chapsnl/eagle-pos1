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

    // Get all active sessions for this NFC
    const { data: sessions, error: sessionErr } = await supabase
      .from('sessions')
      .select('id')
      .eq('nfc_uid', nfc_uid)
      .eq('status', 'active');

    if (sessionErr) throw sessionErr;

    if (!sessions || sessions.length === 0) {
      return new Response(JSON.stringify({ error: 'No active session found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sessionIds = sessions.map((s) => s.id);

    // Delete all drink_logs for these sessions
    const { count: drinkLogsCount } = await supabase
      .from('drink_logs')
      .delete()
      .in('session_id', sessionIds);

    // Also count for response (already deleted above, use count from delete)
    const deletedCount = drinkLogsCount ?? 0;

    // Archive all active sessions for this tag
    const { error: updateErr } = await supabase
      .from('sessions')
      .update({ status: 'archived', total_amount: 0 })
      .in('id', sessionIds);

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ 
      success: true, 
      archived_session_ids: sessionIds,
      archived_sessions_count: sessionIds.length,
      drink_logs_deleted: deletedCount 
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
