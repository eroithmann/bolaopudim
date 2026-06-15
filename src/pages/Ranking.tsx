import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Crown, ArrowUp, ArrowDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import RankingEvolution from "@/components/RankingEvolution";

interface RankingEntry {
  user_id: string;
  name: string | null;
  total_points: number;
  exact_scores: number;
  goal_diff: number;
  results_only: number;
}

export default function Ranking() {
  const { user } = useAuth();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [previousPositions, setPreviousPositions] = useState<Record<string, number>>({});
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
      return (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" });
    });
    setRanking(sorted);

    // Posições anteriores: snapshot imediatamente antes do último jogo finalizado
    const { data: snapshots } = await supabase
      .from("ranking_snapshots")
      .select("user_id, match_id, match_date, total_points")
      .order("match_date", { ascending: true });

    if (snapshots && snapshots.length > 0) {
      // pegar lista ordenada de match_ids únicos (na ordem em que apareceram)
      const seen = new Set<string>();
      const orderedMatches: string[] = [];
      snapshots.forEach((s: any) => {
        if (!seen.has(s.match_id)) {
          seen.add(s.match_id);
          orderedMatches.push(s.match_id);
        }
      });
      if (orderedMatches.length >= 2) {
        const prevMatchId = orderedMatches[orderedMatches.length - 2];
        const prevByUser = new Map<string, number>();
        snapshots.forEach((s: any) => {
          if (s.match_id === prevMatchId) {
            prevByUser.set(s.user_id, s.total_points);
          }
        });
        const profileName = new Map(sorted.map((e) => [e.user_id, e.name]));
        const prevSorted = Array.from(prevByUser.entries())
          .map(([user_id, total_points]) => ({ user_id, total_points, name: profileName.get(user_id) || "" }))
          .sort((a, b) => {
            if (b.total_points !== a.total_points) return b.total_points - a.total_points;
            return (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" });
          });
        const prevPos: Record<string, number> = {};
        prevSorted.forEach((e, i) => {
          let pos = i + 1;
          for (let j = i - 1; j >= 0; j--) {
            if (prevSorted[j].total_points === e.total_points) pos = j + 1;
            else break;
          }
          prevPos[e.user_id] = pos;
        });
        setPreviousPositions(prevPos);
      }
    }

    setLoading(false);
  };

  // Posição com empate: mesmos pontos = mesma posição (1,1,3...)
  const positions = ranking.map((_, i) => {
    let pos = i + 1;
    for (let j = i - 1; j >= 0; j--) {
      if (ranking[j].total_points === ranking[i].total_points) pos = j + 1;
      else break;
    }
    return pos;
  });

  const getMedalColor = (pos: number) => {
    if (pos === 0) return "text-yellow-500";
    if (pos === 1) return "text-gray-400";
    if (pos === 2) return "text-amber-700";
    return "";
  };

  const PositionDelta = ({ userId, currentPos }: { userId: string; currentPos: number }) => {
    const prev = previousPositions[userId];
    if (prev === undefined) return null;
    if (currentPos < prev) {
      return <ArrowUp className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-label={`subiu ${prev - currentPos}`} />;
    }
    if (currentPos > prev) {
      return <ArrowDown className="h-3.5 w-3.5 text-red-600 shrink-0" aria-label={`caiu ${currentPos - prev}`} />;
    }
    return null;
  };

  const top3 = ranking.slice(0, 3);
  // Display order for podium: 2nd, 1st, 3rd
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const podiumHeights = ["h-20", "h-28", "h-16"];
  const podiumColors = ["bg-gray-300 dark:bg-gray-600", "bg-yellow-400", "bg-amber-700"];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <h1 className="text-2xl sm:text-4xl font-bold mb-6 flex items-center gap-2 sm:gap-3">
          <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-secondary" />
          RANKING GERAL
        </h1>

        {loading ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando...</CardContent></Card>
        ) : ranking.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            Nenhum resultado ainda. Os pontos aparecem quando os jogos terminam.
          </CardContent></Card>
        ) : (
          <>
            {/* Pódio top 3 */}
            {top3.length >= 1 && top3[0].total_points > 0 && (
              <Card className="mb-4">
                <CardContent className="pt-6 pb-4">
                  <div className="flex items-end justify-center gap-2 sm:gap-4">
                    {podiumOrder.map((entry) => {
                      const realPos = top3.indexOf(entry);
                      const heightIdx = realPos === 0 ? 1 : realPos === 1 ? 0 : 2;
                      const isMe = entry.user_id === user?.id;
                      return (
                        <div key={entry.user_id} className="flex flex-col items-center flex-1 max-w-[120px]">
                          {realPos === 0 && <Crown className="h-5 w-5 text-yellow-500 mb-1" />}
                          <div className={`text-center mb-2 ${isMe ? "font-bold" : ""}`}>
                            <div className="text-xs sm:text-sm font-medium truncate max-w-[100px]">
                              {entry.name || "Anônimo"}
                            </div>
                            <div className="text-lg sm:text-xl font-bold text-primary tabular-nums">
                              {entry.total_points}
                            </div>
                          </div>
                          <div className={`w-full rounded-t-lg flex items-center justify-center text-white font-bold text-2xl ${podiumHeights[heightIdx]} ${podiumColors[heightIdx]}`}>
                            {realPos + 1}º
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* MOBILE: lista compacta */}
            <Card className="md:hidden">
              <CardContent className="p-0 divide-y">
                {ranking.map((entry, i) => {
                  const pos = positions[i];
                  const medalIdx = pos - 1;
                  const isMe = entry.user_id === user?.id;
                  return (
                    <div
                      key={entry.user_id}
                      className={`flex items-center gap-3 px-3 py-2.5 ${isMe ? "bg-primary/5" : ""}`}
                    >
                      <div className={`w-8 text-center font-bold text-sm shrink-0 ${getMedalColor(medalIdx)}`}>
                        {medalIdx < 3 ? <Medal className="h-4 w-4 inline" /> : `${pos}º`}
                        {medalIdx < 3 && <span className="block text-[10px]">{pos}º</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{entry.name || "Anônimo"}</span>
                          <PositionDelta userId={entry.user_id} currentPos={pos} />
                          {isMe && <Badge className="bg-primary/20 text-primary text-[9px] px-1.5 py-0">você</Badge>}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {entry.exact_scores} exatos · {entry.goal_diff} saldo · {entry.results_only} result.
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold text-primary tabular-nums leading-none">{entry.total_points}</div>
                        <div className="text-[10px] text-muted-foreground">pts</div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* DESKTOP: tabela */}
            <Card className="hidden md:block">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Jogador</TableHead>
                      <TableHead className="text-center">Pontos</TableHead>
                      <TableHead className="text-center">Exatos</TableHead>
                      <TableHead className="text-center">Saldo</TableHead>
                      <TableHead className="text-center">Resultados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.map((entry, i) => {
                      const pos = positions[i];
                      const medalIdx = pos - 1;
                      const isMe = entry.user_id === user?.id;
                      return (
                      <TableRow key={entry.user_id} className={isMe ? "bg-primary/5" : ""}>
                        <TableCell className="font-bold">
                          <span className={`flex items-center gap-1 ${getMedalColor(medalIdx)}`}>
                            {medalIdx < 3 && <Medal className="h-4 w-4" />}
                            {pos}º
                            <PositionDelta userId={entry.user_id} currentPos={pos} />
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {entry.name || "Anônimo"}
                          {isMe && <Badge className="ml-2 bg-primary/20 text-primary text-[10px]">você</Badge>}
                        </TableCell>
                        <TableCell className="text-center font-bold text-primary text-lg">{entry.total_points}</TableCell>
                        <TableCell className="text-center">{entry.exact_scores}</TableCell>
                        <TableCell className="text-center">{entry.goal_diff}</TableCell>
                        <TableCell className="text-center">{entry.results_only}</TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}

        <RankingEvolution />

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl">SISTEMA DE PONTUAÇÃO</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">PONTOS BASE</h3>
              <div className="grid sm:grid-cols-5 gap-4 text-center">
                <div className="p-4 rounded-lg bg-primary/10">
                  <span className="block text-3xl font-bold text-primary">5</span>
                  <span className="text-sm text-muted-foreground">Placar exato</span>
                </div>
                <div className="p-4 rounded-lg bg-secondary/20">
                  <span className="block text-3xl font-bold text-secondary-foreground">3</span>
                  <span className="text-sm text-muted-foreground">Saldo de gols certo (ou empate)</span>
                </div>
                <div className="p-4 rounded-lg bg-secondary/10">
                  <span className="block text-3xl font-bold">2</span>
                  <span className="text-sm text-muted-foreground">Resultado + gols de um lado</span>
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
