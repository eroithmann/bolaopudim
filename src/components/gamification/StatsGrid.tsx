import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import type { PersonalStats } from "@/lib/gamification";

interface Props {
  stats: PersonalStats;
  currentPosition: number | null;
}

const Cell = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
  <div className="p-2 sm:p-3 rounded-lg bg-muted/40">
    <div className="text-[10px] sm:text-[11px] text-muted-foreground uppercase tracking-wider leading-tight">{label}</div>
    <div className="text-lg sm:text-2xl font-bold tabular-nums leading-tight mt-0.5">{value}</div>
    {hint && <div className="text-[9px] text-muted-foreground mt-0.5">{hint}</div>}
  </div>
);

export default function StatsGrid({ stats, currentPosition }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-xl flex items-center gap-2">
          <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          ESTATÍSTICAS PESSOAIS
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <Cell label="Pontos totais" value={stats.totalPoints} />
          <Cell label="Posição" value={currentPosition != null ? `${currentPosition}º` : "—"} />
          <Cell label="Palpites" value={stats.predictionsMade} />
          <Cell label="Pendentes" value={stats.pendingPredictions} />
          <Cell label="Acertos vencedor" value={stats.winnerHits} />
          <Cell label="Placares exatos" value={stats.exactScores} />
          <Cell label="Taxa de acerto" value={`${Math.round(stats.accuracy * 100)}%`} />
          <Cell
            label="Melhor rodada"
            value={stats.bestRound ? stats.bestRound.points : "—"}
            hint={stats.bestRound?.dayKey}
          />
          <Cell
            label="Pior rodada"
            value={stats.worstRound ? stats.worstRound.points : "—"}
            hint={stats.worstRound?.dayKey}
          />
          <Cell label="Seq. acertos" value={stats.longestHitStreak} />
          <Cell label="Seq. erros" value={stats.longestMissStreak} />
          <Cell label="Esquecidos" value={stats.forgottenMatches} hint={`~${stats.estimatedLostPoints} pts perdidos`} />
          <Cell label="Contra a maioria" value={stats.againstMajority} />
        </div>
      </CardContent>
    </Card>
  );
}
