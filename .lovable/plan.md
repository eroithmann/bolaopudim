## Diagnóstico

A função `fetch-odds` falhou em todos os jogos porque a **API RapidAPI (free-api-live-football-data) estourou a cota mensal do plano BASIC**. Os logs mostram, para cada data consultada:

```
API 429: You have exceeded the MONTHLY quota for Requests on your current plan, BASIC.
```

Como nenhuma fixture é retornada (`0 fixtures`), o matching time-a-time falha em 100% dos jogos e nada é gravado em `odds_cache`. Não é bug de código nem de mapeamento de nomes — é limite da conta RapidAPI esgotado até o próximo ciclo.

## Solução proposta

Aproveitar o secret **`ODDS_API_KEY`** que já existe no projeto (the-odds-api.com) como **fonte primária de odds**, mantendo a RapidAPI apenas como fallback se algum dia o ODDS_API_KEY falhar. The Odds API tem cobertura nativa para "FIFA World Cup" e devolve odds 1X2 (h2h) já no formato decimal, sem precisar de busca por evento.

### Mudanças

1. **`supabase/functions/fetch-odds/index.ts`** — em modo `refresh=true`:
   - Tentar primeiro `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds?regions=eu&markets=h2h&oddsFormat=decimal` (1 única requisição cobre todos os jogos próximos).
   - Para cada evento retornado, casar com nossos `matches` via `home_team`/`away_team` (usando o mesmo `normalize` + `aliases` que já existe).
   - Calcular média das odds dos bookmakers (ou pegar o primeiro disponível, ex.: Bet365/Pinnacle se estiverem na lista) e fazer upsert em `odds_cache` com `source: "the-odds-api"`.
   - Se a chamada retornar 401/429/erro, cair no caminho atual de RapidAPI sem alterar a lógica existente.
   - Retornar no JSON `{ refreshed, total, source: "the-odds-api" | "rapidapi", logs }` para o admin enxergar a origem.

2. **`src/pages/Admin.tsx`** (toast de "Atualizar Odds") — mostrar a fonte usada e, quando `refreshed === 0`, exibir uma mensagem clara: "Cota da API esgotada — odds não atualizadas".

### Observações

- Não há alteração de schema nem de RLS.
- Continua sendo 1 chamada admin sob demanda, então não há risco de estourar o free tier do the-odds-api (500 req/mês).
- Se preferir, posso também adicionar um botão "Limpar odds antigas" depois, mas não é necessário para resolver o problema atual.
