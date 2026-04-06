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
    if (!RAPIDAPI_KEY) {
      return new Response(JSON.stringify({ error: "RAPIDAPI_KEY not set" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = "https://free-api-live-football-data.p.rapidapi.com";
    const headers = {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": "free-api-live-football-data.p.rapidapi.com",
      "Content-Type": "application/json",
    };

    // Try multiple endpoint patterns to discover the API structure
    const endpoints = [
      "/football-get-all-leagues",
      "/football-get-fixtures-by-league?leagueid=1&season=2026",
      "/football-get-fixtures-by-league?leagueid=1&season=2025-2026",
      "/football-current-live",
      "/football-get-all-events-by-league?leagueid=1",
      "/football-get-fixtures-all?leagueid=1",
    ];

    const results: any = {};

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(`${baseUrl}${endpoint}`, { headers });
        const data = await res.json();
        results[endpoint] = {
          status: res.status,
          // Only include first few items or error info
          data_keys: data ? Object.keys(data) : null,
          sample: JSON.stringify(data).substring(0, 500),
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
