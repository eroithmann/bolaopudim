import { supabase } from "@/integrations/supabase/client";

/**
 * Busca todas as linhas de uma tabela paginando em blocos de 1000
 * (limite padrão do PostgREST). Útil para tabelas que já passaram desse
 * tamanho — sem paginação, requests retornam silenciosamente truncados.
 */
export async function fetchAllRows<T = any>(
  table: string,
  select: string,
  build?: (q: any) => any
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q: any = supabase.from(table as any).select(select);
    if (build) q = build(q);
    q = q.range(from, from + PAGE - 1);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < PAGE) break;
  }
  return out;
}
