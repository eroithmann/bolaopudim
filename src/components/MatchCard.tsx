import { getFlagUrl } from "@/lib/teamFlags";
import { differenceInSeconds } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, MapPin, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { formatBrazilMatchDate } from "@/lib/brazilDate";

interface MatchTeam {
  name: string;
  code: string;
}

interface Prediction {
  match_id: string;
  home_score: number;
  away_score: number;
  points: number | null;
}

interface OddsData {
  home: number | null;
  draw: number | null;
  away: number | null;
  bookmaker?: string;
}

interface BetDistribution {
  home: number;
  draw: number;
  away: number;
  total: number;
}

interface MatchCardProps {
  match: {
    id: string;
    phase: string;
    group_name: string | null;
    match_date: string;
    venue: string | null;
    status: string;
    home_score: number | null;
    away_score: number | null;
    home_team: MatchTeam | null;
    away_team: MatchTeam | null;
  };
  prediction?: Prediction;
  editScore: { home: string; away: string };
  saving: boolean;
  isLoggedIn: boolean;
  odds?: OddsData | null;
  betDistribution?: BetDistribution | null;
  onEditChange: (scores: { home: string; away: string }) => void;
  onSave: () => void;
}

export default function MatchCard({
  match, prediction, editScore, saving, isLoggedIn, odds, betDistribution, onEditChange, onSave,
}: MatchCardProps) {
  const matchDate = new Date(match.match_date);
  const deadlineDate = new Date(matchDate.getTime() - 60 * 60 * 1000); // 1h before

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (match.status === "finished") return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [match.status]);

  const locked = now >= deadlineDate;
  const totalSecsLeft = Math.max(0, differenceInSeconds(deadlineDate, now));

  const formatCountdown = (secs: number) => {
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s.toString().padStart(2, "0")}s`;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  const dateStr = formatBrazilMatchDate(matchDate);

  const getPointsBadge = (points: number | null) => {
    if (points === null) return null;
    if (points === 0) return <Badge variant="destructive">0 pts</Badge>;
    const label = `${points} pt${points === 1 ? "" : "s"}`;
    return <Badge className="bg-primary text-primary-foreground">{label}</Badge>;
  };

  return (
    <Card className={match.status === "finished" ? "border-primary/30" : ""}>
      <CardContent className="py-3 px-3 sm:py-4 sm:px-6">
        {/* Header: date + venue + group */}
        <div className="flex justify-between items-start mb-3 text-[11px] sm:text-xs text-muted-foreground gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-medium truncate">{dateStr}</span>
            {match.venue && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{match.venue}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {match.group_name && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{match.group_name}</Badge>}
            {match.status !== "finished" && !locked && totalSecsLeft > 0 && (
              <span className={`flex items-center gap-1 font-mono text-[10px] sm:text-[11px] ${totalSecsLeft < 3600 ? "text-destructive font-semibold" : "text-muted-foreground"}`} title="Tempo restante para apostar">
                <Clock className="h-3 w-3" />
                {formatCountdown(totalSecsLeft)}
              </span>
            )}
            {locked && <Lock className="h-3 w-3" />}
          </div>
        </div>

        {/* Teams row */}
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {/* Home team */}
          <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 flex-1 sm:justify-end min-w-0">
            {match.home_team && (
              <img src={getFlagUrl(match.home_team.code)} alt="" className="h-9 w-14 sm:h-7 sm:w-10 object-cover rounded shadow-sm shrink-0 sm:order-2" />
            )}
            <span className="font-semibold text-xs sm:text-base text-center sm:text-right truncate w-full sm:w-auto sm:order-1 leading-tight">
              {match.home_team?.name || "TBD"}
            </span>
          </div>

          {/* Score / VS */}
          <div className="shrink-0 min-w-[50px] sm:min-w-[60px] text-center">
            {match.status === "finished" ? (
              <span className="font-bold text-lg sm:text-xl tabular-nums">
                {match.home_score} – {match.away_score}
              </span>
            ) : (
              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">vs</span>
            )}
          </div>

          {/* Away team */}
          <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
            {match.away_team && (
              <img src={getFlagUrl(match.away_team.code)} alt="" className="h-9 w-14 sm:h-7 sm:w-10 object-cover rounded shadow-sm shrink-0" />
            )}
            <span className="font-semibold text-xs sm:text-base text-center sm:text-left truncate w-full sm:w-auto leading-tight">
              {match.away_team?.name || "TBD"}
            </span>
          </div>
        </div>

        {/* Odds */}
        {odds && (odds.home || odds.draw || odds.away) && (
          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="font-medium text-[10px] uppercase tracking-wider opacity-60">
              Probabilidade
            </span>
            {odds.home && (
              <span className="bg-muted px-2 py-0.5 rounded font-mono">
                1: {Math.round((1 / odds.home) * 100)}%
              </span>
            )}
            {odds.draw !== null && odds.draw !== undefined && (
              <span className="bg-muted px-2 py-0.5 rounded font-mono">
                X: {Math.round((1 / odds.draw) * 100)}%
              </span>
            )}
            {odds.away && (
              <span className="bg-muted px-2 py-0.5 rounded font-mono">
                2: {Math.round((1 / odds.away) * 100)}%
              </span>
            )}
          </div>
        )}

        {/* Bet distribution */}
        {locked && betDistribution && betDistribution.total > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>🏠 {betDistribution.total > 0 ? Math.round((betDistribution.home / betDistribution.total) * 100) : 0}%</span>
              <span className="font-medium">{betDistribution.total} palpite{betDistribution.total !== 1 ? "s" : ""}</span>
              <span>{betDistribution.total > 0 ? Math.round((betDistribution.away / betDistribution.total) * 100) : 0}% 🏟️</span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
              {betDistribution.home > 0 && (
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${(betDistribution.home / betDistribution.total) * 100}%` }}
                />
              )}
              {betDistribution.draw > 0 && (
                <div
                  className="bg-gray-400 transition-all"
                  style={{ width: `${(betDistribution.draw / betDistribution.total) * 100}%` }}
                />
              )}
              {betDistribution.away > 0 && (
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${(betDistribution.away / betDistribution.total) * 100}%` }}
                />
              )}
            </div>
            <div className="flex items-center justify-center gap-3 mt-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Casa ({betDistribution.home})</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-gray-400" /> Empate ({betDistribution.draw})</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Fora ({betDistribution.away})</span>
            </div>
          </div>
        )}

        {/* Prediction section */}
        {isLoggedIn && (
          <div className="mt-3 pt-3 border-t">
            {locked ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Seu palpite:</span>
                {prediction ? (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{prediction.home_score} – {prediction.away_score}</span>
                    {match.status === "finished" && getPointsBadge(prediction.points)}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Sem palpite</span>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 sm:justify-start">
                <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">Palpite:</span>
                <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-center">
                  <Input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min="0"
                    max="20"
                    className="w-14 h-11 sm:w-16 sm:h-9 text-center text-lg sm:text-base font-semibold tabular-nums"
                    placeholder="—"
                    value={editScore.home}
                    onChange={(e) => onEditChange({ ...editScore, home: e.target.value })}
                  />
                  <span className="text-muted-foreground font-bold">–</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min="0"
                    max="20"
                    className="w-14 h-11 sm:w-16 sm:h-9 text-center text-lg sm:text-base font-semibold tabular-nums"
                    placeholder="—"
                    value={editScore.away}
                    onChange={(e) => onEditChange({ ...editScore, away: e.target.value })}
                  />
                </div>
                <Button
                  size="sm"
                  className="h-11 sm:h-9 px-4 shrink-0"
                  disabled={saving || editScore.home === "" || editScore.away === ""}
                  onClick={onSave}
                >
                  {saving ? "..." : prediction ? "Atualizar" : "Salvar"}
                </Button>
              </div>
            )}
          </div>
        )}

        {!isLoggedIn && (
          <div className="mt-3 pt-3 border-t text-center">
            <span className="text-xs text-muted-foreground">Faça login para dar seu palpite</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
