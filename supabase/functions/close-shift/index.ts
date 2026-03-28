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

    // Build HTML email with A4 report styling
    const tableRows = rows.map(r => `<tr>
<td style="padding:8px 12px;border-bottom:1px solid #ddd;color:#000;font-size:14px;text-align:left;">${r.name}</td>
<td style="padding:8px 12px;border-bottom:1px solid #ddd;color:#000;font-size:14px;text-align:center;">${r.qty}</td>
<td style="padding:8px 12px;border-bottom:1px solid #ddd;color:#000;font-size:14px;text-align:right;">&euro;${r.unitPrice.toFixed(2)}</td>
<td style="padding:8px 12px;border-bottom:1px solid #ddd;color:#000;font-size:14px;font-weight:bold;text-align:right;">&euro;${r.total.toFixed(2)}</td>
</tr>`).join('');

    const htmlReport = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:40px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#000;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ddd;">
<div style="background:#f5f5f5;padding:30px;text-align:center;border-bottom:2px solid #4b4b4b;">
<h1 style="margin:0;color:#4b4b4b;font-size:28px;letter-spacing:4px;text-transform:uppercase;">Eagle POS</h1>
<p style="margin:8px 0 0;color:#000;font-size:13px;">Shift Report &mdash; ${dateStr} ${timeStr}</p>
</div>
<div style="padding:24px;">
<table style="width:100%;border-collapse:collapse;">
<thead>
<tr style="border-bottom:2px solid #4b4b4b;">
<th style="padding:10px 12px;text-align:left;color:#4b4b4b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Product</th>
<th style="padding:10px 12px;text-align:center;color:#4b4b4b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Aantal</th>
<th style="padding:10px 12px;text-align:right;color:#4b4b4b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Prijs</th>
<th style="padding:10px 12px;text-align:right;color:#4b4b4b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Subtotaal</th>
</tr>
</thead>
<tbody>
${tableRows}
</tbody>
</table>
<div style="margin-top:20px;padding:16px;background:#f5f5f5;border-radius:8px;border:1px solid #ddd;">
<table style="width:100%;">
<tr>
<td style="color:#000;font-size:14px;text-align:left;">Totaal items:</td>
<td style="color:#000;font-size:14px;text-align:right;font-weight:bold;">${totalItems}</td>
</tr>
<tr>
<td style="color:#000;font-size:20px;font-weight:bold;padding-top:8px;text-align:left;">TOTAAL</td>
<td style="color:#000;font-size:20px;font-weight:bold;text-align:right;padding-top:8px;">&euro;${grandTotal.toFixed(2)}</td>
</tr>
</table>
</div>
</div>
<div style="padding:16px;text-align:center;background:#f5f5f5;border-top:1px solid #ddd;">
<p style="margin:0;color:#4b4b4b;font-size:11px;">Eagle POS System &mdash; Automated Shift Report</p>
</div>
</div>
</body>
</html>`;

    // Send email via SMTP to fixed recipient (manual TLS SMTP)
    const smtpHost = Deno.env.get('SMTP_HOST')!;
    const smtpUser = Deno.env.get('SMTP_USER')!;
    const smtpPass = Deno.env.get('SMTP_PASS')!;
    const recipient = 'michael.roks@icloud.com';

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

    // Archive all active sessions after report
    await supabase
      .from('sessions')
      .update({ status: 'archived' })
      .in('status', ['active', 'paid']);

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
