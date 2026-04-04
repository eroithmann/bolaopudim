import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getFlagUrl } from "@/lib/teamFlags";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Lock, Check, X } from "lucide-react";

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

  useEffect(() => {
    fetchMatches();
    if (user) fetchPredictions();
  }, [user]);

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

  const isLocked = (matchDate: string) => new Date(matchDate) <= new Date();

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

  const getPointsBadge = (points: number | null) => {
    if (points === null) return null;
    if (points === 5) return <Badge className="bg-primary">5 pts - Exato!</Badge>;
    if (points === 3) return <Badge variant="secondary">3 pts</Badge>;
    if (points === 1) return <Badge variant="outline">1 pt</Badge>;
    return <Badge variant="destructive">0 pts</Badge>;
  };

  const matchesByPhase = PHASES.map((phase) => ({
    ...phase,
    matches: matches.filter((m) => m.phase === phase.value),
  })).filter((p) => p.matches.length > 0);

  const defaultTab = matchesByPhase.length > 0 ? matchesByPhase[0].value : "groups";

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
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
                  const locked = isLocked(match.match_date);
                  const pred = predictions[match.id];
                  const edit = editScores[match.id] ?? {
                    home: pred ? String(pred.home_score) : "",
                    away: pred ? String(pred.away_score) : "",
                  };

                  return (
                    <Card key={match.id} className={match.status === "finished" ? "border-primary/30" : ""}>
                      <CardContent className="py-4">
                        {/* Date + venue */}
                        <div className="flex justify-between items-center mb-3 text-xs text-muted-foreground">
                          <span>{format(new Date(match.match_date), "dd/MM · HH:mm", { locale: ptBR })}</span>
                          <div className="flex items-center gap-2">
                            {match.group_name && <Badge variant="outline" className="text-xs">{match.group_name}</Badge>}
                            {locked && <Lock className="h-3 w-3" />}
                          </div>
                        </div>

                        {/* Match */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {match.home_team && (
                              <img src={getFlagUrl(match.home_team.code)} alt="" className="h-6 w-8 object-cover rounded shrink-0" />
                            )}
                            <span className="font-medium text-sm truncate">{match.home_team?.name || "TBD"}</span>
                          </div>

                          {/* Scores */}
                          <div className="flex items-center gap-1 shrink-0">
                            {match.status === "finished" ? (
                              <span className="font-bold text-lg px-2">{match.home_score} - {match.away_score}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground px-2">vs</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                            <span className="font-medium text-sm truncate">{match.away_team?.name || "TBD"}</span>
                            {match.away_team && (
                              <img src={getFlagUrl(match.away_team.code)} alt="" className="h-6 w-8 object-cover rounded shrink-0" />
                            )}
                          </div>
                        </div>

                        {/* Prediction */}
                        {user && (
                          <div className="mt-3 pt-3 border-t">
                            {locked ? (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Seu palpite:</span>
                                {pred ? (
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{pred.home_score} - {pred.away_score}</span>
                                    {match.status === "finished" && getPointsBadge(pred.points)}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Sem palpite</span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground shrink-0">Palpite:</span>
                                <Input
                                  type="number"
                                  min="0"
                                  max="20"
                                  className="w-16 h-8 text-center"
                                  placeholder="0"
                                  value={edit.home}
                                  onChange={(e) => setEditScores((s) => ({ ...s, [match.id]: { ...edit, home: e.target.value } }))}
                                />
                                <span className="text-muted-foreground">-</span>
                                <Input
                                  type="number"
                                  min="0"
                                  max="20"
                                  className="w-16 h-8 text-center"
                                  placeholder="0"
                                  value={edit.away}
                                  onChange={(e) => setEditScores((s) => ({ ...s, [match.id]: { ...edit, away: e.target.value } }))}
                                />
                                <Button
                                  size="sm"
                                  className="h-8"
                                  disabled={saving[match.id] || edit.home === "" || edit.away === ""}
                                  onClick={() => savePrediction(match.id)}
                                >
                                  {saving[match.id] ? "..." : pred ? "Atualizar" : "Salvar"}
                                </Button>
                              </div>
                            )}
                          </div>
                        )}

                        {!user && (
                          <div className="mt-3 pt-3 border-t text-center">
                            <span className="text-xs text-muted-foreground">Faça login para dar seu palpite</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
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
