import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import MatchCard from "@/components/MatchCard";

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

  useEffect(() => {
    fetchMatches();
    if (user) fetchPredictions();
  }, [user]);

  useEffect(() => {
    if (matches.length > 0) {
      fetchOdds();
      fetchBetDistribution();
    }
  }, [matches]);

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
    try {
      const response = await supabase.functions.invoke("fetch-odds");
      if (response.data?.odds) {
        setOdds(response.data.odds);
      }
    } catch {
      // Odds are optional, fail silently
    }
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

  // Agrupa todos os jogos por dia (YYYY-MM-DD)
  const matchesByDay = matches.reduce<Record<string, MatchWithTeams[]>>((acc, m) => {
    const key = m.match_date.slice(0, 10);
    (acc[key] ||= []).push(m);
    return acc;
  }, {});
  const orderedDays = Object.keys(matchesByDay).sort();

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
          <div className="space-y-8">
            {orderedDays.map((day) => {
              const dayDate = parseISO(day + "T12:00:00Z");
              const label = format(dayDate, "EEEE, d 'de' MMMM", { locale: ptBR });
              return (
                <section key={day}>
                  <div className="sticky top-16 z-10 -mx-4 px-4 py-2 mb-3 bg-background/95 backdrop-blur border-b">
                    <h2 className="text-lg font-bold capitalize text-primary">
                      {label}
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {matchesByDay[day].map((match) => {
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
                          onEditChange={(scores) => setEditScores((s) => ({ ...s, [match.id]: scores }))}
                          onSave={() => savePrediction(match.id)}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

      </div>
    </Layout>
  );
}
