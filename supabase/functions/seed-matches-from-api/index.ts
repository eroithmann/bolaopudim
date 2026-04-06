import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map API-Football team names to our team codes
const teamNameToCode: Record<string, string> = {
  "brazil": "BRA", "argentina": "ARG", "uruguay": "URU", "colombia": "COL",
  "ecuador": "ECU", "paraguay": "PAR", "peru": "PER", "chile": "CHI",
  "bolivia": "BOL", "venezuela": "VEN", "mexico": "MEX",
  "usa": "USA", "united states": "USA", "canada": "CAN",
  "germany": "GER", "france": "FRA", "spain": "ESP", "england": "ENG",
  "italy": "ITA", "portugal": "POR", "netherlands": "NED", "holland": "NED",
  "belgium": "BEL", "croatia": "CRO", "serbia": "SRB", "switzerland": "SUI",
  "denmark": "DEN", "poland": "POL", "austria": "AUT", "czech republic": "CZE",
  "czechia": "CZE", "scotland": "SCO", "wales": "WAL", "ukraine": "UKR",
  "sweden": "SWE", "norway": "NOR", "turkey": "TUR", "romania": "ROU",
  "hungary": "HUN", "greece": "GRE", "slovakia": "SVK", "slovenia": "SVN",
  "japan": "JPN", "south korea": "KOR", "korea republic": "KOR",
  "australia": "AUS", "saudi arabia": "KSA", "iran": "IRN", "qatar": "QAT",
  "iraq": "IRQ", "uzbekistan": "UZB", "china": "CHN", "indonesia": "IDN",
  "bahrain": "BHR",
  "morocco": "MAR", "senegal": "SEN", "nigeria": "NGA", "ghana": "GHA",
  "cameroon": "CMR", "egypt": "EGY", "tunisia": "TUN", "ivory coast": "CIV",
  "cote d'ivoire": "CIV", "mali": "MLI", "algeria": "ALG",
  "south africa": "RSA", "dr congo": "COD",
  "costa rica": "CRC", "honduras": "HON", "panama": "PAN", "jamaica": "JAM",
  "el salvador": "SLV", "trinidad and tobago": "TRI",
  "new zealand": "NZL",
  "ireland": "IRL", "republic of ireland": "IRL",
  "north macedonia": "MKD", "iceland": "ISL", "finland": "FIN",
  "georgia": "GEO", "albania": "ALB", "montenegro": "MNE",
  "bosnia and herzegovina": "BIH", "bosnia": "BIH",
  "luxembourg": "LUX", "israel": "ISR",
  "india": "IND", "thailand": "THA", "vietnam": "VNM",
  "jordan": "JOR", "oman": "OMA", "palestine": "PLE", "syria": "SYR",
  "korea dpr": "PRK", "north korea": "PRK",
  "curacao": "CUR", "haiti": "HAI", "bermuda": "BER",
  "guatemala": "GUA", "suriname": "SUR",
  "cape verde": "CPV", "burkina faso": "BFA", "guinea": "GUI",
  "mozambique": "MOZ", "tanzania": "TAN", "kenya": "KEN",
  "uganda": "UGA", "zambia": "ZAM", "zimbabwe": "ZIM",
  "congo": "CGO", "benin": "BEN", "togo": "TOG",
  "gabon": "GAB", "equatorial guinea": "EQG",
  "comoros": "COM", "mauritania": "MTN", "namibia": "NAM",
  "angola": "ANG", "niger": "NIG",
  "fiji": "FIJ", "solomon islands": "SOL",
  "chinese taipei": "TPE", "philippines": "PHI", "malaysia": "MAS",
  "singapore": "SIN", "myanmar": "MYA", "cambodia": "CAM",
  "kyrgyzstan": "KGZ", "tajikistan": "TJK", "turkmenistan": "TKM",
  "kuwait": "KUW", "united arab emirates": "UAE", "yemen": "YEM", "lebanon": "LBN",
};

function normalizeTeamName(name: string): string {
  return name.toLowerCase().trim();
}

function findTeamCode(apiName: string): string | null {
  const normalized = normalizeTeamName(apiName);
  if (teamNameToCode[normalized]) return teamNameToCode[normalized];
  // Fuzzy: check if any key is contained
  for (const [key, code] of Object.entries(teamNameToCode)) {
    if (normalized.includes(key) || key.includes(normalized)) return code;
  }
  return null;
}

