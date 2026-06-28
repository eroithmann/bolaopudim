import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_HOST = "free-api-live-football-data.p.rapidapi.com";

// Normalize team name for fuzzy matching
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|cf|sc|afc|club|cd|sad|ud)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Common team aliases (extend as needed)
const aliases: Record<string, string[]> = {
  BRA: ["brazil", "brasil"],
  ARG: ["argentina"],
  URU: ["uruguay", "uruguai"],
  COL: ["colombia"],
  ECU: ["ecuador", "equador"],
  PAR: ["paraguay", "paraguai"],
  PER: ["peru"],
  CHI: ["chile"],
  MEX: ["mexico"],
  USA: ["unitedstates", "usa", "estadosunidos"],
  CAN: ["canada"],
  GER: ["germany", "deutschland", "alemanha"],
  FRA: ["france", "franca"],
  ESP: ["spain", "espana", "espanha"],
  ENG: ["england", "inglaterra"],
  ITA: ["italy", "italia"],
  POR: ["portugal"],
  NED: ["netherlands", "holland", "holanda"],
  BEL: ["belgium", "belgica"],
  CRO: ["croatia", "croacia"],
  JPN: ["japan", "japao"],
  KOR: ["southkorea", "koreareplublic", "korearepublic", "coreiadosul"],
  AUS: ["australia"],
  MAR: ["morocco", "marrocos"],
  SEN: ["senegal"],
  NGA: ["nigeria"],
  GHA: ["ghana", "gana"],
  CMR: ["cameroon", "camaroes"],
  EGY: ["egypt", "egito"],
  TUN: ["tunisia"],
  CIV: ["ivorycoast", "costadomarfim", "cotedivoire"],
  RSA: ["southafrica", "africadosul"],
  CZE: ["czechrepublic", "czechia", "tchequia", "republicatcheca"],
  BIH: ["bosniaandherzegovina", "bosnia", "bosniaeherzegovina", "bosniaherzegovina"],
  QAT: ["qatar", "catar"],
  SUI: ["switzerland", "suica"],
  KSA: ["saudiarabia", "arabiasaudita"],
  TUR: ["turkey", "turkiye", "turquia"],
  NZL: ["newzealand", "novazelandia"],
  IRN: ["iran", "irniran", "ira"],
  NOR: ["norway", "noruega"],
  IRQ: ["iraq", "iraque"],
  SWE: ["sweden", "suecia"],
  SCO: ["scotland", "escocia"],
  HAI: ["haiti"],
  CUW: ["curacao"],
  PAN: ["panama"],
  JOR: ["jordan", "jordania"],
  ALG: ["algeria", "argelia"],
  AUT: ["austria"],
  UZB: ["uzbekistan", "uzbequistao"],
  CPV: ["capeverde", "caboverde", "capeverdeislands"],
  COD: ["drcongo", "rdcongo", "congodr", "drcongo", "democraticrepublicofcongo", "congokinshasa"],
  WAL: ["wales", "paisdegales"],
  UKR: ["ukraine", "ucrania"],
  POL: ["poland", "polonia"],
  DEN: ["denmark", "dinamarca"],
};

function teamCodeFromName(name: string, teamMap: Map<string, { code: string; name: string }>): string | null {
  const norm = normalize(name);
  if (!norm) return null;
  // 1) direct against our team names
  for (const [, t] of teamMap) {
    if (normalize(t.name) === norm) return t.code;
  }
  // 2) alias table: match if fixture name AND one of our team names fall in the same alias group
  for (const [code, names] of Object.entries(aliases)) {
    const group = names.map((n) => normalize(n));
    if (group.includes(norm)) {
      for (const [, t] of teamMap) {
        if (t.code === code || group.includes(normalize(t.name))) return t.code;
      }
    }
  }
  // 3) partial contains (only for longer names, avoids false positives)
  if (norm.length >= 5) {
    for (const [, t] of teamMap) {
      const tn = normalize(t.name);
      if (tn.length >= 5 && (norm.includes(tn) || tn.includes(norm))) return t.code;
    }
  }
  return null;
}

