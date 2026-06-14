import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  MatchLite, PredictionLite, OddsLite, ProfileLite, RankingSnapshotLite,
} from "@/lib/gamification";

export interface GamificationData {
  matches: MatchLite[];
  predictions: PredictionLite[];
  profiles: ProfileLite[];
  oddsByMatch: Map<string, OddsLite>;
  snapshots: RankingSnapshotLite[];
  teamNameById: Map<string, string>;
}

export function useGamificationData() {
  return useQuery<GamificationData>({
    queryKey: ["gamification-data"],
    staleTime: 30_000,
    queryFn: async () => {
      const [m, p, prof, o, snaps, teams] = await Promise.all([
        supabase
          .from("matches")
          .select("id, phase, match_date, status, home_score, away_score, home_team_id, away_team_id")
          .order("match_date"),
        supabase
          .from("predictions")
          .select("user_id, match_id, home_score, away_score, points"),
        supabase.from("profiles").select("user_id, name"),
        supabase
          .from("odds_cache")
          .select("match_id, home_odds, draw_odds, away_odds"),
        supabase
          .from("ranking_snapshots")
          .select("match_id, match_date, user_id, position, total_points")
          .order("match_date"),
        supabase.from("teams").select("id, name"),
      ]);

      const oddsByMatch = new Map<string, OddsLite>();
      ((o.data as any[]) || []).forEach((row) => oddsByMatch.set(row.match_id, row));

      const teamNameById = new Map<string, string>();
      ((teams.data as any[]) || []).forEach((t) => teamNameById.set(t.id, t.name));

      return {
        matches: (m.data as MatchLite[]) || [],
        predictions: (p.data as PredictionLite[]) || [],
        profiles: (prof.data as ProfileLite[]) || [],
        oddsByMatch,
        snapshots: (snaps.data as RankingSnapshotLite[]) || [],
        teamNameById,
      };
    },
  });
}
