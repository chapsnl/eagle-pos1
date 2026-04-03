import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function readSmtpResponse(conn: Deno.Conn): Promise<string> {
  const decoder = new TextDecoder();
  const buf = new Uint8Array(2048);
  let response = '';

  while (true) {
    const n = await conn.read(buf);
    if (n === null) break;

    response += decoder.decode(buf.subarray(0, n));
    const lines = response.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) continue;

    const lastLine = lines[lines.length - 1];
    if (/^\d{3} /.test(lastLine)) break;
  }

  return response;
}

async function sendSmtpCommand(
  conn: Deno.Conn,
  command: string,
  expectedCodes: number[]
): Promise<string> {
  const encoder = new TextEncoder();
  await conn.write(encoder.encode(`${command}\r\n`));
  const response = await readSmtpResponse(conn);
  const code = Number(response.slice(0, 3));

  if (!expectedCodes.includes(code)) {
    throw new Error(`SMTP command failed (${command}): ${response.trim()}`);
  }

  return response;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all drink_logs with product info for active+paid sessions
    const { data: logs, error: logsErr } = await supabase
      .from('drink_logs')
      .select('price_at_time, products(full_name, shorthand, price), session_id, sessions!inner(status)')
      .in('sessions.status', ['active', 'paid']);

    if (logsErr) throw logsErr;

    // Aggregate per product
    const agg: Record<string, { name: string; shorthand: string; qty: number; unitPrice: number; total: number }> = {};
    for (const log of (logs || [])) {
      const product = (log as any).products;
      const key = product?.shorthand || 'unknown';
      if (!agg[key]) {
        agg[key] = {
          name: product?.full_name || key,
          shorthand: key,
          qty: 0,
          unitPrice: Number(product?.price || log.price_at_time || 0),
          total: 0,
        };
      }
      agg[key].qty++;
      agg[key].total += Number(log.price_at_time);
    }

    const rows = Object.values(agg).sort((a, b) => a.name.localeCompare(b.name));
    const grandTotal = rows.reduce((s, r) => s + r.total, 0);
    const totalItems = rows.reduce((s, r) => s + r.qty, 0);
    const now = new Date();
    const dateStr = now.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

    // Build HTML email with clean, consistent styling
    const tableRows = rows.map((r, i) => `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
        <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#1a1a1a;font-size:14px;text-align:left;">${r.name}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#1a1a1a;font-size:14px;text-align:center;">${r.qty}x</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#1a1a1a;font-size:14px;text-align:right;white-space:nowrap;">&euro; ${r.unitPrice.toFixed(2)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#1a1a1a;font-size:14px;font-weight:600;text-align:right;white-space:nowrap;">&euro; ${r.total.toFixed(2)}</td>
      </tr>`).join('');

    const htmlReport = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:32px 16px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;">

  <div style="max-width:560px;margin:0 auto;">

    <!-- Header -->
    <div style="background:#1a1a1a;padding:28px 24px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Shift Rapport</h1>
      <p style="margin:6px 0 0;color:#a1a1aa;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Eagle POS</p>
      <p style="margin:4px 0 0;color:#a1a1aa;font-size:12px;">${dateStr} &nbsp;&bull;&nbsp; ${timeStr}</p>
    </div>

    <!-- Table -->
    <div style="background:#ffffff;padding:0;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:2px solid #e4e4e7;">
            <th style="padding:12px 14px;text-align:left;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Product</th>
            <th style="padding:12px 14px;text-align:center;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Aantal</th>
            <th style="padding:12px 14px;text-align:right;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Stukprijs</th>
            <th style="padding:12px 14px;text-align:right;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Subtotaal</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>

    <!-- Totals -->
    <div style="background:#fafafa;padding:20px 24px;border-top:2px solid #e4e4e7;">
      <table style="width:100%;">
        <tr>
          <td style="color:#71717a;font-size:13px;text-align:left;padding:4px 0;">Totaal aantal items</td>
          <td style="color:#1a1a1a;font-size:13px;text-align:right;font-weight:600;padding:4px 0;" colspan="3">${totalItems}x</td>
        </tr>
        <tr>
          <td style="color:#1a1a1a;font-size:22px;font-weight:700;padding:12px 0 0;text-align:left;">Totaal</td>
          <td style="text-align:right;padding:12px 0 0;" colspan="3">
            <span style="color:#1a1a1a;font-size:22px;font-weight:700;">&euro; ${grandTotal.toFixed(2)}</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:16px 24px;text-align:center;background:#1a1a1a;border-radius:0 0 12px 12px;">
      <p style="margin:0;color:#71717a;font-size:11px;">Eagle POS &mdash; Automatisch gegenereerd shift rapport</p>
    </div>

  </div>

</body>
</html>`;

    // Send email via SMTP to fixed recipient (manual TLS SMTP)
    const smtpHost = Deno.env.get('SMTP_HOST')!;
    const smtpUser = Deno.env.get('SMTP_USER')!;
    const smtpPass = Deno.env.get('SMTP_PASS')!;
    const recipient = 'office@eagleamsterdam.com';

    const conn = await Deno.connectTls({ hostname: smtpHost, port: 465 });
    try {
      const greeting = await readSmtpResponse(conn);
      if (!greeting.startsWith('220')) {
        throw new Error(`SMTP greeting failed: ${greeting.trim()}`);
      }

      await sendSmtpCommand(conn, 'EHLO eagle-pos.local', [250]);
      await sendSmtpCommand(conn, 'AUTH LOGIN', [334]);
      await sendSmtpCommand(conn, btoa(smtpUser), [334]);
      await sendSmtpCommand(conn, btoa(smtpPass), [235]);
      await sendSmtpCommand(conn, `MAIL FROM:<${smtpUser}>`, [250]);
      await sendSmtpCommand(conn, `RCPT TO:<${recipient}>`, [250, 251]);
      await sendSmtpCommand(conn, 'DATA', [354]);

      const boundary = `eagle-pos-${crypto.randomUUID()}`;
      const message = [
        `From: Eagle POS <${smtpUser}>`,
        `To: ${recipient}`,
        `Subject: Eagle POS Shift Report — ${dateStr} ${timeStr}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        `Shift report van ${dateStr} ${timeStr}.`,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        '',
        htmlReport,
        '',
        `--${boundary}--`,
      ].join('\r\n');

      const encoder = new TextEncoder();
      await conn.write(encoder.encode(`${message}\r\n.\r\n`));

      const dataResp = await readSmtpResponse(conn);
      if (!dataResp.startsWith('250')) {
        throw new Error(`SMTP DATA failed: ${dataResp.trim()}`);
      }

      await sendSmtpCommand(conn, 'QUIT', [221]);
    } finally {
      conn.close();
    }

    // Delete all drink_logs first (foreign key dependency)
    await supabase
      .from('drink_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    // Delete all sessions
    await supabase
      .from('sessions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    return new Response(JSON.stringify({ 
      success: true, 
      products: rows.length,
      totalItems,
      grandTotal,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Close shift error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
