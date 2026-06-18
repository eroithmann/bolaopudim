import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy } from "lucide-react";
import type { MatchLite } from "@/lib/gamification";

const PHASE_MULTIPLIER: Record<string, number> = {
  groups: 1,
  round_of_32: 2,
  round_of_16: 3,
  quarterfinals: 4,
  semifinals: 5,
  third_place: 2,
  final: 6,
};

const maxPointsForMatch = (phase: string) => 5 * (PHASE_MULTIPLIER[phase] ?? 1);

interface Props {
  matches: MatchLite[];
}

export default function TournamentProgress({ matches }: Props) {
  const totalGames = matches.length;
  const playedGames = matches.filter((m) => m.status === "finished").length;

  let totalPoints = 0;
  let playedPoints = 0;
  for (const m of matches) {
    const max = maxPointsForMatch(m.phase);
    totalPoints += max;
    if (m.status === "finished") playedPoints += max;
  }

  const gamesPct = totalGames > 0 ? (playedGames / totalGames) * 100 : 0;
  const pointsPct = totalPoints > 0 ? (playedPoints / totalPoints) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-xl flex items-center gap-2">
          <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          PROGRESSO DA COPA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Row
          label="Jogos disputados"
          current={playedGames}
          total={totalGames}
          unit="jogos"
          pct={gamesPct}
        />
        <Row
          label="Pontos em disputa"
          current={playedPoints}
          total={totalPoints}
          unit="pts"
          pct={pointsPct}
        />
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  current,
  total,
  unit,
  pct,
}: {
  label: string;
  current: number;
  total: number;
  unit: string;
  pct: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <span className="text-sm sm:text-base tabular-nums">
          <span className="font-bold text-foreground">{current}</span>
          <span className="text-muted-foreground"> / {total} {unit}</span>
          <span className="text-muted-foreground"> · {Math.round(pct)}%</span>
        </span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}
