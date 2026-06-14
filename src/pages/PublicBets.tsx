import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, Lock, Users } from "lucide-react";


interface MatchRow {
  id: string;
  phase: string;
  match_date: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
}
interface TeamRow { id: string; name: string; code: string; }
interface ProfileRow { user_id: string; name: string | null; }
interface PredictionRow {
  user_id: string; match_id: string;
  home_score: number; away_score: number; points: number | null;
}

const LOCK_MS = 60 * 60 * 1000; // 1h

export default function PublicBets() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [teams, setTeams] = useState<Map<string, TeamRow>>(new Map());
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    const [m, t, p, preds] = await Promise.all([
      supabase.from("matches").select("id, phase, match_date, status, home_score, away_score, home_team_id, away_team_id").order("match_date"),
      supabase.from("teams").select("id, name, code"),
      supabase.from("profiles").select("user_id, name"),
      supabase.from("predictions").select("user_id, match_id, home_score, away_score, points"),
    ]);
    setMatches((m.data as MatchRow[]) || []);
    setTeams(new Map(((t.data as TeamRow[]) || []).map(x => [x.id, x])));
    setProfiles((p.data as ProfileRow[]) || []);
    setPredictions((preds.data as PredictionRow[]) || []);
    setLoading(false);
  };

  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" })),
    [profiles]
  );

  // Apenas jogos com apostas fechadas (1h antes do início) ficam visíveis publicamente
  const visibleMatches = useMemo(
    () => matches.filter(m => now >= new Date(m.match_date).getTime() - LOCK_MS),
    [matches, now]
  );

  const predMap = useMemo(() => {
    const map = new Map<string, PredictionRow>();
    predictions.forEach(p => map.set(`${p.match_id}:${p.user_id}`, p));
    return map;
  }, [predictions]);

  const cellClass = (pts: number | null | undefined) => {
    if (pts == null) return "";
    if (pts === 0) return "bg-destructive/10 text-destructive";
    if (pts <= 2) return "bg-muted";
    if (pts <= 6) return "bg-secondary/30";
    return "bg-primary/20 text-primary font-bold";
  };

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto px-4 py-6 sm:py-8">
        <h1 className="text-2xl sm:text-4xl font-bold mb-2 flex items-center gap-2 sm:gap-3">
          <Users className="h-6 w-6 sm:h-8 sm:w-8 text-secondary" />
          APOSTAS DA GALERA
        </h1>
        <p className="text-muted-foreground mb-6 flex items-start gap-2 text-xs sm:text-sm">
          <Lock className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Apostas ficam públicas 1h antes de cada jogo. Quem não apostou aparece com "—" e leva 0 pontos.</span>
        </p>

        {loading ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando...</CardContent></Card>
        ) : visibleMatches.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma aposta liberada ainda. Volte 1h antes do primeiro jogo.
          </CardContent></Card>
        ) : sortedProfiles.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Sem jogadores cadastrados.</CardContent></Card>
        ) : (
          <>
            {/* MOBILE: lista de cards por jogo */}
            <div className="md:hidden space-y-3">
              {visibleMatches.map(m => {
                const home = m.home_team_id ? teams.get(m.home_team_id) : null;
                const away = m.away_team_id ? teams.get(m.away_team_id) : null;
                const finished = m.status === "finished" && m.home_score != null && m.away_score != null;
                return (
                  <Card key={m.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-3 pb-2 border-b">
                        <div>
                          <div className="font-bold text-base">
                            {home?.code || "?"} <span className="text-muted-foreground font-normal">vs</span> {away?.code || "?"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {format(parseISO(m.match_date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </div>
                        </div>
                        <div className="text-right">
                          {finished ? (
                            <div className="font-bold text-primary text-lg tabular-nums">
                              {m.home_score} – {m.away_score}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">aguardando</span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {sortedProfiles.map(p => {
                          const pred = predMap.get(`${m.id}:${p.user_id}`);
                          return (
                            <div
                              key={p.user_id}
                              className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${cellClass(pred?.points)}`}
                            >
                              <span className="truncate mr-2">{p.name || "—"}</span>
                              {pred ? (
                                <span className="font-semibold tabular-nums shrink-0">
                                  {pred.home_score}–{pred.away_score}
                                  {finished && (
                                    <span className="ml-1 opacity-70">({pred.points ?? 0})</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground shrink-0">—</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* DESKTOP: tabela completa */}
            <Card className="hidden md:block">
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10 min-w-[220px]">Jogo</TableHead>
                      <TableHead className="text-center min-w-[80px]">Resultado</TableHead>
                      {sortedProfiles.map(p => (
                        <TableHead key={p.user_id} className="text-center min-w-[90px] whitespace-nowrap">
                          {p.name || "—"}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleMatches.map(m => {
                      const home = m.home_team_id ? teams.get(m.home_team_id) : null;
                      const away = m.away_team_id ? teams.get(m.away_team_id) : null;
                      const finished = m.status === "finished" && m.home_score != null && m.away_score != null;
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="sticky left-0 bg-background z-10 align-top">
                            <div className="font-medium text-sm">
                              {home?.code || "?"} x {away?.code || "?"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(parseISO(m.match_date), "dd/MM HH:mm", { locale: ptBR })}
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {finished ? (
                              <span className="text-primary">{m.home_score} x {m.away_score}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">aguard.</span>
                            )}
                          </TableCell>
                          {sortedProfiles.map(p => {
                            const pred = predMap.get(`${m.id}:${p.user_id}`);
                            return (
                              <TableCell key={p.user_id} className={`text-center ${cellClass(pred?.points)}`}>
                                {pred ? (
                                  <div>
                                    <div className="font-semibold">{pred.home_score} x {pred.away_score}</div>
                                    {finished && (
                                      <div className="text-xs opacity-80">
                                        {pred.points ?? 0} pt{(pred.points ?? 0) === 1 ? "" : "s"}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
