## Objetivo
Mostrar em cada card de jogo, como texto simples, os canais que transmitem no Brasil (ex.: "TV: Globo, SporTV, CazéTV"), usando o Sofascore como fonte.

## Arquitetura

### 1. Tabela de cache
Nova tabela `match_broadcasts` para não scrapear toda hora:
- `match_id` (FK matches, unique)
- `channels` (text[])
- `source` (text, default 'sofascore')
- `fetched_at` (timestamptz)
- `updated_at`
- RLS: SELECT público (anon+authenticated), INSERT/UPDATE só service_role (edge function).
- GRANTs conforme política.

### 2. Edge function `fetch-broadcasts`
- Roda sob demanda (botão admin) e também via cron diário.
- Para cada `match` futuro / nas próximas 72h sem broadcast cacheado:
  1. Buscar evento no Sofascore: `GET https://api.sofascore.com/api/v1/search/events?q={time1}+{time2}` ou usar o endpoint de agenda por data `https://api.sofascore.com/api/v1/sport/football/scheduled-events/{yyyy-MM-dd}` e casar por nomes dos times.
  2. Com o `eventId`, chamar `https://api.sofascore.com/api/v1/event/{id}/channels/BR` (endpoint público que o site usa) → lista de `channelId`s.
  3. Para cada `channelId`, buscar nome via `https://api.sofascore.com/api/v1/tv/channel/{id}` (cachear em memória durante a execução).
  4. Filtrar/normalizar: remover duplicatas, manter ordem (TV aberta → fechada → streaming). Map de nomes (ex.: "Globo" / "SporTV" / "CazéTV" / "GE" etc.).
  5. Upsert em `match_broadcasts`.
- Headers: User-Agent de browser; tratar 404 (sem transmissão BR conhecida) gravando `channels = []` para não re-tentar logo.
- CORS padrão + validação de input.

### 3. Trigger no admin
Botão "Atualizar transmissões" na página Admin, ao lado dos botões existentes (resultados/odds), chamando a edge function. Toast com nº de jogos atualizados.

### 4. UI no MatchCard
- Buscar broadcasts junto com os jogos em `Games.tsx` e `PublicBets.tsx` (uma query única em `match_broadcasts` por lista de match_ids, mapear por match_id).
- Passar `broadcasts?: string[]` como prop opcional para `MatchCard`.
- Renderizar abaixo da linha de data/venue, antes das probabilidades:
  ```
  📺 Globo, SporTV, CazéTV
  ```
  Estilo: `text-[11px] text-muted-foreground`, truncar com `line-clamp-1`. Só exibir se array não vazio.

## Riscos / observações
- Sofascore não tem API oficial; os endpoints `/api/v1/...` são os usados pelo próprio site. Podem mudar sem aviso e podem rate-limitar — por isso o cache na tabela e busca server-side via edge function.
- Casar times pelo nome pode falhar para nomes traduzidos; usar normalização semelhante à que já existe em `fetch-match-results` (reaproveitar map de aliases).
- Primeira execução popula só jogos próximos; jogos muito distantes podem ainda não ter transmissão definida no Sofascore.

## Arquivos
- **Migration**: criar `match_broadcasts` + GRANTs + RLS.
- **Nova edge function**: `supabase/functions/fetch-broadcasts/index.ts`.
- **Editar** `supabase/functions/fetch-match-results/index.ts` apenas se for útil extrair o map de aliases de times para um módulo compartilhado (opcional; senão duplicar inline).
- **Editar** `src/pages/Admin.tsx`: novo botão.
- **Editar** `src/pages/Games.tsx` e `src/pages/PublicBets.tsx`: fetch + passar prop.
- **Editar** `src/components/MatchCard.tsx`: nova prop + render.
