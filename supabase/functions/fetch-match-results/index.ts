import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

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
        JSON.stringify({ error: "RAPIDAPI_KEY not configured. Please add it in project secrets." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch FIFA World Cup 2026 fixtures from API-Football
    const response = await fetch(
      "https://api-football-v1.p.rapidapi.com/v3/fixtures?league=1&season=2026",
      {
        headers: {
          "X-RapidAPI-Key": rapidApiKey,
          "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
        },
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`API-Football request failed [${response.status}]: ${body}`);
    }

    const apiData = await response.json();
    const fixtures = apiData.response || [];
    let updated = 0;

    for (const fixture of fixtures) {
      if (fixture.fixture.status.short !== "FT") continue; // Only finished matches

      const fixtureId = fixture.fixture.id;
      const homeScore = fixture.goals.home;
      const awayScore = fixture.goals.away;

      // Find match by api_fixture_id
      const { data: match } = await supabase
        .from("matches")
        .select("id, status")
        .eq("api_fixture_id", fixtureId)
        .single();

      if (match && match.status !== "finished") {
        await supabase
          .from("matches")
          .update({
            home_score: homeScore,
            away_score: awayScore,
            status: "finished",
            result_source: "api",
          })
          .eq("id", match.id);
        updated++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, updated, total_fixtures: fixtures.length }),
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
