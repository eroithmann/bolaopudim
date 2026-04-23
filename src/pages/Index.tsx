import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Calendar, ArrowRight, Users } from "lucide-react";
import { getFlagUrl } from "@/lib/teamFlags";
import { format } from "date-fns";
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
  const { user } = useAuth();
  const [nextMatches, setNextMatches] = useState<MatchWithTeams[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);

  useEffect(() => {
    fetchNextMatches();
    fetchTopRanking();
  }, []);

  const fetchNextMatches = async () => {
    const { data } = await supabase
      .from("matches")
      .select("id, phase, match_date, venue, status, home_score, away_score, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)")
      .gte("match_date", new Date().toISOString())
      .eq("status", "scheduled")
      .order("match_date", { ascending: true })
      .limit(4);
    if (data) setNextMatches(data as unknown as MatchWithTeams[]);
  };

  const fetchTopRanking = async () => {
    const { data } = await supabase
      .from("predictions")
      .select("user_id, points, profiles!inner(name)")
      .not("points", "is", null);

    if (data) {
      const grouped: Record<string, { name: string | null; total: number }> = {};
      data.forEach((p: any) => {
        if (!grouped[p.user_id]) {
          grouped[p.user_id] = { name: p.profiles?.name, total: 0 };
        }
        grouped[p.user_id].total += p.points || 0;
      });
      const sorted = Object.entries(grouped)
        .map(([user_id, v]) => ({ user_id, name: v.name, total_points: v.total }))
        .sort((a, b) => b.total_points - a.total_points)
        .slice(0, 5);
      setRanking(sorted);
    }
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/70 text-primary-foreground py-24 px-4">
        {/* Decorative blobs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-secondary/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-16 w-[28rem] h-[28rem] rounded-full bg-accent/15 blur-3xl pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: "radial-gradient(hsl(var(--primary-foreground)) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

        <div className="relative max-w-5xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 text-xs font-semibold tracking-widest uppercase mb-6">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            Temporada 2026 · Aberta
          </span>
          <h1
            className="text-6xl md:text-8xl font-black mb-6 leading-[0.9] tracking-tight"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            Aposte. Vibre.{" "}
            <span className="italic bg-gradient-to-r from-secondary via-accent to-secondary bg-clip-text text-transparent drop-shadow-[0_0_30px_hsl(var(--secondary)/0.4)]">
              Vença.
            </span>
          </h1>
          <p className="text-lg md:text-2xl opacity-90 mb-10 font-sans max-w-2xl mx-auto leading-relaxed">
            O bolão definitivo da Copa do Mundo. Palpite cada jogo, suba no ranking e prove que entende mais que seus amigos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            {!user ? (
              <Link to="/auth">
                <Button size="lg" variant="secondary" className="text-lg px-10 h-14 shadow-2xl shadow-secondary/30 hover:scale-105 transition-transform">
                  Participar agora <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <Link to="/games">
                <Button size="lg" variant="secondary" className="text-lg px-10 h-14 shadow-2xl shadow-secondary/30 hover:scale-105 transition-transform">
                  Ver jogos <Calendar className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            )}
            <Link to="/ranking">
              <Button size="lg" variant="ghost" className="text-lg px-8 h-14 text-primary-foreground hover:bg-primary-foreground/10 border border-primary-foreground/20">
                Ver ranking <Trophy className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Stats strip */}
          <div className="mt-14 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            {[
              { n: "104", l: "Jogos" },
              { n: "48", l: "Seleções" },
              { n: "1", l: "Campeão" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl bg-primary-foreground/5 backdrop-blur-sm border border-primary-foreground/10 py-4 px-2">
                <div className="text-3xl md:text-4xl font-black text-secondary" style={{ fontFamily: "'Outfit', sans-serif" }}>{s.n}</div>
                <div className="text-xs uppercase tracking-widest opacity-70 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Wave separator */}
        <svg className="absolute bottom-0 left-0 right-0 w-full h-12 text-background" viewBox="0 0 1440 60" preserveAspectRatio="none" fill="currentColor">
          <path d="M0,40 C360,80 720,0 1440,40 L1440,60 L0,60 Z" />
        </svg>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-2 gap-6">
        {/* Next Matches */}
        <Card className="relative overflow-hidden border-2 hover:border-primary/30 transition-colors shadow-lg hover:shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-3" style={{ fontFamily: "'Outfit', sans-serif" }}>
              <div className="p-2 rounded-xl bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              Próximos jogos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextMatches.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum jogo agendado ainda.</p>
            ) : (
              <div className="space-y-3">
                {nextMatches.map((match) => (
                  <div key={match.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 flex-1">
                      {match.home_team && (
                        <img src={getFlagUrl(match.home_team.code)} alt={match.home_team.name} className="h-6 w-8 object-cover rounded" />
                      )}
                      <span className="font-medium text-sm">{match.home_team?.name || "TBD"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground px-2">vs</span>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <span className="font-medium text-sm">{match.away_team?.name || "TBD"}</span>
                      {match.away_team && (
                        <img src={getFlagUrl(match.away_team.code)} alt={match.away_team.name} className="h-6 w-8 object-cover rounded" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link to="/games" className="block mt-4">
              <Button variant="outline" className="w-full">Ver todos os jogos</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Ranking */}
        <Card className="relative overflow-hidden border-2 hover:border-secondary/40 transition-colors shadow-lg hover:shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-secondary via-secondary/60 to-transparent" />
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-3" style={{ fontFamily: "'Outfit', sans-serif" }}>
              <div className="p-2 rounded-xl bg-secondary/15">
                <Trophy className="h-5 w-5 text-secondary-foreground" />
              </div>
              Ranking
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ranking.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum palpite registrado ainda.</p>
            ) : (
              <div className="space-y-2">
                {ranking.map((entry, i) => (
                  <div key={entry.user_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <span className={`font-bold text-lg w-8 text-center ${i === 0 ? "text-secondary" : i === 1 ? "text-muted-foreground" : ""}`}>
                        {i + 1}º
                      </span>
                      <span className="font-medium">{entry.name || "Anônimo"}</span>
                    </div>
                    <span className="font-bold text-primary">{entry.total_points} pts</span>
                  </div>
                ))}
              </div>
            )}
            <Link to="/ranking" className="block mt-4">
              <Button variant="outline" className="w-full">Ver ranking completo</Button>
            </Link>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card className="md:col-span-2 relative overflow-hidden border-2 shadow-lg bg-gradient-to-br from-card to-muted/30">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
          <CardHeader>
            <CardTitle className="text-3xl flex items-center gap-3" style={{ fontFamily: "'Outfit', sans-serif" }}>
              <div className="p-2 rounded-xl bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              Como funciona
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-6 relative">
              {[
                { n: 1, title: "Cadastre-se", desc: "Crie sua conta em segundos. 100% gratuito.", color: "primary" },
                { n: 2, title: "Faça seus palpites", desc: "Dê seu placar para cada jogo antes do apito inicial.", color: "secondary" },
                { n: 3, title: "Suba no ranking", desc: "5 pts placar exato · 3 pts um time · 1 pt resultado.", color: "primary" },
              ].map((step) => (
                <div key={step.n} className="relative group">
                  <div className="absolute -top-4 -left-2 text-8xl font-black opacity-[0.07] select-none" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {step.n}
                  </div>
                  <div className="relative space-y-3 p-5 rounded-2xl bg-card border hover:shadow-md transition-all hover:-translate-y-1">
                    <div className={`w-12 h-12 rounded-xl ${step.color === "primary" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"} flex items-center justify-center text-xl font-black shadow-lg`}>
                      {step.n}
                    </div>
                    <h3 className="font-bold text-lg" style={{ fontFamily: "'Outfit', sans-serif" }}>{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CTA Footer band */}
      {!user && (
        <section className="relative overflow-hidden bg-gradient-to-r from-secondary via-accent to-secondary text-secondary-foreground py-12 px-4 mt-8">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 12px, hsl(var(--secondary-foreground)/0.3) 12px, hsl(var(--secondary-foreground)/0.3) 13px)" }} />
          <div className="relative max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
            <div>
              <h2 className="text-3xl md:text-4xl font-black mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Pronto pra entrar no jogo?
              </h2>
              <p className="text-lg opacity-90">A Copa começa em breve. Não fique de fora.</p>
            </div>
            <Link to="/auth">
              <Button size="lg" variant="default" className="bg-foreground text-background hover:bg-foreground/90 text-lg px-10 h-14 shadow-2xl">
                Criar conta grátis <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>
      )}
    </Layout>
  );
}
