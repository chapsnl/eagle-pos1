import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
    const tableRows = rows.map(r => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #333;color:#fff;font-size:14px;">${r.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #333;color:#fff;text-align:center;font-size:14px;">${r.qty}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #333;color:#fff;text-align:right;font-size:14px;">€${r.unitPrice.toFixed(2)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #333;color:#00cc13;text-align:right;font-size:14px;font-weight:bold;">€${r.total.toFixed(2)}</td>
      </tr>
    `).join('');

    const htmlReport = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:40px;background:#1a1a1a;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:600px;margin:0 auto;background:#222;border-radius:12px;overflow:hidden;border:1px solid #333;">
        <div style="background:#111;padding:30px;text-align:center;border-bottom:2px solid #00cc13;">
          <h1 style="margin:0;color:#00cc13;font-size:28px;letter-spacing:4px;text-transform:uppercase;">Eagle POS</h1>
          <p style="margin:8px 0 0;color:#888;font-size:13px;">Shift Report — ${dateStr} ${timeStr}</p>
        </div>
        <div style="padding:24px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:2px solid #00cc13;">
                <th style="padding:10px 12px;text-align:left;color:#00cc13;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Product</th>
                <th style="padding:10px 12px;text-align:center;color:#00cc13;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Aantal</th>
                <th style="padding:10px 12px;text-align:right;color:#00cc13;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Prijs</th>
                <th style="padding:10px 12px;text-align:right;color:#00cc13;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Subtotaal</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div style="margin-top:20px;padding:16px;background:#111;border-radius:8px;border:1px solid #00cc13;">
            <table style="width:100%;">
              <tr>
                <td style="color:#888;font-size:14px;">Totaal items:</td>
                <td style="color:#fff;font-size:14px;text-align:right;font-weight:bold;">${totalItems}</td>
              </tr>
              <tr>
                <td style="color:#00cc13;font-size:20px;font-weight:bold;padding-top:8px;">TOTAAL</td>
                <td style="color:#00cc13;font-size:20px;font-weight:bold;text-align:right;padding-top:8px;">€${grandTotal.toFixed(2)}</td>
              </tr>
            </table>
          </div>
        </div>
        <div style="padding:16px;text-align:center;background:#111;border-top:1px solid #333;">
          <p style="margin:0;color:#555;font-size:11px;">Eagle POS System — Automated Shift Report</p>
        </div>
      </div>
    </body>
    </html>`;

    // Send email via SMTP to fixed recipient (with secure fallback)
    const smtpHost = Deno.env.get('SMTP_HOST')!;
    const smtpUser = Deno.env.get('SMTP_USER')!;
    const smtpPass = Deno.env.get('SMTP_PASS')!;
    const recipient = 'michael.roks@icloud.com';

    const smtpAttempts = [
      {
        label: '465_tls',
        client: new SMTPClient({
          connection: {
            hostname: smtpHost,
            port: 465,
            tls: true,
            auth: { username: smtpUser, password: smtpPass },
          },
        }),
      },
      {
        label: '587_starttls',
        client: new SMTPClient({
          connection: {
            hostname: smtpHost,
            port: 587,
            tls: false,
            auth: { username: smtpUser, password: smtpPass },
          },
        }),
      },
    ];

    const smtpErrors: string[] = [];
    let emailSent = false;

    for (const attempt of smtpAttempts) {
      try {
        await attempt.client.send({
          from: smtpUser,
          to: recipient,
          subject: `Eagle POS Shift Report — ${dateStr} ${timeStr}`,
          content: 'Zie rapport hieronder.',
          html: htmlReport,
        });
        await attempt.client.close();
        emailSent = true;
        break;
      } catch (e: any) {
        smtpErrors.push(`${attempt.label}: ${e?.message || 'unknown error'}`);
        try { await attempt.client.close(); } catch { /* ignore */ }
      }
    }

    if (!emailSent) {
      throw new Error(`SMTP verzending mislukt: ${smtpErrors.join(' | ')}`);
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
