import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { guestNumber, printerIp } = await req.json();
    const ip = printerIp || "192.168.178.82";

    const now = new Date();
    const date = now.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Amsterdam" });
    const time = now.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });

    // ESC/POS commands for NT320_W
    const ESC = "\x1B";
    const GS = "\x1D";
    const LF = "\n";
    const INIT = ESC + "@";
    const CENTER = ESC + "a" + "\x01";
    const BOLD_ON = ESC + "E" + "\x01";
    const BOLD_OFF = ESC + "E" + "\x00";
    const DOUBLE_SIZE = GS + "!" + "\x11"; // double width + double height
    const NORMAL_SIZE = GS + "!" + "\x00";
    const CUT = GS + "V" + "\x00";

    const receipt =
      INIT +
      CENTER +
      LF +
      "=============================" + LF +
      DOUBLE_SIZE + BOLD_ON +
      "BETAALD" + LF +
      BOLD_OFF + NORMAL_SIZE +
      "=============================" + LF +
      LF +
      BOLD_ON + `Gast: ${guestNumber}` + LF + BOLD_OFF +
      `${date} - ${time}` + LF +
      LF +
      "=============================" + LF +
      LF + LF + LF +
      CUT;

    // Try common ESC/POS printer ports
    const ports = [9100, 9101, 80];
    let printed = false;
    let lastError = "";

    for (const port of ports) {
      try {
        const conn = await Deno.connect({ hostname: ip, port, transport: "tcp" });
        const encoder = new TextEncoder();
        await conn.write(encoder.encode(receipt));
        conn.close();
        printed = true;
        break;
      } catch (e) {
        lastError = `Port ${port}: ${e.message}`;
      }
    }

    if (!printed) {
      return new Response(JSON.stringify({ success: false, error: lastError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
