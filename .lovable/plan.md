# Bolão Pudim Newsletter — e-mail diário 6h30

Resumo diário automático com os destaques do dia anterior, enviado para todos os usuários cadastrados. Primeiro envio (resumo de 15/06) sai imediatamente após você aprovar; depois roda automaticamente todo dia às 6h30 (horário de Brasília).

## Pré-requisitos (uma vez só)

1. **Configurar domínio de e-mail** no Lovable Cloud — você precisa ter um domínio (ex.: `bolaopudim.com.br` ou similar) e adicionar registros DNS via subdomínio delegado (ex.: `notify.bolaopudim.com.br`). Sem isso, e-mails não saem.
2. Provisionar a infraestrutura de e-mail (filas, tabelas de log, supressão, cron de processamento) — feito automaticamente após o domínio estar configurado.

Se você ainda não tem domínio, abrimos o assistente de setup antes de qualquer código.

## Conteúdo do e-mail

Assunto: **Bolão Pudim Newsletter — [data por extenso]**

Blocos do corpo:

1. **Saudação personalizada** ("E aí, {nome}!") + frase curta sobre o dia anterior
2. **Resultados dos jogos de ontem** — placar, fase, e quantos pontos cada jogo distribuiu no bolão
3. **Sua performance** — pontos feitos ontem, acertos exatos / parciais / zeros, palpites perdidos (sem palpitar)
4. **Movimentação no ranking** — posição atual, delta (subiu/desceu/manteve) vs. dia anterior, total de pontos
5. **Destaques da galera** — top 3 do dia (quem mais pontuou ontem), maior zebra acertada do dia (palpite minoritário que deu certo), eventual "ninguém acertou ninguém" se for o caso
6. **Próximos jogos** — partidas das próximas 24h com horário e CTA "Fazer meus palpites"
7. Rodapé com link de unsubscribe (gerado automaticamente pela infraestrutura)

**Dias sem jogos da Copa**: versão enxuta — pula blocos 2/3/5, mantém saudação, sua posição atual no ranking e prévia dos próximos jogos ("amanhã tem X vs Y, não esquece de palpitar").

## Como vai funcionar (técnico)

- **Edge Function `send-daily-newsletter`**: consulta jogos finalizados do dia anterior (00:00–23:59 BRT), monta os dados por usuário (performance, ranking via `ranking_snapshots`, destaques globais) e enfileira um e-mail por usuário com `templateData` específico.
- **Template React Email** `daily-newsletter.tsx` em `_shared/transactional-email-templates/`, com a paleta do projeto (verde #145 + dourado, headings Bebas Neue cai como Arial no e-mail, Inter no corpo). Fundo `#ffffff` (regra do React Email).
- **pg_cron** dispara a function todo dia às **09:30 UTC** (= 06:30 BRT). Job nomeado `daily-newsletter-630-brt`.
- **Idempotência**: chave `newsletter-{user_id}-{YYYY-MM-DD}` impede duplicidade se o cron rodar duas vezes.
- **Envio imediato do resumo de 15/06**: rodamos a function uma vez com parâmetro `?date=2026-06-15` logo após você aprovar e o domínio estar verificado.
- **Lista de destinatários**: query em `profiles` (todos os usuários). Quem estiver em `suppressed_emails` (bounce/unsubscribe) é pulado automaticamente pelo `send-transactional-email`.
- **Volume estimado**: ~N usuários × 1 e-mail/dia, dentro do throughput padrão da fila (120/min).

## Limitações / pontos de atenção

- Precisa do domínio configurado antes de qualquer teste real. DNS pode levar até 72h pra propagar.
- Não tem opt-out por enquanto (você escolheu "todos os usuários"). O link de unsubscribe no rodapé é obrigatório pela infra e cuida disso individualmente quando alguém clicar.
- "Destaques da galera" usa dados agregados do dia, sem expor palpites individuais de outros usuários além dos top-pontuadores (que já aparecem no ranking público).

## Próximo passo

Se aprovar o plano, eu começo abrindo o assistente de configuração de domínio de e-mail. Me confirma qual domínio você quer usar (ou se quer comprar um) antes da implementação.
