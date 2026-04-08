

# Migrar fetch-match-results para football-data.org

## O que muda

Trocar a API instável do RapidAPI pela **football-data.org v4**, que é gratuita, documentada e confiável.

## Passos

### 1. Salvar a API key como secret
- Nome: `FOOTBALL_DATA_TOKEN`
- Valor: `447476e58ebe45a8a8f06af71821a44d`

### 2. Reescrever `supabase/functions/fetch-match-results/index.ts`

Nova lógica:
1. Buscar matches pendentes no banco (`status != 'finished'` e `match_date < agora`)
2. Extrair intervalo de datas (dateFrom/dateTo)
3. Chamar `GET https://api.football-data.org/v4/matches?dateFrom=...&dateTo=...&status=FINISHED` com header `X-Auth-Token`
4. Para cada resultado da API, comparar nomes dos times com os do banco (usando `teamAliases` existente)
5. Se encontrar match correspondente, atualizar `home_score`, `away_score`, `status = 'finished'`, `result_source = 'api'`

A API retorna:
```json
{
  "matches": [{
    "status": "FINISHED",
    "homeTeam": { "name": "Sporting CP" },
    "awayTeam": { "name": "Arsenal FC" },
    "score": {
      "fullTime": { "home": 1, "away": 3 }
    }
  }]
}
```

### 3. Manter fallback
- Se a API não retornar dados ou não encontrar o jogo, reportar sem erro
- Admin pode inserir manualmente pelo painel

### 4. Testar
- Resetar os jogos da Champions para `scheduled`
- Clicar "Buscar Resultados" no Admin
- Verificar se os placares atualizam e o ranking recalcula

## Arquivos alterados
- `supabase/functions/fetch-match-results/index.ts` — reescrita completa
- Novo secret: `FOOTBALL_DATA_TOKEN`

