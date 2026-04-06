import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// All 72 group stage matches from FIFA official schedule
const GROUP_STAGE_MATCHES = [
  // Group A
  { home: "Mexico", away: "South Africa", group: "A", date: "2026-06-11T19:00:00Z", venue: "Mexico City" },
  { home: "South Korea", away: "Playoff Winner D", group: "A", date: "2026-06-12T02:00:00Z", venue: "Guadalajara" },
  { home: "Playoff Winner D", away: "South Africa", group: "A", date: "2026-06-18T16:00:00Z", venue: "Atlanta" },
  { home: "Mexico", away: "South Korea", group: "A", date: "2026-06-19T01:00:00Z", venue: "Guadalajara" },
  { home: "Playoff Winner D", away: "Mexico", group: "A", date: "2026-06-25T01:00:00Z", venue: "Mexico City" },
  { home: "South Africa", away: "South Korea", group: "A", date: "2026-06-25T01:00:00Z", venue: "Monterrey" },

  // Group B
  { home: "Canada", away: "Playoff Winner A", group: "B", date: "2026-06-12T19:00:00Z", venue: "Toronto" },
  { home: "Qatar", away: "Switzerland", group: "B", date: "2026-06-13T19:00:00Z", venue: "San Francisco" },
  { home: "Switzerland", away: "Playoff Winner A", group: "B", date: "2026-06-18T19:00:00Z", venue: "Los Angeles" },
  { home: "Canada", away: "Qatar", group: "B", date: "2026-06-18T22:00:00Z", venue: "Vancouver" },
  { home: "Switzerland", away: "Canada", group: "B", date: "2026-06-24T19:00:00Z", venue: "Vancouver" },
  { home: "Playoff Winner A", away: "Qatar", group: "B", date: "2026-06-24T19:00:00Z", venue: "Seattle" },

  // Group C
  { home: "Brazil", away: "Morocco", group: "C", date: "2026-06-13T22:00:00Z", venue: "New Jersey" },
  { home: "Haiti", away: "Scotland", group: "C", date: "2026-06-14T01:00:00Z", venue: "Boston" },
  { home: "Scotland", away: "Morocco", group: "C", date: "2026-06-19T22:00:00Z", venue: "Boston" },
  { home: "Brazil", away: "Haiti", group: "C", date: "2026-06-20T01:00:00Z", venue: "Philadelphia" },
  { home: "Scotland", away: "Brazil", group: "C", date: "2026-06-24T22:00:00Z", venue: "Miami" },
  { home: "Morocco", away: "Haiti", group: "C", date: "2026-06-24T22:00:00Z", venue: "Atlanta" },

  // Group D
  { home: "USA", away: "Paraguay", group: "D", date: "2026-06-13T01:00:00Z", venue: "Los Angeles" },
  { home: "Australia", away: "Playoff Winner C", group: "D", date: "2026-06-14T04:00:00Z", venue: "Vancouver" },
  { home: "USA", away: "Australia", group: "D", date: "2026-06-19T19:00:00Z", venue: "Seattle" },
  { home: "Playoff Winner C", away: "Paraguay", group: "D", date: "2026-06-20T04:00:00Z", venue: "San Francisco" },
  { home: "Playoff Winner C", away: "USA", group: "D", date: "2026-06-26T02:00:00Z", venue: "Los Angeles" },
  { home: "Paraguay", away: "Australia", group: "D", date: "2026-06-26T02:00:00Z", venue: "San Francisco" },

  // Group E
  { home: "Germany", away: "Curacao", group: "E", date: "2026-06-14T17:00:00Z", venue: "Houston" },
  { home: "Ivory Coast", away: "Ecuador", group: "E", date: "2026-06-14T23:00:00Z", venue: "Philadelphia" },
  { home: "Germany", away: "Ivory Coast", group: "E", date: "2026-06-20T20:00:00Z", venue: "Toronto" },
  { home: "Ecuador", away: "Curacao", group: "E", date: "2026-06-21T00:00:00Z", venue: "Kansas City" },
  { home: "Ecuador", away: "Germany", group: "E", date: "2026-06-25T20:00:00Z", venue: "New Jersey" },
  { home: "Curacao", away: "Ivory Coast", group: "E", date: "2026-06-25T20:00:00Z", venue: "Philadelphia" },

  // Group F
  { home: "Netherlands", away: "Japan", group: "F", date: "2026-06-14T20:00:00Z", venue: "Dallas" },
  { home: "Playoff Winner B", away: "Tunisia", group: "F", date: "2026-06-15T02:00:00Z", venue: "Monterrey" },
  { home: "Netherlands", away: "Playoff Winner B", group: "F", date: "2026-06-20T17:00:00Z", venue: "Houston" },
  { home: "Tunisia", away: "Japan", group: "F", date: "2026-06-21T04:00:00Z", venue: "Monterrey" },
  { home: "Tunisia", away: "Netherlands", group: "F", date: "2026-06-25T23:00:00Z", venue: "Kansas City" },
  { home: "Japan", away: "Playoff Winner B", group: "F", date: "2026-06-25T23:00:00Z", venue: "Dallas" },

  // Group G
  { home: "Belgium", away: "Egypt", group: "G", date: "2026-06-15T19:00:00Z", venue: "Seattle" },
  { home: "Iran", away: "New Zealand", group: "G", date: "2026-06-16T01:00:00Z", venue: "Los Angeles" },
  { home: "Belgium", away: "Iran", group: "G", date: "2026-06-21T19:00:00Z", venue: "Los Angeles" },
  { home: "New Zealand", away: "Egypt", group: "G", date: "2026-06-22T01:00:00Z", venue: "Vancouver" },
  { home: "New Zealand", away: "Belgium", group: "G", date: "2026-06-27T03:00:00Z", venue: "Vancouver" },
  { home: "Egypt", away: "Iran", group: "G", date: "2026-06-27T03:00:00Z", venue: "Seattle" },

  // Group H
  { home: "Spain", away: "Cape Verde", group: "H", date: "2026-06-15T16:00:00Z", venue: "Atlanta" },
  { home: "Saudi Arabia", away: "Uruguay", group: "H", date: "2026-06-15T22:00:00Z", venue: "Miami" },
  { home: "Spain", away: "Saudi Arabia", group: "H", date: "2026-06-21T16:00:00Z", venue: "Atlanta" },
  { home: "Uruguay", away: "Cape Verde", group: "H", date: "2026-06-21T22:00:00Z", venue: "Miami" },
  { home: "Uruguay", away: "Spain", group: "H", date: "2026-06-26T00:00:00Z", venue: "Guadalajara" },
  { home: "Cape Verde", away: "Saudi Arabia", group: "H", date: "2026-06-26T00:00:00Z", venue: "Houston" },

  // Group I
  { home: "France", away: "Senegal", group: "I", date: "2026-06-16T19:00:00Z", venue: "New Jersey" },
  { home: "Playoff Winner 2", away: "Norway", group: "I", date: "2026-06-16T22:00:00Z", venue: "Boston" },
  { home: "France", away: "Playoff Winner 2", group: "I", date: "2026-06-22T21:00:00Z", venue: "Philadelphia" },
  { home: "Norway", away: "Senegal", group: "I", date: "2026-06-23T00:00:00Z", venue: "New Jersey" },
  { home: "Norway", away: "France", group: "I", date: "2026-06-26T19:00:00Z", venue: "Boston" },
  { home: "Senegal", away: "Playoff Winner 2", group: "I", date: "2026-06-26T19:00:00Z", venue: "Toronto" },

  // Group J
  { home: "Argentina", away: "Algeria", group: "J", date: "2026-06-17T01:00:00Z", venue: "Kansas City" },
  { home: "Austria", away: "Jordan", group: "J", date: "2026-06-17T04:00:00Z", venue: "San Francisco" },
  { home: "Argentina", away: "Austria", group: "J", date: "2026-06-22T17:00:00Z", venue: "Dallas" },
  { home: "Jordan", away: "Algeria", group: "J", date: "2026-06-23T03:00:00Z", venue: "San Francisco" },
  { home: "Jordan", away: "Argentina", group: "J", date: "2026-06-28T02:00:00Z", venue: "Dallas" },
  { home: "Algeria", away: "Austria", group: "J", date: "2026-06-28T02:00:00Z", venue: "Kansas City" },

  // Group K
  { home: "Portugal", away: "Playoff Winner 1", group: "K", date: "2026-06-17T17:00:00Z", venue: "Houston" },
  { home: "Uzbekistan", away: "Colombia", group: "K", date: "2026-06-18T02:00:00Z", venue: "Mexico City" },
  { home: "Portugal", away: "Uzbekistan", group: "K", date: "2026-06-23T17:00:00Z", venue: "Houston" },
  { home: "Colombia", away: "Playoff Winner 1", group: "K", date: "2026-06-24T02:00:00Z", venue: "Guadalajara" },
  { home: "Colombia", away: "Portugal", group: "K", date: "2026-06-27T23:30:00Z", venue: "Miami" },
  { home: "Playoff Winner 1", away: "Uzbekistan", group: "K", date: "2026-06-27T23:30:00Z", venue: "Atlanta" },

  // Group L
  { home: "England", away: "Croatia", group: "L", date: "2026-06-17T20:00:00Z", venue: "Dallas" },
  { home: "Ghana", away: "Panama", group: "L", date: "2026-06-17T23:00:00Z", venue: "Toronto" },
  { home: "England", away: "Ghana", group: "L", date: "2026-06-23T20:00:00Z", venue: "Boston" },
  { home: "Panama", away: "Croatia", group: "L", date: "2026-06-23T23:00:00Z", venue: "Toronto" },
  { home: "Panama", away: "England", group: "L", date: "2026-06-27T21:00:00Z", venue: "New Jersey" },
  { home: "Croatia", away: "Ghana", group: "L", date: "2026-06-27T21:00:00Z", venue: "Philadelphia" },
];

