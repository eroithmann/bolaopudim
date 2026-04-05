import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  useEffect(() => {
    fetchMatches();
    if (user) fetchPredictions();
  }, [user]);

  useEffect(() => {
    if (matches.length > 0) fetchOdds();
  }, [matches]);

  const fetchMatches = async () => {
    const { data } = await supabase
      .from("matches")
      .select("id, phase, group_name, match_date, venue, status, home_score, away_score, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)")
      .order("match_date", { ascending: true });
    if (data) setMatches(data as unknown as MatchWithTeams[]);
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

  const matchesByPhase = PHASES.map((phase) => ({
    ...phase,
    matches: matches.filter((m) => m.phase === phase.value),
  })).filter((p) => p.matches.length > 0);

  const defaultTab = matchesByPhase.length > 0 ? matchesByPhase[0].value : "groups";

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
          <Tabs defaultValue={defaultTab}>
            <TabsList className="mb-4 flex-wrap h-auto">
              {matchesByPhase.map((phase) => (
                <TabsTrigger key={phase.value} value={phase.value}>{phase.label}</TabsTrigger>
              ))}
            </TabsList>

            {matchesByPhase.map((phase) => (
              <TabsContent key={phase.value} value={phase.value} className="space-y-3">
                {phase.matches.map((match) => {
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
                      onEditChange={(scores) => setEditScores((s) => ({ ...s, [match.id]: scores }))}
                      onSave={() => savePrediction(match.id)}
                    />
                  );
                })}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </Layout>
  );
}
