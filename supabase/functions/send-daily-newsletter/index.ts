// Newsletter diária — envia resumo do dia anterior via Brevo
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const CRON_SECRET_ENV = Deno.env.get("NEWSLETTER_CRON_SECRET");

const APP_URL = "https://bolaopudim.lovable.app";
const SENDER = { name: "TI do Bolão Pudim", email: "eroithmann@icloud.com" };

function yesterdayBRT(): string {
  // "ontem" em BRT (UTC-3): pega "agora em BRT" e subtrai 1 dia
  const nowBrt = new Date(Date.now() - 3 * 3600 * 1000);
  nowBrt.setUTCDate(nowBrt.getUTCDate() - 1);
  return nowBrt.toISOString().slice(0, 10); // YYYY-MM-DD
}

function brtDayRangeUTC(dateStr: string): { startISO: string; endISO: string } {
  // dateStr é um dia em BRT. Janela [00:00 BRT, 24:00 BRT) = [03:00 UTC, 27:00 UTC)
  const start = new Date(`${dateStr}T03:00:00Z`);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

function fmtBRT(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDayBRT(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    weekday: "long",
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

async function buildHtml(supabase: any, dateStr: string, recipientName?: string) {
  const { startISO, endISO } = brtDayRangeUTC(dateStr);

  // Jogos do dia (finalizados)
  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, phase, group_name, match_date, status, home_score, away_score, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)"
    )
    .gte("match_date", startISO)
    .lt("match_date", endISO)
    .eq("status", "finished")
    .order("match_date", { ascending: true });

  const matchList = matches ?? [];
  const matchIds = matchList.map((m: any) => m.id);

  // Top do dia
  let topDay: { name: string; points: number }[] = [];
  if (matchIds.length > 0) {
    const { data: preds } = await supabase
      .from("predictions")
      .select("user_id, points")
      .in("match_id", matchIds)
      .not("points", "is", null);

    const sums = new Map<string, number>();
    for (const p of preds ?? []) {
      sums.set(p.user_id, (sums.get(p.user_id) ?? 0) + (p.points ?? 0));
    }
    const userIds = [...sums.keys()];
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);
      const nameMap = new Map((profs ?? []).map((p: any) => [p.user_id, p.name]));
      topDay = [...sums.entries()]
        .map(([uid, pts]) => ({ name: nameMap.get(uid) ?? "?", points: pts }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 3);
    }
  }

  // Top 3 geral — último snapshot
  const { data: lastSnap } = await supabase
    .from("ranking_snapshots")
    .select("match_date")
    .order("match_date", { ascending: false })
    .limit(1);
  let topOverall: { name: string; points: number; position: number }[] = [];
  if (lastSnap && lastSnap[0]) {
    const { data: snap } = await supabase
      .from("ranking_snapshots")
      .select("user_id, total_points, position")
      .eq("match_date", lastSnap[0].match_date)
      .order("position", { ascending: true })
      .limit(3);
    const ids = (snap ?? []).map((s: any) => s.user_id);
    const { data: profs2 } = await supabase
      .from("profiles")
      .select("user_id, name")
      .in("user_id", ids);
    const nameMap2 = new Map((profs2 ?? []).map((p: any) => [p.user_id, p.name]));
    topOverall = (snap ?? []).map((s: any) => ({
      name: nameMap2.get(s.user_id) ?? "?",
      points: s.total_points,
      position: s.position,
    }));
  }

  // HTML
  const greeting = recipientName ? `Olá, ${escapeHtml(recipientName)}!` : "Olá!";
  const matchesHtml = matchList.length
    ? matchList
        .map(
          (m: any) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;">
            <strong>${escapeHtml(m.home_team?.name ?? "?")}</strong> ${m.home_score} × ${m.away_score} <strong>${escapeHtml(m.away_team?.name ?? "?")}</strong>
            <div style="color:#888;font-size:12px;">${escapeHtml(m.group_name || m.phase)} · ${fmtBRT(m.match_date)}</div>
          </td>
        </tr>`
        )
        .join("")
    : `<tr><td style="padding:12px;color:#888;font-size:14px;">Nenhum jogo finalizado neste dia.</td></tr>`;

  const topDayHtml = topDay.length
    ? topDay
        .map(
          (t, i) =>
            `<tr><td style="padding:6px 12px;font-size:14px;">${i + 1}º <strong>${escapeHtml(t.name)}</strong> — ${t.points} pts</td></tr>`
        )
        .join("")
    : `<tr><td style="padding:8px 12px;color:#888;font-size:14px;">Sem pontuações no dia.</td></tr>`;

  const topOverallHtml = topOverall.length
    ? topOverall
        .map(
          (t) =>
            `<tr><td style="padding:6px 12px;font-size:14px;">${t.position}º <strong>${escapeHtml(t.name)}</strong> — ${t.points} pts</td></tr>`
        )
        .join("")
    : `<tr><td style="padding:8px 12px;color:#888;font-size:14px;">Ranking ainda sem dados.</td></tr>`;

  const subject = `Bolão Pudim — Resumo de ${fmtDayBRT(dateStr)}`;
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#222;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#1a6b3a;padding:20px 24px;color:#fff;">
          <div style="font-size:22px;font-weight:bold;">🏆 Bolão Pudim</div>
          <div style="font-size:13px;opacity:.85;">Resumo de ${fmtDayBRT(dateStr)}</div>
        </td></tr>
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 16px;font-size:15px;">${greeting}</p>
          <p style="margin:0 0 20px;font-size:14px;color:#555;">Veja como foi o dia no bolão:</p>

          <h3 style="margin:20px 0 8px;font-size:16px;color:#1a6b3a;">⚽ Jogos finalizados</h3>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;">${matchesHtml}</table>

          <h3 style="margin:24px 0 8px;font-size:16px;color:#1a6b3a;">🔥 Top do dia</h3>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;">${topDayHtml}</table>

          <h3 style="margin:24px 0 8px;font-size:16px;color:#1a6b3a;">🏅 Top 3 geral</h3>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;">${topOverallHtml}</table>

          <div style="margin:28px 0 8px;text-align:center;">
            <a href="${APP_URL}" style="background:#1a6b3a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold;font-size:14px;display:inline-block;">Abrir o Bolão</a>
          </div>
        </td></tr>
        <tr><td style="padding:16px 24px;background:#fafafa;color:#999;font-size:12px;text-align:center;">
          Você recebe este e-mail porque participa do Bolão Pudim.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, stats: { matches: matchList.length, topDay: topDay.length, topOverall: topOverall.length } };
}

async function sendBrevo(to: { email: string; name?: string }, subject: string, html: string): Promise<{ ok: boolean; status: number; error?: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": BREVO_API_KEY! },
      body: JSON.stringify({ sender: SENDER, to: [to], subject, htmlContent: html }),
    });
    if (res.ok) {
      await res.text();
      return { ok: true, status: res.status };
    }
    const body = await res.text();
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      if (attempt < 2) continue;
    }
    return { ok: false, status: res.status, error: body.slice(0, 200) };
  }
  return { ok: false, status: 0, error: "exhausted" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!BREVO_API_KEY) {
      return new Response(JSON.stringify({ error: "BREVO_API_KEY não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Autorização: cron secret (vault ou env) OU admin JWT
    const cronHeader = req.headers.get("x-cron-secret");
    let authed = false;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (cronHeader) {
      let expected: string | null = CRON_SECRET_ENV ?? null;
      if (!expected) {
        const { data } = await admin.rpc("get_newsletter_cron_secret");
        if (typeof data === "string") expected = data;
      }
      if (expected && cronHeader === expected) authed = true;
    }
    if (!authed) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const userClient = createClient(SUPABASE_URL, ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });
        const token = authHeader.replace("Bearer ", "");
        const { data: claims } = await userClient.auth.getClaims(token);
        if (claims?.claims?.sub) {
          const { data: roleRow } = await admin
            .from("user_roles").select("role").eq("user_id", claims.claims.sub).eq("role", "admin").maybeSingle();
          if (roleRow) authed = true;
        }
      }
    }
    if (!authed) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dateStr: string = body.date || yesterdayBRT();
    const testEmail: string | undefined = body.testEmail;
    const dryRun: boolean = !!body.dryRun;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { subject, html, stats } = await buildHtml(admin, dateStr);

    if (dryRun) {
      return new Response(JSON.stringify({ dryRun: true, date: dateStr, subject, html, stats }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lista de destinatários
    let recipients: { email: string; name?: string }[] = [];
    if (testEmail) {
      recipients = [{ email: testEmail }];
    } else {
      // Lista todos os usuários do auth + nome no profiles
      const { data: profs } = await admin.from("profiles").select("user_id, name");
      const nameMap = new Map((profs ?? []).map((p: any) => [p.user_id, p.name]));
      let page = 1;
      const perPage = 1000;
      while (true) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) break;
        for (const u of data.users) {
          if (u.email) recipients.push({ email: u.email, name: nameMap.get(u.id) ?? undefined });
        }
        if (data.users.length < perPage) break;
        page++;
      }
    }

    let sent = 0, failed = 0;
    const sampleErrors: { status: number; error?: string }[] = [];
    for (const r of recipients) {
      const { subject: subj, html: personalized } = await buildHtml(admin, dateStr, r.name);
      const result = await sendBrevo(r, subj, personalized);
      if (result.ok) sent++;
      else {
        failed++;
        if (sampleErrors.length < 5) sampleErrors.push({ status: result.status, error: result.error });
      }
    }

    console.log(JSON.stringify({ event: "newsletter_send", date: dateStr, recipients: recipients.length, sent, failed }));
    return new Response(JSON.stringify({ date: dateStr, recipients: recipients.length, sent, failed, sampleErrors, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("newsletter_error", err instanceof Error ? err.message : String(err));
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
