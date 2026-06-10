import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extended name mapping for team matching
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
  MEX: ["mexico", "méxico"],
  USA: ["united states", "usa", "estados unidos"],
  CAN: ["canada", "canadá"],
  GER: ["germany", "deutschland", "alemania", "alemanha"],
  FRA: ["france", "francia", "frança"],
  ESP: ["spain", "españa", "espanha"],
  ENG: ["england", "inglaterra"],
  ITA: ["italy", "italia", "itália"],
  POR: ["portugal"],
  NED: ["netherlands", "holland", "holanda", "países baixos"],
  BEL: ["belgium", "bélgica", "belgique"],
  CRO: ["croatia", "croácia", "hrvatska"],
  SRB: ["serbia", "sérvia"],
  SUI: ["switzerland", "suíça", "schweiz"],
  DEN: ["denmark", "dinamarca", "danmark"],
  POL: ["poland", "polônia", "polska"],
  AUT: ["austria", "áustria", "österreich"],
  CZE: ["czech republic", "czechia", "república tcheca"],
  SCO: ["scotland", "escócia"],
  WAL: ["wales", "gales"],
  UKR: ["ukraine", "ucrânia"],
  SWE: ["sweden", "suécia", "sverige"],
  NOR: ["norway", "noruega", "norge"],
  TUR: ["turkey", "turquia", "türkiye"],
  ROU: ["romania", "romênia"],
  HUN: ["hungary", "hungria"],
  GRE: ["greece", "grécia"],
  JPN: ["japan", "japão"],
  KOR: ["south korea", "korea republic", "coreia do sul", "korea"],
  AUS: ["australia", "austrália"],
  KSA: ["saudi arabia", "arábia saudita"],
  IRN: ["iran", "irã"],
  QAT: ["qatar", "catar"],
  IRQ: ["iraq", "iraque"],
  UZB: ["uzbekistan", "uzbequistão"],
  MAR: ["morocco", "marrocos", "maroc"],
  SEN: ["senegal"],
  NGA: ["nigeria", "nigéria"],
  GHA: ["ghana", "gana"],
  CMR: ["cameroon", "camarões", "cameroun"],
  EGY: ["egypt", "egito"],
  TUN: ["tunisia", "tunísia", "tunisie"],
  CIV: ["ivory coast", "cote d'ivoire", "costa do marfim"],
  ALG: ["algeria", "argélia", "algérie"],
  RSA: ["south africa", "áfrica do sul"],
  CRC: ["costa rica"],
  HON: ["honduras"],
  PAN: ["panama", "panamá"],
  JAM: ["jamaica"],
  NZL: ["new zealand", "nova zelândia"],
  IRL: ["ireland", "republic of ireland", "irlanda"],
  ISL: ["iceland", "islândia"],
  FIN: ["finland", "finlândia"],
  GEO: ["georgia", "geórgia"],
  ALB: ["albania", "albânia"],
  BIH: ["bosnia", "bosnia and herzegovina", "bósnia"],
  MKD: ["north macedonia", "macedônia do norte"],
  ISR: ["israel"],
  IDN: ["indonesia", "indonésia"],
  CHN: ["china"],
  IND: ["india", "índia"],
  BHR: ["bahrain", "barein"],
  JOR: ["jordan", "jordânia"],
  UAE: ["united arab emirates", "emirados árabes"],
  COD: ["dr congo", "rd congo"],
  MLI: ["mali"],
  BFA: ["burkina faso"],
  GUI: ["guinea", "guiné"],
  CPV: ["cape verde", "cabo verde"],
  MOZ: ["mozambique", "moçambique"],
  TAN: ["tanzania", "tanzânia"],
  KEN: ["kenya", "quênia"],
  ANG: ["angola"],
  ZAM: ["zambia", "zâmbia"],
  ZIM: ["zimbabwe", "zimbábue"],
  NAM: ["namibia", "namíbia"],
  BEN: ["benin", "benim"],
  TOG: ["togo"],
  GAB: ["gabon", "gabão"],
  EQG: ["equatorial guinea", "guiné equatorial"],
};

