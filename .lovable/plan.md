## Objetivo

Adicionar dois indicadores de progresso no topo da página **Stats** ("Estatísticas da galera"):

1. **Jogos disputados** — ex: `10 de 104 jogos` + barra de progresso
2. **Pontos em disputa já distribuídos** — ex: `200 de 810 pts` + barra de progresso

Ambos usando o componente `Progress` já existente do shadcn.

## Onde

Novo componente `src/components/gamification/TournamentProgress.tsx`, renderizado no topo de `src/pages/Stats.tsx` (acima do `RoundPodium`).

## Cálculo

Lê `data.matches` (já disponível via `useGamificationData`).

**Jogos:**
- `total = matches.length` (deve ser 104 na Copa 2026: 72 grupos + 16 + 8 + 4 + 2 + 1 + 1)
- `played = matches.filter(m => m.status === 'finished').length`

**Pontos em disputa** — máximo possível por jogo é `5 × phase_multiplier(phase)` (mesma função do banco). Multiplicadores:

| Fase | Mult | Jogos | Máx/jogo | Total fase |
|------|------|-------|----------|------------|
| groups | 1 | 72 | 5 | 360 |
| round_of_32 | 2 | 16 | 10 | 160 |
| round_of_16 | 3 | 8 | 15 | 120 |
| quarterfinals | 4 | 4 | 20 | 80 |
| semifinals | 5 | 2 | 25 | 50 |
| third_place | 2 | 1 | 10 | 10 |
| final | 6 | 1 | 30 | 30 |
| **Total** | | **104** | | **810** |

- `totalPoints = soma de 5 * mult(phase) sobre todos matches`
- `playedPoints = soma de 5 * mult(phase) sobre matches com status='finished'`

(O cálculo é dinâmico em cima de `matches`, então se mudar a tabela continua certo.)

## UI

Card único com duas linhas, cada uma com:
- label à esquerda ("Jogos disputados" / "Pontos em disputa")
- contagem à direita (`10 / 104` · `10%`)
- `<Progress value={pct} />` abaixo

Visual coerente com `StatsGrid` (mesmo tom de card, tipografia tabular-nums).

## Não muda

- Nenhuma lógica de palpites/pontos/ranking
- Nenhum schema, função ou edge function
- `useGamificationData` permanece igual (já traz `matches` com `phase` e `status`)
