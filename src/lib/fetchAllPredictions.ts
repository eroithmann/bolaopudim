import { supabase } from "@/integrations/supabase/client";

/**
 * PostgREST limita a 1000 linhas por request. Pagina manualmente para
 * garantir que TODAS as apostas sejam carregadas (já passamos de 1000).
 */
export async function fetchAllPredictions<T = any>(
  columns: string,
  modifyQuery?: (q: any) => any
): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q: any = supabase.from("predictions").select(columns);
    if (modifyQuery) q = modifyQuery(q);
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE) break;
  }
  return all;
}