// Map team names to codes
const teamNameToCode: Record<string, string> = {
  "Mexico": "MEX", "South Africa": "RSA", "South Korea": "KOR",
  "Canada": "CAN", "Qatar": "QAT", "Switzerland": "SUI",
  "Brazil": "BRA", "Morocco": "MAR", "Haiti": "HAI", "Scotland": "SCO",
  "USA": "USA", "Paraguay": "PAR", "Australia": "AUS",
  "Germany": "GER", "Curacao": "CUR", "Ivory Coast": "CIV", "Ecuador": "ECU",
  "Netherlands": "NED", "Japan": "JPN", "Tunisia": "TUN",
  "Belgium": "BEL", "Egypt": "EGY", "Iran": "IRN", "New Zealand": "NZL",
  "Spain": "ESP", "Cape Verde": "CPV", "Saudi Arabia": "KSA", "Uruguay": "URU",
  "France": "FRA", "Senegal": "SEN", "Norway": "NOR",
  "Argentina": "ARG", "Algeria": "ALG", "Austria": "AUT", "Jordan": "JOR",
  "Portugal": "POR", "Uzbekistan": "UZB", "Colombia": "COL",
  "England": "ENG", "Croatia": "CRO", "Ghana": "GHA", "Panama": "PAN",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get existing teams
    const { data: existingTeams } = await supabase.from("teams").select("*");
    const teamsByCode = new Map((existingTeams || []).map((t: any) => [t.code, t]));

    let teamsCreated = 0;
    let matchesCreated = 0;
    let matchesSkipped = 0;
    let matchesDeleted = 0;

    // First: delete all existing matches (they're placeholder data)
    const { data: deleted } = await supabase.from("matches").delete().neq("id", "00000000-0000-0000-0000-000000000000").select("id");
    matchesDeleted = deleted?.length || 0;

    for (const match of GROUP_STAGE_MATCHES) {
      const homeCode = teamNameToCode[match.home];
      const awayCode = teamNameToCode[match.away];

      // Skip playoff winner placeholders
      if (!homeCode || !awayCode) {
        matchesSkipped++;
        continue;
      }

      const groupName = `Grupo ${match.group}`;

      // Ensure home team exists
      let homeTeamId: string;
      if (teamsByCode.has(homeCode)) {
        homeTeamId = teamsByCode.get(homeCode)!.id;
        // Update group
        await supabase.from("teams").update({ group_name: groupName }).eq("id", homeTeamId);
      } else {
        const { data: newTeam } = await supabase.from("teams").insert({
          name: match.home, code: homeCode, group_name: groupName,
        }).select().single();
        if (newTeam) {
          teamsByCode.set(homeCode, newTeam);
          homeTeamId = newTeam.id;
          teamsCreated++;
        } else continue;
      }

      // Ensure away team exists
      let awayTeamId: string;
      if (teamsByCode.has(awayCode)) {
        awayTeamId = teamsByCode.get(awayCode)!.id;
        await supabase.from("teams").update({ group_name: groupName }).eq("id", awayTeamId);
      } else {
        const { data: newTeam } = await supabase.from("teams").insert({
          name: match.away, code: awayCode, group_name: groupName,
        }).select().single();
        if (newTeam) {
          teamsByCode.set(awayCode, newTeam);
          awayTeamId = newTeam.id;
          teamsCreated++;
        } else continue;
      }

      // Insert match
      const { error } = await supabase.from("matches").insert({
        match_date: match.date,
        venue: match.venue,
        phase: "groups",
        group_name: groupName,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        status: "scheduled",
      });

      if (!error) matchesCreated++;
    }

    return new Response(JSON.stringify({
      success: true,
      matches_deleted: matchesDeleted,
      matches_created: matchesCreated,
      matches_skipped_playoff: matchesSkipped,
      teams_created: teamsCreated,
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
