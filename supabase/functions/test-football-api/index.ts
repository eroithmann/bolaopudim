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

    // Try different season/parameter combos for World Cup (id=77)
    const endpoints = [
      "/football-get-all-matches-by-league?leagueid=77&season=2026",
      "/football-get-all-matches-by-league?leagueid=77&season=2025/2026",
      "/football-get-all-matches-by-league?leagueid=77&season=2025-2026",
      // Try Premier League to see if endpoint works at all with matches
      "/football-get-all-matches-by-league?leagueid=47",
      // Also try a match details endpoint
      "/football-match-details?matchid=4803343",
      "/football-get-match-details?matchid=4803343",
      "/football-get-match?matchid=4803343",
    ];

    const results: any = {};

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(`${baseUrl}${endpoint}`, { headers });
        const data = await res.json();
        results[endpoint] = {
          status: res.status,
          sample: JSON.stringify(data).substring(0, 1000),
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
