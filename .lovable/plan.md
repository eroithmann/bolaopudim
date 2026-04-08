

# Corrigir `fetch-match-results` — API errada

## Problema

A função `fetch-match-results` ainda usa a API antiga (`api-football-v1.p.rapidapi.com`) à qual você não é assinante. Por isso retorna erro 403.

## Solução

Reescrever `fetch-match-results` para usar a mesma API gratuita (`free-api-live-football-data.p.rapidapi.com`) que o seed já usa.

### Lógica da nova função

1. Buscar todos os matches do banco que têm `status != 'finished'` e `match_date` já passou (jogos que deveriam ter terminado)
2. Para cada match, buscar o nome dos times via join com `teams`
3. Usar o endpoint da API gratuita para buscar resultados dos jogos por time/data
4. Atualizar `home_score`, `away_score`, `status = 'finished'`, `result_source = 'api'`

### Abordagem alternativa (mais robusta)

Como a API gratuita pode não ter um endpoint direto de "fixtures by league", a abordagem mais confiável é:

1. Buscar matches pendentes (status `scheduled`, match_date < agora)
2. Para cada match, usar endpoint de busca por time para encontrar o resultado
3. Se encontrar score final, atualizar o match

### Detalhes técnicos

- Arquivo: `supabase/functions/fetch-match-results/index.ts`
- Manter CORS headers corretos
- Usar `RAPIDAPI_KEY` existente (mesmo secret)
- Host: `free-api-live-football-data.p.rapidapi.com`
- Fallback: se a API não retornar dados, reportar sem erro — o admin pode inserir manualmente

