import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { User, Save, Trophy } from "lucide-react";

interface PredictionWithMatch {
  match_id: string;
  home_score: number;
  away_score: number;
  points: number | null;
  matches: {
    phase: string;
    match_date: string;
    status: string;
    home_score: number | null;
    away_score: number | null;
    home_team: { name: string; code: string } | null;
    away_team: { name: string; code: string } | null;
  };
}

export default function Profile() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [predictions, setPredictions] = useState<PredictionWithMatch[]>([]);
  const [stats, setStats] = useState({ total: 0, exact: 0, partial: 0, results: 0 });

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading]);

  useEffect(() => {
    if (profile) setName(profile.name || "");
    if (user) fetchMyPredictions();
  }, [profile, user]);

  const fetchMyPredictions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("predictions")
      .select("match_id, home_score, away_score, points, matches!inner(phase, match_date, status, home_score, away_score, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      setPredictions(data as unknown as PredictionWithMatch[]);
      let total = 0, exact = 0, partial = 0, results = 0;
      data.forEach((p: any) => {
        const pts = p.points || 0;
        total += pts;
        const m = p.matches;
        if (!m || m.status !== "finished" || m.home_score == null || m.away_score == null) return;
        const isExact = p.home_score === m.home_score && p.away_score === m.away_score;
        const pDiff = p.home_score - p.away_score;
        const rDiff = m.home_score - m.away_score;
        const sameResult = Math.sign(pDiff) === Math.sign(rDiff);
        if (isExact) exact++;
        else if (sameResult && pDiff === rDiff && pDiff !== 0) partial++;
        else if (sameResult) results++;
      });
      setStats({ total, exact, partial, results });
    }
  };

  const updateProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name })
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil atualizado!" });
    }
    setSaving(false);
  };

  if (authLoading) return <Layout><div className="p-8 text-center">Carregando...</div></Layout>;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <h1 className="text-2xl sm:text-4xl font-bold mb-6 flex items-center gap-2 sm:gap-3">
          <User className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          MEU PERFIL
        </h1>

        {/* Stats hero — sempre visível no topo */}
        <Card className="mb-4 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
          <CardContent className="py-4">
            <div className="grid grid-cols-4 gap-2 sm:gap-4 text-center">
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-primary tabular-nums">{stats.total}</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Pontos</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold tabular-nums">{stats.exact}</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Exatos</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold tabular-nums">{stats.partial}</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Saldo</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold tabular-nums">{stats.results}</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Result.</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
          {/* Profile edit */}
          <Card className="md:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-xl">DADOS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <p className="font-medium text-sm truncate">{user?.email}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Nome</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
              </div>
              <Button onClick={updateProfile} disabled={saving} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </CardContent>
          </Card>

          {/* Meus palpites */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-xl flex items-center gap-2">
                <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-secondary" />
                MEUS PALPITES ({predictions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {predictions.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  Nenhum palpite feito ainda.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                  {predictions.map((p) => {
                    const m = p.matches as any;
                    const finished = m?.status === "finished" && m?.home_score != null;
                    const home = m?.home_team?.code || "?";
                    const away = m?.away_team?.code || "?";
                    return (
                      <div
                        key={p.match_id}
                        className="flex items-center gap-2 p-2 rounded-md bg-muted/40 text-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {home} <span className="text-muted-foreground">vs</span> {away}
                          </div>
                          {finished && (
                            <div className="text-[10px] text-muted-foreground tabular-nums">
                              Real: {m.home_score}–{m.away_score}
                            </div>
                          )}
                        </div>
                        <div className="font-bold tabular-nums shrink-0 text-base">
                          {p.home_score}–{p.away_score}
                        </div>
                        {p.points !== null ? (
                          <Badge
                            variant={p.points >= 3 ? "default" : p.points === 2 ? "secondary" : p.points === 1 ? "outline" : "destructive"}
                            className="text-[10px] shrink-0 min-w-[42px] justify-center"
                          >
                            {p.points} pt{p.points === 1 ? "" : "s"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] shrink-0 min-w-[42px] justify-center opacity-50">
                            —
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
