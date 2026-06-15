import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE = "https://www.futebolnatv.com.br";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Aliases (PT → outras formas que podem aparecer em slugs). Apply normalize() to both sides. */
const teamAliases: Record<string, string[]> = {
  "Estados Unidos": ["eua", "usa", "united states"],
  "Coreia do Sul": ["coreia", "south korea", "korea"],
  "Arábia Saudita": ["arabia"],
  "Costa do Marfim": ["costa marfim", "ivory coast"],
  "Bósnia e Herzegovina": ["bosnia", "bosnia e herzegovina", "bosnia herzegovina"],
  "RD Congo": ["rd congo", "congo", "dr congo"],
  "País de Gales": ["pais de gales", "gales", "wales"],
  "Irlanda do Norte": ["irlanda norte"],
  "Nova Zelândia": ["nova zelandia", "new zealand"],
  "South Africa": ["africa do sul", "south africa"],
  "Cape Verde": ["cabo verde", "cape verde"],
  "Holanda": ["paises baixos", "netherlands"],
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugTokens(s: string): string {
  return normalize(s).replace(/\s+/g, "-");
}

function teamMatchesSlug(dbName: string, slugPart: string): boolean {
  const a = normalize(slugPart.replace(/-/g, " "));
  const d = normalize(dbName);
  if (a === d) return true;
  if (a.startsWith(d + " ") || a.endsWith(" " + d) || a.includes(" " + d + " ")) return true;
  if (d.startsWith(a + " ") || d.endsWith(" " + a)) return true;
  const aliases = (teamAliases[dbName] ?? []).map(normalize);
  return aliases.some((al) => al === a || a.includes(al) || al.includes(a));
}

interface DayLink {
  slug: string;
  homeSlug: string;
  awaySlug: string;
}

async function fetchDayLinks(path: string): Promise<DayLink[]> {
  const res = await fetch(`${BASE}${path}`, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR" } });
  if (!res.ok) {
    console.log(`Day fetch failed ${path}: ${res.status}`);
    return [];
  }
  const html = await res.text();
  const re = /href="\/aovivo\/([a-z0-9-]+)\.html"/g;
  const seen = new Set<string>();
  const out: DayLink[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const slug = m[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    const parts = slug.split("-x-");
    if (parts.length !== 2) continue;
    const homeSlug = parts[0];
    // strip trailing hex hash (8+ hex chars)
    const awaySlug = parts[1].replace(/-[a-f0-9]{8,}$/i, "");
    out.push({ slug, homeSlug, awaySlug });
  }
  return out;
}

function prettifyChannel(raw: string): string {
  const s = raw.trim().replace(/^\(|\)$/g, "");
  const map: Record<string, string> = {
    "GLOBO": "Globo",
    "SBT": "SBT",
    "BAND": "Band",
    "RECORD": "Record",
    "REDE TV": "RedeTV",
    "SPORTV": "SporTV",
    "SPORTV 2": "SporTV 2",
    "SPORTV 3": "SporTV 3",
    "GE TV": "ge.tv",
    "GE.TV": "ge.tv",
    "CAZÉ TV": "CazéTV",
    "CAZE TV": "CazéTV",
    "CAZÉTV": "CazéTV",
    "ESPN": "ESPN",
    "ESPN 2": "ESPN 2",
    "ESPN 3": "ESPN 3",
    "ESPN 4": "ESPN 4",
    "DISNEY+": "Disney+",
    "DISNEY +": "Disney+",
    "PREMIERE": "Premiere",
    "PRIME VIDEO": "Prime Video",
    "AMAZON PRIME": "Prime Video",
    "PARAMOUNT+": "Paramount+",
    "YOUTUBE": "YouTube",
    "FIFA+": "FIFA+",
  };
  const up = s.toUpperCase();
  return map[up] ?? s;
}

async function fetchChannels(slug: string): Promise<string[]> {
  const res = await fetch(`${BASE}/aovivo/${slug}.html`, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR" } });
  if (!res.ok) return [];
  const html = await res.text();
  // JSON-LD FAQ has: "A partida terá transmissão ao vivo por X, Y e Z."
  let m = html.match(/transmiss[ãa]o ao vivo por ([^\.\"]+)/i);
  if (!m) m = html.match(/jogo ser[áa] transmitido por ([^\.\"]+)/i);
  if (!m) return [];
  const raw = m[1].trim();
  // split on commas and " e "
  const parts = raw.split(/,\s*|\s+e\s+/i).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const pretty = prettifyChannel(p);
    const key = pretty.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(pretty);
    }
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Look at matches in the next 3 days (timezone-tolerant)
    const now = new Date();
    const future = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const past = new Date(now.getTime() - 12 * 60 * 60 * 1000); // include "today" matches already started

    const { data: matches, error: mErr } = await supabase
      .from("matches")
      .select("id, match_date, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)")
      .gte("match_date", past.toISOString())
      .lte("match_date", future.toISOString())
      .order("match_date", { ascending: true });
    if (mErr) throw new Error(mErr.message);

    const dbMatches = (matches ?? []) as any[];
    console.log(`DB matches in window: ${dbMatches.length}`);

    // Fetch day pages
    const [todayLinks, tmrLinks, ystLinks] = await Promise.all([
      fetchDayLinks("/jogos-hoje"),
      fetchDayLinks("/jogos-amanha"),
      fetchDayLinks("/jogos-ontem"),
    ]);
    const allLinks: DayLink[] = [];
    const linkSeen = new Set<string>();
    for (const l of [...ystLinks, ...todayLinks, ...tmrLinks]) {
      if (linkSeen.has(l.slug)) continue;
      linkSeen.add(l.slug);
      allLinks.push(l);
    }
    console.log(`Day links found: ${allLinks.length}`);

    let updated = 0;
    const unmatched: string[] = [];
    const matched: { game: string; channels: string[] }[] = [];

    for (const m of dbMatches) {
      const home = m.home_team?.name;
      const away = m.away_team?.name;
      if (!home || !away) continue;
      const label = `${home} vs ${away}`;

      const link = allLinks.find(
        (l) => teamMatchesSlug(home, l.homeSlug) && teamMatchesSlug(away, l.awaySlug),
      );
      if (!link) {
        unmatched.push(label);
        continue;
      }

      const channels = await fetchChannels(link.slug);
      const { error: upErr } = await supabase
        .from("match_broadcasts")
        .upsert(
          {
            match_id: m.id,
            channels,
            source: "futebolnatv",
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "match_id" },
        );
      if (upErr) {
        console.error(`Upsert error ${label}: ${upErr.message}`);
        continue;
      }
      updated++;
      matched.push({ game: label, channels });
      console.log(`✅ ${label} → ${channels.join(", ") || "(sem canais)"}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: dbMatches.length,
        updated,
        unmatched: unmatched.length ? unmatched : undefined,
        matched: matched.length ? matched : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("fetch-broadcasts error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
