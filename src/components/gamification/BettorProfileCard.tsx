import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import type { BettorTagInfo } from "@/lib/gamification";

interface Props { tags: BettorTagInfo[] }

export default function BettorProfileCard({ tags }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-xl flex items-center gap-2">
          <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-secondary" />
          SEU ESTILO DE APOSTADOR
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">
            Ainda estamos descobrindo seu estilo de apostador. Faça mais palpites! 🔍
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <div
                key={t.tag}
                className="flex items-center gap-2 px-3 py-2 rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20"
              >
                <span className="text-lg leading-none">{t.emoji}</span>
                <div className="leading-tight">
                  <div className="text-sm font-semibold">{t.label}</div>
                  <div className="text-[10px] text-muted-foreground">{t.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
