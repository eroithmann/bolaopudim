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
    const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
    const baseUrl = "https://free-api-live-football-data.p.rapidapi.com";
    const headers = {
      "x-rapidapi-key": RAPIDAPI_KEY!,
      "x-rapidapi-host": "free-api-live-football-data.p.rapidapi.com",
      "Content-Type": "application/json",
    };

    // Step 1: Get all leagues to find World Cup ID
    const leaguesRes = await fetch(`${baseUrl}/football-get-all-leagues`, { headers });
    const leaguesData = await leaguesRes.json();
    const allLeagues = leaguesData?.response?.leagues || [];
    
    // Find World Cup related leagues
    const worldCupLeagues = allLeagues.filter((l: any) => {
      const name = (l.name || "").toLowerCase();
      return name.includes("world cup") || name.includes("copa do mundo") || name.includes("fifa");
    });

    // Step 2: Try various fixture endpoints
    const endpoints = [
      "/football-get-matches-by-league?leagueid=77&season=2025/2026",
      "/football-get-matches-by-league?leagueid=77",
      "/football-league-matches?leagueid=77",
      "/football-get-league-matches?leagueid=77",
      "/football-league-season-matches?leagueid=77",
      "/football-get-league-season?leagueid=77",
      "/football-league-season?leagueid=77",
      "/football-get-league-details?leagueid=77",
      "/football-league-details?leagueid=77",
    ];

    const results: any = { worldCupLeagues };

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(`${baseUrl}${endpoint}`, { headers });
        const data = await res.json();
        results[endpoint] = {
          status: res.status,
          sample: JSON.stringify(data).substring(0, 800),
        };
      } catch (e) {
        results[endpoint] = { error: e.message };
      }
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
