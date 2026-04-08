import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const teamAliases: Record<string, string[]> = {
  "Sporting CP": ["sporting cp", "sporting", "sporting lisbon", "sporting clube de portugal"],
  "Arsenal": ["arsenal", "arsenal fc"],
  "Real Madrid": ["real madrid", "real madrid cf"],
  "Bayern Munich": ["bayern munich", "bayern münchen", "fc bayern münchen", "bayern", "fc bayern munich", "bayern munchen"],
  "Barcelona": ["barcelona", "fc barcelona", "barça"],
  "Borussia Dortmund": ["borussia dortmund", "dortmund", "bvb"],
  "Inter Milan": ["inter milan", "inter", "fc internazionale", "internazionale"],
  "Goiás": ["goias", "goiás"],
  "Criciúma": ["criciuma", "criciúma"],
  "México": ["mexico", "méxico"],
  "South Africa": ["south africa"],
  "South Korea": ["south korea", "korea republic", "korea"],
  "Brasil": ["brazil", "brasil"],
  "Estados Unidos": ["united states", "usa", "us"],
  "Paraguai": ["paraguay", "paraguai"],
  "Alemanha": ["germany", "deutschland"],
  "França": ["france", "francia"],
  "Espanha": ["spain", "españa"],
  "Inglaterra": ["england", "inglaterra"],
  "Portugal": ["portugal"],
  "Holanda": ["netherlands", "holland"],
  "Bélgica": ["belgium", "bélgica"],
  "Croácia": ["croatia", "croácia"],
  "Suíça": ["switzerland", "suíça"],
  "Argentina": ["argentina"],
  "Uruguai": ["uruguay", "uruguai"],
  "Colômbia": ["colombia", "colômbia"],
  "Equador": ["ecuador", "equador"],
  "Japão": ["japan", "japão"],
  "Marrocos": ["morocco", "marrocos"],
  "Senegal": ["senegal"],
  "Gana": ["ghana", "gana"],
  "Camarões": ["cameroon", "camarões"],
  "Egito": ["egypt", "egito"],
  "Tunísia": ["tunisia", "tunísia"],
  "Costa do Marfim": ["ivory coast", "costa do marfim", "côte d'ivoire"],
  "Argélia": ["algeria", "argélia"],
  "Noruega": ["norway", "noruega"],
  "Áustria": ["austria", "áustria"],
  "Jordânia": ["jordan", "jordânia"],
  "Uzbequistão": ["uzbekistan", "uzbequistão"],
  "Cabo Verde": ["cape verde", "cabo verde"],
  "Arábia Saudita": ["saudi arabia", "arábia saudita"],
  "Irã": ["iran", "irã"],
  "Nova Zelândia": ["new zealand", "nova zelândia"],
  "Catar": ["qatar", "catar"],
  "Panamá": ["panama", "panamá"],
  "Escócia": ["scotland", "escócia"],
  "Haiti": ["haiti"],
  "Curaçao": ["curacao", "curaçao"],
};

function matchesTeamName(dbName: string, apiName: string): boolean {
  const apiLower = apiName.toLowerCase().trim();
  const dbLower = dbName.toLowerCase().trim();
  if (dbLower === apiLower) return true;
  if (dbLower.includes(apiLower) || apiLower.includes(dbLower)) return true;
  const aliases = teamAliases[dbName];
  if (aliases) {
    return aliases.some(a => apiLower === a || apiLower.includes(a) || a.includes(apiLower));
  }
  return false;
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
      .limit(20);

    if (fetchError) throw new Error(`DB query failed: ${fetchError.message}`);

    if (!pendingMatches || pendingMatches.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No pending matches to update", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${pendingMatches.length} pending matches`);

    // Get date range
    const matchDates = pendingMatches.map(m => m.match_date.split("T")[0]);
    const dateFrom = matchDates.reduce((a, b) => a < b ? a : b);
    const dateTo = matchDates.reduce((a, b) => a > b ? a : b);

    // Fetch from football-data.org
    const apiUrl = `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&status=FINISHED`;
    console.log(`Fetching: ${apiUrl}`);

    const res = await fetch(apiUrl, {
      headers: { "X-Auth-Token": footballToken },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`API error: ${res.status} - ${body}`);
      return new Response(
        JSON.stringify({ success: false, error: `API returned ${res.status}`, details: body }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const apiMatches = data.matches || [];
    console.log(`API returned ${apiMatches.length} finished matches`);

    let updated = 0;
    const errors: string[] = [];

    for (const match of pendingMatches) {
      const homeTeam = (match as any).home_team;
      const awayTeam = (match as any).away_team;
      if (!homeTeam || !awayTeam) continue;

      for (const apiMatch of apiMatches) {
        const apiHome = apiMatch.homeTeam?.name || apiMatch.homeTeam?.shortName || "";
        const apiAway = apiMatch.awayTeam?.name || apiMatch.awayTeam?.shortName || "";

        if (matchesTeamName(homeTeam.name, apiHome) && matchesTeamName(awayTeam.name, apiAway)) {
          const homeScore = apiMatch.score?.fullTime?.home;
          const awayScore = apiMatch.score?.fullTime?.away;

          if (homeScore !== null && homeScore !== undefined && awayScore !== null && awayScore !== undefined) {
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
              console.log(`Updated: ${homeTeam.name} ${homeScore} x ${awayScore} ${awayTeam.name}`);
              updated++;
            }
          }
          break;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, updated, pending_checked: pendingMatches.length, api_matches_found: apiMatches.length, errors: errors.length > 0 ? errors : undefined }),
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
