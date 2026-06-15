import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Aliases map: canonical DB name → additional possible API names (lowercase).
 * Normalization (accents/punctuation/suffix stripping) is applied to BOTH sides,
 * so you usually only need to add aliases that are semantically different
 * (e.g. translations: "Alemanha" ↔ "germany").
 */
const teamAliases: Record<string, string[]> = {
  // Club teams (test)
  "Sporting CP": ["sporting clube de portugal", "sporting lisbon"],
  "Real Madrid": ["real madrid cf"],
  "Bayern Munich": ["bayern munchen", "fc bayern munchen"],
  "Barcelona": ["fc barcelona", "barca"],
  "Atlético de Madrid": ["atletico madrid", "club atletico de madrid"],
  "Borussia Dortmund": ["bvb 09 borussia dortmund", "bvb"],
  "Inter Milan": ["fc internazionale milano", "internazionale"],
  "Paris Saint-Germain": ["paris sg", "psg"],
  // World Cup 2026 national teams
  "Brasil": ["brazil"],
  "Alemanha": ["germany", "deutschland"],
  "França": ["france", "francia"],
  "Espanha": ["spain", "espana"],
  "Inglaterra": ["england"],
  "Holanda": ["netherlands", "holland", "nederland"],
  "Bélgica": ["belgium", "belgique", "belgie"],
  "Croácia": ["croatia", "hrvatska"],
  "Uruguai": ["uruguay"],
  "Colômbia": ["colombia"],
  "México": ["mexico"],
  "Estados Unidos": ["united states", "usa", "united states of america", "us"],
  "Canadá": ["canada"],
  "Japão": ["japan"],
  "Coreia do Sul": ["south korea", "korea republic", "republic of korea", "korea, republic of"],
  "Austrália": ["australia"],
  "Arábia Saudita": ["saudi arabia"],
  "Irã": ["iran", "ir iran", "iran islamic republic of"],
  "Marrocos": ["morocco", "maroc"],
  "Senegal": ["senegal"],
  "Gana": ["ghana"],
  "Camarões": ["cameroon", "cameroun"],
  "Nigéria": ["nigeria"],
  "Egito": ["egypt"],
  "Tunísia": ["tunisia", "tunisie"],
  "Tchéquia": ["czechia", "czech republic"],
  "Eslováquia": ["slovakia"],
  "Eslovênia": ["slovenia"],
  "Romênia": ["romania"],
  "Hungria": ["hungary"],
  "Rússia": ["russia"],
  "País de Gales": ["wales"],
  "Irlanda": ["ireland", "republic of ireland"],
  "Irlanda do Norte": ["northern ireland"],
  "Costa do Marfim": ["ivory coast", "cote d ivoire"],
  "Argélia": ["algeria", "algerie"],
  "South Africa": ["south africa", "africa do sul"],
  "Cape Verde": ["cape verde", "cabo verde", "cape verde islands"],
  "Suíça": ["switzerland", "suisse", "schweiz"],
  "Áustria": ["austria"],
  "Dinamarca": ["denmark", "danmark"],
  "Suécia": ["sweden", "sverige"],
  "Noruega": ["norway", "norge"],
  "Polônia": ["poland", "polska"],
  "Sérvia": ["serbia", "srbija"],
  "Turquia": ["turkey", "turkiye"],
  "Ucrânia": ["ukraine"],
  "Grécia": ["greece", "hellas"],
  "Itália": ["italy", "italia"],
  "Equador": ["ecuador"],
  "Paraguai": ["paraguay"],
  "Bósnia e Herzegovina": ["bosnia and herzegovina", "bosnia herzegovina", "bosnia-herzegovina", "bosnia", "bosnia y herzegovina"],
  "RD Congo": ["dr congo", "democratic republic of the congo", "congo dr", "congo democratic republic"],
  "Iraque": ["iraq"],
  "Nova Zelândia": ["new zealand"],
  "Catar": ["qatar"],
  "Scotland": ["scotland", "escocia", "escócia"],
  "Goiás": ["goias"],
  "Criciúma": ["criciuma"],
  "Haiti": ["haiti"],
  "Panamá": ["panama"],
  "Jamaica": ["jamaica"],
  "Costa Rica": ["costa rica"],
  "Curacao": ["curacao"],
  "Jordan": ["jordan", "jordania", "jordânia"],
  "Uzbekistan": ["uzbekistan", "uzbequistao", "uzbequistão"],
};

