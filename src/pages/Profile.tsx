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
        if (pts === 5) exact++;
        else if (pts === 3) partial++;
        else if (pts === 1) results++;
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
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-6 flex items-center gap-3">
          <User className="h-8 w-8 text-primary" />
          MEU PERFIL
        </h1>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Profile edit */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">DADOS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Email</label>
                <p className="font-medium">{user?.email}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Nome</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <Button onClick={updateProfile} disabled={saving} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Trophy className="h-5 w-5 text-secondary" />
                DESEMPENHO
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-center mb-6">
                <div className="p-3 rounded-lg bg-primary/10">
                  <span className="block text-2xl font-bold text-primary">{stats.total}</span>
                  <span className="text-xs text-muted-foreground">Total pts</span>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <span className="block text-2xl font-bold text-primary">{stats.exact}</span>
                  <span className="text-xs text-muted-foreground">Exatos</span>
                </div>
                <div className="p-3 rounded-lg bg-secondary/20">
                  <span className="block text-2xl font-bold">{stats.partial}</span>
                  <span className="text-xs text-muted-foreground">Parciais</span>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <span className="block text-2xl font-bold">{stats.results}</span>
                  <span className="text-xs text-muted-foreground">Resultados</span>
                </div>
              </div>

              <h3 className="font-semibold mb-3">Meus Palpites ({predictions.length})</h3>
              {predictions.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum palpite feito ainda.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {predictions.map((p) => (
                    <div key={p.match_id} className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
                      <span className="truncate flex-1">
                        {(p.matches as any)?.home_team?.name || "?"} vs {(p.matches as any)?.away_team?.name || "?"}
                      </span>
                      <span className="mx-2 font-medium">{p.home_score} - {p.away_score}</span>
                      {p.points !== null && (
                        <Badge variant={p.points === 5 ? "default" : p.points === 3 ? "secondary" : p.points === 1 ? "outline" : "destructive"} className="text-xs">
                          {p.points} pts
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
