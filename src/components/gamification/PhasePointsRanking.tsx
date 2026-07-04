import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";
import type { MatchLite, PredictionLite, ProfileLite } from "@/lib/gamification";
import { isFinished } from "@/lib/gamification";

interface Props {
  profiles: ProfileLite[];
  matches: MatchLite[];
  predictions: PredictionLite[];
  currentUserId?: string;
}

const PHASES: { key: string; label: string; emoji: string }[] = [
  { key: "groups", label: "Fase de grupos", emoji: "🏁" },
  { key: "round_of_32", label: "16-avos", emoji: "🎯" },
  { key: "round_of_16", label: "Oitavas", emoji: "🔥" },
  { key: "quarterfinals", label: "Quartas", emoji: "⚔️" },
  { key: "semifinals", label: "Semis", emoji: "🥈" },
  { key: "third_place", label: "3º lugar", emoji: "🥉" },
  { key: "final", label: "Final", emoji: "🏆" },
];

export default function PhasePointsRanking({ profiles, matches, predictions, currentUserId }: Props) {
  // Fases que já têm ao menos 1 jogo finalizado
  const availablePhases = useMemo(() => {
    const set = new Set(matches.filter(isFinished).map((m) => m.phase));
    return PHASES.filter((p) => set.has(p.key));
  }, [matches]);

  const [active, setActive] = useState<string>(availablePhases[0]?.key ?? "groups");

  const ranking = useMemo(() => {
    const matchIds = new Set(
      matches.filter((m) => m.phase === active && isFinished(m)).map((m) => m.id),
    );
    const nameById = new Map(profiles.map((p) => [p.user_id, p.name || "Anônimo"]));
    const pointsByUser = new Map<string, number>();
    for (const p of predictions) {
      if (!matchIds.has(p.match_id)) continue;
      pointsByUser.set(p.user_id, (pointsByUser.get(p.user_id) ?? 0) + (p.points ?? 0));
    }
    return Array.from(pointsByUser.entries())
      .map(([user_id, points]) => ({ user_id, name: nameById.get(user_id) || "Anônimo", points }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 20);
  }, [active, matches, predictions, profiles]);

  if (availablePhases.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-xl flex items-center gap-2">
          <Layers className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          PONTOS POR FASE
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {availablePhases.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={active === p.key ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setActive(p.key)}
            >
              <span className="mr-1">{p.emoji}</span> {p.label}
            </Button>
          ))}
        </div>

        {ranking.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Ainda ninguém pontuou nessa fase. 🤷
          </p>
        ) : (
          <ol className="space-y-1.5">
            {ranking.map((u, i) => {
              const isMe = u.user_id === currentUserId;
              return (
                <li
                  key={u.user_id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isMe ? "bg-primary/10" : "bg-muted/40"}`}
                >
                  <div className="w-7 text-center font-bold text-sm shrink-0">{i + 1}º</div>
                  <div className="flex-1 truncate text-sm font-medium">{u.name}</div>
                  <div className="font-bold tabular-nums text-primary shrink-0">{u.points}</div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
