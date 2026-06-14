import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import type { UserAgg } from "@/lib/gamification";

interface Props {
  users: UserAgg[];
  currentUserId?: string;
}

type MetricKey =
  | "exactScores" | "winnerHits" | "underdogHits" | "longestHitStreak"
  | "longestMissStreak" | "forgottenMatches" | "againstMajority"
  | "drawsPredicted" | "currentRoundPoints" | "rankClimb";

const METRICS: { key: MetricKey; label: string; emoji: string; suffix?: string }[] = [
  { key: "exactScores", label: "Mais placares exatos", emoji: "🔮" },
  { key: "winnerHits", label: "Mais acertos de vencedor", emoji: "🎯" },
  { key: "underdogHits", label: "Mais zebras acertadas", emoji: "🦓" },
  { key: "longestHitStreak", label: "Maior sequência de acertos", emoji: "🔥" },
  { key: "longestMissStreak", label: "Maior sequência de erros", emoji: "🧊" },
  { key: "forgottenMatches", label: "Mais palpites esquecidos", emoji: "😴" },
  { key: "againstMajority", label: "Mais apostas contra a maioria", emoji: "🙅" },
  { key: "drawsPredicted", label: "Mais empates apostados", emoji: "🤝" },
  { key: "currentRoundPoints", label: "Mais pontos no dia atual", emoji: "⚡" },
  { key: "rankClimb", label: "Maior subida no ranking", emoji: "📈", suffix: " pos" },
];

export default function AlternativeRankings({ users, currentUserId }: Props) {
  const [active, setActive] = useState<MetricKey>("exactScores");

  const metric = METRICS.find((m) => m.key === active)!;
  const sorted = [...users].sort((a, b) => (b[active] as number) - (a[active] as number));
  const top = sorted.slice(0, 10).filter((u) => (u[active] as number) > 0 || active === "rankClimb");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-xl flex items-center gap-2">
          <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-secondary" />
          RANKINGS ALTERNATIVOS
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {METRICS.map((m) => (
            <Button
              key={m.key}
              size="sm"
              variant={active === m.key ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setActive(m.key)}
            >
              <span className="mr-1">{m.emoji}</span> {m.label}
            </Button>
          ))}
        </div>

        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Ainda sem dados pra esse ranking. 🤷
          </p>
        ) : (
          <ol className="space-y-1.5">
            {top.map((u, i) => {
              const isMe = u.user_id === currentUserId;
              const value = u[active] as number;
              return (
                <li
                  key={u.user_id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isMe ? "bg-primary/10" : "bg-muted/40"}`}
                >
                  <div className="w-7 text-center font-bold text-sm shrink-0">{i + 1}º</div>
                  <div className="flex-1 truncate text-sm font-medium">{u.name}</div>
                  <div className="font-bold tabular-nums text-primary shrink-0">
                    {value > 0 && active === "rankClimb" ? `+${value}` : value}
                    {metric.suffix || ""}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
