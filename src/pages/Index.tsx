import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Calendar,
  ArrowRight,
  Users,
  Target,
  Clock,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { getFlagUrl } from "@/lib/teamFlags";
import { format, parseISO, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MatchWithTeams {
  id: string;
  phase: string;
  match_date: string;
  venue: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_team: { name: string; code: string } | null;
  away_team: { name: string; code: string } | null;
}

interface RankingEntry {
  user_id: string;
  name: string | null;
  total_points: number;
}

export default function Index() {
  const { user, profile } = useAuth();
  const [nextMatches, setNextMatches] = useState<MatchWithTeams[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [myPoints, setMyPoints] = useState(0);
  const [myPosition, setMyPosition] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetchNextMatches();
    fetchTopRanking();
  }, []);

  useEffect(() => {
    if (user) fetchUserStatus();
  }, [user, ranking]);

  const fetchNextMatches = async () => {
    const { data } = await supabase
      .from("matches")
      .select(
        "id, phase, match_date, venue, status, home_score, away_score, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)"
      )
      .gte("match_date", new Date().toISOString())
      .eq("status", "scheduled")
      .order("match_date", { ascending: true })
      .limit(3);
    if (data) setNextMatches(data as unknown as MatchWithTeams[]);
  };

  const fetchTopRanking = async () => {
    const [{ data: profiles }, { data: preds }] = await Promise.all([
      supabase.from("profiles").select("user_id, name"),
      supabase.from("predictions").select("user_id, points").not("points", "is", null),
    ]);

    const grouped: Record<string, { name: string | null; total: number }> = {};
    (profiles || []).forEach((p: any) => {
      grouped[p.user_id] = { name: p.name, total: 0 };
    });
    (preds || []).forEach((p: any) => {
      if (!grouped[p.user_id]) grouped[p.user_id] = { name: null, total: 0 };
      grouped[p.user_id].total += p.points || 0;
    });
    const sorted = Object.entries(grouped)
      .map(([user_id, v]) => ({ user_id, name: v.name, total_points: v.total }))
      .sort((a, b) => b.total_points - a.total_points);
    setRanking(sorted);
  };

  const fetchUserStatus = async () => {
    if (!user) return;

    // my points + position
    const mine = ranking.find((r) => r.user_id === user.id);
    if (mine) {
      setMyPoints(mine.total_points);
      setMyPosition(ranking.findIndex((r) => r.user_id === user.id) + 1);
    } else {
      setMyPoints(0);
      setMyPosition(null);
    }

    // pending = jogos abertos sem palpite
    const nowIso = new Date().toISOString();
    const { data: openMatches } = await supabase
      .from("matches")
      .select("id, match_date")
      .eq("status", "scheduled")
      .gte("match_date", nowIso);

    if (!openMatches) return;

    const { data: myPreds } = await supabase
      .from("predictions")
      .select("match_id")
      .eq("user_id", user.id);

    const predicted = new Set((myPreds || []).map((p: any) => p.match_id));
    // só conta jogos que ainda permitem palpite (até 1h antes)
    const oneHour = 60 * 60 * 1000;
    const now = Date.now();
    const pending = openMatches.filter(
      (m: any) => !predicted.has(m.id) && new Date(m.match_date).getTime() - now > oneHour
    );
    setPendingCount(pending.length);
  };

  const topRanking = ranking.slice(0, 5);

  return (
    <Layout>
      {/* Hero — compacto no mobile, generoso no desktop */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/70 text-primary-foreground py-10 md:py-24 px-4">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-secondary/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-16 w-[28rem] h-[28rem] rounded-full bg-accent/15 blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 text-[10px] md:text-xs font-semibold tracking-widest uppercase mb-4 md:mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            Temporada 2026 · Aberta
          </span>
          <h1
            className="text-4xl md:text-8xl font-black mb-3 md:mb-6 leading-[0.95] tracking-tight"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            Aposte. Vibre.{" "}
            <span className="italic bg-gradient-to-r from-secondary via-accent to-secondary bg-clip-text text-transparent">
              Vença.
            </span>
          </h1>
          <p className="text-sm md:text-2xl opacity-90 mb-6 md:mb-10 max-w-2xl mx-auto leading-relaxed">
            {user
              ? `E aí, ${profile?.name?.split(" ")[0] || "craque"}! Pronto pro próximo palpite?`
              : "O bolão onde todos são bem vindos, menos o Victor Grunberg."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            {!user ? (
              <>
                <Link to="/auth">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="text-base md:text-lg px-8 md:px-10 h-12 md:h-14 shadow-2xl shadow-secondary/30"
                  >
                    Participar agora <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/ranking">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="text-base md:text-lg px-6 md:px-8 h-12 md:h-14 text-primary-foreground hover:bg-primary-foreground/10 border border-primary-foreground/20"
                  >
                    Ver ranking <Trophy className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </>
            ) : (
              <Link to="/games">
                <Button
                  size="lg"
                  variant="secondary"
                  className="text-base md:text-lg px-8 md:px-10 h-12 md:h-14 shadow-2xl shadow-secondary/30"
                >
                  {pendingCount > 0
                    ? `Apostar (${pendingCount} pendente${pendingCount > 1 ? "s" : ""})`
                    : "Ver jogos"}{" "}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            )}
          </div>

          {/* Stats — discreto */}
          <p className="mt-6 md:mt-10 text-[11px] md:text-sm opacity-60 tracking-wider">
            104 jogos · 48 seleções · 1 campeão
          </p>
        </div>

        <svg
          className="absolute bottom-0 left-0 right-0 w-full h-6 md:h-12 text-background"
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          fill="currentColor"
        >
          <path d="M0,40 C360,80 720,0 1440,40 L1440,60 L0,60 Z" />
        </svg>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-6 md:py-12 space-y-6 md:space-y-8">
        {/* Seu bolão agora — só logado */}
        {user && (
          <Card className="relative overflow-hidden border-2 border-primary/20 shadow-lg bg-gradient-to-br from-primary/5 via-card to-secondary/5">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-primary" />
            <CardHeader className="pb-3">
              <CardTitle
                className="text-xl md:text-2xl flex items-center gap-2"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                <Sparkles className="h-5 w-5 text-secondary" />
                Seu bolão agora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4">
                <div className="rounded-xl bg-background/60 backdrop-blur border p-3 md:p-4 text-center">
                  <Trophy className="h-4 w-4 md:h-5 md:w-5 text-secondary mx-auto mb-1" />
                  <div
                    className="text-2xl md:text-3xl font-black text-primary"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    {myPosition ? `${myPosition}º` : "—"}
                  </div>
                  <div className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground mt-1">
                    Posição
                  </div>
                </div>
                <div className="rounded-xl bg-background/60 backdrop-blur border p-3 md:p-4 text-center">
                  <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-primary mx-auto mb-1" />
                  <div
                    className="text-2xl md:text-3xl font-black text-primary"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    {myPoints}
                  </div>
                  <div className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground mt-1">
                    Pontos
                  </div>
                </div>
                <div className="rounded-xl bg-background/60 backdrop-blur border p-3 md:p-4 text-center">
                  <Clock
                    className={`h-4 w-4 md:h-5 md:w-5 mx-auto mb-1 ${pendingCount > 0 ? "text-destructive" : "text-muted-foreground"}`}
                  />
                  <div
                    className={`text-2xl md:text-3xl font-black ${pendingCount > 0 ? "text-destructive" : "text-primary"}`}
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    {pendingCount}
                  </div>
                  <div className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground mt-1">
                    Pendentes
                  </div>
                </div>
              </div>
              {pendingCount > 0 ? (
                <Link to="/games">
                  <Button className="w-full" size="lg">
                    <Target className="mr-2 h-4 w-4" />
                    Apostar agora
                  </Button>
                </Link>
              ) : (
                <Link to="/games">
                  <Button variant="outline" className="w-full">
                    Ver jogos
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Próximos jogos */}
          <Card className="relative overflow-hidden border-2 shadow-lg">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />
            <CardHeader className="pb-3">
              <CardTitle
                className="text-xl md:text-2xl flex items-center gap-3"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                <div className="p-2 rounded-xl bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                Próximos jogos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nextMatches.length === 0 ? (
                <p className="text-muted-foreground text-center py-6 text-sm">
                  Nenhum jogo agendado ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {nextMatches.map((match) => (
                    <div
                      key={match.id}
                      className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
                        {format(parseISO(match.match_date), "dd MMM · HH:mm", {
                          locale: ptBR,
                        })}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {match.home_team && (
                            <img
                              src={getFlagUrl(match.home_team.code)}
                              alt={match.home_team.name}
                              className="h-5 w-7 object-cover rounded shrink-0"
                            />
                          )}
                          <span className="font-medium text-sm truncate">
                            {match.home_team?.name || "TBD"}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground px-1 font-bold">
                          vs
                        </span>
                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                          <span className="font-medium text-sm truncate text-right">
                            {match.away_team?.name || "TBD"}
                          </span>
                          {match.away_team && (
                            <img
                              src={getFlagUrl(match.away_team.code)}
                              alt={match.away_team.name}
                              className="h-5 w-7 object-cover rounded shrink-0"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Link to="/games" className="block mt-4">
                <Button variant="outline" className="w-full">
                  Ver todos os jogos
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Ranking */}
          <Card className="relative overflow-hidden border-2 shadow-lg">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-secondary via-secondary/60 to-transparent" />
            <CardHeader className="pb-3">
              <CardTitle
                className="text-xl md:text-2xl flex items-center gap-3"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                <div className="p-2 rounded-xl bg-secondary/15">
                  <Trophy className="h-5 w-5 text-secondary-foreground" />
                </div>
                Top 5
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topRanking.length === 0 ? (
                <p className="text-muted-foreground text-center py-6 text-sm">
                  Nenhum palpite registrado ainda.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {topRanking.map((entry, i) => {
                    const isMe = user?.id === entry.user_id;
                    return (
                      <div
                        key={entry.user_id}
                        className={`flex items-center justify-between p-2.5 rounded-lg transition-colors ${
                          isMe
                            ? "bg-primary/10 border border-primary/30"
                            : "bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`font-black text-base w-7 text-center shrink-0 ${
                              i === 0
                                ? "text-secondary"
                                : i === 1
                                  ? "text-muted-foreground"
                                  : i === 2
                                    ? "text-accent"
                                    : "text-muted-foreground/70"
                            }`}
                          >
                            {i + 1}º
                          </span>
                          <span className="font-medium text-sm truncate">
                            {entry.name || "Anônimo"}
                            {isMe && (
                              <Badge variant="secondary" className="ml-2 text-[10px] py-0">
                                você
                              </Badge>
                            )}
                          </span>
                        </div>
                        <span className="font-bold text-primary text-sm shrink-0">
                          {entry.total_points} pts
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <Link to="/ranking" className="block mt-4">
                <Button variant="outline" className="w-full">
                  Ver ranking completo
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Como pontuar — versão compacta */}
        <Card className="relative overflow-hidden border-2 shadow-lg bg-gradient-to-br from-card to-muted/30">
          <CardHeader className="pb-3">
            <CardTitle
              className="text-xl md:text-2xl flex items-center gap-3"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              <div className="p-2 rounded-xl bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              Como pontuar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
              {[
                { pts: "5", label: "Placar exato", color: "bg-primary text-primary-foreground" },
                { pts: "3", label: "Saldo certo", color: "bg-secondary text-secondary-foreground" },
                { pts: "2", label: "Um lado certo", color: "bg-accent text-accent-foreground" },
                { pts: "1", label: "Só resultado", color: "bg-muted text-foreground" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border p-3 md:p-4 text-center bg-card"
                >
                  <div
                    className={`inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full ${s.color} font-black text-lg md:text-xl mb-2`}
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    {s.pts}
                  </div>
                  <div className="text-xs md:text-sm font-medium">{s.label}</div>
                </div>
              ))}
            </div>
            <p className="text-[11px] md:text-xs text-muted-foreground text-center mt-4">
              Pontos multiplicam por fase · Final vale ×6
            </p>
          </CardContent>
        </Card>
      </div>

      {!user && (
        <section className="relative overflow-hidden bg-gradient-to-r from-secondary via-accent to-secondary text-secondary-foreground py-10 md:py-12 px-4 mt-4 md:mt-8">
          <div className="relative max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
            <div>
              <h2
                className="text-2xl md:text-4xl font-black mb-1"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                Pronto pra entrar no jogo?
              </h2>
              <p className="text-base md:text-lg opacity-90">
                A Copa começa em breve. Não fique de fora.
              </p>
            </div>
            <Link to="/auth">
              <Button
                size="lg"
                className="bg-foreground text-background hover:bg-foreground/90 text-base md:text-lg px-8 md:px-10 h-12 md:h-14 shadow-2xl"
              >
                Criar conta grátis <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>
      )}
    </Layout>
  );
}
