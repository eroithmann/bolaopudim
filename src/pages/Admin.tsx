import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Shield, RefreshCw, Save, Check, Download, TrendingUp, Tv, Trophy, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PredictionStatus from "@/components/admin/PredictionStatus";
import NewsletterCard from "@/components/admin/NewsletterCard";

interface MatchRow {
  id: string;
  phase: string;
  group_name: string | null;
  match_date: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  result_source: string | null;
  home_team: { name: string; code: string } | null;
  away_team: { name: string; code: string } | null;
}

export default function Admin() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [editResults, setEditResults] = useState<Record<string, { home: string; away: string }>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState(false);
  const [seedingMatches, setSeedingMatches] = useState(false);
  const [refreshingOdds, setRefreshingOdds] = useState(false);
  const [refreshingBroadcasts, setRefreshingBroadcasts] = useState(false);
  const [seedingKnockout, setSeedingKnockout] = useState<string | null>(null);

  const KNOCKOUT_PHASES: { key: string; label: string }[] = [
    { key: "round_of_32", label: "32-avos de final" },
    { key: "round_of_16", label: "Oitavas de final" },
    { key: "quarterfinals", label: "Quartas de final" },
    { key: "semifinals", label: "Semifinais" },
    { key: "third_place", label: "Disputa de 3º lugar" },
    { key: "final", label: "Final" },
  ];

  const seedKnockoutPhase = async (phase: string, label: string) => {
    setSeedingKnockout(phase);
    try {
      const { data, error } = await supabase.functions.invoke("seed-knockout-matches", {
        body: { phase },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
      } else {
        const unm = (data?.unmatched as string[] | undefined) ?? [];
        const skp = (data?.skipped_placeholders as { raw: string; date: string | null }[] | undefined) ?? [];
        let desc = `${data?.created ?? 0} criados, ${data?.updated ?? 0} atualizados.`;
        if (data?.skipped_finished) desc += ` ${data.skipped_finished} já finalizados (preservados).`;
        if (skp.length) desc += ` ${skp.length} ainda indefinidos na API (${skp.slice(0, 2).map((s) => s.raw).join("; ")}${skp.length > 2 ? "…" : ""}).`;
        if (unm.length) desc += ` Não casados: ${unm.slice(0, 3).join(", ")}${unm.length > 3 ? "…" : ""}`;
        if (data?.message) desc = data.message;
        toast({ title: `${label}: importação concluída`, description: desc });
        fetchMatches();
      }
    } catch (err: any) {
      toast({ title: "Erro ao importar fase", description: err.message, variant: "destructive" });
    }
    setSeedingKnockout(null);
  };

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/");
  }, [user, isAdmin, loading]);

  useEffect(() => {
    if (isAdmin) fetchMatches();
  }, [isAdmin]);

  const fetchMatches = async () => {
    const { data } = await supabase
      .from("matches")
      .select("id, phase, group_name, match_date, status, home_score, away_score, result_source, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)")
      .order("match_date", { ascending: true });
    if (data) setMatches(data as unknown as MatchRow[]);
  };

  const saveResult = async (matchId: string) => {
    const scores = editResults[matchId];
    if (!scores || scores.home === "" || scores.away === "") return;

    setSaving((s) => ({ ...s, [matchId]: true }));
    const { error } = await supabase
      .from("matches")
      .update({
        home_score: parseInt(scores.home),
        away_score: parseInt(scores.away),
        status: "finished",
        result_source: "manual",
      })
      .eq("id", matchId);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Resultado salvo! Pontos recalculados." });
      fetchMatches();
    }
    setSaving((s) => ({ ...s, [matchId]: false }));
  };

  const syncFromApi = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-match-results");
      if (error) throw error;
      const updated = data?.updated || 0;
      const checked = data?.pending_checked || 0;
      const unmatched: { game: string; reason: string }[] = data?.unmatched || [];

      let description = `${updated} de ${checked} jogos atualizados.`;
      if (unmatched.length > 0) {
        const sample = unmatched.slice(0, 3).map((u) => `• ${u.game}: ${u.reason}`).join("\n");
        const more = unmatched.length > 3 ? `\n…e mais ${unmatched.length - 3}` : "";
        description += `\nNão encontrados:\n${sample}${more}`;
      }
      toast({
        title: updated > 0 ? "Sincronização concluída!" : "Nenhum resultado novo",
        description,
        variant: unmatched.length > 0 && updated === 0 ? "destructive" : "default",
      });
      console.log("[sync] response:", data);
      fetchMatches();
    } catch (err: any) {
      toast({ title: "Erro na sincronização", description: err.message || "Verifique a API key", variant: "destructive" });
    }
    setSyncing(false);
  };

  const seedMatchesFromApi = async () => {
    setSeedingMatches(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-matches-from-api");
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Aviso", description: data.error, variant: "destructive" });
      } else {
        toast({
          title: "Jogos atualizados!",
          description: `${data?.matches_created || 0} criados, ${data?.matches_updated || 0} atualizados, ${data?.matches_removed || 0} removidos. Times: ${data?.teams_created || 0} novos.`,
        });
        fetchMatches();
      }
    } catch (err: any) {
      toast({ title: "Erro ao buscar jogos", description: err.message || "Verifique a API key", variant: "destructive" });
    }
    setSeedingMatches(false);
  };

  const refreshOdds = async () => {
    setRefreshingOdds(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-odds?refresh=true");
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro nas odds", description: data.error, variant: "destructive" });
      } else {
        const src = data?.source ? ` (${data.source})` : "";
        const remaining = data?.remaining_quota ? ` · ${data.remaining_quota} req restantes` : "";
        const desc = `${data?.refreshed || 0} de ${data?.total || 0} jogos com odds${remaining}.`;
        toast({
          title: data?.refreshed > 0 ? `Odds atualizadas!${src}` : "Nenhuma odd atualizada",
          description: desc,
          variant: data?.refreshed === 0 ? "destructive" : "default",
        });
      }
    } catch (err: any) {
      toast({ title: "Erro ao buscar odds", description: err.message, variant: "destructive" });
    }
    setRefreshingOdds(false);
  };

  const refreshBroadcasts = async () => {
    setRefreshingBroadcasts(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-broadcasts", { method: "POST" });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro nas transmissões", description: data.error, variant: "destructive" });
      } else {
        const unm = (data?.unmatched as string[] | undefined) ?? [];
        let desc = `${data?.updated ?? 0} de ${data?.checked ?? 0} jogos.`;
        if (unm.length) desc += ` Não encontrados: ${unm.slice(0, 3).join(", ")}${unm.length > 3 ? "…" : ""}`;
        toast({ title: "Transmissões atualizadas!", description: desc });
      }
    } catch (err: any) {
      toast({ title: "Erro ao buscar transmissões", description: err.message, variant: "destructive" });
    }
    setRefreshingBroadcasts(false);
  };

  if (loading) return <Layout><div className="p-8 text-center">Carregando...</div></Layout>;

  const pastMatches = matches.filter((m) => new Date(m.match_date) <= new Date());

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            PAINEL ADMIN
          </h1>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={seedMatchesFromApi} disabled={seedingMatches} variant="outline">
              <Download className={`h-4 w-4 mr-2 ${seedingMatches ? "animate-spin" : ""}`} />
              {seedingMatches ? "Importando..." : "Importar Jogos da API"}
            </Button>
            <Button onClick={syncFromApi} disabled={syncing} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando..." : "Buscar Resultados"}
            </Button>
            <Button onClick={refreshOdds} disabled={refreshingOdds} variant="outline">
              <TrendingUp className={`h-4 w-4 mr-2 ${refreshingOdds ? "animate-spin" : ""}`} />
              {refreshingOdds ? "Atualizando..." : "Atualizar Odds"}
            </Button>
            <Button onClick={refreshBroadcasts} disabled={refreshingBroadcasts} variant="outline">
              <Tv className={`h-4 w-4 mr-2 ${refreshingBroadcasts ? "animate-spin" : ""}`} />
              {refreshingBroadcasts ? "Atualizando..." : "Atualizar Transmissões"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={!!seedingKnockout}>
                  <Trophy className={`h-4 w-4 mr-2 ${seedingKnockout ? "animate-spin" : ""}`} />
                  {seedingKnockout
                    ? `Importando ${KNOCKOUT_PHASES.find((p) => p.key === seedingKnockout)?.label}...`
                    : "Importar mata-mata"}
                  <ChevronDown className="h-3 w-3 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {KNOCKOUT_PHASES.map((p) => (
                  <DropdownMenuItem key={p.key} onClick={() => seedKnockoutPhase(p.key, p.label)}>
                    {p.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mb-6">
          <PredictionStatus />
        </div>

        <div className="mb-6">
          <NewsletterCard />
        </div>

        <Tabs defaultValue="past" className="w-full">
          <TabsList>
            <TabsTrigger value="past">Jogos Passados</TabsTrigger>
            <TabsTrigger value="all">Todos os Jogos</TabsTrigger>
          </TabsList>
          {(["past", "all"] as const).map((tab) => {
            const list = tab === "past" ? pastMatches : matches;
            return (
              <TabsContent key={tab} value={tab}>
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {tab === "past" ? "RESULTADOS DOS JOGOS" : "TODOS OS JOGOS"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Jogo</TableHead>
                          <TableHead className="text-center">Placar</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-center">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {list.map((match) => {
                          const edit = editResults[match.id] ?? {
                            home: match.home_score !== null ? String(match.home_score) : "",
                            away: match.away_score !== null ? String(match.away_score) : "",
                          };

                          return (
                            <TableRow key={match.id}>
                              <TableCell>
                                <div className="font-medium text-sm">
                                  {match.home_team?.name || "TBD"} vs {match.away_team?.name || "TBD"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {match.group_name || match.phase} · {new Date(match.match_date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-center gap-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    className="w-14 h-8 text-center"
                                    value={edit.home}
                                    onChange={(e) => setEditResults((s) => ({ ...s, [match.id]: { ...edit, home: e.target.value } }))}
                                  />
                                  <span>-</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    className="w-14 h-8 text-center"
                                    value={edit.away}
                                    onChange={(e) => setEditResults((s) => ({ ...s, [match.id]: { ...edit, away: e.target.value } }))}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={match.status === "finished" ? "default" : "outline"}>
                                  {match.status === "finished" ? "Finalizado" : "Agendado"}
                                </Badge>
                                {match.result_source && (
                                  <div className="text-xs text-muted-foreground mt-1">{match.result_source}</div>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  size="sm"
                                  disabled={saving[match.id]}
                                  onClick={() => saveResult(match.id)}
                                >
                                  {saving[match.id] ? "..." : match.status === "finished" ? <><Check className="h-3 w-3 mr-1" />Atualizar</> : <><Save className="h-3 w-3 mr-1" />Salvar</>}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {list.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              Nenhum jogo.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>

      </div>
    </Layout>
  );
}
