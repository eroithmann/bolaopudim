// Funções puras de gamificação. Sem efeitos colaterais, sem fetch.
// Tudo é derivado dos dados que já existem no banco.

import { getBrazilDayKey } from "./brazilDate";

export interface MatchLite {
  id: string;
  phase: string;
  match_date: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
}

export interface PredictionLite {
  user_id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  points: number | null;
}

export interface OddsLite {
  match_id: string;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
}

export interface ProfileLite {
  user_id: string;
  name: string | null;
}

export interface RankingSnapshotLite {
  match_id: string;
  match_date: string;
  user_id: string;
  position: number;
  total_points: number;
}

// -------- Helpers --------

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

export function isFinished(m: MatchLite | undefined | null): m is MatchLite {
  return !!m && m.status === "finished" && m.home_score != null && m.away_score != null;
}

export function predictionResult(p: PredictionLite) {
  return sign(p.home_score - p.away_score); // 1 home, -1 away, 0 draw
}

export function matchResult(m: MatchLite) {
  return sign((m.home_score ?? 0) - (m.away_score ?? 0));
}

export function isExact(p: PredictionLite, m: MatchLite) {
  return p.home_score === m.home_score && p.away_score === m.away_score;
}

export function isWinnerHit(p: PredictionLite, m: MatchLite) {
  return predictionResult(p) === matchResult(m);
}

// Favorito do jogo segundo a odd (menor odd = favorito). 'home' | 'away' | 'draw' | null
export function favoriteSide(o: OddsLite | undefined | null): "home" | "away" | "draw" | null {
  if (!o) return null;
  const arr: { key: "home" | "draw" | "away"; v: number | null }[] = [
    { key: "home", v: o.home_odds },
    { key: "draw", v: o.draw_odds },
    { key: "away", v: o.away_odds },
  ];
  const valid = arr.filter((x) => x.v != null) as { key: "home" | "draw" | "away"; v: number }[];
  if (valid.length === 0) return null;
  valid.sort((a, b) => a.v - b.v);
  return valid[0].key;
}
export function underdogSide(o: OddsLite | undefined | null): "home" | "away" | "draw" | null {
  if (!o) return null;
  const arr: { key: "home" | "draw" | "away"; v: number | null }[] = [
    { key: "home", v: o.home_odds },
    { key: "draw", v: o.draw_odds },
    { key: "away", v: o.away_odds },
  ];
  const valid = arr.filter((x) => x.v != null) as { key: "home" | "draw" | "away"; v: number }[];
  if (valid.length === 0) return null;
  valid.sort((a, b) => b.v - a.v);
  return valid[0].key;
}

// Lado apostado por um palpite ('home' | 'draw' | 'away')
export function betSide(p: PredictionLite): "home" | "draw" | "away" {
  const r = predictionResult(p);
  return r > 0 ? "home" : r < 0 ? "away" : "draw";
}

// -------- Personal stats --------

export interface PersonalStats {
  totalPoints: number;
  predictionsMade: number;
  pendingPredictions: number;
  winnerHits: number;
  exactScores: number;
  accuracy: number; // 0..1 sobre jogos finalizados com palpite
  bestRound: { dayKey: string; points: number } | null;
  worstRound: { dayKey: string; points: number } | null;
  longestHitStreak: number;
  longestMissStreak: number;
  forgottenMatches: number; // jogos finalizados sem palpite
  estimatedLostPoints: number; // pontos médios da galera nesses jogos
  againstMajority: number; // jogos onde meu lado é minoria
  finishedWithPrediction: number;
}

