import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Medal } from "lucide-react";

interface RankingEntry {
  user_id: string;
  name: string | null;
  total_points: number;
  exact_scores: number;
  goal_diff: number;
  results_only: number;
}

export default function Ranking() {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRanking();
  }, []);

  const fetchRanking = async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name");

    // Only fetch finished matches with scores
    const { data: finishedMatches } = await supabase
      .from("matches")
      .select("id, home_score, away_score")
      .eq("status", "finished")
      .not("home_score", "is", null)
      .not("away_score", "is", null);

    const matchById = new Map<string, { home_score: number; away_score: number }>();
    (finishedMatches || []).forEach((m: any) => {
      matchById.set(m.id, { home_score: m.home_score, away_score: m.away_score });
    });

    const { data: predictions } = await supabase
      .from("predictions")
      .select("user_id, match_id, home_score, away_score, points")
      .not("points", "is", null);

    const grouped: Record<string, RankingEntry> = {};

    if (profiles) {
      profiles.forEach((p: any) => {
        grouped[p.user_id] = {
          user_id: p.user_id,
          name: p.name,
          total_points: 0,
          exact_scores: 0,
          goal_diff: 0,
          results_only: 0,
        };
      });
    }

    if (predictions) {
      predictions.forEach((p: any) => {
        if (!grouped[p.user_id]) return;
        const m = matchById.get(p.match_id);
        if (!m) return;
        const pts = p.points || 0;
        grouped[p.user_id].total_points += pts;
        const exact = p.home_score === m.home_score && p.away_score === m.away_score;
        const pDiff = p.home_score - p.away_score;
        const rDiff = m.home_score - m.away_score;
        const sameResult = Math.sign(pDiff) === Math.sign(rDiff);
        if (exact) grouped[p.user_id].exact_scores++;
        else if (sameResult && pDiff === rDiff && pDiff !== 0) grouped[p.user_id].goal_diff++;
        else if (sameResult) grouped[p.user_id].results_only++;
      });
    }

    const sorted = Object.values(grouped).sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      return b.exact_scores - a.exact_scores;
    });
    setRanking(sorted);
    setLoading(false);
  };

  const getMedalColor = (pos: number) => {
    if (pos === 0) return "text-yellow-500";
    if (pos === 1) return "text-gray-400";
    if (pos === 2) return "text-amber-700";
    return "";
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-6 flex items-center gap-3">
          <Trophy className="h-8 w-8 text-secondary" />
          RANKING GERAL
        </h1>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="text-center py-12 text-muted-foreground">Carregando...</p>
            ) : ranking.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">Nenhum resultado ainda. Os pontos aparecem quando os jogos terminam.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Jogador</TableHead>
                    <TableHead className="text-center">Exatos</TableHead>
                    <TableHead className="text-center">Saldo</TableHead>
                    <TableHead className="text-center">Resultados</TableHead>
                    <TableHead className="text-right">Pontos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((entry, i) => (
                    <TableRow key={entry.user_id}>
                      <TableCell className="font-bold">
                        <span className={`flex items-center gap-1 ${getMedalColor(i)}`}>
                          {i < 3 && <Medal className="h-4 w-4" />}
                          {i + 1}º
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{entry.name || "Anônimo"}</TableCell>
                      <TableCell className="text-center">{entry.exact_scores}</TableCell>
                      <TableCell className="text-center">{entry.goal_diff}</TableCell>
                      <TableCell className="text-center">{entry.results_only}</TableCell>
                      <TableCell className="text-right font-bold text-primary text-lg">{entry.total_points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl">SISTEMA DE PONTUAÇÃO</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">PONTOS BASE</h3>
              <div className="grid sm:grid-cols-4 gap-4 text-center">
                <div className="p-4 rounded-lg bg-primary/10">
                  <span className="block text-3xl font-bold text-primary">3</span>
                  <span className="text-sm text-muted-foreground">Placar exato</span>
                </div>
                <div className="p-4 rounded-lg bg-secondary/20">
                  <span className="block text-3xl font-bold text-secondary-foreground">2</span>
                  <span className="text-sm text-muted-foreground">Resultado + saldo de gols</span>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <span className="block text-3xl font-bold">1</span>
                  <span className="text-sm text-muted-foreground">Apenas o resultado</span>
                </div>
                <div className="p-4 rounded-lg bg-destructive/10">
                  <span className="block text-3xl font-bold text-destructive">0</span>
                  <span className="text-sm text-muted-foreground">Errou tudo</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">MULTIPLICADOR POR FASE</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
                <div className="p-3 rounded-lg bg-muted"><span className="block text-xl font-bold">x1</span><span className="text-xs text-muted-foreground">1ª fase</span></div>
                <div className="p-3 rounded-lg bg-muted"><span className="block text-xl font-bold">x2</span><span className="text-xs text-muted-foreground">2ª fase</span></div>
                <div className="p-3 rounded-lg bg-muted"><span className="block text-xl font-bold">x3</span><span className="text-xs text-muted-foreground">Oitavas</span></div>
                <div className="p-3 rounded-lg bg-muted"><span className="block text-xl font-bold">x4</span><span className="text-xs text-muted-foreground">Quartas</span></div>
                <div className="p-3 rounded-lg bg-muted"><span className="block text-xl font-bold">x5</span><span className="text-xs text-muted-foreground">Semi</span></div>
                <div className="p-3 rounded-lg bg-muted"><span className="block text-xl font-bold">x2</span><span className="text-xs text-muted-foreground">3º lugar</span></div>
                <div className="p-3 rounded-lg bg-primary/10"><span className="block text-xl font-bold text-primary">x6</span><span className="text-xs text-muted-foreground">Final</span></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
