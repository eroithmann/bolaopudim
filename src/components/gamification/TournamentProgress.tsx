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

// Estrutura fixa da Copa 2026: 12 grupos x 4 = 48 times, 72 jogos de grupo
// + 16 (16-avos) + 8 (oitavas) + 4 (quartas) + 2 (semis) + 1 (3º lugar) + 1 (final) = 104 jogos
const PHASE_GAMES: Record<string, number> = {
  groups: 72,
  round_of_32: 16,
  round_of_16: 8,
  quarterfinals: 4,
  semifinals: 2,
  third_place: 1,
  final: 1,
};
const TOTAL_GAMES = 104;
// Pontos máximos por fase = jogos × 5 × multiplicador
const TOTAL_POINTS = Object.entries(PHASE_GAMES).reduce(
  (acc, [phase, n]) => acc + n * 5 * (PHASE_MULTIPLIER[phase] ?? 1),
  0,
); // 360 + 160 + 120 + 80 + 50 + 10 + 30 = 810

export default function TournamentProgress({ matches }: Props) {
  const playedGames = matches.filter((m) => m.status === "finished").length;

  let playedPoints = 0;
  for (const m of matches) {
    if (m.status === "finished") playedPoints += maxPointsForMatch(m.phase);
  }

  const gamesPct = (playedGames / TOTAL_GAMES) * 100;
  const pointsPct = (playedPoints / TOTAL_POINTS) * 100;


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