export function computePersonalStats(
  userId: string,
  matches: MatchLite[],
  myPredictions: PredictionLite[],
  allPredictions: PredictionLite[],
): PersonalStats {
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const myByMatch = new Map(myPredictions.map((p) => [p.match_id, p]));

  let totalPoints = 0;
  let winnerHits = 0;
  let exactScores = 0;
  let finishedWithPrediction = 0;
  let forgottenMatches = 0;
  let estimatedLostPoints = 0;
  let againstMajority = 0;

  const pointsByDay = new Map<string, number>();

  // Sequências baseadas em jogos finalizados com palpite, em ordem cronológica
  const finishedChronological = [...matches]
    .filter(isFinished)
    .sort((a, b) => +new Date(a.match_date) - +new Date(b.match_date));

  let curHit = 0, maxHit = 0, curMiss = 0, maxMiss = 0;

  // Agrupar palpites por jogo para "maioria" e "pontos médios"
  const predsByMatch = new Map<string, PredictionLite[]>();
  allPredictions.forEach((p) => {
    const arr = predsByMatch.get(p.match_id) || [];
    arr.push(p);
    predsByMatch.set(p.match_id, arr);
  });

  for (const m of finishedChronological) {
    const dayKey = getBrazilDayKey(new Date(m.match_date));
    const mine = myByMatch.get(m.id);
    if (mine) {
      finishedWithPrediction++;
      const pts = mine.points ?? 0;
      totalPoints += pts;
      pointsByDay.set(dayKey, (pointsByDay.get(dayKey) ?? 0) + pts);
      if (isExact(mine, m)) exactScores++;
      const winner = isWinnerHit(mine, m);
      if (winner) {
        winnerHits++;
        curHit++; maxHit = Math.max(maxHit, curHit);
        curMiss = 0;
      } else {
        curMiss++; maxMiss = Math.max(maxMiss, curMiss);
        curHit = 0;
      }
      // Contra a maioria?
      const all = predsByMatch.get(m.id) || [];
      if (all.length >= 3) {
        const counts = { home: 0, draw: 0, away: 0 } as Record<"home" | "draw" | "away", number>;
        all.forEach((p) => counts[betSide(p)]++);
        const mySide = betSide(mine);
        const myShare = counts[mySide] / all.length;
        if (myShare < 0.25) againstMajority++;
      }
    } else {
      forgottenMatches++;
      const all = predsByMatch.get(m.id) || [];
      if (all.length > 0) {
        const avg = all.reduce((s, p) => s + (p.points ?? 0), 0) / all.length;
        estimatedLostPoints += avg;
      }
    }
  }

  // Palpites totais e pendentes (jogos não finalizados)
  const predictionsMade = myPredictions.length;
  const pendingPredictions = myPredictions.filter((p) => {
    const m = matchById.get(p.match_id);
    return m && !isFinished(m);
  }).length;

  // Best/worst round
  let bestRound: PersonalStats["bestRound"] = null;
  let worstRound: PersonalStats["worstRound"] = null;
  for (const [dayKey, points] of pointsByDay) {
    if (!bestRound || points > bestRound.points) bestRound = { dayKey, points };
    if (!worstRound || points < worstRound.points) worstRound = { dayKey, points };
  }
  if (pointsByDay.size < 2) worstRound = null; // não faz sentido com 1 só

  return {
    totalPoints,
    predictionsMade,
    pendingPredictions,
    winnerHits,
    exactScores,
    accuracy: finishedWithPrediction > 0 ? winnerHits / finishedWithPrediction : 0,
    bestRound,
    worstRound,
    longestHitStreak: maxHit,
    longestMissStreak: maxMiss,
    forgottenMatches,
    estimatedLostPoints: Math.round(estimatedLostPoints),
    againstMajority,
    finishedWithPrediction,
  };
}

// -------- Bettor profile --------

export type BettorTag =
  | "zebreiro"
  | "favoritizeiro"
  | "empatador"
  | "do_contra"
  | "vidente"
  | "pe_quente"
  | "pe_frio"
  | "conservador"
  | "showman";

export interface BettorTagInfo {
  tag: BettorTag;
  label: string;
  description: string;
  emoji: string;
}

export const BETTOR_TAG_INFO: Record<BettorTag, BettorTagInfo> = {
  zebreiro: { tag: "zebreiro", label: "Zebreiro", emoji: "🦓", description: "Adora apostar em azarão." },
  favoritizeiro: { tag: "favoritizeiro", label: "Favoritizeiro", emoji: "⭐", description: "Vai com o favorito sempre." },
  empatador: { tag: "empatador", label: "Empatador", emoji: "🤝", description: "Empate é o forte." },
  do_contra: { tag: "do_contra", label: "Do Contra", emoji: "🙅", description: "Aposta contra a maioria." },
  vidente: { tag: "vidente", label: "Vidente", emoji: "🔮", description: "Cravando placares exatos." },
  pe_quente: { tag: "pe_quente", label: "Pé Quente", emoji: "🔥", description: "Tá numa sequência boa." },
  pe_frio: { tag: "pe_frio", label: "Pé Frio", emoji: "🧊", description: "Tá numa seca feia." },
  conservador: { tag: "conservador", label: "Conservador", emoji: "🛡️", description: "Aposta em placares baixos." },
  showman: { tag: "showman", label: "Showman", emoji: "🎆", description: "Placares elásticos sempre." },
};

