## Post-mortem

### 1) Apostas não contabilizadas no NED x SWE

**Causa raiz**: o PostgREST (API do Supabase) limita cada request a 1000 linhas por padrão. A tabela `predictions` tem 1012 linhas. Ao carregar o ranking, a página `/ranking` e a `/` fazem `select` em todas as predictions de uma vez — as 12 últimas (justamente as do jogo mais novo, NED x SWE) eram cortadas silenciosamente. O ranking somava só o que chegava. Em `PublicBets` o efeito era o "13/21 apostaram" e várias células "—".

Evidências:
- `select count(*) from predictions` → 1012
- `select count(*) from predictions where points is not null` → 1012
- O jogo tinha 19 apostas no banco, mas só 13 chegavam no front
- A correção via paginação (Ranking/Home/Evolution/PublicBets) restaurou os pontos

**Status**: já corrigido com paginação manual em todos os consumers. Sobra um risco residual: qualquer `select` futuro que não pagine vai re-introduzir o bug quando a tabela crescer.

### 2) Xumi alterou de 5x0 → 4x0 e não pegou

**Causa raiz (com base no audit)**:
- `prediction_audit` mostra **apenas** o INSERT original (16/06, 5x0) e o UPDATE que eu fiz manualmente (20/06 19:18 UTC). **Nenhum** UPDATE feito pelo próprio Xumi entre essas datas.
- O jogo GER x CIV começa às **20:00 UTC (17h BRT)**. O lock do app é 1h antes → **19:00 UTC (16h BRT)**.
- Hoje, na rotina de atualização da página, o Xumi provavelmente trocou o valor no input bem em cima do horário de bloqueio. O lock é **só no frontend** (`now >= deadline`): quando o `now` passa do limite enquanto a tela está aberta, o botão "Salvar" some — mas o input já tem o número novo. Resultado: ele vê 4x0 na tela, acha que salvou, e o banco nunca recebeu.
- Não há nenhuma proteção no backend: a policy de UPDATE é só `auth.uid() = user_id`, sem checar o horário. Se um cliente burlar o frontend, ainda passa.

### Correções para garantir que não aconteça de novo

#### A) Backend trava o lock (defesa real)

Criar um trigger BEFORE INSERT/UPDATE em `public.predictions` que rejeita se `match_date - now() < 1h` (e o usuário não for admin). Isso:
- impede salvar em cima do limite, retornando erro claro
- elimina qualquer dúvida do tipo "achei que tinha salvado"
- protege contra clientes que pulam a checagem do front

```sql
create or replace function public.enforce_prediction_deadline()
returns trigger language plpgsql security definer set search_path = public as $$
declare md timestamptz;
begin
  select match_date into md from public.matches where id = new.match_id;
  if md is null then raise exception 'match not found'; end if;
  if md - now() < interval '1 hour'
     and not public.has_role(auth.uid(),'admin') then
    raise exception 'Palpites bloqueados (faltam menos de 1h para o jogo)';
  end if;
  return new;
end $$;

create trigger trg_enforce_prediction_deadline
before insert or update of home_score, away_score on public.predictions
for each row execute function public.enforce_prediction_deadline();
```

#### B) Frontend para de mentir sobre o salvamento

Em `MatchCard.tsx` / `Games.tsx`:
1. Quando o lock vira `true` com o input "sujo" (valor diferente do persistido), mostrar toast vermelho "Tempo esgotado — seu novo palpite NÃO foi salvo" e reverter o input para o valor persistido.
2. Mostrar contagem regressiva em vermelho nos últimos 5 min.
3. Tratar o erro do trigger backend (mensagem em português) com toast claro.
4. Após `savePrediction`, esperar a confirmação e exibir o valor confirmado, não o que está em `editScores`.

#### C) Garantia contra o "limite de 1000 linhas" voltar

1. Manter o helper `fetchAllRows` como caminho padrão para qualquer leitura volumosa.
2. Adicionar um lint guard simples (comentário + console.warn em dev) dentro do helper quando uma página atingir 1000 linhas, para detectar futuros candidatos cedo.
3. Mover o cálculo do **ranking** para o servidor: criar uma RPC `get_full_ranking()` que retorna `user_id, name, total_points, exact, diff, side, result_only` agregados em SQL. O front recebe ~21 linhas em vez de 1000+. Mais rápido e imune a paginação.
4. Aplicar a mesma lógica ao "top do dia" e ao mini-ranking da home.

#### D) Conferência única agora

- Re-rodar `rebuild_ranking_snapshots('2026-06-13')` para garantir que todos os snapshots refletem o estado atualizado (já que o Xumi ficou com 5x0 por horas antes de eu corrigir para 4x0; mas como GER x CIV ainda não terminou, o snapshot dele não muda — só importa quando o resultado entrar).
- Conferir que não há outra predição "fantasma" (input mudado mas não persistido) comparando `prediction_audit` vs estado atual: listar usuários com `updated_at > created_at` no audit que não bate com a predição final. Reportar achados ao admin.

### Resumo do que será alterado

**Banco** (migration):
- Função `enforce_prediction_deadline()` + trigger em `predictions`
- RPC `get_full_ranking()` agregando em SQL

**Código**:
- `src/components/MatchCard.tsx`: detecção de lock com input sujo + toast de aviso
- `src/pages/Games.tsx`: trata erro do trigger, revalida valor após salvar
- `src/pages/Ranking.tsx` e `src/pages/Index.tsx`: trocar `fetchAllRows` em `predictions` por chamada à nova RPC `get_full_ranking()`
- `src/lib/fetchAll.ts`: `console.warn` quando o resultado bate em N*1000

**Dados** (insert tool):
- `select public.rebuild_ranking_snapshots('2026-06-13'::timestamptz)` para reconciliar.

Não mexe em layout, design tokens, scoring, nem na lógica de pontos.