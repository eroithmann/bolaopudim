

# Proteger jogos manuais + Teste com Champions League

## Problema identificado

A edge function `seed-matches-from-api` na **linha 171** faz `DELETE` de **todos** os matches antes de reinserir os da Copa. Isso apagou o jogo Goiás x Criciúma e qualquer palpite associado.

## Plano

### 1. Proteger jogos manuais na função seed

Alterar `seed-matches-from-api/index.ts` para deletar apenas jogos que pertencem à fase de grupos da Copa (phase = 'groups' com group_name começando por "Grupo"), preservando jogos com `group_name = 'Teste'` ou qualquer outro grupo customizado.

Trocar a linha:
```
DELETE ... neq("id", "00000000...")
```
Por:
```
DELETE ... like("group_name", "Grupo %").eq("phase", "groups")
```

Isso garante que jogos de teste ou de outras competições nunca sejam apagados pela importação da Copa.

### 2. Adicionar jogos da Champions League de hoje como teste

Inserir via SQL (usando insert tool) os times e jogos das quartas de final da Champions de hoje (08/04/2026). Os jogos de hoje são:
- **Barcelona x Dortmund** (16h BRT)  
- **Inter x Bayern** (16h BRT)

Criar os times (BAR, DOR, INT, BAY) se não existirem, e os matches com `group_name = 'Champions League'` e `phase = 'test'` para distinguir dos jogos da Copa.

### 3. Atualizar `fetch-match-results` para suportar Champions

A função atual busca resultados apenas da `league=1&season=2026` (Copa do Mundo). Adicionar suporte para buscar resultados da Champions League (`league=2&season=2025`) para os jogos marcados como Champions.

Alternativa mais simples: como é teste, manter o fluxo manual pelo Admin — inserir o resultado manualmente depois do jogo para validar o cálculo de pontos e ranking.

### 4. Adicionar bandeiras dos times da Champions no `teamFlags.ts`

Adicionar códigos de clubes: BAR (bandeira da Espanha como fallback), DOR (Alemanha), INT (Itália), BAY (Alemanha). Ou usar logos genéricos.

---

## Detalhes técnicos

- A proteção no seed é a mudança mais crítica — evita perda de dados na Copa
- Os jogos da Champions terão `phase: 'test'` para fácil limpeza posterior
- O `recalculate_match_points` trigger já funciona para qualquer match — basta salvar o resultado pelo Admin

