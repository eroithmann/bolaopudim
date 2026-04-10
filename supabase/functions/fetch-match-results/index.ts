import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Aliases map: canonical DB name → all possible API names (lowercase, full strings only)
// IMPORTANT: Use EXACT full strings, never substrings. No includes() matching.
const teamAliases: Record<string, string[]> = {
  // Club teams (test)
  "Sporting CP": ["sporting cp", "sporting clube de portugal", "sporting lisbon"],
  "Arsenal": ["arsenal", "arsenal fc"],
  "Real Madrid": ["real madrid", "real madrid cf"],
  "Bayern Munich": ["bayern munich", "bayern münchen", "fc bayern münchen", "fc bayern munich", "bayern munchen"],
  "Barcelona": ["barcelona", "fc barcelona", "barça"],
  "Atlético de Madrid": ["atletico madrid", "atlético de madrid", "atlético madrid", "atletico de madrid", "club atlético de madrid", "club atletico de madrid"],
  "Borussia Dortmund": ["borussia dortmund", "bvb 09 borussia dortmund", "bvb"],
  "Inter Milan": ["inter milan", "fc internazionale milano", "internazionale"],
  // World Cup 2026 national teams
  "Brasil": ["brazil", "brasil"],
  "Argentina": ["argentina"],
  "Alemanha": ["germany", "deutschland"],
  "França": ["france", "francia"],
  "Espanha": ["spain", "españa"],
  "Inglaterra": ["england"],
  "Portugal": ["portugal"],
  "Holanda": ["netherlands", "holland", "nederland"],
  "Bélgica": ["belgium", "belgique", "belgië"],
  "Croácia": ["croatia", "hrvatska"],
  "Uruguai": ["uruguay"],
  "Colômbia": ["colombia"],
  "México": ["mexico", "méxico"],
  "Estados Unidos": ["united states", "usa", "united states of america"],
  "Canadá": ["canada"],
  "Japão": ["japan"],
  "Coreia do Sul": ["south korea", "korea republic", "republic of korea", "korea, republic of"],
  "Austrália": ["australia"],
  "Arábia Saudita": ["saudi arabia"],
  "Irã": ["iran", "ir iran", "iran, islamic republic of"],
  "Marrocos": ["morocco", "maroc"],
  "Senegal": ["senegal"],
  "Gana": ["ghana"],
  "Camarões": ["cameroon", "cameroun"],
  "Nigéria": ["nigeria"],
  "Egito": ["egypt"],
  "Tunísia": ["tunisia", "tunisie"],
  "Costa do Marfim": ["ivory coast", "côte d'ivoire", "cote d'ivoire"],
  "Argélia": ["algeria", "algérie"],
  "South Africa": ["south africa"],
  "Cape Verde": ["cape verde", "cabo verde"],
  "Suíça": ["switzerland", "suisse", "schweiz"],
  "Áustria": ["austria"],
  "Dinamarca": ["denmark", "danmark"],
  "Suécia": ["sweden", "sverige"],
  "Noruega": ["norway", "norge"],
  "Polônia": ["poland", "polska"],
  "Sérvia": ["serbia", "srbija"],
  "Turquia": ["turkey", "türkiye"],
  "Ucrânia": ["ukraine"],
  "Grécia": ["greece", "hellas"],
  "Itália": ["italy", "italia"],
  "Chile": ["chile"],
  "Peru": ["peru"],
  "Equador": ["ecuador"],
  "Paraguai": ["paraguay"],
  "Costa Rica": ["costa rica"],
  "Jamaica": ["jamaica"],
  "Panamá": ["panama"],
  "Haiti": ["haiti"],
  "Curacao": ["curacao", "curaçao"],
  "Jordan": ["jordan"],
  "Uzbekistan": ["uzbekistan"],
  "Nova Zelândia": ["new zealand"],
  "Catar": ["qatar"],
  "Scotland": ["scotland"],
  "Goiás": ["goias", "goiás"],
  "Criciúma": ["criciuma", "criciúma"],
};

/**
 * Strict team name matching — NO substring/includes matching.
 * Only exact match or explicit alias match.
 */
function matchesTeamName(dbName: string, apiName: string): boolean {
  const apiLower = apiName.toLowerCase().trim();
  const dbLower = dbName.toLowerCase().trim();

  // Exact match
  if (dbLower === apiLower) return true;

  // Check aliases (exact match only)
  const aliases = teamAliases[dbName];
  if (aliases) {
    return aliases.some(alias => alias === apiLower);
  }

  return false;
}

/**
 * Validate that API match date is within ±dayRange days of DB match date.
 */
function datesAreClose(dbDate: string, apiDate: string, dayRange = 3): boolean {
  const db = new Date(dbDate).getTime();
  const api = new Date(apiDate).getTime();
  const diffMs = Math.abs(db - api);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= dayRange;
}

