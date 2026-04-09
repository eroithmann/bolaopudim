

# Corrigir jogos de teste + Blindar matching para a Copa

## Problema

1. Os confrontos de teste foram alterados de Sporting x Arsenal e Real Madrid x Bayern para Arsenal x Real Madrid e Bayern x Inter — que são os jogos reais da Champions 2024/25. Isso foi feito na tentativa anterior de fazer a API funcionar. Precisa voltar ao correto.

2. A função `fetch-match-results` tem riscos para a Copa:
   - O `matchesTeamName` usa `includes()`, que pode causar falsos positivos (ex: "Inter" matching "Inter Miami")
   - Não valida que **ambos** os times do confronto batem — na verdade valida, mas o `includes` é perigoso
   - Não há proteção contra atualizar um jogo com resultado de outro jogo diferente

## Plano

### 1. Restaurar os confrontos de teste corretos

Via insert tool (UPDATE), restaurar:
- Match `52fc79fd...` → home: Sporting CP, away: Arsenal, status: scheduled, scores: null
- Match `dde18283...` → home: Real Madrid, away: Bayern Munich, status: scheduled, scores: null

### 2. Blindar o matching de times na edge function

Melhorar `matchesTeamName` para ser mais rigoroso:
- Remover a lógica de `includes()` que causa falsos positivos
- Usar apenas comparação exata e aliases explícitos
- Cada alias deve ser uma string completa, não substring

### 3. Adicionar validação extra no matching

Antes de atualizar um match, verificar:
- Ambos os times (home E away) batem com o jogo da API
- A data do jogo da API está próxima da data do banco (±2 dias)
- Log claro de quais jogos foram matched e quais não

### 4. Adicionar mais aliases para Copa do Mundo 2026

Garantir que todos os 48 times da Copa tenham aliases cobrindo os nomes que a football-data.org usa (ex: "Korea Republic" → "South Korea").

## Arquivos alterados
- `supabase/functions/fetch-match-results/index.ts` — matching mais seguro
- 2 UPDATEs no banco para restaurar os jogos de teste