/** Normalize a string: lowercase, strip accents/punctuation/common suffixes, collapse spaces. */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[.,'`’\-]/g, " ")        // punctuation → space
    .replace(/\b(fc|cf|sc|afc|sk|ac|cd)\b/g, "") // common club suffixes
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Matching strategy (in order):
 * 1. Normalized exact match
 * 2. Normalized alias match
 * 3. Code match (3-letter team code present in API name as a whole token)
 */
function matchesTeamName(dbName: string, dbCode: string | null, apiName: string): boolean {
  const a = normalize(apiName);
  const d = normalize(dbName);
  if (!a || !d) return false;
  if (a === d) return true;

  const aliases = (teamAliases[dbName] ?? []).map(normalize);
  if (aliases.includes(a)) return true;

  if (dbCode) {
    const code = dbCode.toLowerCase();
    const tokens = a.split(" ");
    if (tokens.includes(code)) return true;
  }
  return false;
}

function datesAreClose(dbDate: string, apiDate: string, dayRange = 3): boolean {
  const diffDays = Math.abs(new Date(dbDate).getTime() - new Date(apiDate).getTime()) / 86_400_000;
  return diffDays <= dayRange;
}

async function fetchFromApi(token: string, dateFrom: string, dateTo: string, extra = ""): Promise<any[]> {
  const url = `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}${extra ? "&" + extra : ""}`;
  console.log(`Fetching: ${url}`);
  const res = await fetch(url, { headers: { "X-Auth-Token": token } });
  if (!res.ok) {
    console.error(`API error ${res.status}: ${await res.text()}`);
    return [];
  }
  const data = await res.json();
  const matches = data.matches || [];
  console.log(`API returned ${matches.length} matches`);
  return matches;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const footballToken = Deno.env.get("FOOTBALL_DATA_TOKEN");
    if (!footballToken) {
      return new Response(JSON.stringify({ error: "FOOTBALL_DATA_TOKEN not configured." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const now = new Date().toISOString();
    const { data: pendingMatches, error: fetchError } = await supabase
      .from("matches")
      .select("id, match_date, status, api_fixture_id, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)")
      .neq("status", "finished")
      .lt("match_date", now)
      .order("match_date", { ascending: false })
      .limit(50);

    if (fetchError) throw new Error(`DB query failed: ${fetchError.message}`);

    if (!pendingMatches || pendingMatches.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No pending matches", updated: 0, pending_checked: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Found ${pendingMatches.length} pending matches`);

    // Date range (expand +2 days for timezone safety)
    const dates = pendingMatches.map(m => m.match_date.split("T")[0]);
    const dateFrom = dates.reduce((a, b) => a < b ? a : b);
    const dateToObj = new Date(dates.reduce((a, b) => a > b ? a : b));
    dateToObj.setDate(dateToObj.getDate() + 2);
    const dateTo = dateToObj.toISOString().split("T")[0];

    // Always fetch ALL statuses; we filter to FINISHED in code so that
    // matches still IN_PLAY / PAUSED / etc don't get reported as "names didn't match"
    const apiMatches = await fetchFromApi(footballToken, dateFrom, dateTo);

    const finishedMatches = apiMatches.filter(m =>
      m.status === "FINISHED" && m.score?.fullTime?.home != null
    );

    console.log(`${apiMatches.length} total API matches, ${finishedMatches.length} FINISHED with scores`);
    for (const m of finishedMatches.slice(0, 10)) {
      console.log(`  API: ${m.homeTeam?.name} vs ${m.awayTeam?.name} | ${m.utcDate} | ${m.score?.fullTime?.home}-${m.score?.fullTime?.away} | id=${m.id}`);
    }

    let updated = 0;
    const errors: string[] = [];
    const matched: string[] = [];
    const unmatched: { game: string; reason: string }[] = [];

    for (const match of pendingMatches) {
      const homeTeam = (match as any).home_team;
      const awayTeam = (match as any).away_team;
      if (!homeTeam || !awayTeam) {
        unmatched.push({ game: `Match ${match.id}`, reason: "Times não preenchidos no banco" });
        continue;
      }

      const label = `${homeTeam.name} vs ${awayTeam.name}`;
      let apiMatch: any | null = null;

      // 1. Match by api_fixture_id (most reliable)
      if (match.api_fixture_id) {
        apiMatch = finishedMatches.find(m => m.id === match.api_fixture_id) ?? null;
      }

      // 2. Fallback: name + date
      if (!apiMatch) {
        apiMatch = finishedMatches.find(m =>
          matchesTeamName(homeTeam.name, homeTeam.code, m.homeTeam?.name ?? "") &&
          matchesTeamName(awayTeam.name, awayTeam.code, m.awayTeam?.name ?? "") &&
          datesAreClose(match.match_date, m.utcDate ?? "")
        ) ?? null;
      }

      if (!apiMatch) {
        // Look for the same fixture across ALL statuses (not just FINISHED) to
        // give a precise reason: still in play, not yet started, or really missing.
        const anyStatusMatch = apiMatches.find(m =>
          matchesTeamName(homeTeam.name, homeTeam.code, m.homeTeam?.name ?? "") &&
          matchesTeamName(awayTeam.name, awayTeam.code, m.awayTeam?.name ?? "") &&
          datesAreClose(match.match_date, m.utcDate ?? "")
        );

        let reason: string;
        if (anyStatusMatch) {
          reason = `Jogo encontrado na API mas status é "${anyStatusMatch.status}" (ainda não finalizado)`;
        } else {
          const apiHasOnDate = apiMatches.some(m => datesAreClose(match.match_date, m.utcDate ?? "", 1));
          reason = apiHasOnDate
            ? "Times não bateram (verifique aliases)"
            : "API não retornou jogo nesta data";
        }
        unmatched.push({ game: label, reason });
        console.log(`❌ NO MATCH: ${label} — ${reason}`);
        continue;
      }


      const homeScore = Number(apiMatch.score.fullTime.home);
      const awayScore = Number(apiMatch.score.fullTime.away);
      console.log(`✅ MATCH: ${label} => ${homeScore}-${awayScore} (api id ${apiMatch.id})`);

      const { error: updateError } = await supabase
        .from("matches")
        .update({
          home_score: homeScore,
          away_score: awayScore,
          status: "finished",
          result_source: "api",
          api_fixture_id: apiMatch.id ?? match.api_fixture_id,
        })
        .eq("id", match.id);

      if (updateError) {
        errors.push(`${label}: ${updateError.message}`);
      } else {
        updated++;
        matched.push(`${label}: ${homeScore}-${awayScore}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      updated,
      pending_checked: pendingMatches.length,
      api_matches_found: apiMatches.length,
      finished_with_scores: finishedMatches.length,
      matched,
      unmatched: unmatched.length > 0 ? unmatched : undefined,
      errors: errors.length > 0 ? errors : undefined,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", message);
    return new Response(JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
