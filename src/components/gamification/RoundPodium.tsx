import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, TrendingUp, TrendingDown, Skull, Target, Crown, Zap } from "lucide-react";
import type { RoundPodium as RoundPodiumType } from "@/lib/gamification";
import { formatBrazilDayShort } from "@/lib/brazilDate";

interface Props { podium: RoundPodiumType }

const Tile = ({
  icon: Icon, color, label, name, detail,
}: { icon: any; color: string; label: string; name: string; detail: string }) => (
  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
    <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${color}`}>
      <Icon className="h-5 w-5 text-white" />
    </div>
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="text-sm font-bold truncate">{name}</div>
      <div className="text-xs text-muted-foreground">{detail}</div>
    </div>
  </div>
);

export default function RoundPodium({ podium }: Props) {
  const hasAny = podium.best || podium.bestPrediction || podium.biggestClimb;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-xl flex items-center gap-2">
          <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-secondary" />
          PÓDIO DO DIA
          {podium.dayKey && <span className="text-xs font-normal text-muted-foreground">({formatBrazilDayShort(podium.dayKey)})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasAny ? (
          <p className="text-sm text-muted-foreground py-3 text-center">
            Ainda sem dia finalizado. Volte após os primeiros jogos! 🎯
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {podium.best && (
              <Tile icon={Crown} color="bg-yellow-500" label="Melhor do dia" name={podium.best.name} detail={`${podium.best.value} pts`} />
            )}
            {podium.worst && (
              <Tile icon={Skull} color="bg-zinc-500" label="Lanterna do dia" name={podium.worst.name} detail={`${podium.worst.value} pts`} />
            )}
            {podium.biggestClimb && (
              <Tile icon={TrendingUp} color="bg-emerald-500" label="Maior subida" name={podium.biggestClimb.name} detail={`+${podium.biggestClimb.value} posições`} />
            )}
            {podium.biggestDrop && (
              <Tile icon={TrendingDown} color="bg-red-500" label="Maior queda" name={podium.biggestDrop.name} detail={`${podium.biggestDrop.value} posições`} />
            )}
            {podium.bestPrediction && (
              <Tile icon={Target} color="bg-primary" label="Melhor palpite"
                name={podium.bestPrediction.name}
                detail={`${podium.bestPrediction.matchLabel} • ${podium.bestPrediction.score} (${podium.bestPrediction.points} pts)`} />
            )}
            {podium.underdogHero && (
              <Tile icon={Zap} color="bg-amber-600" label="Zebra do dia"
                name={podium.underdogHero.name}
                detail={`${podium.underdogHero.matchLabel} • ${podium.underdogHero.score}`} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