export function computeBettorProfile(
  userId: string,
  matches: MatchLite[],
  myPredictions: PredictionLite[],
  oddsByMatch: Map<string, OddsLite>,
  allPredictions: PredictionLite[],
  stats: PersonalStats,
): BettorTagInfo[] {
  const tags: BettorTag[] = [];
  const matchById = new Map(matches.map((m) => [m.id, m]));

  // Apenas palpites em jogos válidos
  const validPreds = myPredictions.filter((p) => matchById.has(p.match_id));
  if (validPreds.length < 3) return [];

  // Empatador
  const draws = validPreds.filter((p) => p.home_score === p.away_score).length;
  if (draws / validPreds.length >= 0.3) tags.push("empatador");

  // Conservador / Showman
  const avgGoals = validPreds.reduce((s, p) => s + p.home_score + p.away_score, 0) / validPreds.length;
  if (avgGoals <= 2) tags.push("conservador");
  const elastic = validPreds.filter((p) => p.home_score + p.away_score >= 4).length;
  if (elastic / validPreds.length >= 0.3) tags.push("showman");

  // Zebreiro / Favoritizeiro (precisa de odds)
  const withOdds = validPreds.filter((p) => oddsByMatch.has(p.match_id));
  if (withOdds.length >= 5) {
    let zebrou = 0, favoriteu = 0;
    withOdds.forEach((p) => {
      const o = oddsByMatch.get(p.match_id)!;
      const fav = favoriteSide(o);
      const und = underdogSide(o);
      const my = betSide(p);
      if (und && my === und) zebrou++;
      if (fav && my === fav) favoriteu++;
    });
    if (zebrou / withOdds.length >= 0.4) tags.push("zebreiro");
    if (favoriteu / withOdds.length >= 0.6) tags.push("favoritizeiro");
  }

  // Do contra
  if (stats.againstMajority >= 5) tags.push("do_contra");

  // Vidente
  if (stats.exactScores >= 3) tags.push("vidente");

  // Pé quente / Pé frio (sequências atuais via último jogo)
  if (stats.longestHitStreak >= 3) tags.push("pe_quente");
  if (stats.longestMissStreak >= 3) tags.push("pe_frio");

  return tags.slice(0, 4).map((t) => BETTOR_TAG_INFO[t]);
}

// -------- Badges --------

export interface BadgeDef {
  id: string;
  label: string;
  description: string;
  emoji: string;
  requirement: string;
  unlocked: boolean;
  progress?: { current: number; target: number };
}

export function computeBadges(stats: PersonalStats, profileTags: BettorTagInfo[], extras: {
  underdogHits: number;
  drawHits: number;
  withMajority: number;
  bigScorePredictions: number;
}): BadgeDef[] {
  const list: Omit<BadgeDef, "unlocked">[] = [
    { id: "vidente", label: "Vidente", emoji: "🔮", description: "3 placares exatos.", requirement: "Acerte 3 placares exatos", progress: { current: stats.exactScores, target: 3 } },
    { id: "nostradamus", label: "Nostradamus", emoji: "🧙", description: "5 placares exatos.", requirement: "Acerte 5 placares exatos", progress: { current: stats.exactScores, target: 5 } },
    { id: "rei_zebra", label: "Rei da Zebra", emoji: "🦓", description: "3 zebras acertadas.", requirement: "Acerte 3 zebras", progress: { current: extras.underdogHits, target: 3 } },
    { id: "pe_quente", label: "Pé Quente", emoji: "🔥", description: "5 acertos seguidos.", requirement: "5 acertos consecutivos", progress: { current: stats.longestHitStreak, target: 5 } },
    { id: "pe_frio", label: "Pé Frio", emoji: "🧊", description: "5 erros seguidos.", requirement: "5 erros consecutivos", progress: { current: stats.longestMissStreak, target: 5 } },
    { id: "esp_empate", label: "Especialista em Empate", emoji: "🤝", description: "3 empates acertados.", requirement: "Acerte 3 empates", progress: { current: extras.drawHits, target: 3 } },
    { id: "do_contra", label: "Do Contra", emoji: "🙅", description: "5 apostas contra a maioria.", requirement: "Aposte contra a maioria 5x", progress: { current: stats.againstMajority, target: 5 } },
    { id: "maria", label: "Maria vai com as outras", emoji: "🐑", description: "10 apostas com a maioria.", requirement: "Aposte com a maioria 10x", progress: { current: extras.withMajority, target: 10 } },
    { id: "esqueceu", label: "Esqueceu o Bolão", emoji: "😴", description: "Perdeu um jogo sem apostar.", requirement: "Deixe de apostar em 1 jogo", progress: { current: stats.forgottenMatches, target: 1 } },
    { id: "showman", label: "Showman", emoji: "🎆", description: "5 placares com 4+ gols.", requirement: "5 palpites com 4+ gols", progress: { current: extras.bigScorePredictions, target: 5 } },
  ];

  return list.map((b) => ({
    ...b,
    unlocked: !!b.progress && b.progress.current >= b.progress.target,
  }));
}

