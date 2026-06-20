## Objetivo

Enviar uma newsletter diária a todos os usuários cadastrados:
- **Hoje** (envio inaugural, disparado manual pelo admin): resumo dos jogos de **ontem** (19/06).
- **A partir de amanhã**: todo dia às **07:00 BRT** automaticamente, com resumo do **dia anterior**.

Conteúdo do e-mail (por dia coberto):
- Jogos finalizados no dia (placar final).
- Top 3 do dia (quem mais pontuou naqueles jogos) com pontos ganhos.
- Top 3 do ranking geral acumulado até ali.
- Link para o app.

## Integração Brevo

- API key armazenada como secret `BREVO_API_KEY` (solicitada via interface segura — eu abro o prompt depois que o plano for aprovado).
- Remetente: `TI do Bolão Pudim <eroithmann@icloud.com>`.
- Chamada direta à API transacional do Brevo (`https://api.brevo.com/v3/smtp/email`) a partir de edge function — sem MCP, sem connector gateway, sem SDK.
- Key nunca aparece no frontend, no repo, nem em logs (logamos só status HTTP e contagem de envios).

## Arquitetura (edge functions Lovable Cloud)

1. **`send-daily-newsletter`** (`supabase/functions/send-daily-newsletter/index.ts`)
   - Aceita `POST { date?: "YYYY-MM-DD", testEmail?: string, dryRun?: boolean }`.
   - Sem `date` → usa "ontem" em BRT.
   - Monta o conteúdo consultando `matches`, `predictions`, `profiles` via service role.
   - Renderiza HTML inline (sem React Email — mantém leve, no padrão das outras funções do projeto).
   - Destinatários:
     - `testEmail` definido → envia só para esse e-mail (modo teste seguro).
     - Senão → busca lista de e-mails de `auth.users` (via admin API com service role) cruzando com `profiles` para pegar nome.
   - Envia 1 requisição por destinatário ao Brevo (com `to` individual para preservar privacidade). Retry leve em 429/5xx. Loga `{ sent, failed, sampleErrors }` sem expor a key.
   - `dryRun: true` retorna o HTML sem enviar (para inspeção do admin).
   - CORS habilitado, `verify_jwt = false` por padrão; valida internamente que o caller é admin **exceto** quando chamado pelo cron (header secreto `X-Cron-Secret` comparado a um segundo secret).

2. **Cron diário 07:00 BRT (= 10:00 UTC)** via `pg_cron` + `pg_net`, criado por SQL no banco (não em migration — usa `supabase--insert` para não vazar segredos em remix):
   ```sql
   select cron.schedule(
     'newsletter-daily-7am-brt',
     '0 10 * * *',
     $$ select net.http_post(
       url := 'https://<project>.supabase.co/functions/v1/send-daily-newsletter',
       headers := '{"Content-Type":"application/json","X-Cron-Secret":"<secret>"}'::jsonb,
       body := '{}'::jsonb
     ); $$
   );
   ```

3. **Botão admin no `/admin`**: card "Newsletter" com:
   - Input de data (default = ontem).
   - Input de e-mail de teste (default = e-mail do admin logado).
   - Botões: **Enviar teste para mim**, **Pré-visualizar (dry run)**, **Enviar para todos**.
   - Confirmação dupla no "Enviar para todos".

## Secrets necessários

- `BREVO_API_KEY` — solicitado via `add_secret` (interface segura). Valor que você colou no chat **não deve** ser repetido em texto; entre com ele no prompt seguro.
- `NEWSLETTER_CRON_SECRET` — gerado e solicitado via `add_secret` para autenticar o cron.

## Hospedagem / compatibilidade

Projeto roda em Lovable Cloud (Supabase). Edge functions Deno são o caminho nativo — nenhuma mudança de arquitetura. Frontend continua puro React/Vite.

## Arquivos a criar/modificar

- **criar** `supabase/functions/send-daily-newsletter/index.ts`
- **modificar** `src/pages/Admin.tsx` (novo card "Newsletter" com os 3 botões)
- **SQL via supabase--insert** (cron job — não vai pra migration)

## O que NÃO vai mudar

- Lógica de pontuação, ranking, palpites.
- Schema do banco.
- `supabase/config.toml` (function default já serve).
- Nenhum código no frontend além do card admin.

## Instruções finais (entrego no chat após implementar)

1. Onde inserir o secret `BREVO_API_KEY` (vou abrir o prompt seguro automaticamente — você cola o valor lá; nunca aqui no chat).
2. Como rodar o teste: ir em `/admin` → card Newsletter → "Enviar teste para mim".
3. Lista de arquivos criados/modificados.

## Pergunta antes de implementar

Quer que o envio inaugural de **hoje** referente a **ontem (19/06)** dispare automaticamente assim que eu terminar, ou prefere disparar você mesmo pelo botão do admin após validar com o teste?
