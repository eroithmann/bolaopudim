import { fetchAllRows } from "@/lib/fetchAll";

/**
 * Garante que TODAS as apostas sejam carregadas, paginando além do limite
 * de 1000 linhas por request do Data API.
 */
export async function fetchAllPredictions<T = any>(
  columns: string,
  modifyQuery?: (q: any) => any
): Promise<T[]> {
  return fetchAllRows<T>("predictions", columns, (q) => {
    const ordered = q.order("created_at", { ascending: true }).order("id", { ascending: true });
    return modifyQuery ? modifyQuery(ordered) : ordered;
  });
}
