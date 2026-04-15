

# Correção do matching Liverpool vs PSG + prevenção futura

## Diagnóstico
- **API retorna**: `"Paris Saint-Germain FC"` e `"Liverpool FC"`
- **Aliases atuais do PSG**: `["paris saint-germain", "paris sg", "psg"]` — falta `"paris saint-germain fc"`
- **Liverpool funciona** porque já tem `"liverpool fc"` nos aliases
- **Atlético funciona** porque tem `"club atlético de madrid"` nos aliases

## Correções

### 1. Adicionar alias faltante (fetch-match-results/index.ts)
Adicionar `"paris saint-germain fc"` à lista de aliases do PSG.

### 2. Padronizar group_name dos jogos de teste
Atualizar via migration: todos os jogos de teste com `group_name = 'Champions League QF'` para consistência.

### 3. Melhoria preventiva: fallback com normalização
Adicionar ao `matchesTeamName` uma etapa extra: se nenhum alias exato bater, tentar remover sufixos comuns ("FC", "CF", "SC", "AFC") de ambos os nomes e comparar novamente. Isso evita que o problema se repita com outros times (ex: "Arsenal FC" vs "Arsenal").

```text
Fluxo de matching melhorado:
1. Comparação exata (lowercase)
2. Comparação por alias exato
3. [NOVO] Remover sufixos (FC/CF/SC/AFC) → comparar novamente
```

### Arquivos alterados
- `supabase/functions/fetch-match-results/index.ts` — alias + fallback de normalização
- Migration SQL — padronizar group_name dos jogos de teste