async function apiGet(path: string, key: string) {
  const url = `https://${API_HOST}${path}`;
  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": API_HOST,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`API ${res.status} on ${path}: ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${path}: ${text.slice(0, 200)}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const refresh = url.searchParams.get("refresh") === "true";
  const debug = url.searchParams.get("debug");

  // Debug helpers (temporary)
  if (debug) {
    const key = Deno.env.get("RAPIDAPI_KEY")!;
    try {
      if (debug === "fixtures") {
        const date = url.searchParams.get("date")!;
        const fx = await apiGet(`/football-get-matches-by-date?date=${date}`, key);
        const list: any[] =
          fx?.response?.matches || fx?.response || fx?.matches || (Array.isArray(fx) ? fx : []);
        const names = list.map((f: any) => ({
          id: f?.id || f?.eventId || f?.fixtureId,
          home: f?.home?.name || f?.homeTeam?.name || f?.teams?.home?.name || f?.home_team,
          away: f?.away?.name || f?.awayTeam?.name || f?.teams?.away?.name || f?.away_team,
          league: f?.leagueName || f?.league?.name || f?.tournament?.name,
        }));
        return new Response(JSON.stringify(names), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (debug === "odds") {
        const eventId = url.searchParams.get("eventid")!;
        const od = await apiGet(`/football-event-odds?eventid=${eventId}`, key);
        return new Response(JSON.stringify(od).slice(0, 8000), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Default mode: serve odds from cache (zero external calls)
  if (!refresh) {
    const { data } = await supabase
      .from("odds_cache")
      .select("match_id, home_odds, draw_odds, away_odds, bookmaker");
    const oddsMap: Record<string, any> = {};
    (data || []).forEach((r) => {
      oddsMap[r.match_id] = {
        home: r.home_odds ? Number(r.home_odds) : null,
        draw: r.draw_odds ? Number(r.draw_odds) : null,
        away: r.away_odds ? Number(r.away_odds) : null,
        bookmaker: r.bookmaker,
      };
    });
    return new Response(JSON.stringify({ odds: oddsMap, source: "cache" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Refresh mode: fetch from RapidAPI and upsert cache
  const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
  if (!RAPIDAPI_KEY) {
    return new Response(JSON.stringify({ error: "RAPIDAPI_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ============ Try The Odds API first ============
  const ODDS_API_KEY = Deno.env.get("ODDS_API_KEY");
  if (ODDS_API_KEY) {
    const odLogs: string[] = [];
    try {
      const inTenDays = new Date(Date.now() + 10 * 86400 * 1000).toISOString();
      const [{ data: matches }, { data: teams }] = await Promise.all([
        supabase
          .from("matches")
          .select("id, match_date, home_team_id, away_team_id")
          .eq("status", "scheduled")
          .lte("match_date", inTenDays)
          .order("match_date", { ascending: true }),
        supabase.from("teams").select("id, name, code"),
      ]);

      const teamById = new Map((teams || []).map((t: any) => [t.id, { code: t.code, name: t.name }]));

      // Try multiple sport keys (knockout fixtures may live under different keys)
      const sportKeys = [
        "soccer_fifa_world_cup",
        "soccer_fifa_world_cup_2026",
      ];
      let events: any[] = [];
      let usedKey = "";
      let lastErr = "";
      for (const sportKey of sportKeys) {
        const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?regions=eu,uk,us&markets=h2h&oddsFormat=decimal&apiKey=${ODDS_API_KEY}`;
        const res = await fetch(oddsUrl);
        const txt = await res.text();
        if (!res.ok) {
          lastErr = `${sportKey} -> ${res.status}: ${txt.slice(0, 160)}`;
          odLogs.push(lastErr);
          continue;
        }
        try {
          const parsed = JSON.parse(txt);
          if (Array.isArray(parsed) && parsed.length > 0) {
            events = parsed;
            usedKey = sportKey;
            odLogs.push(`${sportKey}: ${parsed.length} eventos`);
            break;
          } else {
            odLogs.push(`${sportKey}: 0 eventos`);
          }
        } catch (e: any) {
          odLogs.push(`${sportKey}: JSON parse fail`);
        }
      }
      if (events.length === 0) {
        throw new Error(`the-odds-api sem eventos. ${lastErr || odLogs.join(" | ")}`);
      }


      const logs: string[] = [`the-odds-api: ${events.length} eventos, ${(matches || []).length} jogos nossos`];
      let upserted = 0;

      for (const m of matches || []) {
        const home = teamById.get(m.home_team_id);
        const away = teamById.get(m.away_team_id);
        if (!home || !away) continue;

        const ev = events.find((e) => {
          const eh = teamCodeFromName(String(e?.home_team || ""), teamById);
          const ea = teamCodeFromName(String(e?.away_team || ""), teamById);
          return (
            (eh === home.code && ea === away.code) ||
            (eh === away.code && ea === home.code)
          );
        });
        if (!ev) {
          logs.push(`  sem evento para ${home.name} vs ${away.name}`);
          continue;
        }
        const reversed = teamCodeFromName(String(ev.home_team || ""), teamById) === away.code;

        // Average odds across bookmakers
        const sums = { h: 0, d: 0, a: 0 };
        const counts = { h: 0, d: 0, a: 0 };
        let bookmaker = "average";
        for (const bk of ev.bookmakers || []) {
          const mk = (bk.markets || []).find((x: any) => x.key === "h2h");
          if (!mk) continue;
          const findPrice = (teamName: string) =>
            mk.outcomes?.find((o: any) => o.name === teamName)?.price;
          const ph = findPrice(ev.home_team);
          const pa = findPrice(ev.away_team);
          const pd = findPrice("Draw");
          if (ph && pa) {
            sums.h += ph; counts.h++;
            sums.a += pa; counts.a++;
            if (pd) { sums.d += pd; counts.d++; }
          }
        }
        if (!counts.h || !counts.a) {
          logs.push(`  sem 1X2 para ${home.code}-${away.code}`);
          continue;
        }
        let homeOdd = sums.h / counts.h;
        let awayOdd = sums.a / counts.a;
        const drawOdd = counts.d ? sums.d / counts.d : null;
        if (reversed) [homeOdd, awayOdd] = [awayOdd, homeOdd];

        await supabase.from("odds_cache").upsert(
          {
            match_id: m.id,
            home_odds: homeOdd.toFixed(2),
            draw_odds: drawOdd ? drawOdd.toFixed(2) : null,
            away_odds: awayOdd.toFixed(2),
            bookmaker,
            source: "the-odds-api",
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "match_id" }
        );
        upserted++;
        logs.push(`  ✓ ${home.code} ${homeOdd.toFixed(2)} / ${drawOdd?.toFixed(2) ?? "?"} / ${awayOdd.toFixed(2)} ${away.code}`);
      }

      console.log(logs.join("\n"));
      return new Response(
        JSON.stringify({
          refreshed: upserted,
          total: (matches || []).length,
          source: `the-odds-api (${usedKey})`,
          logs: [...odLogs, ...logs].slice(-60),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err: any) {
      console.warn("the-odds-api falhou, caindo para RapidAPI:", err.message);
      // Anexa diagnóstico no fallback
      (globalThis as any).__oddsApiError = `${err.message} :: ${odLogs.join(" | ")}`;
    }
  }


  try {
    // Load upcoming scheduled matches (next 10 days) and teams
    const inTenDays = new Date(Date.now() + 10 * 86400 * 1000).toISOString();
    const [{ data: matches }, { data: teams }] = await Promise.all([
      supabase
        .from("matches")
        .select("id, match_date, home_team_id, away_team_id")
        .eq("status", "scheduled")
        .lte("match_date", inTenDays)
        .order("match_date", { ascending: true }),
      supabase.from("teams").select("id, name, code"),
    ]);

    const teamById = new Map((teams || []).map((t: any) => [t.id, { code: t.code, name: t.name }]));

    if (!matches || matches.length === 0) {
      return new Response(JSON.stringify({ refreshed: 0, reason: "no upcoming matches" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group matches by date (YYYYMMDD)
    const byDate: Record<string, any[]> = {};
    for (const m of matches) {
      const d = new Date(m.match_date);
      const key = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
      (byDate[key] ||= []).push(m);
    }

    const logs: string[] = [];
    let upserted = 0;

    // Fixture cache per API date (API dates can differ from ours due to timezone)
    const fixturesByDate: Record<string, any[]> = {};
    const getFixtures = async (date: string): Promise<any[]> => {
      if (fixturesByDate[date]) return fixturesByDate[date];
      try {
        const fx = await apiGet(`/football-get-matches-by-date?date=${date}`, RAPIDAPI_KEY);
        const list =
          fx?.response?.matches || fx?.response || fx?.matches || (Array.isArray(fx) ? fx : []);
        fixturesByDate[date] = Array.isArray(list) ? list : [];
      } catch (e: any) {
        logs.push(`date ${date}: ${e.message}`);
        fixturesByDate[date] = [];
      }
      return fixturesByDate[date];
    };
    const shiftDate = (date: string, days: number): string => {
      const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6, 8)));
      d.setUTCDate(d.getUTCDate() + days);
      return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
    };

    for (const [date, dayMatches] of Object.entries(byDate)) {
      // Search the match date plus adjacent days (timezone offsets in the API)
      const fixtureList: any[] = [
        ...(await getFixtures(date)),
        ...(await getFixtures(shiftDate(date, 1))),
        ...(await getFixtures(shiftDate(date, -1))),
      ];

      logs.push(`date ${date}: ${fixtureList.length} fixtures (±1d), ${dayMatches.length} our matches`);

      for (const m of dayMatches) {
        const home = teamById.get(m.home_team_id);
        const away = teamById.get(m.away_team_id);
        if (!home || !away) continue;

        // Find matching fixture by team names
        const fx = fixtureList.find((f: any) => {
          const fhName = f?.home?.name || f?.homeTeam?.name || f?.teams?.home?.name || f?.home_team || "";
          const faName = f?.away?.name || f?.awayTeam?.name || f?.teams?.away?.name || f?.away_team || "";
          const fhCode = teamCodeFromName(String(fhName), teamById);
          const faCode = teamCodeFromName(String(faName), teamById);
          return (
            (fhCode === home.code && faCode === away.code) ||
            (fhCode === away.code && faCode === home.code)
          );
        });

        if (!fx) {
          logs.push(`  no fixture match for ${home.name} vs ${away.name}`);
          continue;
        }

        const eventId = fx?.id || fx?.eventId || fx?.fixtureId || fx?.match_id;
        if (!eventId) {
          logs.push(`  no eventId for ${home.name} vs ${away.name}`);
          continue;
        }

        // Was the fixture reversed relative to our match? (home/away swap)
        const fhName = fx?.home?.name || fx?.homeTeam?.name || fx?.teams?.home?.name || fx?.home_team || "";
        const reversed = teamCodeFromName(String(fhName), teamById) === away.code;

        // 2) Get odds for this event
        let oddsData: any;
        try {
          oddsData = await apiGet(`/football-event-odds?eventid=${eventId}`, RAPIDAPI_KEY);
        } catch (e: any) {
          logs.push(`  odds fail ${home.code}-${away.code}: ${e.message}`);
          continue;
        }

        // Fotmob shape: response.odds = provider; provider.odds.matchfactMarkets / oddsTabMarkets
        const provider = oddsData?.response?.odds || oddsData?.odds || {};
        const inner = provider?.odds || {};
        let homeOdd: number | null = null;
        let drawOdd: number | null = null;
        let awayOdd: number | null = null;
        const bookmaker =
          String(provider?.persistentKey || "").split("_")[0] || provider?.provider || "Bet365";

        const marketsList: any[] = [];
        if (Array.isArray(inner?.matchfactMarkets)) marketsList.push(...inner.matchfactMarkets);
        if (Array.isArray(inner?.oddsTabMarkets)) {
          for (const cat of inner.oddsTabMarkets) {
            if (Array.isArray(cat?.markets)) marketsList.push(...cat.markets);
          }
        }

        for (const mk of marketsList) {
          const header = String(mk?.header || "").toLowerCase();
          const tk = String(mk?.headerTranslationKey || "");
          if (header.includes("full time result") || header.includes("1x2") || tk === "who_will_win") {
            for (const s of mk?.selections || []) {
              const label = String(s?.name || "").toLowerCase();
              const price = Number(s?.oddsDecimal ?? s?.odd ?? s?.price);
              if (!isFinite(price)) continue;
              if (label === "1" || label.includes("home")) homeOdd = price;
              else if (label === "x" || label.includes("draw")) drawOdd = price;
              else if (label === "2" || label.includes("away")) awayOdd = price;
            }
            if (homeOdd && awayOdd) break;
          }
        }

        // If the API fixture had home/away swapped relative to our match, swap odds back
        if (reversed && homeOdd && awayOdd) {
          [homeOdd, awayOdd] = [awayOdd, homeOdd];
        }

        if (homeOdd && awayOdd) {
          await supabase.from("odds_cache").upsert(
            {
              match_id: m.id,
              home_odds: homeOdd,
              draw_odds: drawOdd,
              away_odds: awayOdd,
              bookmaker,
              source: "free-api-live-football-data",
              fetched_at: new Date().toISOString(),
            },
            { onConflict: "match_id" }
          );
          upserted++;
          logs.push(`  ✓ ${home.code} ${homeOdd} / ${drawOdd ?? "?"} / ${awayOdd} ${away.code}`);
        } else {
          logs.push(`  no 1X2 found for ${home.code}-${away.code}. Sample: ${JSON.stringify(inner).slice(0, 200)}`);
        }
      }
    }

    console.log(logs.join("\n"));
    return new Response(
      JSON.stringify({ refreshed: upserted, total: matches.length, logs: logs.slice(-30) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("fetch-odds error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
