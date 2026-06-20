import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAll";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Snapshot {
  match_id: string;
  match_date: string;
  user_id: string;
  position: number;
  total_points: number;
}

interface MatchInfo {
  id: string;
  home: string;
  away: string;
  match_date: string;
}

interface Profile {
  user_id: string;
  name: string | null;
}

// Cores fixas para até N jogadores destacados
const PALETTE = [
  "hsl(43, 96%, 50%)",
  "hsl(145, 63%, 42%)",
  "hsl(0, 75%, 55%)",
  "hsl(210, 80%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(25, 90%, 55%)",
  "hsl(180, 60%, 40%)",
  "hsl(320, 65%, 55%)",
];

export default function RankingEvolution() {
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [mode, setMode] = useState<"position" | "points">("position");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [snaps, matchRes, profRes] = await Promise.all([
        fetchAllRows<Snapshot>(
          "ranking_snapshots",
          "match_id, match_date, user_id, position, total_points",
          (q) => q.order("match_date", { ascending: true })
        ),
        supabase
          .from("matches")
          .select(
            "id, match_date, home_team:teams!matches_home_team_id_fkey(code), away_team:teams!matches_away_team_id_fkey(code)"
          )
          .eq("status", "finished"),
        supabase.from("profiles").select("user_id, name"),
      ]);

      setSnapshots(snaps);
      setMatches(
        ((matchRes.data as any[]) || []).map((m) => ({
          id: m.id,
          match_date: m.match_date,
          home: m.home_team?.code || "?",
          away: m.away_team?.code || "?",
        }))
      );
      setProfiles((profRes.data as Profile[]) || []);
      setLoading(false);
    })();
  }, []);

  const { chartData, series, finalRanking } = useMemo(() => {
    const matchById = new Map(matches.map((m) => [m.id, m]));

    // Pontuação final por usuário (último snapshot)
    const lastByUser = new Map<string, Snapshot>();
    snapshots.forEach((s) => {
      const prev = lastByUser.get(s.user_id);
      if (!prev || new Date(s.match_date) > new Date(prev.match_date)) {
        lastByUser.set(s.user_id, s);
      }
    });

    const profileById = new Map(profiles.map((p) => [p.user_id, p.name]));
    const finalRanking = Array.from(lastByUser.values())
      .map((s) => ({
        user_id: s.user_id,
        name: profileById.get(s.user_id) || "Anônimo",
        position: s.position,
        total_points: s.total_points,
      }))
      .sort((a, b) => a.position - b.position);

    // Seleciona top 5 + usuário logado
    const topIds = new Set(finalRanking.slice(0, 5).map((u) => u.user_id));
    if (user) topIds.add(user.id);
    const seriesUsers = finalRanking.filter((u) => topIds.has(u.user_id));

    // Agrupa snapshots por jogo
    const byMatch = new Map<string, Snapshot[]>();
    snapshots.forEach((s) => {
      if (!byMatch.has(s.match_id)) byMatch.set(s.match_id, []);
      byMatch.get(s.match_id)!.push(s);
    });

    const matchOrder = Array.from(byMatch.keys()).sort((a, b) => {
      const da = matchById.get(a)?.match_date || "";
      const db = matchById.get(b)?.match_date || "";
      return da.localeCompare(db);
    });

    const chartData = matchOrder.map((matchId, idx) => {
      const m = matchById.get(matchId);
      const snaps = byMatch.get(matchId) || [];
      const row: Record<string, any> = {
        label: m ? `${m.home}×${m.away}` : `Jogo ${idx + 1}`,
        date: m ? format(parseISO(m.match_date), "dd/MM", { locale: ptBR }) : "",
        idx: idx + 1,
      };
      seriesUsers.forEach((u) => {
        const s = snaps.find((x) => x.user_id === u.user_id);
        if (s) {
          row[`pos_${u.user_id}`] = s.position;
          row[`pts_${u.user_id}`] = s.total_points;
        }
      });
      return row;
    });

    const series = seriesUsers.map((u, i) => ({
      user_id: u.user_id,
      name: u.name,
      color: u.user_id === user?.id ? "hsl(145, 63%, 32%)" : PALETTE[i % PALETTE.length],
      isMe: u.user_id === user?.id,
    }));

    return { chartData, series, finalRanking };
  }, [snapshots, matches, profiles, user]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Carregando evolução...
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return null;
  }

  const maxPos = Math.max(...finalRanking.map((u) => u.position));

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-xl flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            EVOLUÇÃO DO RANKING
          </CardTitle>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={mode === "position" ? "default" : "outline"}
              onClick={() => setMode("position")}
            >
              Posição
            </Button>
            <Button
              size="sm"
              variant={mode === "points" ? "default" : "outline"}
              onClick={() => setMode("points")}
            >
              Pontos
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Top 5{user ? " + você" : ""} · evolução jogo a jogo
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-72 sm:h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                reversed={mode === "position"}
                domain={mode === "position" ? [1, maxPos] : ["auto", "auto"]}
                allowDecimals={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: any, _name: any, item: any) => {
                  const id = item.dataKey.replace(/^(pos_|pts_)/, "");
                  const user = series.find((s) => s.user_id === id);
                  return [
                    mode === "position" ? `${value}º` : `${value} pts`,
                    user?.name || "",
                  ];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) => {
                  const s = series.find((x) => x.user_id === value);
                  return s ? (s.isMe ? `${s.name} (você)` : s.name) : value;
                }}
              />
              {series.map((s) => (
                <Line
                  key={s.user_id}
                  type="monotone"
                  dataKey={mode === "position" ? `pos_${s.user_id}` : `pts_${s.user_id}`}
                  name={s.user_id}
                  stroke={s.color}
                  strokeWidth={s.isMe ? 3 : 2}
                  dot={{ r: s.isMe ? 4 : 2 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
