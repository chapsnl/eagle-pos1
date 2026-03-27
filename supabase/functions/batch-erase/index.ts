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
    const { nfc_uid, wardrobe_number } = await req.json();
    if (!nfc_uid && !wardrobe_number) {
      return new Response(JSON.stringify({ error: 'nfc_uid or wardrobe_number required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Build query to find sessions by nfc_uid OR wardrobe_number
    let query = supabase
      .from('sessions')
      .select('id')
      .eq('status', 'active');

    const orConditions: string[] = [];
    if (nfc_uid) orConditions.push(`nfc_uid.eq.${nfc_uid}`);
    if (wardrobe_number) {
      // Match any wardrobe_number containing the coat/bag patterns
      const wn = wardrobe_number.replace(/[CB]/g, '');
      orConditions.push(`wardrobe_number.like.%C${wn}%`);
      orConditions.push(`wardrobe_number.like.%B${wn}%`);
      orConditions.push(`wardrobe_number.eq.${wardrobe_number}`);
    }

    if (orConditions.length > 0) {
      query = query.or(orConditions.join(','));
    }

    const { data: sessions, error: sessionErr } = await query;
    if (sessionErr) throw sessionErr;

    // Also check paid sessions
    let queryPaid = supabase
      .from('sessions')
      .select('id')
      .eq('status', 'paid');

    if (orConditions.length > 0) {
      queryPaid = queryPaid.or(orConditions.join(','));
    }

    const { data: paidSessions } = await queryPaid;

    const allSessions = [...(sessions || []), ...(paidSessions || [])];

    if (allSessions.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No sessions found, tag cleared' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sessionIds = allSessions.map((s) => s.id);

    // Delete all drink_logs for these sessions
    const { count: drinkLogsCount } = await supabase
      .from('drink_logs')
      .delete()
      .in('session_id', sessionIds);

    const deletedCount = drinkLogsCount ?? 0;

    // Archive all sessions for this tag
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
