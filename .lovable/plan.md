
# Bolão Copa do Mundo 2026 — Plano Atualizado

## Mudança Principal
Resultados dos jogos serão puxados automaticamente via API de futebol, com fallback manual pelo admin.

## Arquitetura

### Backend (Supabase + Edge Function)
- **Edge Function `fetch-match-results`**: Consulta a API-Football (via RapidAPI) periodicamente ou sob demanda para buscar resultados dos jogos da Copa 2026
- **Fallback manual**: Painel admin mantido para inserir/corrigir resultados caso a API falhe ou demore
- **Cron ou botão**: Admin pode disparar atualização manual, ou configurar execução periódica

### API de Futebol
- Usaremos a **API-Football** (api-football.com) via RapidAPI — tier gratuito com 100 req/dia, suficiente para um bolão
- Endpoint principal: `GET /fixtures?league=1&season=2026` (Copa do Mundo FIFA)
- Retorna placares, status do jogo, times, etc.
- Você precisará criar uma conta gratuita no RapidAPI e fornecer a API key

### Fluxo de Atualização
1. Edge Function consulta API-Football para jogos finalizados
2. Atualiza a tabela `matches` com os placares reais
3. Trigger/função recalcula pontos de todos os apostadores
4. Admin pode forçar atualização ou corrigir manualmente

## Tabelas (Supabase)

- **profiles** — id, user_id, name, avatar_url
- **user_roles** — id, user_id, role (enum: admin, user)
- **matches** — id, phase, group, home_team, away_team, match_date, home_score, away_score, status (scheduled/finished), api_fixture_id, result_source (api/manual)
- **predictions** — id, user_id, match_id, home_score, away_score, points, created_at
- **teams** — id, name, code, flag_url, group

## Pontuação (recalculada ao salvar resultado)
- 5 pts: placar exato
- 3 pts: acertou placar de um time
- 1 pt: acertou resultado (vitória/empate)
- 0 pts: errou

## Páginas
1. **Home** — próximos jogos + ranking resumido
2. **Jogos** — lista por fase, campo de palpite (trava após início)
3. **Ranking** — classificação geral com filtro por fase
4. **Perfil** — palpites e desempenho do usuário
5. **Admin** — atualizar resultados (botão "Buscar da API" + edição manual), gerenciar jogos

## Passos de Implementação

1. Configurar Supabase (Lovable Cloud) com tabelas, RLS e triggers
2. Criar autenticação (email/senha) + perfil + roles
3. Seed dos times e jogos da fase de grupos
4. Criar páginas de jogos e sistema de palpites
5. Criar ranking com cálculo de pontos
6. Criar Edge Function para buscar resultados da API-Football
7. Criar painel admin com botão de sync + edição manual
8. Design responsivo com tema verde/dourado

## Requisito do Usuário
- Você precisará criar uma conta gratuita em [RapidAPI](https://rapidapi.com) e assinar o plano gratuito da API-Football
- Depois, fornecer a API key para armazenarmos como secret no projeto
