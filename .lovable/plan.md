

# Corrigir pontos fantasma + API de teste

## Problemas encontrados

### 1. Pontos fantasma no ranking (6 pontos)
O trigger `on_match_result_updated` só roda quando `status = 'finished'`. Quando limpamos o resultado (voltando para `scheduled`), o trigger **não roda** e os pontos antigos ficam na tabela `predictions`. Agora as predictions mostram 5 + 1 = 6 pontos, mesmo sem resultado nos matches.

### 2. Ranking não valida se o jogo terminou
A query do ranking soma `predictions.points` sem verificar se o match correspondente está `finished`. Pontos órfãos aparecem no ranking.

### 3. API não encontra os jogos de teste
"Sporting CP vs Arsenal" e "Real Madrid vs Bayern Munich" são confrontos **fictícios** — nunca aconteceram na vida real. A API football-data.org só retorna jogos reais. Por isso retorna "NO MATCH" para ambos.

## Plano

### 1. Resetar pontos órfãos agora (SQL UPDATE)
```sql
UPDATE predictions SET points = NULL 
WHERE match_id IN (
  SELECT id FROM matches WHERE status != 'finished'
);
```

### 2. Melhorar o trigger para resetar pontos ao limpar resultado
Alterar o trigger para rodar também quando o match volta para `scheduled`, zerando os pontos das predictions associadas. Novo trigger:
- Se `status = 'finished'` → calcula pontos (como hoje)
- Se `status != 'finished'` → seta `points = NULL` nas predictions

### 3. Ranking: filtrar apenas matches finalizados
Alterar `Ranking.tsx` para fazer join com `matches` e só somar pontos de jogos com `status = 'finished'`. Isso protege contra qualquer dado inconsistente.

### 4. Sobre os jogos de teste e a API
Os confrontos Sporting vs Arsenal e Real Madrid vs Bayern são fictícios. A API **nunca** vai encontrá-los. Duas opções:
- **Opção A**: Trocar os jogos de teste por confrontos reais (ex: Arsenal vs Real Madrid, Bayern vs Inter de 08/04/2025) — a API vai encontrar e atualizar
- **Opção B**: Manter os fictícios e aceitar que só funcionam com inserção manual — a Copa real vai funcionar porque os confrontos vão bater

Vou implementar a **Opção A** por padrão (trocar para confrontos reais) para que você possa testar a API de ponta a ponta. Se preferir manter os fictícios, me avise.

## Arquivos alterados
- Migration SQL: novo trigger + reset de pontos órfãos
- `src/pages/Ranking.tsx` — filtrar pontos apenas de jogos finalizados
- Migration SQL: atualizar `home_team_id`/`away_team_id` dos matches de teste para confrontos reais

## Detalhes técnicos
- O trigger atual tem `WHEN (new.status = 'finished')` — precisa ser removido do WHEN e a lógica condicional vai para dentro da função
- A função `recalculate_match_points` será alterada para lidar com ambos os cenários
- O ranking passará a fazer query com join: `predictions` → `matches` (via `match_id`) filtrando `matches.status = 'finished'`

