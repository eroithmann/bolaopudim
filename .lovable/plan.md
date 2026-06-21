Diagnóstico encontrado:

- As apostas não sumiram do banco: para TUN x JPN existem 21 apostas e todas têm pontos calculados.
- A tela publicada mostrou 14/21 porque estava carregando só as primeiras 1000 linhas da tabela de apostas.
- Hoje o banco já tem 1028 apostas; as 28 linhas além da 1000ª ficam invisíveis para a tela antiga. Isso bate exatamente com o print: TUN x JPN aparecendo 14/21 e ECU x CUR 19/21.
- A tela do código atual já tem uma correção parcial com paginação, mas a versão publicada aparentemente ainda não está usando essa versão.
- Também achei dois problemas de robustez no backend: gatilhos duplicados de auditoria/pontuação, que geram logs duplicados e podem recalcular/registrar mudanças mais de uma vez.

Plano de correção:

1. Garantir paginação completa na tela Galera
   - Manter/validar o carregamento paginado de `predictions` em blocos de 1000 até não haver mais linhas.
   - Confirmar que TUN x JPN aparece 21/21 e ECU x CUR 21/21 no preview.

2. Evitar regressão em outras telas com muitas apostas
   - Revisar telas/consultas que carregam `predictions` para não dependerem do limite padrão de 1000 linhas.
   - Ajustar apenas onde houver risco real de corte.

3. Limpar gatilhos duplicados no banco
   - Remover o trigger duplicado de auditoria em `predictions`, deixando só um log por mudança.
   - Remover triggers duplicados de recálculo/snapshot em `matches`, deixando uma execução por alteração.
   - Não alterar regras de pontuação nem palpites existentes.

4. Recalcular/ressincronizar dados finais
   - Rodar uma migração segura que recalcula pontos de jogos finalizados com a regra atual.
   - Reconstruir snapshots/ranking se necessário.

5. Validar e publicar a correção
   - Conferir no preview que a tela Galera mostra todos os palpites computados.
   - Depois, publicar a versão corrigida para o domínio `bolaopudim.lovable.app`, porque o erro observado está na versão publicada.