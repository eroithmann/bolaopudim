import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Phase mapping: our internal enum ↔ football-data.org "stage" values
const PHASE_TO_STAGE: Record<string, string[]> = {
  round_of_32: ["LAST_32"],
  round_of_16: ["LAST_16"],
  quarterfinals: ["QUARTER_FINALS"],
  semifinals: ["SEMI_FINALS"],
  third_place: ["THIRD_PLACE", "THIRD_PLACE_FINAL"],
  final: ["FINAL"],
};

const PHASE_LABEL: Record<string, string> = {
  round_of_32: "32-avos",
  round_of_16: "Oitavas",
  quarterfinals: "Quartas",
  semifinals: "Semifinais",
  third_place: "3º lugar",
  final: "Final",
};

// --- team name matching (same logic used in fetch-match-results) ---
const teamAliases: Record<string, string[]> = {
  "Brasil": ["brazil"],
  "Alemanha": ["germany", "deutschland"],
  "França": ["france"],
  "Espanha": ["spain", "espana"],
  "Inglaterra": ["england"],
  "Holanda": ["netherlands", "holland", "nederland"],
  "Bélgica": ["belgium"],
  "Croácia": ["croatia"],
  "Uruguai": ["uruguay"],
  "Colômbia": ["colombia"],
  "México": ["mexico"],
  "Estados Unidos": ["united states", "usa", "us"],
  "Canadá": ["canada"],
  "Japão": ["japan"],
  "Coreia do Sul": ["south korea", "korea republic", "republic of korea"],
  "Austrália": ["australia"],
  "Arábia Saudita": ["saudi arabia"],
  "Irã": ["iran", "ir iran"],
  "Marrocos": ["morocco"],
  "Senegal": ["senegal"],
  "Gana": ["ghana"],
  "Egito": ["egypt"],
  "Tunísia": ["tunisia"],
  "Tchéquia": ["czechia", "czech republic"],
  "Costa do Marfim": ["ivory coast", "cote d ivoire"],
  "Algeria": ["algeria", "argelia"],
  "South Africa": ["south africa", "rsa"],
  "Cape Verde": ["cape verde", "cabo verde", "cape verde islands"],
  "Suíça": ["switzerland", "suisse"],
  "Áustria": ["austria"],
  "Suécia": ["sweden"],
  "Noruega": ["norway"],
  "Sérvia": ["serbia"],
  "Turquia": ["turkey", "turkiye"],
  "Equador": ["ecuador"],
  "Paraguai": ["paraguay"],
  "Bósnia e Herzegovina": ["bosnia and herzegovina", "bosnia herzegovina", "bosnia"],
  "RD Congo": ["dr congo", "democratic republic of the congo", "congo dr"],
  "Iraque": ["iraq"],
  "Nova Zelândia": ["new zealand"],
  "Catar": ["qatar"],
  "Scotland": ["scotland"],
  "Haiti": ["haiti"],
  "Panamá": ["panama"],
  "Curacao": ["curacao"],
  "Jordan": ["jordan"],
  "Uzbekistan": ["uzbekistan"],
};

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,'`’\-&]/g, " ")
    .replace(/\b(fc|cf|sc|afc|sk|ac|cd)\b/g, "")
    .replace(/\b(islands?|republic|national|team|of|the|and|y|e|do|da|de|dos|das)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSubset(a: string, b: string): boolean {
  const at = a.split(" ").filter(Boolean);
  const bt = new Set(b.split(" ").filter(Boolean));
  if (at.length === 0 || bt.size === 0) return false;
  return at.every((t) => bt.has(t));
}

function matchesTeamName(dbName: string, dbCode: string | null, apiName: string): boolean {
  const a = normalize(apiName);
  const d = normalize(dbName);
  if (!a || !d) return false;
  if (a === d) return true;
  const aliases = (teamAliases[dbName] ?? []).map(normalize);
  for (const al of aliases) {
    if (!al) continue;
    if (al === a) return true;
    if (tokenSubset(al, a) || tokenSubset(a, al)) return true;
  }
  if (tokenSubset(d, a) || tokenSubset(a, d)) return true;
  if (dbCode) {
    const code = dbCode.toLowerCase();
    if (a.split(" ").includes(code)) return true;
  }
  return false;
}

function findTeam(teams: any[], apiName: string) {
  return teams.find((t) => matchesTeamName(t.name, t.code, apiName)) ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const phase: string = body.phase;

    if (!phase || !PHASE_TO_STAGE[phase]) {
      return new Response(JSON.stringify({
        error: `Parâmetro 'phase' inválido. Use: ${Object.keys(PHASE_TO_STAGE).join(", ")}`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = Deno.env.get("FOOTBALL_DATA_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ error: "FOOTBALL_DATA_TOKEN não configurado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const stages = PHASE_TO_STAGE[phase];
    // Try each stage label until one returns matches (football-data sometimes
    // uses different keys across competitions/seasons).
    let apiMatches: any[] = [];
    let lastStatus = 0;
    let lastBody = "";
    for (const stage of stages) {
      const url = `https://api.football-data.org/v4/competitions/WC/matches?stage=${stage}`;
      console.log(`GET ${url}`);
      const res = await fetch(url, { headers: { "X-Auth-Token": token } });
      lastStatus = res.status;
      if (!res.ok) {
        lastBody = await res.text();
        console.warn(`API ${res.status}: ${lastBody.slice(0, 200)}`);
        if (res.status === 429 || res.status === 403) {
          return new Response(JSON.stringify({
            error: "Quota da API externa esgotada ou acesso negado.",
            status: res.status,
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        continue;
      }
      const data = await res.json();
      apiMatches = data.matches ?? [];
      if (apiMatches.length > 0) break;
    }

    console.log(`API returned ${apiMatches.length} fixtures for phase=${phase}`);

    if (apiMatches.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        phase,
        phase_label: PHASE_LABEL[phase],
        created: 0,
        updated: 0,
        skipped_finished: 0,
        unmatched: [],
        message: `Nenhum confronto de ${PHASE_LABEL[phase]} disponível ainda na API.`,
        api_status: lastStatus,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load teams + existing matches for this phase
    const { data: teams } = await supabase.from("teams").select("id, name, code, group_name");
    const { data: existing } = await supabase
      .from("matches")
      .select("id, home_team_id, away_team_id, phase, status, match_date, venue")
      .eq("phase", phase);

    const existingByPair = new Map<string, any>();
    for (const m of existing ?? []) {
      existingByPair.set(`${m.home_team_id}|${m.away_team_id}`, m);
    }

    let created = 0;
    let updated = 0;
    let skippedFinished = 0;
    const unmatched: string[] = [];
    const skippedPlaceholders: { raw: string; date: string | null }[] = [];
    const toInsert: any[] = [];

    // ---- Detecta placeholder (Winner Match X, TBD, W47, L23, Runner-up A, etc.) ----
    const PLACEHOLDER_RE = /\b(tbd|winner|loser|runner[- ]?up|w\d+|l\d+|group\s+[a-l]|match\s+\d+)\b/i;
    const isPlaceholder = (name: string) =>
      !name || !name.trim() || PLACEHOLDER_RE.test(name);

    // ---- Fallback: free-api-live-football-data (RAPIDAPI) para resolver placeholders ----
    const RAPID_HOST = "free-api-live-football-data.p.rapidapi.com";
    const RAPID_KEY = Deno.env.get("RAPIDAPI_KEY");
    const rapidByDate: Record<string, any[]> = {};
    async function rapidFixtures(dateStr: string): Promise<any[]> {
      if (!RAPID_KEY) return [];
      if (rapidByDate[dateStr]) return rapidByDate[dateStr];
      try {
        const res = await fetch(`https://${RAPID_HOST}/football-get-matches-by-date?date=${dateStr}`, {
          headers: { "X-RapidAPI-Key": RAPID_KEY, "X-RapidAPI-Host": RAPID_HOST },
        });
        if (!res.ok) {
          console.warn(`rapid ${dateStr}: ${res.status}`);
          rapidByDate[dateStr] = [];
          return [];
        }
        const j = await res.json();
        const list = j?.response?.matches || j?.response || j?.matches || (Array.isArray(j) ? j : []);
        rapidByDate[dateStr] = Array.isArray(list) ? list : [];
      } catch (e) {
        console.warn(`rapid ${dateStr} err`, e);
        rapidByDate[dateStr] = [];
      }
      return rapidByDate[dateStr];
    }
    const ymd = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
    const shift = (iso: string, d: number) => {
      const dt = new Date(iso);
      dt.setUTCDate(dt.getUTCDate() + d);
      return dt.toISOString();
    };

    async function resolvePlaceholder(utcDate: string | null): Promise<{ home: string; away: string; fxTimeIso?: string } | null> {
      if (!utcDate) return null;
      const target = new Date(utcDate).getTime();
      const candidates: any[] = [];
      for (const d of [utcDate, shift(utcDate, 1), shift(utcDate, -1)]) {
        candidates.push(...(await rapidFixtures(ymd(d))));
      }
      // Match by ±90min tolerance to the fixture's UTC start
      let best: any = null;
      let bestDelta = Infinity;
      for (const f of candidates) {
        const t = f?.time || f?.utcDate || f?.date || f?.startTime || f?.status?.utcTime || f?.status?.startAt;
        let ts: number | null = null;
        if (typeof t === "number") ts = t < 1e12 ? t * 1000 : t;
        else if (typeof t === "string") { const p = Date.parse(t); if (!isNaN(p)) ts = p; }
        if (ts == null) continue;
        const delta = Math.abs(ts - target);
        if (delta > 90 * 60 * 1000) continue;
        const league = (f?.leagueName || f?.league?.name || f?.tournament?.name || "").toString().toLowerCase();
        if (league && !/(world cup|copa do mundo|mundial|fifa)/i.test(league)) continue;
        if (delta < bestDelta) { best = f; bestDelta = delta; }
      }
      if (!best) return null;
      const home = best?.home?.name || best?.homeTeam?.name || best?.teams?.home?.name || best?.home_team || "";
      const away = best?.away?.name || best?.awayTeam?.name || best?.teams?.away?.name || best?.away_team || "";
      if (!home || !away) return null;
      return { home, away };
    }

    for (const m of apiMatches) {
      let homeName = m.homeTeam?.name ?? "";
      let awayName = m.awayTeam?.name ?? "";
      const utcDate = m.utcDate ?? null;
      const rawLabel = `${homeName || "?"} vs ${awayName || "?"}`;

      // Se placeholder, tenta resolver via RapidAPI
      if (isPlaceholder(homeName) || isPlaceholder(awayName)) {
        console.log(`⏳ placeholder detectado: ${rawLabel} @ ${utcDate} — tentando fallback`);
        const resolved = await resolvePlaceholder(utcDate);
        if (resolved) {
          console.log(`   ✓ resolvido para: ${resolved.home} vs ${resolved.away}`);
          homeName = resolved.home;
          awayName = resolved.away;
        } else {
          console.log(`   ✗ não resolvido`);
          skippedPlaceholders.push({ raw: rawLabel, date: utcDate });
          continue;
        }
      }

      const home = findTeam(teams ?? [], homeName);
      const away = findTeam(teams ?? [], awayName);
      if (!home || !away) {
        unmatched.push(`${homeName} vs ${awayName}`);
        console.log(`❌ não casou: ${homeName} vs ${awayName}`);
        continue;
      }

      const pair = `${home.id}|${away.id}`;
      const reversePair = `${away.id}|${home.id}`;
      const existingMatch = existingByPair.get(pair) ?? existingByPair.get(reversePair);
      const venue = m.venue ?? null;
      const matchDate = utcDate;
      const apiFixtureId = m.id ?? null;

      if (existingMatch) {
        if (existingMatch.status === "finished") {
          skippedFinished++;
          continue;
        }
        const updates: any = {};
        if (matchDate && matchDate !== existingMatch.match_date) updates.match_date = matchDate;
        if (venue && venue !== existingMatch.venue) updates.venue = venue;
        if (apiFixtureId) updates.api_fixture_id = apiFixtureId;
        if (Object.keys(updates).length > 0) {
          const { error } = await supabase.from("matches").update(updates).eq("id", existingMatch.id);
          if (error) console.error("update error", error);
          else updated++;
        }
      } else {
        toInsert.push({
          phase,
          match_date: matchDate,
          venue,
          home_team_id: home.id,
          away_team_id: away.id,
          status: "scheduled",
          api_fixture_id: apiFixtureId,
        });
      }
    }

    if (toInsert.length > 0) {
      const { data: inserted, error } = await supabase.from("matches").insert(toInsert).select("id");
      if (error) {
        console.error("insert error", error);
        return new Response(JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      created = inserted?.length ?? 0;
    }

    return new Response(JSON.stringify({
      success: true,
      phase,
      phase_label: PHASE_LABEL[phase],
      created,
      updated,
      skipped_finished: skippedFinished,
      unmatched,
      api_total: apiMatches.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Error:", msg);
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
