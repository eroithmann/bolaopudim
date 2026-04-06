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

    // Try more endpoint patterns - World Cup league id = 77
    const endpoints = [
      "/football-league-list-by-country?ccode=INT",
      "/football-get-all-matches-by-league?leagueid=77",
      "/football-get-matches?leagueid=77",
      "/football-matches-by-league?leagueid=77&season=2025/2026",
      "/football-league-info?leagueid=77",
      "/football-get-league?leagueid=77",
      "/football-league?leagueid=77",
      "/football-league-table?leagueid=77",
      "/football-league-overview?leagueid=77",
      "/football-get-league-season-fixture?leagueid=77",
      "/football-get-league-fixture?leagueid=77",
      "/football-get-all-fixtures?leagueid=77",
      "/football-get-season-fixtures?leagueid=77",
    ];

    const results: any = {};

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(`${baseUrl}${endpoint}`, { headers });
        const data = await res.json();
        results[endpoint] = {
          status: res.status,
          sample: JSON.stringify(data).substring(0, 600),
        };
        // Stop early if we find a working one
        if (res.status === 200 && !data.message?.includes("does not exist")) {
          results[endpoint].note = "FOUND WORKING ENDPOINT!";
        }
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