function mapPhase(round: string): { phase: string; group_name: string | null } {
  const r = round.toLowerCase();
  if (r.includes("group")) {
    // Extract group letter e.g. "Group A - 1" -> "Grupo A"
    const match = r.match(/group\s+([a-l])/i);
    return { phase: "groups", group_name: match ? `Grupo ${match[1].toUpperCase()}` : null };
  }
  if (r.includes("round of 32") || r.includes("32nd")) return { phase: "round_of_32", group_name: null };
  if (r.includes("round of 16") || r.includes("16th")) return { phase: "round_of_16", group_name: null };
  if (r.includes("quarter")) return { phase: "quarter_finals", group_name: null };
  if (r.includes("semi")) return { phase: "semi_finals", group_name: null };
  if (r.includes("final") && !r.includes("semi") && !r.includes("quarter")) return { phase: "final", group_name: null };
  if (r.includes("3rd place") || r.includes("third")) return { phase: "final", group_name: null };
  return { phase: "groups", group_name: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
    if (!RAPIDAPI_KEY) {
      return new Response(JSON.stringify({ error: "RAPIDAPI_KEY not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch fixtures from API-Football for World Cup 2026
    // League ID 1 = FIFA World Cup
    const apiUrl = "https://api-football-v1.p.rapidapi.com/v3/fixtures?league=1&season=2026";
    const apiRes = await fetch(apiUrl, {
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": "api-football-v1.p.rapidapi.com",
      },
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error("API-Football error:", apiRes.status, errText);
      return new Response(JSON.stringify({ error: "API-Football request failed", status: apiRes.status }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiData = await apiRes.json();
    const fixtures = apiData?.response || [];

    if (fixtures.length === 0) {
      return new Response(JSON.stringify({ error: "No fixtures returned from API", raw_errors: apiData?.errors }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing teams
    const { data: existingTeams } = await supabase.from("teams").select("*");
    const teamsByCode = new Map((existingTeams || []).map((t: any) => [t.code, t]));

    let teamsCreated = 0;
    let teamsUpdated = 0;
    let matchesCreated = 0;
    let matchesUpdated = 0;

    // Collect all fixture IDs from API
    const apiFixtureIds: number[] = [];

    for (const fixture of fixtures) {
      const homeApiName = fixture.teams?.home?.name || "";
      const awayApiName = fixture.teams?.away?.name || "";
      const homeCode = findTeamCode(homeApiName);
      const awayCode = findTeamCode(awayApiName);
      const fixtureId = fixture.fixture?.id;
      const fixtureDate = fixture.fixture?.date;
      const venue = fixture.fixture?.venue?.city || fixture.fixture?.venue?.name || null;
      const round = fixture.league?.round || "";
      const { phase, group_name } = mapPhase(round);

      const homeGoals = fixture.goals?.home;
      const awayGoals = fixture.goals?.away;
      const fixtureStatus = fixture.fixture?.status?.short || "NS";
      const isFinished = ["FT", "AET", "PEN"].includes(fixtureStatus);

      apiFixtureIds.push(fixtureId);

      // Ensure home team exists
      let homeTeamId: string | null = null;
      if (homeCode && teamsByCode.has(homeCode)) {
        homeTeamId = teamsByCode.get(homeCode)!.id;
        // Update group if needed
        if (group_name) {
          await supabase.from("teams").update({ group_name }).eq("id", homeTeamId);
          teamsUpdated++;
        }
      } else if (homeCode) {
        const { data: newTeam } = await supabase.from("teams").insert({
          name: homeApiName, code: homeCode, group_name,
        }).select().single();
        if (newTeam) {
          teamsByCode.set(homeCode, newTeam);
          homeTeamId = newTeam.id;
          teamsCreated++;
        }
      }

      // Ensure away team exists
      let awayTeamId: string | null = null;
      if (awayCode && teamsByCode.has(awayCode)) {
        awayTeamId = teamsByCode.get(awayCode)!.id;
        if (group_name) {
          await supabase.from("teams").update({ group_name }).eq("id", awayTeamId);
        }
      } else if (awayCode) {
        const { data: newTeam } = await supabase.from("teams").insert({
          name: awayApiName, code: awayCode, group_name,
        }).select().single();
        if (newTeam) {
          teamsByCode.set(awayCode, newTeam);
          awayTeamId = newTeam.id;
          teamsCreated++;
        }
      }

      // Upsert match by api_fixture_id
      const matchData: any = {
        api_fixture_id: fixtureId,
        match_date: fixtureDate,
        venue,
        phase,
        group_name,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        status: isFinished ? "finished" : "scheduled",
        home_score: isFinished ? homeGoals : null,
        away_score: isFinished ? awayGoals : null,
        result_source: isFinished ? "api" : null,
      };

      // Check if match already exists
      const { data: existingMatch } = await supabase
        .from("matches")
        .select("id")
        .eq("api_fixture_id", fixtureId)
        .maybeSingle();

      if (existingMatch) {
        await supabase.from("matches").update(matchData).eq("id", existingMatch.id);
        matchesUpdated++;
      } else {
        await supabase.from("matches").insert(matchData);
        matchesCreated++;
      }
    }

    // Delete old matches that don't have api_fixture_id (placeholder data)
    const { data: deletedMatches } = await supabase
      .from("matches")
      .delete()
      .is("api_fixture_id", null)
      .select("id");

    const matchesRemoved = deletedMatches?.length || 0;

    return new Response(JSON.stringify({
      success: true,
      fixtures_from_api: fixtures.length,
      teams_created: teamsCreated,
      teams_updated: teamsUpdated,
      matches_created: matchesCreated,
      matches_updated: matchesUpdated,
      matches_removed: matchesRemoved,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error seeding matches:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
