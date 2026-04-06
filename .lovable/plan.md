

# Corrigir Jogos e Probabilidades

## Diagnóstico

### Jogos incorretos
Os jogos atuais (EUA x México, Argentina x Uruguai no mesmo grupo, etc.) foram inseridos manualmente como placeholders fictícios. Precisam ser substituídos pelos jogos reais da Copa 2026. A melhor abordagem: usar a **API-Football** (já configurada com RAPIDAPI_KEY) para buscar os fixtures oficiais e popular o banco automaticamente.

### Odds/probabilidades não aparecem
A edge function `fetch-odds` usa o sport key `soccer_fifa_world_cup`, que pode não ter mercados publicados na Odds API ainda. Sites como Betano já têm odds, mas usam APIs próprias. Solução híbrida: tentar múltiplos sport keys na Odds API + adicionar fallback.

---

## Plano de Implementação

### 1. Edge function `seed-matches-from-api` (nova)
- Consulta `GET /fixtures?league=1&season=2026` na API-Football
- Para cada fixture retornado:
  - Encontra os times pelo nome (matching com tabela `teams`)
  - Se o time não existe, cria na tabela `teams`
  - Insere/atualiza o match com data, venue, grupo, fase, `api_fixture_id`
- Deleta matches antigos que não existem nos fixtures da API
- Retorna resumo (criados, atualizados, removidos)

### 2. Corrigir tabela `teams`
- Os times e grupos atuais podem estar incorretos
- A função vai atualizar os grupos dos times com base nos dados da API
- Mapeamento de nomes da API para códigos existentes (ex: "Brazil" → BRA)

### 3. Melhorar edge function `fetch-odds`
- Tentar múltiplos sport keys: `soccer_fifa_world_cup`, `soccer_fifa_world_cup_winner`, `soccer_international_friendlies`
- Listar os sports disponíveis primeiro (`/v4/sports`) e filtrar os que contêm "fifa" ou "world cup"
- Melhorar matching de times (adicionar mais aliases)
- Logar quais jogos encontraram odds e quais não, para debug

### 4. Painel Admin — Botão "Atualizar Jogos da API"
- Adicionar botão no Admin que chama `seed-matches-from-api`
- Mostra quantos jogos foram criados/atualizados/removidos
- Separado do botão existente "Buscar da API" (que busca resultados/placares)

### 5. Proteção de dados existentes
- Predictions existentes são vinculadas por `match_id` — ao deletar matches antigos, predictions também são removidas (CASCADE)
- Como os jogos atuais são fictícios e provavelmente não há palpites reais relevantes, isso é aceitável

---

## Detalhes técnicos

- **API-Football endpoint**: `GET /fixtures?league=1&season=2026` retorna todos os jogos com times, datas, venues, status
- **Odds API discovery**: `GET /v4/sports/?apiKey=...` lista todos os esportes disponíveis — usaremos isso para encontrar o key correto da Copa 2026
- **Matching de times**: Expandir o `nameMap` com mais variações (ex: "Brasil" / "Brazil", "Coreia do Sul" / "South Korea" / "Korea Republic")
- Migration não é necessária — schema já está correto, apenas dados precisam mudar

