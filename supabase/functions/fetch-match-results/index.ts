import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Team name matching — maps our DB team names to possible API names
const teamAliases: Record<string, string[]> = {
  "Sporting CP": ["sporting cp", "sporting", "sporting lisbon", "sporting clube de portugal", "sporting lisboa"],
  "Arsenal": ["arsenal", "arsenal fc"],
  "Real Madrid": ["real madrid", "real madrid cf"],
  "Bayern Munich": ["bayern munich", "bayern münchen", "fc bayern münchen", "bayern", "fc bayern munich", "bayern munchen"],
  "Barcelona": ["barcelona", "fc barcelona", "barça"],
  "Borussia Dortmund": ["borussia dortmund", "dortmund", "bvb"],
  "Inter Milan": ["inter milan", "inter", "fc internazionale", "internazionale", "inter milano"],
  "Goiás": ["goias", "goiás", "goias ec"],
  "Criciúma": ["criciuma", "criciúma", "criciúma ec"],
  // World Cup teams
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
  "Costa do Marfim": ["ivory coast", "costa do marfim"],
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
  
  // Direct match
  if (dbLower === apiLower) return true;
  if (dbLower.includes(apiLower) || apiLower.includes(dbLower)) return true;
  
  // Check aliases
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
    const rapidApiKey = Deno.env.get("RAPIDAPI_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!rapidApiKey) {
      return new Response(
        JSON.stringify({ error: "RAPIDAPI_KEY not configured." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find matches that should have ended (match_date < now) but aren't finished
    const now = new Date().toISOString();
    const { data: pendingMatches, error: fetchError } = await supabase
      .from("matches")
      .select("id, match_date, status, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)")
      .neq("status", "finished")
      .lt("match_date", now)
      .order("match_date", { ascending: false })
      .limit(20);

    if (fetchError) {
      throw new Error(`DB query failed: ${fetchError.message}`);
    }

    if (!pendingMatches || pendingMatches.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No pending matches to update", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${pendingMatches.length} pending matches to check`);

    // Get unique dates to query the API
    const dates = new Set<string>();
    for (const m of pendingMatches) {
      const d = m.match_date.split("T")[0];
      dates.add(d);
    }

    // Fetch match data from free API for each date
    const allApiMatches: any[] = [];
    for (const date of dates) {
      try {
        const url = `https://free-api-live-football-data.p.rapidapi.com/football-get-matches-by-date?date=${date}`;
        console.log(`Fetching API for date: ${date}`);
        const res = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            "x-rapidapi-host": "free-api-live-football-data.p.rapidapi.com",
            "x-rapidapi-key": rapidApiKey,
          },
        });

        if (!res.ok) {
          const body = await res.text();
          console.error(`API error for ${date}: ${res.status} - ${body}`);
          continue;
        }

        const data = await res.json();
        console.log(`API returned data for ${date}:`, JSON.stringify(data).substring(0, 500));
        
        // The API may return data in different structures - handle both
        if (data.response?.matches) {
          allApiMatches.push(...data.response.matches);
        } else if (data.response?.data) {
          allApiMatches.push(...data.response.data);
        } else if (Array.isArray(data.response)) {
          allApiMatches.push(...data.response);
        } else if (data.matches) {
          allApiMatches.push(...data.matches);
        } else if (Array.isArray(data)) {
          allApiMatches.push(...data);
        }
      } catch (e) {
        console.error(`Error fetching date ${date}:`, e);
      }
    }

    console.log(`Total API matches fetched: ${allApiMatches.length}`);
    if (allApiMatches.length > 0) {
      console.log(`Sample match:`, JSON.stringify(allApiMatches[0]).substring(0, 500));
    }

    let updated = 0;
    const errors: string[] = [];

    // Try to match API results to our pending matches
    for (const match of pendingMatches) {
      const homeTeam = (match as any).home_team;
      const awayTeam = (match as any).away_team;
      if (!homeTeam || !awayTeam) continue;

      for (const apiMatch of allApiMatches) {
        // Try various field names the API might use
        const apiHome = apiMatch.homeTeam?.name || apiMatch.home_team || apiMatch.homeTeamName || apiMatch.teams?.home?.name || "";
        const apiAway = apiMatch.awayTeam?.name || apiMatch.away_team || apiMatch.awayTeamName || apiMatch.teams?.away?.name || "";
        const apiStatus = (apiMatch.status || apiMatch.fixture?.status?.short || apiMatch.matchStatus || "").toString().toUpperCase();

        if (matchesTeamName(homeTeam.name, apiHome) && matchesTeamName(awayTeam.name, apiAway)) {
          // Check if match is finished
          const isFinished = ["FT", "AET", "PEN", "FINISHED", "FULL TIME", "ENDED"].some(s => apiStatus.includes(s));
          
          if (!isFinished) {
            console.log(`Match ${homeTeam.name} vs ${awayTeam.name}: status=${apiStatus}, not finished yet`);
            continue;
          }

          // Extract scores - try various field names
          const homeScore = apiMatch.homeScore?.current ?? apiMatch.homeGoals ?? apiMatch.home_score ?? apiMatch.goals?.home ?? apiMatch.score?.home ?? apiMatch.homeTeam?.score;
          const awayScore = apiMatch.awayScore?.current ?? apiMatch.awayGoals ?? apiMatch.away_score ?? apiMatch.goals?.away ?? apiMatch.score?.away ?? apiMatch.awayTeam?.score;

          if (homeScore !== undefined && homeScore !== null && awayScore !== undefined && awayScore !== null) {
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
              errors.push(`Failed to update ${homeTeam.name} vs ${awayTeam.name}: ${updateError.message}`);
            } else {
              console.log(`Updated: ${homeTeam.name} ${homeScore} x ${awayScore} ${awayTeam.name}`);
              updated++;
            }
          } else {
            console.log(`Match found but no score: ${homeTeam.name} vs ${awayTeam.name}`);
          }
          break;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        pending_checked: pendingMatches.length,
        api_matches_found: allApiMatches.length,
        dates_queried: [...dates],
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching match results:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