// -------- Alternative rankings --------

export interface UserAgg {
  user_id: string;
  name: string;
  totalPoints: number;
  exactScores: number;
  winnerHits: number;
  underdogHits: number;
  drawHits: number;
  longestHitStreak: number;
  longestMissStreak: number;
  forgottenMatches: number;
  againstMajority: number;
  drawsPredicted: number;
  withMajority: number;
  bigScorePredictions: number;
  currentRoundPoints: number;
  rankClimb: number; // diff entre snapshot mais antigo e mais recente desse usuário
}

export function aggregateUsers(
  profiles: ProfileLite[],
  matches: MatchLite[],
  allPredictions: PredictionLite[],
  oddsByMatch: Map<string, OddsLite>,
  snapshots: RankingSnapshotLite[],
): UserAgg[] {
  const matchById = new Map(matches.map((m) => [m.id, m]));

  const predsByMatch = new Map<string, PredictionLite[]>();
  allPredictions.forEach((p) => {
    const arr = predsByMatch.get(p.match_id) || [];
    arr.push(p);
    predsByMatch.set(p.match_id, arr);
  });

  // Maioria por jogo (entre jogos finalizados)
  const majorityByMatch = new Map<string, "home" | "draw" | "away">();
  for (const [matchId, preds] of predsByMatch) {
    if (preds.length < 3) continue;
    const counts = { home: 0, draw: 0, away: 0 } as Record<"home" | "draw" | "away", number>;
    preds.forEach((p) => counts[betSide(p)]++);
    let top: "home" | "draw" | "away" = "home";
    if (counts.draw > counts[top]) top = "draw";
    if (counts.away > counts[top]) top = "away";
    majorityByMatch.set(matchId, top);
  }

  // Última rodada finalizada (dayKey)
  const finishedMatches = matches.filter(isFinished);
  const dayKeys = [...new Set(finishedMatches.map((m) => getBrazilDayKey(new Date(m.match_date))))].sort();
  const currentRoundKey = dayKeys[dayKeys.length - 1];
  const currentRoundMatchIds = new Set(
    finishedMatches.filter((m) => getBrazilDayKey(new Date(m.match_date)) === currentRoundKey).map((m) => m.id),
  );

  // Snapshots por usuário (mais recente e primeiro)
  const snapsByUser = new Map<string, RankingSnapshotLite[]>();
  snapshots.forEach((s) => {
    const arr = snapsByUser.get(s.user_id) || [];
    arr.push(s);
    snapsByUser.set(s.user_id, arr);
  });
  for (const [, arr] of snapsByUser) {
    arr.sort((a, b) => +new Date(a.match_date) - +new Date(b.match_date));
  }

  return profiles.map((profile) => {
    const myPreds = allPredictions.filter((p) => p.user_id === profile.user_id);
    const myByMatch = new Map(myPreds.map((p) => [p.match_id, p]));

    const agg: UserAgg = {
      user_id: profile.user_id,
      name: profile.name || "Anônimo",
      totalPoints: 0,
      exactScores: 0,
      winnerHits: 0,
      underdogHits: 0,
      drawHits: 0,
      longestHitStreak: 0,
      longestMissStreak: 0,
      forgottenMatches: 0,
      againstMajority: 0,
      drawsPredicted: myPreds.filter((p) => p.home_score === p.away_score).length,
      withMajority: 0,
      bigScorePredictions: myPreds.filter((p) => p.home_score + p.away_score >= 4).length,
      currentRoundPoints: 0,
      rankClimb: 0,
    };

    const finishedChrono = [...finishedMatches].sort(
      (a, b) => +new Date(a.match_date) - +new Date(b.match_date),
    );

    let curHit = 0, curMiss = 0;
    for (const m of finishedChrono) {
      const mine = myByMatch.get(m.id);
      if (!mine) { agg.forgottenMatches++; continue; }
      const pts = mine.points ?? 0;
      agg.totalPoints += pts;
      if (currentRoundMatchIds.has(m.id)) agg.currentRoundPoints += pts;
      if (isExact(mine, m)) agg.exactScores++;
      if (isWinnerHit(mine, m)) {
        agg.winnerHits++;
        curHit++; agg.longestHitStreak = Math.max(agg.longestHitStreak, curHit);
        curMiss = 0;
        if (matchResult(m) === 0) agg.drawHits++;
        // Zebra acertada?
        const o = oddsByMatch.get(m.id);
        if (o) {
          const fav = favoriteSide(o);
          const myS = betSide(mine);
          if (fav && myS !== fav && matchResult(m) === (myS === "home" ? 1 : myS === "away" ? -1 : 0)) {
            agg.underdogHits++;
          }
        }
      } else {
        curMiss++; agg.longestMissStreak = Math.max(agg.longestMissStreak, curMiss);
        curHit = 0;
      }
      const majority = majorityByMatch.get(m.id);
      if (majority) {
        const my = betSide(mine);
        if (my === majority) agg.withMajority++;
        else if ((predsByMatch.get(m.id) || []).length >= 3) {
          const counts = (predsByMatch.get(m.id) || []).reduce(
            (acc, p) => { acc[betSide(p)]++; return acc; },
            { home: 0, draw: 0, away: 0 } as Record<"home" | "draw" | "away", number>,
          );
          if (counts[my] / (predsByMatch.get(m.id)!.length) < 0.25) agg.againstMajority++;
        }
      }
    }

    // Rank climb: posição inicial - posição final (positivo = subiu)
    const snaps = snapsByUser.get(profile.user_id) || [];
    if (snaps.length >= 2) {
      agg.rankClimb = snaps[0].position - snaps[snaps.length - 1].position;
    }

    return agg;
  });
}

