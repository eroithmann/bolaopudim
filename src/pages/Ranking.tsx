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
  partial_scores: number;
  results_only: number;
}

export default function Ranking() {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRanking();
  }, []);

  const fetchRanking = async () => {
    // Fetch all profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name");

    // Fetch predictions with points
    const { data: predictions } = await supabase
      .from("predictions")
      .select("user_id, points")
      .not("points", "is", null);

    const grouped: Record<string, RankingEntry> = {};

    // Initialize all profiles with zero
    if (profiles) {
      profiles.forEach((p: any) => {
        grouped[p.user_id] = {
          user_id: p.user_id,
          name: p.name,
          total_points: 0,
          exact_scores: 0,
          partial_scores: 0,
          results_only: 0,
        };
      });
    }

    // Add prediction points
    if (predictions) {
      predictions.forEach((p: any) => {
        if (!grouped[p.user_id]) return;
        const pts = p.points || 0;
        grouped[p.user_id].total_points += pts;
        if (pts === 5) grouped[p.user_id].exact_scores++;
        else if (pts === 3) grouped[p.user_id].partial_scores++;
        else if (pts === 1) grouped[p.user_id].results_only++;
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
                    <TableHead className="text-center">Parciais</TableHead>
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
                      <TableCell className="text-center">{entry.partial_scores}</TableCell>
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
          <CardContent>
            <div className="grid sm:grid-cols-4 gap-4 text-center">
              <div className="p-4 rounded-lg bg-primary/10">
                <span className="block text-3xl font-bold text-primary">5</span>
                <span className="text-sm text-muted-foreground">Placar exato</span>
              </div>
              <div className="p-4 rounded-lg bg-secondary/20">
                <span className="block text-3xl font-bold text-secondary-foreground">3</span>
                <span className="text-sm text-muted-foreground">Acertou 1 placar</span>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <span className="block text-3xl font-bold">1</span>
                <span className="text-sm text-muted-foreground">Acertou resultado</span>
              </div>
              <div className="p-4 rounded-lg bg-destructive/10">
                <span className="block text-3xl font-bold text-destructive">0</span>
                <span className="text-sm text-muted-foreground">Errou tudo</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
