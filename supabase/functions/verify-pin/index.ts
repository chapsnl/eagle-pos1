const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { pin, type } = await req.json()

    if (!pin || typeof pin !== 'string' || !type || !['staff', 'admin'].includes(type)) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const correctPin = type === 'staff'
      ? Deno.env.get('STAFF_PIN') ?? ''
      : Deno.env.get('ADMIN_PIN') ?? ''

    const valid = pin === correctPin

    return new Response(
      JSON.stringify({ valid }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch {
    return new Response(
      JSON.stringify({ valid: false, error: 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
