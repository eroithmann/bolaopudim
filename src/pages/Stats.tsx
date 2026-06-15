import { useMemo } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { useGamificationData } from "@/hooks/useGamificationData";
import { useAuth } from "@/contexts/AuthContext";
import RoundPodium from "@/components/gamification/RoundPodium";
import AlternativeRankings from "@/components/gamification/AlternativeRankings";
import HeadToHead from "@/components/gamification/HeadToHead";
import { aggregateUsers, computeRoundPodium } from "@/lib/gamification";
import { BarChart3 } from "lucide-react";

export default function Stats() {
  const { user } = useAuth();
  const { data, isLoading } = useGamificationData();

  const aggs = useMemo(
    () => data ? aggregateUsers(data.profiles, data.matches, data.predictions, data.oddsByMatch, data.snapshots) : [],
    [data],
  );

  const podium = useMemo(
    () => data ? computeRoundPodium(data.profiles, data.matches, data.predictions, data.snapshots, data.oddsByMatch, data.teamNameById) : null,
    [data],
  );

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-4">
        <h1 className="text-2xl sm:text-4xl font-bold mb-2 flex items-center gap-2 sm:gap-3">
          <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-secondary" />
          Estatísticas da galera
        </h1>

        {isLoading || !data ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando...</CardContent></Card>
        ) : (
          <>
            {podium && <RoundPodium podium={podium} />}
            <AlternativeRankings users={aggs} currentUserId={user?.id} />
            <HeadToHead
              profiles={data.profiles}
              matches={data.matches}
              predictions={data.predictions}
              aggs={aggs}
              defaultUserA={user?.id}
            />
          </>
        )}
      </div>
    </Layout>
  );
}
