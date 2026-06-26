## Objetivo

Importar progressivamente os jogos do mata-mata (32-avos, oitavas, quartas, semi, 3º lugar, final) conforme cada fase é definida, **sem nunca sobrescrever jogos já existentes** (placares, status, palpites, datas editadas manualmente).

## Garantia de segurança (vale para todas as fases)

A nova lógica de upsert por fase segue o mesmo padrão já validado na `seed-matches-from-api` atual:

1. Cada execução é **escopada a uma única `phase`** (`round_of_32`, `round_of_16`, `quarterfinals`, `semifinals`, `third_place`, `final`). Jogos de outras fases nunca entram na query — impossível tocar fase de grupos rodando o R16, etc.
2. Chave de identidade: `home_team_id + away_team_id + phase`.
3. Se o jogo **já existe**: atualiza só `match_date`, `venue` (quando vier diferente). **Nunca** mexe em `home_score`, `away_score`, `status`, `result_source`.
4. Se **não existe**: insere com `status='scheduled'`.
5. **Não deleta** jogos de mata-mata sob hipótese nenhuma (diferente do que faz hoje na fase de grupos com "sobras"). Mata-mata pode ter confronto reorganizado pela FIFA e queremos preservar palpites a todo custo.
6. Times faltantes (caso algum classificado ainda não exista no `teams`) são criados sob demanda, como já acontece hoje.

## Implementação

### 1. Nova edge function `seed-knockout-matches`

Aceita `phase` no body (`round_of_32` | `round_of_16` | `quarterfinals` | `semifinals` | `third_place` | `final`).

Fluxo:
- Chama API-Football (RAPIDAPI_KEY, mesma usada hoje) filtrando fixtures da Copa 2026 pela fase pedida.
- Faz o matching `home`/`away` contra `teams` usando o mesmo normalizador + aliases já existentes na `fetch-match-results` (extraio para um util compartilhado em `_shared/teamMatch.ts` para não duplicar).
- Para cada fixture casada, aplica o upsert seguro descrito acima.
- Retorna `{ phase, created, updated, skipped_unmatched, unmatched: [...] }`.

Se a API estiver indisponível ou não tiver os confrontos ainda (caso comum antes do último jogo da fase anterior), retorna `{ created: 0, updated: 0, message: "Confrontos ainda não disponíveis na API" }` — sem erro.

### 2. UI no Admin (`src/pages/Admin.tsx`)

Substituo o botão único "Importar Jogos da API" por um pequeno menu com 6 ações, uma por fase:

```
Importar fase ▾
  ├─ 32-avos
  ├─ Oitavas
  ├─ Quartas
  ├─ Semifinais
  ├─ 3º lugar
  └─ Final
```

O botão "Importar Jogos da API" (fase de grupos) continua existindo separado, apontando para a função antiga `seed-matches-from-api` — sem alteração nela.

Toast mostra: `X criados, Y atualizados, Z não casados (lista resumida)`.

### 3. (Opcional, mesmo PR) Hardening na `seed-matches-from-api` atual

Adiciono guard explícito para **bloquear** updates quando `existing.status = 'finished'`, mesmo nos metadados — hoje ela atualiza `match_date` mesmo em jogo finalizado, o que é inofensivo mas confuso. Pequena melhoria de robustez.

## Detalhes técnicos

- Phase IDs FIFA na API-Football v3 (`/fixtures?league=1&season=2026&round=...`): `Round of 32`, `Round of 16`, `Quarter-finals`, `Semi-finals`, `3rd Place Final`, `Final`. Mapeio para nosso enum interno.
- Util de matching extraído: `supabase/functions/_shared/teamMatch.ts` com `normalize(name)`, `aliases`, `findTeamByName(teams, apiName)`. Refatoro a `fetch-match-results` no mesmo passo para usar o util (mantendo o comportamento atual).
- Sem migrations. Sem mudança de schema.

## Fora do escopo

- Não vou auto-rodar nada via cron — fica manual no Admin, você dispara após cada fase fechar.
- Não mexo no scoring nem no `phase_multiplier` (já cobre todas as fases).
