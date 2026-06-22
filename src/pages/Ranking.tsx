import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAll";
import { fetchAllPredictions } from "@/lib/fetchAllPredictions";
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
  one_side_goals: number;
  results_only: number;
}

// farol dos últimos 3 jogos: g=placar exato, y=saldo/gols de um lado, r=errou ou sem palpite
type FormDot = "g" | "y" | "r" | null;

export default function Ranking() {
  const { user } = useAuth();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [previousPositions, setPreviousPositions] = useState<Record<string, number>>({});
  const [previousPoints, setPreviousPoints] = useState<Record<string, number>>({});
  const [recentForm, setRecentForm] = useState<Record<string, FormDot[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRanking();
    const channel = supabase
      .channel("ranking-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => fetchRanking())
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions" }, () => fetchRanking())
      .on("postgres_changes", { event: "*", schema: "public", table: "ranking_snapshots" }, () => fetchRanking())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);


  const fetchRanking = async () => {
    // Ranking agregado no servidor — imune ao limite de 1000 linhas do Data API
    const { data, error } = await supabase.rpc("get_full_ranking");
    let sorted: RankingEntry[] = [];
    if (error) {
      console.error("get_full_ranking falhou:", error);
    } else {
      sorted = ((data as any[]) || [])
        .map((r) => ({
          user_id: r.user_id,
          name: r.name,
          total_points: r.total_points ?? 0,
          exact_scores: r.exact_scores ?? 0,
          goal_diff: r.goal_diff ?? 0,
          one_side_goals: r.one_side_goals ?? 0,
          results_only: r.results_only ?? 0,
        }))
        .sort((a, b) => {
          if (b.total_points !== a.total_points) return b.total_points - a.total_points;
          return (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" });
        });
    }
    setRanking(sorted);



    // Posições anteriores: snapshot imediatamente antes do último jogo finalizado
    const snapshots = await fetchAllRows<any>(
      "ranking_snapshots",
      "user_id, match_id, match_date, total_points",
      (q) => q.order("match_date", { ascending: true })
    );

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
        setPreviousPoints(Object.fromEntries(prevByUser));
      }
    }

    // Farol: últimos 3 jogos finalizados, por usuário
    const { data: lastMatches } = await supabase
      .from("matches")
      .select("id, home_score, away_score, match_date")
      .eq("status", "finished")
      .not("home_score", "is", null)
      .not("away_score", "is", null)
      .order("match_date", { ascending: false })
      .limit(3);

    const recentIds = ((lastMatches as any[]) || []).map((m) => m.id);
    if (recentIds.length > 0) {
      const resultById = new Map<string, { h: number; a: number }>();
      ((lastMatches as any[]) || []).forEach((m) =>
        resultById.set(m.id, { h: m.home_score, a: m.away_score })
      );
      const recentPreds = await fetchAllPredictions<{
        user_id: string;
        match_id: string;
        home_score: number;
        away_score: number;
      }>("user_id, match_id, home_score, away_score", (q) => q.in("match_id", recentIds));

      const classify = (ph: number, pa: number, rh: number, ra: number): FormDot => {
        if (ph === rh && pa === ra) return "g";
        const pr = Math.sign(ph - pa);
        const rr = Math.sign(rh - ra);
        if (pr !== rr) return "r";
        if (rr !== 0 && ph - pa === rh - ra) return "y"; // saldo certo
        if (ph === rh || pa === ra) return "y"; // gols de um lado
        return "r"; // apenas resultado / empate sem placar exato
      };

      const byUser = new Map<string, Map<string, FormDot>>();
      recentPreds.forEach((p) => {
        const res = resultById.get(p.match_id);
        if (!res) return;
        const dot = classify(p.home_score, p.away_score, res.h, res.a);
        if (!byUser.has(p.user_id)) byUser.set(p.user_id, new Map());
        byUser.get(p.user_id)!.set(p.match_id, dot);
      });

      // recentIds está em ordem desc — vamos mostrar do mais antigo p/ mais recente
      const orderedAsc = [...recentIds].reverse();
      const form: Record<string, FormDot[]> = {};
      sorted.forEach((u) => {
        const userMap = byUser.get(u.user_id);
        form[u.user_id] = orderedAsc.map((mid) => (userMap?.get(mid) ?? null));
      });
      setRecentForm(form);
    } else {
      setRecentForm({});
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
    if (pos === 1) return "text-slate-400";
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

  const PointsDelta = ({ userId, current }: { userId: string; current: number }) => {
    const prev = previousPoints[userId];
    if (prev === undefined) return null;
    const delta = current - prev;
    if (delta <= 0) return null;
    return (
      <span className="ml-1 text-[10px] font-medium text-emerald-600 tabular-nums align-middle">
        (+{delta})
      </span>
    );
  };

  const dotColor = (d: FormDot) => {
    if (d === "g") return "bg-emerald-500";
    if (d === "y") return "bg-yellow-400";
    if (d === "r") return "bg-red-500";
    return "bg-muted-foreground/25";
  };
  const dotLabel = (d: FormDot) =>
    d === "g" ? "placar exato" : d === "y" ? "saldo ou gols" : d === "r" ? "errou" : "sem palpite";

  const FormDots = ({ userId, size = "sm" }: { userId: string; size?: "xs" | "sm" }) => {
    const dots = recentForm[userId];
    if (!dots || dots.length === 0) return null;
    const cls = size === "xs" ? "h-1.5 w-1.5" : "h-2 w-2";
    return (
      <span className={`inline-flex items-center gap-0.5 ${size === "xs" ? "" : "ml-1"}`} aria-label="últimos 3 jogos">
        {dots.map((d, i) => (
          <span
            key={i}
            className={`${cls} rounded-full ${dotColor(d)}`}
            title={`Jogo ${i + 1}: ${dotLabel(d)}`}
          />
        ))}
      </span>
    );
  };

  const top3 = ranking.slice(0, 3);
  // Display order for podium: 2nd, 1st, 3rd
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const podiumHeights = ["h-20", "h-28", "h-16"];
  const podiumColors = [
    "bg-slate-300 dark:bg-slate-600",
    "bg-gradient-to-b from-yellow-300 to-yellow-500",
    "bg-gradient-to-b from-amber-500 to-amber-700",
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <h1 className="text-2xl sm:text-4xl font-bold mb-6 flex items-center gap-2 sm:gap-3">
          <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-secondary" />
          Ranking geral
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
                              <PointsDelta userId={entry.user_id} current={entry.total_points} />
                            </div>
                          </div>
                          <div className={`relative w-full rounded-t-lg flex items-center justify-center text-white font-bold text-2xl ${podiumHeights[heightIdx]} ${podiumColors[heightIdx]}`}>
                            {realPos === 0 && (
                              <div className="absolute -inset-1 rounded-xl bg-yellow-300/20 -z-10" />
                            )}
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
                          {entry.exact_scores} exatos · {entry.goal_diff} saldo · {entry.one_side_goals} gols · {entry.results_only} result.
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold text-primary tabular-nums leading-none">
                          {entry.total_points}
                        </div>
                        <div className="text-[10px] text-muted-foreground leading-none mt-0.5 flex items-center justify-end gap-1">
                          <PointsDelta userId={entry.user_id} current={entry.total_points} />
                          <span>pts</span>
                        </div>
                        <div className="mt-1 flex justify-end">
                          <FormDots userId={entry.user_id} size="xs" />
                        </div>
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
                      <TableHead className="text-center">Recentes</TableHead>
                      <TableHead className="text-center">Pontos</TableHead>
                      <TableHead className="text-center">Exatos</TableHead>
                      <TableHead className="text-center">Saldo</TableHead>
                      <TableHead className="text-center">Gols</TableHead>
                      <TableHead className="text-center">Resultados</TableHead>
                      <TableHead className="text-center">Total acertos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.map((entry, i) => {
                      const pos = positions[i];
                      const medalIdx = pos - 1;
                      const isMe = entry.user_id === user?.id;
                      const totalHits = entry.exact_scores + entry.goal_diff + entry.one_side_goals + entry.results_only;
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
                        <TableCell className="text-center">
                          <span className="inline-flex justify-center"><FormDots userId={entry.user_id} /></span>
                        </TableCell>
                        <TableCell className="text-center font-bold text-primary text-lg">
                          {entry.total_points}
                          <PointsDelta userId={entry.user_id} current={entry.total_points} />
                        </TableCell>
                        <TableCell className="text-center">{entry.exact_scores}</TableCell>
                        <TableCell className="text-center">{entry.goal_diff}</TableCell>
                        <TableCell className="text-center">{entry.one_side_goals}</TableCell>
                        <TableCell className="text-center">{entry.results_only}</TableCell>
                        <TableCell className="text-center font-bold">{totalHits}</TableCell>
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
            <CardTitle className="text-xl">Sistema de pontuação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Pontos base</h3>
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
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Multiplicador por fase</h3>
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
