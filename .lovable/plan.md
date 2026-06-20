## Objetivo

Newsletter diária para todos os usuários cadastrados:
- **Hoje** (envio inaugural, manual pelo admin): resumo dos jogos de **ontem (19/06)**.
- **A partir de amanhã**: todo dia às **07:00 BRT** automaticamente, com resumo do dia anterior.

Conteúdo de cada e-mail:
- Jogos finalizados no dia (placar).
- Top 3 do dia (quem pontuou mais naqueles jogos).
- Top 3 do ranking geral acumulado.
- Link para o app.

## Integração Brevo

- Chamada direta à API transacional Brevo (`POST https://api.brevo.com/v3/smtp/email`) a partir de edge function.
- Sem MCP, sem connector gateway, sem SDK.
- Remetente: `TI do Bolão Pudim <eroithmann@icloud.com>`.
- Key lida via `Deno.env.get("BREVO_API_KEY")` — nunca no frontend, no código-fonte, no repo ou em logs.
- Logs registram apenas status HTTP, contagens (`sent`/`failed`) e amostra de erros sem expor a key.

## Secrets

- **`BREVO_API_KEY`** — você cola na interface segura quando eu abrir o prompt.
- **`NEWSLETTER_CRON_SECRET`** — senha aleatória que eu gero e guardo como secret. Serve só para o cron das 7h provar que é ele mesmo chamando a função (header `X-Cron-Secret`). Você só clica "confirmar" no prompt.

## Arquitetura

### 1. Edge function `send-daily-newsletter`
`supabase/functions/send-daily-newsletter/index.ts`

Aceita `POST` com body opcional:
- `date?: "YYYY-MM-DD"` — sem isso, usa "ontem" em BRT.
- `testEmail?: string` — se presente, envia só para esse endereço.
- `dryRun?: boolean` — retorna o HTML montado sem enviar nada.

Lógica:
- Usa service role para ler `matches`, `predictions`, `profiles` e (para destinatários reais) `auth.users` via admin API.
- Monta HTML inline (sem React Email — fica leve, no padrão das outras functions do projeto).
- Envia 1 request por destinatário ao Brevo (preserva privacidade — ninguém vê os e-mails alheios). Retry leve em 429/5xx.
- Autorização:
  - Header `X-Cron-Secret` igual ao secret → libera (cron).
  - Senão valida JWT e checa role admin via `has_role`.
- CORS habilitado.

### 2. Cron 07:00 BRT (= 10:00 UTC)
SQL aplicado via `supabase--insert` (não vai em migration — evita vazar secret em remix):
```sql
select cron.schedule(
  'newsletter-daily-7am-brt',
  '0 10 * * *',
  $$ select net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/send-daily-newsletter',
    headers := jsonb_build_object('Content-Type','application/json','X-Cron-Secret','<secret>'),
    body := '{}'::jsonb
  ); $$
);
```

### 3. Card "Newsletter" em `/admin`
- Input de data (default = ontem).
- Input de e-mail de teste (default = e-mail do admin logado).
- Botões:
  - **Enviar teste para mim** (só pro e-mail informado).
  - **Pré-visualizar** (dry run — abre o HTML retornado em nova aba).
  - **Enviar para todos** (com confirmação dupla).

## Arquivos a criar/modificar

- **criar** `supabase/functions/send-daily-newsletter/index.ts`
- **modificar** `src/pages/Admin.tsx` (adiciona o card "Newsletter")
- **SQL via supabase--insert** (cron — não vira migration)

## Não muda

Schema, lógica de pontuação, ranking, palpites, `supabase/config.toml`, frontend fora do Admin.

## Depois de implementar eu entrego

1. Como inserir o `BREVO_API_KEY` (eu abro o prompt seguro — você cola lá).
2. Como rodar o teste: `/admin` → card Newsletter → "Enviar teste para mim".
3. Lista de arquivos criados/modificados.

## Pergunta

Quer que eu dispare o envio inaugural de hoje (referente a ontem 19/06) automaticamente assim que terminar, ou prefere disparar você mesmo pelo botão após validar com o teste?
