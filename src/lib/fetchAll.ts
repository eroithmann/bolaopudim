import { supabase } from "@/integrations/supabase/client";

/**
 * Busca todas as linhas de uma tabela paginando em blocos de 1000 por request
 * (limite do Data API), até cobrir o total real da consulta.
 */
export async function fetchAllRows<T = any>(
  table: string,
  select: string,
  build?: (q: any) => any
): Promise<T[]> {
  const PAGE = 1000;
  const MAX_ROWS = 100_000;
  const out: T[] = [];
  let expectedCount: number | null = null;
  for (let from = 0; ; from += PAGE) {
    let q: any = supabase
      .from(table as any)
      .select(select, from === 0 ? { count: "exact" } : undefined);
    if (build) q = build(q);
    q = q.range(from, from + PAGE - 1);
    const { data, error, count } = await q;
    if (error) throw error;
    if (from === 0 && typeof count === "number") expectedCount = count;
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (out.length >= MAX_ROWS) {
      throw new Error(`[fetchAllRows] ${table} excedeu o limite seguro de ${MAX_ROWS} linhas.`);
    }
    if (expectedCount !== null && out.length >= expectedCount) break;
    if (data.length < PAGE) break;
  }
  if (out.length >= PAGE && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      `[fetchAllRows] ${table} retornou ${out.length} linhas — confirme que está paginando ou considere uma RPC agregada.`
    );
  }
  return out;
}
