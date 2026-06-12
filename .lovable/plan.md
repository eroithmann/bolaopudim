## Plano para deixar a sincronização de resultados mais robusta

### Problema identificado
- O jogo Canadá x Bósnia foi salvo manualmente, então já não aparece mais como pendente para a função buscar.
- A função atual depende de combinação por nomes traduzidos/aliases e data próxima.
- `Canadá` tem alias para `canada`, mas `Bósnia e Herzegovina` não tem aliases como `bosnia and herzegovina`, `bosnia-herzegovina`, `bosnia`, `bih` etc.
- Os jogos também não têm `api_fixture_id` preenchido, então a sincronização não usa o identificador oficial da API, que é o método mais confiável.

### Mudanças propostas
1. **Melhorar matching por país/time**
   - Adicionar aliases ausentes para seleções, começando por Bósnia e Herzegovina, RD Congo, Iraque e outros nomes comuns em inglês/português.
   - Criar normalização centralizada: remover acentos, pontuação, hífens, variações de espaços e sufixos comuns.
   - Comparar também por código de seleção quando disponível (`CAN`, `BIH`, etc.).

2. **Usar identificador da API quando existir**
   - Ajustar a sincronização para primeiro tentar bater pelo `api_fixture_id` salvo no jogo.
   - Se não existir, usar o matching por times + data como fallback.
   - Ao encontrar por fallback, salvar o `api_fixture_id` no jogo para as próximas sincronizações serem diretas.

3. **Ampliar a janela e melhorar diagnóstico**
   - Manter janela segura por data, mas registrar claramente quais jogos ficaram sem match e quais nomes vieram da API.
   - Retornar no resultado da função uma lista de jogos não encontrados com motivo provável: nome, data ou placar/status indisponível.

4. **Melhorar feedback no painel admin**
   - Em vez de mostrar apenas “0 jogos atualizados”, exibir também quantos jogos foram verificados e quais ficaram sem encontrar resultado.
   - Assim, se a API não retornar o jogo ou retornar com nome diferente, fica visível sem depender de logs.

5. **Validar com casos reais**
   - Testar mentalmente/por chamada da função os casos Canadá x Bósnia, PSG/Liverpool e seleções com acentos/traduções.
   - Conferir se jogos manualmente finalizados não são sobrescritos indevidamente.