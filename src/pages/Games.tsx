import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MatchCard from "@/components/MatchCard";
import { formatBrazilDayHeading, getBrazilDayKey } from "@/lib/brazilDate";

interface MatchWithTeams {
  id: string;
  phase: string;
  group_name: string | null;
  match_date: string;
  venue: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_team: { name: string; code: string } | null;
  away_team: { name: string; code: string } | null;
}

interface MatchRow {
  id: string;
  phase: string;
  group_name: string | null;
  match_date: string;
  venue: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
}

interface TeamRow {
  id: string;
  name: string;
  code: string;
}

interface Prediction {
  match_id: string;
  home_score: number;
  away_score: number;
  points: number | null;
}

interface OddsData {
  home: number | null;
  draw: number | null;
  away: number | null;
  bookmaker?: string;
}

const PHASES = [
  { value: "groups", label: "Grupos" },
  { value: "test", label: "Teste" },
  { value: "round_of_32", label: "32 avos" },
  { value: "round_of_16", label: "Oitavas" },
  { value: "quarter_finals", label: "Quartas" },
  { value: "semi_finals", label: "Semifinal" },
  { value: "final", label: "Final" },
];

export default function Games() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [matches, setMatches] = useState<MatchWithTeams[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [editScores, setEditScores] = useState<Record<string, { home: string; away: string }>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [odds, setOdds] = useState<Record<string, OddsData>>({});
  const [betDistribution, setBetDistribution] = useState<Record<string, { home: number; draw: number; away: number; total: number }>>({});
  const [broadcasts, setBroadcasts] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchMatches();
    if (user) fetchPredictions();
  }, [user]);

  useEffect(() => {
    if (matches.length > 0) {
      fetchOdds();
      fetchBetDistribution();
      fetchBroadcasts();
    }
  }, [matches]);

  const fetchBroadcasts = async () => {
    const ids = matches.map((m) => m.id);
    if (ids.length === 0) return;
    const { data } = await supabase
      .from("match_broadcasts")
      .select("match_id, channels")
      .in("match_id", ids);
    if (!data) return;
    const map: Record<string, string[]> = {};
    data.forEach((r: any) => { map[r.match_id] = (r.channels || []) as string[]; });
    setBroadcasts(map);
  };

  const fetchMatches = async () => {
    const [{ data: matchesData, error: matchesError }, { data: teamsData, error: teamsError }] = await Promise.all([
      supabase
        .from("matches")
        .select("id, phase, group_name, match_date, venue, status, home_score, away_score, home_team_id, away_team_id")
        .order("match_date", { ascending: true }),
      supabase
        .from("teams")
        .select("id, name, code"),
    ]);

    if (matchesError || teamsError) {
      toast({
        title: "Erro ao carregar jogos",
        description: matchesError?.message || teamsError?.message || "Tente novamente.",
        variant: "destructive",
      });
      return;
    }

    const teamsById = new Map((teamsData as TeamRow[] | null)?.map((team) => [team.id, team]));

    const mappedMatches = ((matchesData as MatchRow[] | null) ?? []).map((match) => ({
      id: match.id,
      phase: match.phase,
      group_name: match.group_name,
      match_date: match.match_date,
      venue: match.venue,
      status: match.status,
      home_score: match.home_score,
      away_score: match.away_score,
      home_team: match.home_team_id ? teamsById.get(match.home_team_id) ?? null : null,
      away_team: match.away_team_id ? teamsById.get(match.away_team_id) ?? null : null,
    }));

    setMatches(mappedMatches);
  };

  const fetchPredictions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("predictions")
      .select("match_id, home_score, away_score, points")
      .eq("user_id", user.id);
    if (data) {
      const map: Record<string, Prediction> = {};
      data.forEach((p) => { map[p.match_id] = p; });
      setPredictions(map);
    }
  };

  const fetchOdds = async () => {
    const { data } = await supabase
      .from("odds_cache")
      .select("match_id, home_odds, draw_odds, away_odds, bookmaker");
    if (!data) return;
    const map: Record<string, OddsData> = {};
    data.forEach((r: any) => {
      map[r.match_id] = {
        home: r.home_odds ? Number(r.home_odds) : null,
        draw: r.draw_odds ? Number(r.draw_odds) : null,
        away: r.away_odds ? Number(r.away_odds) : null,
        bookmaker: r.bookmaker,
      };
    });
    setOdds(map);
  };

  const fetchBetDistribution = async () => {
    // Only fetch for locked matches (1h before kickoff)
    const now = new Date();
    const lockedMatchIds = matches
      .filter((m) => now >= new Date(new Date(m.match_date).getTime() - 60 * 60 * 1000))
      .map((m) => m.id);

    if (lockedMatchIds.length === 0) {
      setBetDistribution({});
      return;
    }

    const { data } = await supabase
      .from("predictions")
      .select("match_id, home_score, away_score")
      .in("match_id", lockedMatchIds);

    if (!data) return;

    const dist: Record<string, { home: number; draw: number; away: number; total: number }> = {};
    data.forEach((p) => {
      if (!dist[p.match_id]) dist[p.match_id] = { home: 0, draw: 0, away: 0, total: 0 };
      dist[p.match_id].total++;
      if (p.home_score > p.away_score) dist[p.match_id].home++;
      else if (p.home_score === p.away_score) dist[p.match_id].draw++;
      else dist[p.match_id].away++;
    });
    setBetDistribution(dist);
  };

  const savePrediction = async (matchId: string) => {
    if (!user) return;
    const scores = editScores[matchId];
    if (!scores || scores.home === "" || scores.away === "") return;

    setSaving((s) => ({ ...s, [matchId]: true }));
    const homeScore = parseInt(scores.home);
    const awayScore = parseInt(scores.away);

    const existing = predictions[matchId];
    if (existing) {
      const { error } = await supabase
        .from("predictions")
        .update({ home_score: homeScore, away_score: awayScore })
        .eq("user_id", user.id)
        .eq("match_id", matchId);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Palpite atualizado!" });
        fetchPredictions();
      }
    } else {
      const { error } = await supabase
        .from("predictions")
        .insert({ user_id: user.id, match_id: matchId, home_score: homeScore, away_score: awayScore });
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Palpite salvo!" });
        fetchPredictions();
      }
    }
    setSaving((s) => ({ ...s, [matchId]: false }));
  };

  const matchesByDay = useMemo(() => matches.reduce<Record<string, MatchWithTeams[]>>((acc, m) => {
    const key = getBrazilDayKey(m.match_date);
    (acc[key] ||= []).push(m);
    return acc;
  }, {}), [matches]);
  const orderedDays = useMemo(() => Object.keys(matchesByDay).sort(), [matchesByDay]);

  // Dia padrão aberto: o que contém o próximo jogo (ou o mais recente, se todos já passaram)
  const defaultOpenDay = useMemo(() => {
    if (orderedDays.length === 0) return null;
    const today = getBrazilDayKey(new Date().toISOString());
    const upcoming = orderedDays.find((d) => d >= today);
    return upcoming ?? orderedDays[orderedDays.length - 1];
  }, [orderedDays]);

  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (defaultOpenDay) setOpenDays((prev) => ({ ...prev, [defaultOpenDay]: true }));
  }, [defaultOpenDay]);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-6">JOGOS DA COPA</h1>

        {matches.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum jogo cadastrado ainda. O administrador precisa cadastrar os jogos.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {orderedDays.map((day) => {
              const label = formatBrazilDayHeading(day);
              const isOpen = openDays[day] ?? false;
              const dayMatches = matchesByDay[day];
              const finishedCount = dayMatches.filter((m) => m.status === "finished").length;
              return (
                <Card key={day}>
                  <Collapsible
                    open={isOpen}
                    onOpenChange={(o) => setOpenDays((prev) => ({ ...prev, [day]: o }))}
                  >
                    <CollapsibleTrigger className="w-full text-left">
                      <div className="flex items-center justify-between gap-3 p-3 sm:p-4 hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                          />
                          <h2 className="text-base sm:text-lg font-bold capitalize text-primary truncate">
                            {label}
                          </h2>
                        </div>
                        <div className="shrink-0 text-xs text-muted-foreground">
                          {dayMatches.length} {dayMatches.length === 1 ? "jogo" : "jogos"}
                          {finishedCount > 0 && ` · ${finishedCount} finalizado${finishedCount > 1 ? "s" : ""}`}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pb-3 sm:px-4 sm:pb-4 pt-0 space-y-3">
                        {dayMatches.map((match) => {
                          const pred = predictions[match.id];
                          const edit = editScores[match.id] ?? {
                            home: pred ? String(pred.home_score) : "",
                            away: pred ? String(pred.away_score) : "",
                          };
                          return (
                            <MatchCard
                              key={match.id}
                              match={match}
                              prediction={pred}
                              editScore={edit}
                              saving={!!saving[match.id]}
                              isLoggedIn={!!user}
                              odds={odds[match.id] || null}
                              betDistribution={betDistribution[match.id] || null}
                              broadcasts={broadcasts[match.id] || null}
                              onEditChange={(scores) => setEditScores((s) => ({ ...s, [match.id]: scores }))}
                              onSave={() => savePrediction(match.id)}
                            />
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        )}

      </div>
    </Layout>
  );
}
