import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award } from "lucide-react";
import type { BadgeDef } from "@/lib/gamification";

interface Props { badges: BadgeDef[] }

export default function BadgeGrid({ badges }: Props) {
  const unlocked = badges.filter((b) => b.unlocked);
  const locked = badges.filter((b) => !b.unlocked);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-xl flex items-center gap-2">
          <Award className="h-4 w-4 sm:h-5 sm:w-5 text-secondary" />
          CONQUISTAS ({unlocked.length}/{badges.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {[...unlocked, ...locked].map((b) => (
            <div
              key={b.id}
              className={`p-3 rounded-lg border text-center transition ${
                b.unlocked
                  ? "bg-gradient-to-br from-secondary/20 to-primary/10 border-secondary/40"
                  : "bg-muted/30 border-border opacity-50"
              }`}
            >
              <div className="text-3xl mb-1">{b.emoji}</div>
              <div className="text-xs font-bold leading-tight">{b.label}</div>
              <div className="text-[10px] text-muted-foreground leading-tight mt-1">
                {b.unlocked ? b.description : b.requirement}
              </div>
              {!b.unlocked && b.progress && (
                <div className="mt-1.5">
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.min(100, (b.progress.current / b.progress.target) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5 tabular-nums">
                    {b.progress.current}/{b.progress.target}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
