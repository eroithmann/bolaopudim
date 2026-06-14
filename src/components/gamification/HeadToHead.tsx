import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Swords } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type {
  MatchLite, PredictionLite, ProfileLite, UserAgg,
} from "@/lib/gamification";
import { isFinished } from "@/lib/gamification";
import { getBrazilDayKey, formatBrazilDayShort } from "@/lib/brazilDate";

interface Props {
  profiles: ProfileLite[];
  matches: MatchLite[];
  predictions: PredictionLite[];
  aggs: UserAgg[];
  defaultUserA?: string;
}

export default function HeadToHead({ profiles, matches, predictions, aggs, defaultUserA }: Props) {
  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR")),
    [profiles],
  );
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");

  useEffect(() => {
    if (sortedProfiles.length < 2) return;
    const firstA = defaultUserA || sortedProfiles[0].user_id;
    const firstB = sortedProfiles.find((p) => p.user_id !== firstA)?.user_id || sortedProfiles[1].user_id;
    setA(firstA);
    setB(firstB);
  }, [sortedProfiles.length, defaultUserA]);

  const aggA = aggs.find((x) => x.user_id === a);
  const aggB = aggs.find((x) => x.user_id === b);

  // Posição = índice em aggs ordenados por pontos
  const ranked = useMemo(
    () => [...aggs].sort((x, y) => y.totalPoints - x.totalPoints),
    [aggs],
  );
  const posA = ranked.findIndex((x) => x.user_id === a) + 1;
  const posB = ranked.findIndex((x) => x.user_id === b) + 1;

  // Comparação de palpites
  const cmp = useMemo(() => {
    const predsA = predictions.filter((p) => p.user_id === a);
    const predsB = new Map(predictions.filter((p) => p.user_id === b).map((p) => [p.match_id, p]));
    let same = 0, diff = 0;
    predsA.forEach((pa) => {
      const pb = predsB.get(pa.match_id);
      if (!pb) return;
      if (pa.home_score === pb.home_score && pa.away_score === pb.away_score) same++;
      else diff++;
    });
    return { same, diff };
  }, [a, b, predictions]);

  // Última rodada finalizada
  const lastRound = useMemo(() => {
    const finished = matches.filter(isFinished);
    if (!finished.length) return null;
    const days = [...new Set(finished.map((m) => getBrazilDayKey(new Date(m.match_date))))].sort();
    const key = days[days.length - 1];
    const ids = new Set(finished.filter((m) => getBrazilDayKey(new Date(m.match_date)) === key).map((m) => m.id));
    const sum = (uid: string) =>
      predictions.filter((p) => p.user_id === uid && ids.has(p.match_id)).reduce((s, p) => s + (p.points ?? 0), 0);
    return { key, a: sum(a), b: sum(b) };
  }, [a, b, matches, predictions]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-xl flex items-center gap-2">
          <Swords className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          HEAD TO HEAD
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Select value={a} onValueChange={setA}>
            <SelectTrigger><SelectValue placeholder="Jogador A" /></SelectTrigger>
            <SelectContent>
              {sortedProfiles.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.name || "Anônimo"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={b} onValueChange={setB}>
            <SelectTrigger><SelectValue placeholder="Jogador B" /></SelectTrigger>
            <SelectContent>
              {sortedProfiles.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.name || "Anônimo"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!aggA || !aggB ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Selecione dois jogadores.</p>
        ) : (
          <div className="space-y-2">
            <Row label="Pontos" a={aggA.totalPoints} b={aggB.totalPoints} />
            <Row label="Posição" a={`${posA}º`} b={`${posB}º`} invert />
            <Row label="Placares exatos" a={aggA.exactScores} b={aggB.exactScores} />
            <Row label="Acertos vencedor" a={aggA.winnerHits} b={aggB.winnerHits} />
            <Row label="Palpites iguais" a={cmp.same} b={cmp.same} neutral />
            <Row label="Palpites diferentes" a={cmp.diff} b={cmp.diff} neutral />
            {lastRound && (
              <Row label={`Último dia (${formatBrazilDayShort(lastRound.key)})`} a={lastRound.a} b={lastRound.b} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  label, a, b, invert, neutral,
}: { label: string; a: number | string; b: number | string; invert?: boolean; neutral?: boolean }) {
  let winner: "a" | "b" | null = null;
  if (!neutral) {
    const av = typeof a === "number" ? a : parseInt(String(a));
    const bv = typeof b === "number" ? b : parseInt(String(b));
    if (av !== bv) winner = invert ? (av < bv ? "a" : "b") : (av > bv ? "a" : "b");
  }
  return (
    <div className="grid grid-cols-3 items-center gap-2 px-3 py-2 rounded-lg bg-muted/40">
      <div className={`text-right font-bold tabular-nums ${winner === "a" ? "text-primary" : ""}`}>{a}</div>
      <div className="text-center text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-left font-bold tabular-nums ${winner === "b" ? "text-primary" : ""}`}>{b}</div>
    </div>
  );
}
