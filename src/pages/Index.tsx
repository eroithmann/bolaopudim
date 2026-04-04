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
      <section className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-4" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            BOLÃO COPA DO MUNDO 2026
          </h1>
          <p className="text-lg md:text-xl opacity-90 mb-8 font-sans">
            Faça seus palpites, acompanhe os resultados e dispute com seus amigos!
          </p>
          {!user ? (
            <Link to="/auth">
              <Button size="lg" variant="secondary" className="text-lg px-8">
                Participar agora <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          ) : (
            <Link to="/games">
              <Button size="lg" variant="secondary" className="text-lg px-8">
                Ver jogos <Calendar className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          )}
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-8">
        {/* Next Matches */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              PRÓXIMOS JOGOS
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
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Trophy className="h-6 w-6 text-secondary" />
              RANKING
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
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              COMO FUNCIONA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-6 text-center">
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto text-xl font-bold">1</div>
                <h3 className="font-semibold text-lg">Cadastre-se</h3>
                <p className="text-sm text-muted-foreground">Crie sua conta gratuitamente</p>
              </div>
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center mx-auto text-xl font-bold">2</div>
                <h3 className="font-semibold text-lg">Faça seus palpites</h3>
                <p className="text-sm text-muted-foreground">Dê seu placar para cada jogo antes de começar</p>
              </div>
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto text-xl font-bold">3</div>
                <h3 className="font-semibold text-lg">Acompanhe o ranking</h3>
                <p className="text-sm text-muted-foreground">5 pts (exato), 3 pts (1 placar), 1 pt (resultado)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
