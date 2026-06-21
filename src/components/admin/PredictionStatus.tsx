import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPredictions } from "@/lib/fetchAllPredictions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Check, X, AlertCircle } from "lucide-react";

interface MatchInfo {
  id: string;
  match_date: string;
  phase: string;
  group_name: string | null;
  home_team: { name: string } | null;
  away_team: { name: string } | null;
}

interface Profile {
  user_id: string;
  name: string | null;
}

export default function PredictionStatus() {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [predMap, setPredMap] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    (async () => {
      const nowIso = new Date().toISOString();
      const [{ data: m }, { data: p }, preds] = await Promise.all([
        supabase
          .from("matches")
          .select(
            "id, match_date, phase, group_name, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)"
          )
          .gt("match_date", nowIso)
          .order("match_date", { ascending: true }),
        supabase.from("profiles").select("user_id, name"),
        fetchAllPredictions<{ user_id: string; match_id: string }>("user_id, match_id"),
      ]);

      const map: Record<string, Set<string>> = {};
      (preds ?? []).forEach((pr: any) => {
        if (!map[pr.user_id]) map[pr.user_id] = new Set();
        map[pr.user_id].add(pr.match_id);
      });

      setMatches((m ?? []) as unknown as MatchInfo[]);
      setProfiles((p ?? []) as Profile[]);
      setPredMap(map);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>PALPITES POR USUÁRIO</CardTitle>
        </CardHeader>
        <CardContent>Carregando...</CardContent>
      </Card>
    );
  }

  const totalUpcoming = matches.length;

  const rows = profiles
    .map((p) => {
      const set = predMap[p.user_id] ?? new Set<string>();
      const missing = matches.filter((m) => !set.has(m.id));
      return {
        user_id: p.user_id,
        name: p.name || "Sem nome",
        filled: totalUpcoming - missing.length,
        total: totalUpcoming,
        missing,
      };
    })
    .sort((a, b) => a.missing.length - b.missing.length || a.name.localeCompare(b.name));

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>PALPITES POR USUÁRIO</CardTitle>
        <p className="text-sm text-muted-foreground">
          {totalUpcoming} jogo(s) ainda aberto(s) para palpite. Mostra apenas se está preenchido — não o placar.
        </p>
      </CardHeader>
      <CardContent>
        {totalUpcoming === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum jogo futuro em aberto.</p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {rows.map((r) => {
              const complete = r.missing.length === 0;
              return (
                <AccordionItem key={r.user_id} value={r.user_id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4 gap-3">
                      <span className="font-medium text-left">{r.name}</span>
                      <div className="flex items-center gap-2">
                        {complete ? (
                          <Badge variant="default" className="gap-1">
                            <Check className="h-3 w-3" />
                            Completo
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {r.missing.length} faltando
                          </Badge>
                        )}
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {r.filled}/{r.total}
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {complete ? (
                      <p className="text-sm text-muted-foreground">Todos os palpites preenchidos. 🎉</p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {r.missing.map((m) => (
                          <li key={m.id} className="flex items-center gap-2">
                            <X className="h-3 w-3 text-destructive shrink-0" />
                            <span className="text-muted-foreground tabular-nums">{fmt(m.match_date)}</span>
                            <span>
                              {m.home_team?.name || "TBD"} vs {m.away_team?.name || "TBD"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({m.group_name || m.phase})
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
