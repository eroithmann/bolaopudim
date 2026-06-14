
# Pacote de Gamificação — Bolão Pudim

Implementação **incremental**, sem alterar regras de pontuação, autenticação, bloqueio de palpites ou lógica admin. Tudo deriva dos dados já existentes (`matches`, `predictions`, `profiles`, `ranking_snapshots`, `odds_cache`, `teams`).

## Princípios
- Cálculos no cliente sempre que possível (1 fetch agregado por página), com hook `useGamificationData` que carrega: todos os jogos + odds + meus palpites + (quando necessário) palpites públicos de jogos já bloqueados.
- "Maioria" = % de palpites públicos de cada jogo (apenas jogos já iniciados, respeitando o bloqueio atual).
- "Favorito/Zebra" = derivado de `odds_cache` (menor odd = favorito). Se faltar odd, jogo é ignorado nessa métrica.
- "Rodada" = agrupamento por data (Brasília) usando `getBrazilDayKey` já existente.
- Sem dados suficientes → empty state amigável, nunca dado inventado.

## Entregas (ordem de implementação)

### Fase 1 — Fundação
1. `src/lib/gamification.ts`: funções puras
   - `computePersonalStats(predictions, matches)`
   - `computeBettorProfile(predictions, matches, odds, publicBets)` → retorna lista de tags com score
   - `computeBadges(stats, profile)` → conquistadas + bloqueadas com requisito
   - `computeRoundPodium(matches, predictions, snapshots)`
   - `computeAlternativeRankings(allPredictions, matches, odds)`
   - `computeHeadToHead(userA, userB, predictions, matches)`
   - `computeCrowdMeter(matchId, publicBets, odds)`
2. `src/hooks/useGamificationData.ts` — fetch único + cache via React Query.

### Fase 2 — Perfil turbinado (`src/pages/Profile.tsx`)
- Card **"Seu estilo de apostador"** (até 3 tags, com descrição e ícone).
- Grid de **Estatísticas pessoais** (13 cards do enunciado).
- Seção **Conquistas**: grid de badges; bloqueadas com `opacity-40` + texto de requisito.
- Botão **"Compartilhar perfil"** → abre modal com card visual (ver Fase 6).

### Fase 3 — Estatísticas da Galera (nova rota `/stats`)
- Adicionada no `BottomNav` (ícone de troféu).
- Tabs/segmented control com os 10 rankings alternativos.
- Mobile: cards/listas; Desktop: tabela compacta.
- Inclui o **Pódio da rodada** no topo (melhor, lanterna, maior subida/queda, melhor/pior palpite, zebra da rodada) — usando última rodada finalizada.

### Fase 4 — Head-to-head
- Sub-rota `/stats/h2h` (ou tab dentro de `/stats`).
- 2 dropdowns de usuários (default: eu vs líder).
- Cards comparativos lado a lado + indicador "venceu a última rodada".

### Fase 5 — Termômetro da galera
- Componente `<CrowdMeter matchId />` em `MatchCard` (somente após bloqueio do palpite) e em `PublicBets`.
- Barra tri-color (verde/cinza/dourado) com %; frase contextual baseada no meu palpite vs maioria.

### Fase 6 — Cards compartilháveis
- `src/components/ShareCard.tsx` — gera um card 1080×1080 com `html-to-image` (já leve, adicionar dep).
- Templates: posição, placar exato, zebra solitária, subida de posições, badge desbloqueada.
- Botões: "Copiar texto" + "Compartilhar" (Web Share API com fallback para download da imagem).

## Detalhes técnicos

### Perfil de apostador — heurísticas
- **Zebreiro**: % de palpites no time com maior odd ≥ 40% (mín. 5 palpites com odd).
- **Favoritizeiro**: % no time com menor odd ≥ 60%.
- **Empatador**: % de empates apostados ≥ 30%.
- **Do contra**: ≥ 5 palpites onde meu resultado (1/X/2) é minoria (<25%).
- **Vidente**: ≥ 3 placares exatos.
- **Pé quente / Pé frio**: maior sequência atual de acertos (≥3) ou erros (≥3) em jogos finalizados.
- **Conservador**: média de gols dos meus palpites ≤ 2.
- **Showman**: ≥ 30% dos palpites com soma de gols ≥ 4.

### Métricas que dependem de dado novo
- "Quantos pontos perdeu por não apostar" → calculável: para cada jogo finalizado sem meu palpite, simular "palpite médio" não dá pontos reais; vamos usar **"jogos esquecidos"** + soma de pontos da mediana da galera (rotular como "pontos médios perdidos"). Texto deixa claro que é estimativa.
- "Maior subida no ranking" → derivada de `ranking_snapshots` (diff entre snapshots consecutivos).

### Sem mudanças no banco
Não há migrations nesta fase. Badges são derivadas em runtime (sem persistência). Se no futuro quiser histórico de conquistas, criamos tabela `user_badges`.

### Arquivos novos
```
src/lib/gamification.ts
src/hooks/useGamificationData.ts
src/components/gamification/BettorProfileCard.tsx
src/components/gamification/StatsGrid.tsx
src/components/gamification/BadgeGrid.tsx
src/components/gamification/CrowdMeter.tsx
src/components/gamification/RoundPodium.tsx
src/components/gamification/HeadToHead.tsx
src/components/gamification/ShareCard.tsx
src/pages/Stats.tsx
```

### Arquivos editados
- `src/pages/Profile.tsx` (adiciona seções)
- `src/components/MatchCard.tsx` (CrowdMeter pós-bloqueio)
- `src/components/BottomNav.tsx` (novo item Estatísticas)
- `src/App.tsx` (rota `/stats`)
- `src/pages/PublicBets.tsx` (CrowdMeter inline)

## Fora de escopo nesta fase
- Notificações push de conquistas.
- Persistência de badges desbloqueadas (data de conquista).
- Liga entre amigos / grupos privados.

Posso começar pela Fase 1+2 (fundação + perfil) e seguir nas próximas mensagens, ou implementar tudo de uma vez. Me diz como prefere.
