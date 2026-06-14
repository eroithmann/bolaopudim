import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { User, Save } from "lucide-react";
import { useGamificationData } from "@/hooks/useGamificationData";
import {
  computePersonalStats, computeBettorProfile, computeBadges, aggregateUsers,
  isFinished, isExact, isWinnerHit, betSide, favoriteSide, matchResult,
} from "@/lib/gamification";
import BettorProfileCard from "@/components/gamification/BettorProfileCard";
import StatsGrid from "@/components/gamification/StatsGrid";
import BadgeGrid from "@/components/gamification/BadgeGrid";

export default function Profile() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const { data } = useGamificationData();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading]);

  useEffect(() => { if (profile) setName(profile.name || ""); }, [profile]);

  const myPredictions = useMemo(
    () => (data && user) ? data.predictions.filter((p) => p.user_id === user.id) : [],
    [data, user],
  );

  const stats = useMemo(
    () => (data && user) ? computePersonalStats(user.id, data.matches, myPredictions, data.predictions) : null,
    [data, user, myPredictions],
  );

  const tags = useMemo(
    () => (data && user && stats) ? computeBettorProfile(user.id, data.matches, myPredictions, data.oddsByMatch, data.predictions, stats) : [],
    [data, user, myPredictions, stats],
  );

  // Extras para badges
  const badgeExtras = useMemo(() => {
    if (!data || !user) return { underdogHits: 0, drawHits: 0, withMajority: 0, bigScorePredictions: 0 };
    const matchById = new Map(data.matches.map((m) => [m.id, m]));
    const predsByMatch = new Map<string, typeof data.predictions>();
    data.predictions.forEach((p) => {
      const arr = predsByMatch.get(p.match_id) || [];
      arr.push(p); predsByMatch.set(p.match_id, arr);
    });
    let underdogHits = 0, drawHits = 0, withMajority = 0;
    let bigScorePredictions = myPredictions.filter((p) => p.home_score + p.away_score >= 4).length;
    myPredictions.forEach((p) => {
      const m = matchById.get(p.match_id);
      if (!isFinished(m)) return;
      if (isWinnerHit(p, m!)) {
        if (matchResult(m!) === 0) drawHits++;
        const o = data.oddsByMatch.get(p.match_id);
        const fav = favoriteSide(o);
        if (fav && betSide(p) !== fav) underdogHits++;
      }
      const all = predsByMatch.get(p.match_id) || [];
      if (all.length >= 3) {
        const counts = { home: 0, draw: 0, away: 0 } as Record<"home" | "draw" | "away", number>;
        all.forEach((x) => counts[betSide(x)]++);
        const top = (Object.keys(counts) as ("home" | "draw" | "away")[]).reduce((a, b) => counts[a] >= counts[b] ? a : b);
        if (betSide(p) === top) withMajority++;
      }
    });
    return { underdogHits, drawHits, withMajority, bigScorePredictions };
  }, [data, user, myPredictions]);

  const badges = useMemo(
    () => stats ? computeBadges(stats, tags, badgeExtras) : [],
    [stats, tags, badgeExtras],
  );

  const currentPosition = useMemo(() => {
    if (!data || !user) return null;
    const aggs = aggregateUsers(data.profiles, data.matches, data.predictions, data.oddsByMatch, data.snapshots);
    const ranked = [...aggs].sort((a, b) => b.totalPoints - a.totalPoints);
    let pos = 0, lastPts = -1, lastPos = 0;
    for (let i = 0; i < ranked.length; i++) {
      pos = lastPts === ranked[i].totalPoints ? lastPos : i + 1;
      lastPts = ranked[i].totalPoints; lastPos = pos;
      if (ranked[i].user_id === user.id) return pos;
    }
    return null;
  }, [data, user]);

  const updateProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ name }).eq("user_id", user.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Perfil atualizado!" });
    setSaving(false);
  };

  if (authLoading) return <Layout><div className="p-8 text-center">Carregando...</div></Layout>;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-4">
        <h1 className="text-2xl sm:text-4xl font-bold flex items-center gap-2 sm:gap-3">
          <User className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          MEU PERFIL
        </h1>

        {/* Dados */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-xl">DADOS</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <p className="font-medium text-sm truncate">{user?.email}</p>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Nome</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
              </div>
              <Button onClick={updateProfile} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "..." : "Salvar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {stats && (
          <>
            <BettorProfileCard tags={tags} />
            <StatsGrid stats={stats} currentPosition={currentPosition} />
            <BadgeGrid badges={badges} />
          </>
        )}
      </div>
    </Layout>
  );
}
