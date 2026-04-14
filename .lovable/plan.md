

# Distribuição de apostas + deadline 1h

## Resumo
Alterar o deadline de apostas de 30min para 1h antes do jogo. Após o encerramento das apostas, exibir uma barra visual com a distribuição dos palpites (vitória mandante / empate / vitória visitante).

## Alterações

### 1. MatchCard.tsx — deadline 1h
Linha 59: trocar `30 * 60 * 1000` por `60 * 60 * 1000`.

### 2. Games.tsx — buscar distribuição de apostas
- Nova função `fetchBetDistribution` que faz query em `predictions` para todos os matches, retornando `match_id, home_score, away_score`.
- No client, agrupar por `match_id` e classificar cada palpite como "home win", "draw" ou "away win".
- Montar `Record<string, { home: number, draw: number, away: number, total: number }>`.
- Passar como prop `betDistribution` ao MatchCard.
- Só buscar/exibir para jogos cujo deadline já passou.

### 3. MatchCard.tsx — barra de distribuição
- Nova prop `betDistribution?: { home: number, draw: number, away: number, total: number }`.
- Renderizar apenas quando `locked && betDistribution && betDistribution.total > 0`.
- Layout: barra horizontal tricolor (verde = mandante, cinza = empate, vermelho = visitante) com percentuais e contagem total.
- Posicionada entre a seção de odds e a seção de palpite.

### Arquivos
- `src/components/MatchCard.tsx` — deadline + nova seção visual
- `src/pages/Games.tsx` — fetch e processamento da distribuição

