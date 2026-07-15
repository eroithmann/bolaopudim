import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { X, Share2 } from "lucide-react";
import { getFlagUrl } from "@/lib/teamFlags";
import { isFinished, isExact, isWinnerHit, type MatchLite, type PredictionLite } from "@/lib/gamification";

interface TeamInfo { id: string; name: string; code: string }

const GRADIENTS = [
  "linear-gradient(135deg, #6d28d9 0%, #ec4899 100%)",
  "linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%)",
  "linear-gradient(135deg, #f97316 0%, #facc15 100%)",
  "linear-gradient(135deg, #db2777 0%, #7c3aed 100%)",
  "linear-gradient(135deg, #059669 0%, #84cc16 100%)",
  "linear-gradient(135deg, #dc2626 0%, #f59e0b 100%)",
  "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)",
  "linear-gradient(135deg, #be123c 0%, #f43f5e 100%)",
  "linear-gradient(135deg, #0f172a 0%, #6d28d9 60%, #ec4899 100%)",
];

function useCountUp(target: number, duration = 1200, start = true) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    setVal(0);
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return val;
}

export default function Wrapped() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<MatchLite[]>([]);
  const [myPreds, setMyPreds] = useState<PredictionLite[]>([]);
  const [teams, setTeams] = useState<Map<string, TeamInfo>>(new Map());
  const [totalUsers, setTotalUsers] = useState(0);
  const [myPosition, setMyPosition] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [mRes, pRes, tRes, allPredsRes, profRes] = await Promise.all([
        supabase.from("matches").select("id, phase, match_date, status, home_score, away_score, home_team_id, away_team_id"),
        supabase.from("predictions").select("user_id, match_id, home_score, away_score, points").eq("user_id", user.id),
        supabase.from("teams").select("id, name, code"),
        supabase.from("predictions").select("user_id, points"),
        supabase.from("profiles").select("user_id"),
      ]);
      setMatches((mRes.data as MatchLite[]) || []);
      setMyPreds((pRes.data as PredictionLite[]) || []);
      const tm = new Map<string, TeamInfo>();
      ((tRes.data as TeamInfo[]) || []).forEach((t) => tm.set(t.id, t));
      setTeams(tm);

      // Ranking
      const totals = new Map<string, number>();
      ((allPredsRes.data as { user_id: string; points: number | null }[]) || []).forEach((p) => {
        totals.set(p.user_id, (totals.get(p.user_id) ?? 0) + (p.points ?? 0));
      });
      const profs = (profRes.data as { user_id: string }[]) || [];
      const ranked = profs
        .map((pr) => ({ id: pr.user_id, pts: totals.get(pr.user_id) ?? 0 }))
        .sort((a, b) => b.pts - a.pts);
      setTotalUsers(ranked.length);
      let pos = 0, lastPts = -1, lastPos = 0;
      for (let i = 0; i < ranked.length; i++) {
        pos = lastPts === ranked[i].pts ? lastPos : i + 1;
        lastPts = ranked[i].pts; lastPos = pos;
        if (ranked[i].id === user.id) { setMyPosition(pos); break; }
      }
      setLoading(false);
    })();
  }, [user]);

  // ------ Stats computation ------
  const stats = useMemo(() => {
    const matchById = new Map(matches.map((m) => [m.id, m]));
    const finishedPreds = myPreds.filter((p) => isFinished(matchById.get(p.match_id)));
    const totalPoints = finishedPreds.reduce((s, p) => s + (p.points ?? 0), 0);
    let exact = 0, winners = 0;
    let totalGoals = 0, draws = 0;
    const teamPoints = new Map<string, number>();

    finishedPreds.forEach((p) => {
      const m = matchById.get(p.match_id)!;
      if (isExact(p, m)) exact++;
      if (isWinnerHit(p, m)) winners++;
      const pts = p.points ?? 0;
      if (m.home_team_id) teamPoints.set(m.home_team_id, (teamPoints.get(m.home_team_id) ?? 0) + pts);
      if (m.away_team_id) teamPoints.set(m.away_team_id, (teamPoints.get(m.away_team_id) ?? 0) + pts);
    });
    myPreds.forEach((p) => {
      totalGoals += p.home_score + p.away_score;
      if (p.home_score === p.away_score) draws++;
    });

    const avgGoals = myPreds.length ? totalGoals / myPreds.length : 0;
    const drawRatio = myPreds.length ? draws / myPreds.length : 0;
    const accuracy = finishedPreds.length ? winners / finishedPreds.length : 0;

    let lucky: TeamInfo | null = null, luckyPts = -Infinity;
    let unlucky: TeamInfo | null = null, unluckyPts = Infinity;
    teamPoints.forEach((pts, id) => {
      const t = teams.get(id);
      if (!t) return;
      if (pts > luckyPts) { luckyPts = pts; lucky = t; }
      if (pts < unluckyPts) { unluckyPts = pts; unlucky = t; }
    });

    let style = { label: "O Coração", desc: "você aposta com a emoção, não com a razão ❤️" };
    if (accuracy > 0.6) style = { label: "O Oráculo", desc: "a galera devia te seguir 🔮" };
    else if (drawRatio > 0.25) style = { label: "O Muro", desc: "empate é seu meio-campo 🧱" };
    else if (avgGoals > 3.5) style = { label: "O Otimista", desc: "você sempre espera chuva de gols ⚽" };

    return {
      totalPreds: myPreds.length,
      finishedCount: finishedPreds.length,
      totalPoints,
      exact,
      winners,
      avgGoals,
      lucky: lucky as TeamInfo | null,
      luckyPts,
      unlucky: unlucky as TeamInfo | null,
      unluckyPts,
      style,
    };
  }, [matches, myPreds, teams]);

  const displayName = profile?.name || user?.email?.split("@")[0] || "Apostador";

  // ------ Slide nav ------
  const [step, setStep] = useState(0);
  const totalSlides = 9;

  const notEnough = !loading && stats.finishedCount < 5;

  if (loading || authLoading) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 text-white flex items-center justify-center">
        Preparando sua retrospectiva...
      </div>
    );
  }

  if (notEnough) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 text-center text-white"
        style={{ background: GRADIENTS[3] }}>
        <button onClick={() => navigate("/profile")} className="absolute top-4 right-4 p-2 rounded-full bg-white/20">
          <X className="h-5 w-5" />
        </button>
        <div className="space-y-6">
          <div className="text-7xl">⚽</div>
          <h1 className="text-3xl font-black">Ainda é cedo pro seu Wrapped.</h1>
          <p className="text-lg opacity-90">Aposte mais pra desbloquear sua retrospectiva!</p>
          <Button size="lg" onClick={() => navigate("/games")} className="bg-white text-black hover:bg-white/90 font-bold">
            Ir para os jogos
          </Button>
        </div>
      </div>
    );
  }

  const next = () => setStep((s) => Math.min(totalSlides - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const onTap = (e: React.MouseEvent) => {
    const w = e.currentTarget.getBoundingClientRect().width;
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    if (x < w / 2) prev(); else next();
  };

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden select-none text-white"
      style={{ background: GRADIENTS[step % GRADIENTS.length], transition: "background 600ms ease" }}
      onClick={onTap}
    >
      {/* Progress bars */}
      <div className="absolute top-3 left-3 right-3 flex gap-1 z-20">
        {Array.from({ length: totalSlides }).map((_, i) => (
          <div key={i} className="flex-1 h-1 bg-white/25 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all"
              style={{ width: i < step ? "100%" : i === step ? "100%" : "0%", transitionDuration: i === step ? "0ms" : "300ms" }}
            />
          </div>
        ))}
      </div>

      {/* Close */}
      <button
        onClick={(e) => { e.stopPropagation(); navigate("/profile"); }}
        className="absolute top-6 right-4 z-20 p-2 rounded-full bg-black/25 hover:bg-black/40"
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Slide */}
      <div key={step} className="absolute inset-0 flex items-center justify-center px-6 animate-[fade-in_450ms_ease-out]">
        {step === 0 && <SlideIntro name={displayName} avatarUrl={profile?.avatar_url ?? null} />}
        {step === 1 && <SlideCount label="Você deu" value={stats.totalPreds} suffix="palpites nesta temporada" />}
        {step === 2 && <SlideCount label="E somou" value={stats.totalPoints} suffix="pontos 💥" />}
        {step === 3 && (
          stats.exact > 0
            ? <SlideCount label="Você cravou" value={stats.exact} suffix="placares exatos 🎯" />
            : <SlideMessage title="0 placares cravados" subtitle="Otimista demais? 😅" />
        )}
        {step === 4 && <SlideTeam title="Seu amuleto ✨" team={stats.lucky} points={stats.luckyPts} teams={teams} />}
        {step === 5 && <SlideTeam title="Melhor parar de confiar em 💀" team={stats.unlucky} points={stats.unluckyPts} teams={teams} negative />}
        {step === 6 && <SlideStyle style={stats.style} />}
        {step === 7 && <SlidePosition position={myPosition} total={totalUsers} />}
        {step === 8 && (
          <SlideFinal
            name={displayName}
            avatarUrl={profile?.avatar_url ?? null}
            points={stats.totalPoints}
            exact={stats.exact}
            style={stats.style.label}
            position={myPosition}
            total={totalUsers}
          />
        )}
      </div>

      {/* Floating emojis on intro */}
      {step === 0 && <FloatingEmojis />}
    </div>
  );
}

