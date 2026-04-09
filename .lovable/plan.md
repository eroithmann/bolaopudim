

# Corrigir datas dos jogos teste para a API funcionar

## Problema

A API football-data.org **funciona** — testei e ela retorna os resultados corretos:
- Arsenal 3x0 Real Madrid
- Bayern 1x2 Inter

Porém, os jogos no banco estão com data **2026-04-07**, e a API só tem dados de datas reais. Quando a função busca `dateFrom=2026-04-07`, a API retorna 0 porque essa data é "futura" para ela.

Os jogos reais aconteceram em **2025-04-08**.

## Solução

### 1. Atualizar as datas dos jogos teste no banco

Alterar as datas dos 2 matches de Champions para `2025-04-08` (data real) via migration SQL:
- Sporting vs Arsenal → `2025-04-08 19:00:00+00`
- Real Madrid vs Bayern → `2025-04-08 19:00:00+00`

### 2. Corrigir nomes dos times no matching

A API retorna:
- `"Arsenal FC"` — precisa fazer match com `"Arsenal"`  ✅ (já tem alias)
- `"Real Madrid CF"` — precisa fazer match com `"Real Madrid"` ✅ (já tem alias)
- `"FC Bayern München"` — precisa fazer match com `"Bayern Munich"` ✅ (já tem alias)

Os aliases já cobrem esses casos.

### 3. Ajustar a função para nota dos times

A API retorna `Sporting CP` e o banco tem `Sporting CP` — match direto. Arsenal, Real Madrid e Bayern também já estão mapeados.

### 4. Testar

Após a migration, clicar "Buscar Resultados" no Admin. A função vai buscar `dateFrom=2025-04-08` e encontrar os resultados, atualizando automaticamente:
- Sporting CP vs Arsenal → resultado da API
- Real Madrid vs Bayern → resultado da API

**Nota**: Os jogos reais dessa data são Arsenal vs Real Madrid e Bayern vs Inter — não Sporting vs Arsenal e Real Madrid vs Bayern. Então o matching pode não funcionar se os confrontos do banco não correspondem aos da API. Nesse caso, seria melhor **inserir manualmente** os resultados que você quiser pelo Admin, já que esses são jogos fictícios de teste.

## Alternativa recomendada

Como os confrontos no banco (Sporting vs Arsenal, Real Madrid vs Bayern) são diferentes dos reais da Champions (Arsenal vs Real Madrid, Bayern vs Inter), a melhor abordagem é:

1. **Inserir manualmente** os resultados pelo Admin para testar o ranking
2. Confiar que a API está funcionando (já comprovado acima)
3. Na Copa do Mundo real, os confrontos vão bater com os da API e tudo vai funcionar automaticamente