async function fetchFromApi(footballToken: string, dateFrom: string, dateTo: string, extraParams = ""): Promise<any[]> {
  const baseUrl = `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
  const url = extraParams ? `${baseUrl}&${extraParams}` : baseUrl;
  console.log(`Fetching: ${url}`);

  const res = await fetch(url, {
    headers: { "X-Auth-Token": footballToken },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`API error ${res.status}: ${body}`);
    return [];
  }

  const data = await res.json();
  const matches = data.matches || [];
  console.log(`API returned ${matches.length} matches`);

  for (const m of matches.slice(0, 5)) {
    console.log(`  - ${m.homeTeam?.name} vs ${m.awayTeam?.name} | ${m.status} | ${m.score?.fullTime?.home}-${m.score?.fullTime?.away}`);
  }

  return matches;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const footballToken = Deno.env.get("FOOTBALL_DATA_TOKEN");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!footballToken) {
      return new Response(
        JSON.stringify({ error: "FOOTBALL_DATA_TOKEN not configured." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();
    const { data: pendingMatches, error: fetchError } = await supabase
      .from("matches")
      .select("id, match_date, status, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)")
      .neq("status", "finished")
      .lt("match_date", now)
      .order("match_date", { ascending: false })
      .limit(50);

    if (fetchError) throw new Error(`DB query failed: ${fetchError.message}`);

    if (!pendingMatches || pendingMatches.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No pending matches to update", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${pendingMatches.length} pending matches`);
    for (const m of pendingMatches) {
      const ht = (m as any).home_team;
      const at = (m as any).away_team;
      console.log(`  DB: ${ht?.name} vs ${at?.name} | ${m.match_date} | ${m.status}`);
    }

    // Get date range
    const matchDates = pendingMatches.map(m => m.match_date.split("T")[0]);
    const dateFrom = matchDates.reduce((a, b) => a < b ? a : b);
    let dateTo = matchDates.reduce((a, b) => a > b ? a : b);
    // Expand range by +2 days for timezone differences
    const dateToObj = new Date(dateTo);
    dateToObj.setDate(dateToObj.getDate() + 2);
    dateTo = dateToObj.toISOString().split("T")[0];

    // Try FINISHED first, then all statuses
    let apiMatches = await fetchFromApi(footballToken, dateFrom, dateTo, "status=FINISHED");

    if (apiMatches.length === 0) {
      console.log("No FINISHED matches, trying without status filter...");
      apiMatches = await fetchFromApi(footballToken, dateFrom, dateTo);
    }

    // Filter to usable matches
    const finishedMatches = apiMatches.filter(m =>
      m.status === "FINISHED" &&
      m.score?.fullTime?.home !== null &&
      m.score?.fullTime?.home !== undefined
    );

    console.log(`${finishedMatches.length} usable FINISHED matches with scores`);

    let updated = 0;
    const errors: string[] = [];
    const matched: string[] = [];
    const unmatched: string[] = [];

    for (const match of pendingMatches) {
      const homeTeam = (match as any).home_team;
      const awayTeam = (match as any).away_team;
      if (!homeTeam || !awayTeam) {
        unmatched.push(`Match ${match.id}: missing team data`);
        continue;
      }

      let found = false;
      for (const apiMatch of finishedMatches) {
        const apiHome = apiMatch.homeTeam?.name || "";
        const apiAway = apiMatch.awayTeam?.name || "";
        const apiDate = apiMatch.utcDate || "";

        // Both teams must match AND date must be close
        const homeMatches = matchesTeamName(homeTeam.name, apiHome);
        const awayMatches = matchesTeamName(awayTeam.name, apiAway);
        const dateClose = datesAreClose(match.match_date, apiDate);

        if (homeMatches && awayMatches && dateClose) {
          const homeScore = apiMatch.score.fullTime.home;
          const awayScore = apiMatch.score.fullTime.away;

          console.log(`✅ MATCH: ${homeTeam.name} vs ${awayTeam.name} => ${homeScore}-${awayScore}`);

          const { error: updateError } = await supabase
            .from("matches")
            .update({
              home_score: Number(homeScore),
              away_score: Number(awayScore),
              status: "finished",
              result_source: "api",
            })
            .eq("id", match.id);

          if (updateError) {
            errors.push(`Failed ${homeTeam.name} vs ${awayTeam.name}: ${updateError.message}`);
          } else {
            updated++;
            matched.push(`${homeTeam.name} vs ${awayTeam.name}: ${homeScore}-${awayScore}`);
          }
          found = true;
          break;
        }
      }

      if (!found) {
        unmatched.push(`${homeTeam.name} vs ${awayTeam.name}`);
        console.log(`❌ NO MATCH: ${homeTeam.name} vs ${awayTeam.name}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        pending_checked: pendingMatches.length,
        api_matches_found: apiMatches.length,
        finished_with_scores: finishedMatches.length,
        matched,
        unmatched: unmatched.length > 0 ? unmatched : undefined,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