// ---- Sub-slides ----

function SlideIntro({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <div className="text-center space-y-6 z-10">
      <div className="text-sm uppercase tracking-widest opacity-80">Bolão Wrapped 2026</div>
      <Avatar className="h-32 w-32 mx-auto ring-4 ring-white/60 shadow-2xl">
        <AvatarImage src={avatarUrl ?? undefined} />
        <AvatarFallback className="text-4xl bg-white/20 text-white">{name[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      <h1 className="text-4xl font-black leading-tight">Sua temporada<br />no Bolão, {name}</h1>
      <p className="opacity-90">Toque para começar →</p>
    </div>
  );
}

function SlideCount({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  const v = useCountUp(value);
  return (
    <div className="text-center space-y-4">
      <p className="text-xl opacity-90">{label}</p>
      <div className="text-8xl sm:text-9xl font-black tracking-tight leading-none">{v}</div>
      <p className="text-xl font-bold">{suffix}</p>
    </div>
  );
}

function SlideMessage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center space-y-4">
      <div className="text-6xl font-black">{title}</div>
      <p className="text-2xl opacity-90">{subtitle}</p>
    </div>
  );
}

function SlideTeam({ title, team, points, teams, negative }: {
  title: string; team: { id: string; name: string; code: string } | null; points: number; teams: Map<string, TeamInfo>; negative?: boolean;
}) {
  if (!team) return <SlideMessage title="Ainda sem dados" subtitle="Aposte em mais jogos!" />;
  return (
    <div className="text-center space-y-6">
      <p className="text-xl opacity-90">{title}</p>
      <img src={getFlagUrl(team.code)} alt={team.name} className="w-40 h-auto mx-auto rounded-lg shadow-2xl ring-4 ring-white/40" />
      <div className="text-5xl font-black">{team.name}</div>
      <p className="text-lg opacity-90">
        {negative ? `${points} pontos apostando neles 😬` : `${points} pontos apostando neles 🍀`}
      </p>
    </div>
  );
}

function SlideStyle({ style }: { style: { label: string; desc: string } }) {
  return (
    <div className="text-center space-y-4">
      <p className="text-xl opacity-90">Seu estilo de apostador</p>
      <div className="text-6xl font-black">{style.label}</div>
      <p className="text-xl">{style.desc}</p>
    </div>
  );
}

function SlidePosition({ position, total }: { position: number | null; total: number }) {
  const pos = position ?? total;
  let msg = "Continue firme! 💪";
  if (pos <= 3) msg = "Pódio à vista! 🏆";
  else if (pos === total && total > 1) msg = "Alguém tem que segurar a lanterna 🔦";
  else if (pos <= Math.ceil(total * 0.2)) msg = "Top 20%! Fera 🔥";
  return (
    <div className="text-center space-y-4">
      <p className="text-xl opacity-90">Você está em</p>
      <div className="text-9xl font-black leading-none">{pos}º</div>
      <p className="text-xl">entre {total} participantes</p>
      <p className="text-2xl font-bold mt-4">{msg}</p>
    </div>
  );
}

function SlideFinal({ name, avatarUrl, points, exact, style, position, total }: {
  name: string; avatarUrl: string | null; points: number; exact: number; style: string; position: number | null; total: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const share = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#0f172a" });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "bolao-wrapped.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: "Meu Bolão Wrapped", text: `Meu Bolão Wrapped: ${points} pontos! 🏆` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "bolao-wrapped.png"; a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Imagem baixada!" });
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") toast({ title: "Erro ao compartilhar", variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <div className="w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
      <div
        ref={cardRef}
        className="rounded-3xl p-6 text-center space-y-4 shadow-2xl"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #7c3aed 50%, #ec4899 100%)" }}
      >
        <div className="text-xs uppercase tracking-widest opacity-80 text-yellow-300 font-bold">⚽ Bolão Wrapped</div>
        <Avatar className="h-20 w-20 mx-auto ring-4 ring-white/60">
          <AvatarImage src={avatarUrl ?? undefined} />
          <AvatarFallback className="bg-white/20 text-white text-2xl">{name[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="text-2xl font-black">{name}</div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="PONTOS" value={points} accent />
          <Stat label="EXATOS" value={exact} />
          <Stat label="POSIÇÃO" value={position ? `${position}º` : "-"} />
          <Stat label="DE" value={total} />
        </div>
        <div className="pt-2">
          <div className="text-xs opacity-70">ESTILO</div>
          <div className="text-lg font-black text-yellow-300">{style}</div>
        </div>
        <div className="text-xs opacity-70 pt-2">bolaopudim.lovable.app</div>
      </div>
      <Button onClick={share} disabled={busy} size="lg" className="w-full bg-white text-black hover:bg-white/90 font-bold">
        <Share2 className="h-4 w-4 mr-2" /> Compartilhar 📤
      </Button>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${accent ? "bg-yellow-300/20 ring-2 ring-yellow-300/40" : "bg-white/10 ring-1 ring-white/20"}`}>
      <div className="text-[10px] opacity-70 tracking-widest">{label}</div>
      <div className={`text-2xl font-black ${accent ? "text-yellow-300" : ""}`}>{value}</div>
    </div>
  );
}

function FloatingEmojis() {
  const emojis = ["⚽", "🏆", "🎯", "🥇", "🔥", "✨", "🎉"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {emojis.map((e, i) => (
        <div
          key={i}
          className="absolute text-4xl opacity-40"
          style={{
            left: `${(i * 137) % 90 + 5}%`,
            top: `${(i * 53) % 80 + 10}%`,
            animation: `float 6s ease-in-out ${i * 0.4}s infinite`,
          }}
        >
          {e}
        </div>
      ))}
      <style>{`@keyframes float { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-20px) rotate(10deg); } }`}</style>
    </div>
  );
}