// -------- Round podium --------

export interface PodiumEntry {
  user_id: string;
  name: string;
  value: number | string;
}

export interface RoundPodium {
  dayKey: string | null;
  best: PodiumEntry | null;
  worst: PodiumEntry | null;
  biggestClimb: PodiumEntry | null;
  biggestDrop: PodiumEntry | null;
  bestPrediction: { user_id: string; name: string; matchLabel: string; score: string; points: number } | null;
  underdogHero: { user_id: string; name: string; matchLabel: string; score: string } | null;
}

export function computeRoundPodium(
  profiles: ProfileLite[],
  matches: MatchLite[],
  allPredictions: PredictionLite[],
  snapshots: RankingSnapshotLite[],
  oddsByMatch: Map<string, OddsLite>,
  teamNameById: Map<string, string>,
): RoundPodium {
  const empty: RoundPodium = {
    dayKey: null, best: null, worst: null, biggestClimb: null, biggestDrop: null,
    bestPrediction: null, underdogHero: null,
  };

  const finishedMatches = matches.filter(isFinished);
  if (finishedMatches.length === 0) return empty;

  const dayKeys = [...new Set(finishedMatches.map((m) => getBrazilDayKey(new Date(m.match_date))))].sort();
  const currentRoundKey = dayKeys[dayKeys.length - 1];
  const roundMatches = finishedMatches.filter(
    (m) => getBrazilDayKey(new Date(m.match_date)) === currentRoundKey,
  );
  const roundMatchIds = new Set(roundMatches.map((m) => m.id));

  const profileById = new Map(profiles.map((p) => [p.user_id, p]));

  // Pontos da rodada por usuário
  const ptsByUser = new Map<string, number>();
  allPredictions.forEach((p) => {
    if (!roundMatchIds.has(p.match_id)) return;
    ptsByUser.set(p.user_id, (ptsByUser.get(p.user_id) ?? 0) + (p.points ?? 0));
  });

  let best: PodiumEntry | null = null;
  let worst: PodiumEntry | null = null;
  for (const [uid, pts] of ptsByUser) {
    const name = profileById.get(uid)?.name || "Anônimo";
    if (!best || pts > (best.value as number)) best = { user_id: uid, name, value: pts };
    if (!worst || pts < (worst.value as number)) worst = { user_id: uid, name, value: pts };
  }
  if (ptsByUser.size < 2) worst = null;

  // Melhor palpite: maior pontuação individual da rodada
  let bestPredObj: RoundPodium["bestPrediction"] = null;
  for (const m of roundMatches) {
    const home = m.home_team_id ? teamNameById.get(m.home_team_id) : "?";
    const away = m.away_team_id ? teamNameById.get(m.away_team_id) : "?";
    const label = `${home} ${m.home_score}–${m.away_score} ${away}`;
    const preds = allPredictions.filter((p) => p.match_id === m.id);
    preds.forEach((p) => {
      const pts = p.points ?? 0;
      if (!bestPredObj || pts > bestPredObj.points) {
        bestPredObj = {
          user_id: p.user_id,
          name: profileById.get(p.user_id)?.name || "Anônimo",
          matchLabel: label,
          score: `${p.home_score}–${p.away_score}`,
          points: pts,
        };
      }
    });
  }
  if (bestPredObj && bestPredObj.points === 0) bestPredObj = null;

  // Zebra da rodada: alguém acertou vencedor não-favorito
  let underdogHero: RoundPodium["underdogHero"] = null;
  for (const m of roundMatches) {
    const o = oddsByMatch.get(m.id);
    const fav = favoriteSide(o);
    if (!fav) continue;
    const realSide = matchResult(m) > 0 ? "home" : matchResult(m) < 0 ? "away" : "draw";
    if (realSide === fav) continue; // não foi zebra
    const preds = allPredictions.filter(
      (p) => p.match_id === m.id && betSide(p) === realSide,
    );
    if (preds.length === 0) continue;
    const winner = preds[0];
    const home = m.home_team_id ? teamNameById.get(m.home_team_id) : "?";
    const away = m.away_team_id ? teamNameById.get(m.away_team_id) : "?";
    underdogHero = {
      user_id: winner.user_id,
      name: profileById.get(winner.user_id)?.name || "Anônimo",
      matchLabel: `${home} vs ${away}`,
      score: `${m.home_score}–${m.away_score}`,
    };
    break;
  }

  // Maior subida / queda: comparar último snapshot da rodada vs snapshot da rodada anterior
  let biggestClimb: PodiumEntry | null = null;
  let biggestDrop: PodiumEntry | null = null;

  const lastRoundMatchIds = roundMatches.map((m) => m.id);
  const lastSnapshot = new Map<string, number>(); // user_id -> position
  const prevSnapshot = new Map<string, number>();

  // Pegar o snapshot mais recente por usuário NESTA rodada
  const snapsSorted = [...snapshots].sort((a, b) => +new Date(a.match_date) - +new Date(b.match_date));
  const lastMatchId = lastRoundMatchIds[lastRoundMatchIds.length - 1];

  snapsSorted.forEach((s) => {
    if (roundMatchIds.has(s.match_id)) {
      lastSnapshot.set(s.user_id, s.position);
    } else if (new Date(s.match_date) < new Date(roundMatches[0].match_date)) {
      prevSnapshot.set(s.user_id, s.position);
    }
  });

  for (const [uid, finalPos] of lastSnapshot) {
    const prev = prevSnapshot.get(uid);
    if (prev == null) continue;
    const delta = prev - finalPos; // positivo = subiu
    const name = profileById.get(uid)?.name || "Anônimo";
    if (delta > 0 && (!biggestClimb || delta > (biggestClimb.value as number))) {
      biggestClimb = { user_id: uid, name, value: delta };
    }
    if (delta < 0 && (!biggestDrop || delta < (biggestDrop.value as number))) {
      biggestDrop = { user_id: uid, name, value: delta };
    }
  }

  return {
    dayKey: currentRoundKey,
    best,
    worst,
    biggestClimb,
    biggestDrop,
    bestPrediction: bestPredObj,
    underdogHero,
  };
}

// -------- Crowd meter phrase --------

export function crowdPhrase(
  myBet: "home" | "draw" | "away" | null,
  counts: { home: number; draw: number; away: number },
  homeTeamName?: string,
  awayTeamName?: string,
): string {
  const total = counts.home + counts.draw + counts.away;
  if (total === 0) return "Ainda sem palpites da galera.";
  const max = Math.max(counts.home, counts.draw, counts.away);
  const leader: "home" | "draw" | "away" =
    max === counts.home ? "home" : max === counts.draw ? "draw" : "away";
  const share = max / total;

  if (myBet && counts[myBet] === 1 && total >= 3) return "Só você acreditou nessa! 🦓";

  if (share >= 0.75) {
    const name = leader === "home" ? homeTeamName : leader === "away" ? awayTeamName : "no empate";
    if (myBet && myBet !== leader) return "Você foi contra a maioria 🙅";
    return `A galera tá confiante ${leader === "draw" ? name : `no ${name}`}.`;
  }
  if (share <= 0.45) return "Jogo dividido 🤔";
  return "A maioria tá tendendo pra um lado.";
}
