import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ODDS_API_KEY = Deno.env.get("ODDS_API_KEY");
    
    if (!ODDS_API_KEY) {
      // No odds API key configured, return empty
      return new Response(JSON.stringify({ odds: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch upcoming/scheduled matches with team info
    const { data: matches } = await supabase
      .from("matches")
      .select("id, match_date, status, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)")
      .eq("status", "scheduled")
      .order("match_date", { ascending: true })
      .limit(50);

    if (!matches || matches.length === 0) {
      return new Response(JSON.stringify({ odds: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch odds from The Odds API for FIFA World Cup
    // Sport key for FIFA World Cup 2026
    const sportKey = "soccer_fifa_world_cup";
    const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`;

    const oddsResponse = await fetch(oddsUrl);
    
    if (!oddsResponse.ok) {
      console.error("Odds API error:", oddsResponse.status, await oddsResponse.text());
      return new Response(JSON.stringify({ odds: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const oddsData = await oddsResponse.json();

    // Map team names to normalize for matching
    const nameMap: Record<string, string[]> = {
      BRA: ["brazil", "brasil"],
      ARG: ["argentina"],
      URU: ["uruguay"],
      COL: ["colombia"],
      ECU: ["ecuador"],
      PAR: ["paraguay"],
      PER: ["peru"],
      CHI: ["chile"],
      BOL: ["bolivia"],
      VEN: ["venezuela"],
      MEX: ["mexico"],
      USA: ["united states", "usa", "us"],
      CAN: ["canada"],
      GER: ["germany"],
      FRA: ["france"],
      ESP: ["spain"],
      ENG: ["england"],
      ITA: ["italy"],
      POR: ["portugal"],
      NED: ["netherlands", "holland"],
      BEL: ["belgium"],
      CRO: ["croatia"],
      SRB: ["serbia"],
      SUI: ["switzerland"],
      DEN: ["denmark"],
      POL: ["poland"],
      JPN: ["japan"],
      KOR: ["south korea", "korea republic"],
      AUS: ["australia"],
      MAR: ["morocco"],
      SEN: ["senegal"],
      NGA: ["nigeria"],
      GHA: ["ghana"],
      CMR: ["cameroon"],
      EGY: ["egypt"],
      TUN: ["tunisia"],
      IRN: ["iran"],
      KSA: ["saudi arabia"],
      QAT: ["qatar"],
    };

    function normalizeTeamName(name: string): string {
      return name.toLowerCase().trim();
    }

    function findTeamCode(apiTeamName: string): string | null {
      const normalized = normalizeTeamName(apiTeamName);
      for (const [code, names] of Object.entries(nameMap)) {
        if (names.some(n => normalized.includes(n) || n.includes(normalized))) {
          return code;
        }
      }
      return null;
    }

    // Build odds map by match_id
    const oddsMap: Record<string, { home: number | null; draw: number | null; away: number | null; bookmaker: string }> = {};

    for (const match of matches) {
      const homeTeam = (match as any).home_team;
      const awayTeam = (match as any).away_team;
      if (!homeTeam || !awayTeam) continue;

      const homeCode = homeTeam.code;
      const awayCode = awayTeam.code;

      // Find matching odds event
      for (const event of oddsData) {
        const apiHomeCode = findTeamCode(event.home_team);
        const apiAwayCode = findTeamCode(event.away_team);

        if (
          (apiHomeCode === homeCode && apiAwayCode === awayCode) ||
          (apiHomeCode === awayCode && apiAwayCode === homeCode)
        ) {
          // Get first bookmaker's odds
          const bookmaker = event.bookmakers?.[0];
          if (bookmaker) {
            const h2hMarket = bookmaker.markets?.find((m: any) => m.key === "h2h");
            if (h2hMarket) {
              const outcomes = h2hMarket.outcomes;
              const homeOdds = outcomes.find((o: any) => findTeamCode(o.name) === homeCode);
              const awayOdds = outcomes.find((o: any) => findTeamCode(o.name) === awayCode);
              const drawOdds = outcomes.find((o: any) => o.name.toLowerCase() === "draw");

              oddsMap[match.id] = {
                home: homeOdds?.price || null,
                draw: drawOdds?.price || null,
                away: awayOdds?.price || null,
                bookmaker: bookmaker.title,
              };
            }
          }
          break;
        }
      }
    }

    return new Response(JSON.stringify({ odds: oddsMap }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error fetching odds:", error);
    return new Response(JSON.stringify({ odds: {} }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