function findTeamCode(apiTeamName: string): string | null {
  const normalized = apiTeamName.toLowerCase().trim();
  // First pass: exact match (preferred, avoids false positives like "Australia" → "us")
  for (const [code, names] of Object.entries(nameMap)) {
    if (names.some(n => normalized === n)) return code;
  }
  // Second pass: whole-word containment using word boundaries
  for (const [code, names] of Object.entries(nameMap)) {
    for (const n of names) {
      const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(^|\\W)${escaped}(\\W|$)`, "i");
      if (re.test(normalized) || re.test(n) && new RegExp(`(^|\\W)${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\W|$)`, "i").test(n)) {
        return code;
      }
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ODDS_API_KEY = Deno.env.get("ODDS_API_KEY");
    if (!ODDS_API_KEY) {
      return new Response(JSON.stringify({ odds: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch scheduled matches
    const { data: matches } = await supabase
      .from("matches")
      .select("id, match_date, status, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)")
      .eq("status", "scheduled")
      .order("match_date", { ascending: true })
      .limit(200);

    if (!matches || matches.length === 0) {
      return new Response(JSON.stringify({ odds: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Discover available sports containing "fifa" or "world cup"
    const sportsUrl = `https://api.the-odds-api.com/v4/sports/?apiKey=${ODDS_API_KEY}`;
    const sportsRes = await fetch(sportsUrl);
    let sportKeys: string[] = ["soccer_fifa_world_cup"];

    if (sportsRes.ok) {
      const sportsData = await sportsRes.json();
      const relevantSports = sportsData.filter((s: any) => {
        const title = (s.title || "").toLowerCase();
        const key = (s.key || "").toLowerCase();
        return (
          key.includes("fifa") || key.includes("world_cup") ||
          title.includes("fifa") || title.includes("world cup") ||
          key.includes("soccer_international")
        );
      });
      if (relevantSports.length > 0) {
        sportKeys = relevantSports.map((s: any) => s.key);
      }
      console.log("Available relevant sport keys:", sportKeys);
    } else {
      await sportsRes.text(); // consume body
    }

    // Step 2: Fetch odds from all relevant sport keys
    const allOddsEvents: any[] = [];
    for (const sportKey of sportKeys) {
      try {
        const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=eu,us,uk&markets=h2h&oddsFormat=decimal`;
        const oddsRes = await fetch(oddsUrl);
        if (oddsRes.ok) {
          const data = await oddsRes.json();
          console.log(`Sport key ${sportKey}: ${data.length} events found`);
          allOddsEvents.push(...data);
        } else {
          const errText = await oddsRes.text();
          console.log(`Sport key ${sportKey}: ${oddsRes.status} - ${errText}`);
        }
      } catch (e) {
        console.error(`Error fetching odds for ${sportKey}:`, e);
      }
    }

    console.log(`Total odds events collected: ${allOddsEvents.length}`);

    // Step 3: Match odds to our matches
    const oddsMap: Record<string, { home: number | null; draw: number | null; away: number | null; bookmaker: string }> = {};

    for (const match of matches) {
      const homeTeam = (match as any).home_team;
      const awayTeam = (match as any).away_team;
      if (!homeTeam || !awayTeam) continue;

      const homeCode = homeTeam.code;
      const awayCode = awayTeam.code;

      for (const event of allOddsEvents) {
        const apiHomeCode = findTeamCode(event.home_team);
        const apiAwayCode = findTeamCode(event.away_team);

        if (
          (apiHomeCode === homeCode && apiAwayCode === awayCode) ||
          (apiHomeCode === awayCode && apiAwayCode === homeCode)
        ) {
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
              console.log(`Matched odds for ${homeTeam.name} vs ${awayTeam.name} from ${bookmaker.title}`);
            }
          }
          break;
        }
      }
    }

    console.log(`Odds matched for ${Object.keys(oddsMap).length} out of ${matches.length} matches`);

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
