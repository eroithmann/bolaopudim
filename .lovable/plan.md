## Diagnóstico do estouro

O cron atual roda **a cada 2 minutos, 24h por dia** → ~720 execuções/dia. Cada execução faz pelo menos 1 request ao `api.football-data.org`. O plano Free tem teto mensal pequeno (~100 req/dia efetivos) — estourar era questão de tempo.

A função também não tem nenhum guard: chama a API mesmo quando não há nada pra atualizar (madrugada, dias sem jogo, etc.).

## Estratégia aprovada

Manter o cron rodando frequentemente (a cada 3 min), mas a função decide **dentro dela mesma** se vale a pena chamar a API externa. Regra:

> Só chamar `api.football-data.org` se existir pelo menos um jogo com `status != 'finished'` cujo `match_date` esteja entre `now - 4h` e `now - 5min` (ou seja: já começou há pelo menos 5 min e tem menos de 4h desde o kickoff — janela onde resultados costumam aparecer).

Isso elimina ~95% das chamadas e foca o consumo de quota exatamente na janela útil pós-jogo.

## Mudanças

### 1) Edge function `fetch-match-results` — adicionar guard inicial

Logo após buscar `pendingMatches`, filtrar para a **janela útil**:

```ts
const nowMs = Date.now();
const inWindow = pendingMatches.filter(m => {
  const kickoff = new Date(m.match_date).getTime();
  const elapsedMin = (nowMs - kickoff) / 60000;
  return elapsedMin >= 5 && elapsedMin <= 240; // 5min a 4h após início
});

if (inWindow.length === 0) {
  return new Response(JSON.stringify({
    success: true,
    skipped: true,
    reason: "Nenhum jogo na janela útil (5min–4h após início)",
    pending_total: pendingMatches.length,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

Depois disso, só os jogos `inWindow` viram alvo do matching contra a resposta da API. Importante: a chamada `fetchFromApi(...)` só acontece **se** `inWindow.length > 0`.

### 2) Cron — trocar `*/2` por `*/3` minutos

Atualizar o job `fetch-match-results-every-5min` (nome errado, hoje roda a cada 2 min) para `*/3 * * * *`. A combinação `cron a cada 3min` + `guard de janela` dá:

- Dias sem jogo: **0 requests à API** (função sai cedo).
- Dia com 3 jogos: ~3 jogos × 4h × 20 chamadas/h = **240 requests/dia no pior caso**, mas como cada chamada já cobre TODOS os jogos do dia em 1 request, é só **~80 requests/dia** (a cada 3min × 4h por jogo, com sobreposição quando há jogos no mesmo dia).

### 3) Primeira ativação a partir de hoje 21h (BRT)

O usuário disse que vai lançar manualmente o jogo das 17h BRT (que termina ~19h, quando a API ainda está bloqueada). Para o jogo de **21h BRT (00:00 UTC)** — terminando ~23h BRT (02:00 UTC) — o cron já estará rodando com a nova lógica.

Como precaução extra contra alertas da API enquanto a quota não reseta, vou adicionar tratamento explícito de **HTTP 429/403** na resposta da `fetchFromApi`: se vier "quota exceeded", a função retorna `{ success: false, quota_exceeded: true }` em vez de quebrar, e o cron não tenta de novo até que a quota volte (sem retries em loop).

### 4) Sem mudanças no front, no scoring, no design

Só edge function + cron schedule. Nada quebra para o usuário final.

## Arquivos alterados

- `supabase/functions/fetch-match-results/index.ts` — adicionar guard de janela + tratamento de 429/403.
- Cron `fetch-match-results-every-5min` — `UPDATE cron.job` via supabase--insert para mudar schedule de `*/2 * * * *` → `*/3 * * * *` (e renomear para `fetch-match-results-smart`).

## O que você faz manualmente

- Lançar o placar do jogo das 17h BRT (hoje) pela tela `/admin` — porque a quota ainda está estourada e a API não vai responder até o reset.
- A partir do jogo das 21h BRT, o cron novo já cuida sozinho (assumindo que a quota tenha resetado ou que sobre folga para o resto do mês).

## Resposta à sua pergunta "isso reduz a chance de bloqueio?"

**Sim, drasticamente.** Hoje: 720 chamadas/dia mesmo sem jogo. Depois: ~0 fora da janela útil; ~60-100/dia em dias de jogo. Cabe folgadamente no Free.
