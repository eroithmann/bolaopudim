

# Corrigir fetch-match-results — API retorna 0 resultados

## Diagnóstico

A função está funcionando corretamente (HTTP 200), mas a API football-data.org retorna **0 jogos** para `dateFrom=2026-04-07&dateTo=2026-04-07&status=FINISHED`.

O plano gratuito da football-data.org cobre Champions League, mas o endpoint `/v4/matches` sem filtro de competição pode não retornar tudo. Além disso, precisamos de melhor logging para entender o que a API está devolvendo.

## Plano

### 1. Adicionar filtro de competição e logging detalhado

Alterar a função para:
- Fazer múltiplas chamadas filtradas por competição (Champions League = `CL`, Copa do Mundo = `WC`)
- Logar o corpo da resposta da API para debug
- Se a chamada sem filtro retornar 0, tentar com filtro `competitions=CL,WC`

### 2. Testar com a resposta raw

Adicionar `console.log` do JSON bruto da API para ver exatamente o que ela retorna — pode ser que os jogos estejam lá com status diferente de `FINISHED` (ex: `IN_PLAY`, `PAUSED`).

### 3. Fallback: buscar sem filtro de status

Se `status=FINISHED` retornar 0, fazer uma segunda chamada sem esse filtro para ver todos os jogos do dia e logar os status encontrados.

## Alteração técnica

Arquivo: `supabase/functions/fetch-match-results/index.ts`

```text
Lógica atual:
  GET /v4/matches?dateFrom=X&dateTo=Y&status=FINISHED

Nova lógica:
  1. GET /v4/matches?dateFrom=X&dateTo=Y&status=FINISHED
  2. Se retornar 0, tentar GET /v4/matches?dateFrom=X&dateTo=Y (sem filtro status)
  3. Logar todos os jogos encontrados com seus status
  4. Atualizar apenas os que têm score final
```

Isso vai nos mostrar se o problema é o filtro de status, a competição, ou se a API simplesmente não tem os dados.

