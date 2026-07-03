## Problema

A `seed-knockout-matches` importa oitavas do `football-data.org` (`stage=LAST_16`). A API retorna 8 fixtures, mas 3 ainda vêm com placeholders (`"Winner Match 47"`, `""`, `"TBD"`) porque esse feed demora a preencher confrontos. Por isso Espanha×Portugal, Alemanha×… e Argentina×… não entram — a função pula silenciosamente qualquer fixture com nome vazio/`tbd` e o restante não casa em `findTeam`, sem aparecer em `unmatched`.

Além disso, o filtro atual só olha `"tbd"`. Nomes tipo `"Winner Match 47"` não são pulados no filtro, vão pro `findTeam`, não casam e — pelo log atual — não aparecem em `unmatched` (provavelmente porque `homeName`/`awayName` chegou vazio; de qualquer forma, hoje não temos visibilidade).

## Solução

### 1. Trocar a fonte para API-Football (RAPIDAPI), mantendo football-data como fallback

- API-Football já é usada em `fetch-odds` e `fetch-match-results`, com `RAPIDAPI_KEY` configurada.
- Endpoint: `GET https://api-football-v1.p.rapidapi.com/v3/fixtures?league=1&season=2026&round=Round of 16` (mesmos `round` labels para cada fase: `Round of 32`, `Round of 16`, `Quarter-finals`, `Semi-finals`, `3rd Place Final`, `Final`).
- Esse feed publica os confrontos assim que a fase anterior fecha, com nomes reais dos times (Spain, Portugal, Germany, Argentina, etc.), casando com o `teams` via o mesmo `findTeam`/`teamAliases` já existente na função.

Fluxo novo dentro da `seed-knockout-matches`:
1. Tenta API-Football (RAPIDAPI) primeiro. Se retornar ≥1 fixture com nomes reais (não vazio, não `tbd`, não `winner`), usa esse resultado.
2. Se API-Football falhar (429/403/erro/rota vazia), cai para football-data.org com a lógica atual.
3. Toda a parte de upsert (matching por par `home_team_id|away_team_id`, `skipped_finished`, `unmatched`, `api_fixture_id`) continua igual — só muda a origem do array `apiMatches` e o parser para o shape do API-Football (`fixture.id`, `teams.home.name`, `teams.away.name`, `fixture.date`, `fixture.venue.name`).

### 2. Melhorar o filtro de placeholder e a visibilidade

- Ampliar o guard para detectar `tbd`, `winner`, `loser`, `runner-up`, `w\d+`, `l\d+` e nome vazio; incluir esses casos numa nova lista `skipped_placeholders` no retorno (não em `unmatched`, que continua sendo "casamento com `teams` falhou").
- Log explícito no console para cada fixture pulada, dizendo o motivo (`placeholder` ou `unmatched`), para depurar via logs da função.

### 3. UI Admin

Sem mudança de UI. O toast já mostra `created / updated / unmatched`; adiciono `skipped_placeholders` na mesma mensagem para o admin saber que a API ainda não publicou aqueles confrontos.

## Arquivos afetados

- `supabase/functions/seed-knockout-matches/index.ts` — adicionar fetch API-Football + fallback football-data + filtro de placeholders + logging.
- `src/pages/Admin.tsx` — incluir `skipped_placeholders` no toast (1 linha).

## Fora do escopo

- Não mexer em `fetch-match-results`, `fetch-odds`, scoring, `phase_multiplier`, nem no schema.
- Não sobrescrever placar/status de jogos já existentes (a guard atual continua).
