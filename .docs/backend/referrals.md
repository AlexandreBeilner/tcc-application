# Módulo `referrals` (indicação entre amigos)

Backlog: `.claude/backlog-monetizacao.md` (MO.7.2). Decisões: ponto 046 (item 6) e ponto 052 em `.claude/pontos-em-aberto-decisao-produto.md`.

**Regras fechadas:** qualquer pessoa indica por um link `/cadastro?ref=<código>`. A indicação só **vale** depois que a pessoa indicada **conclui a primeira lição** (freio contra conta descartável, ponto 052; sem limite por IP). A recompensa é só de quem indica, sem teto de indicações: os marcos 5, 20 e 50 liberam cada um uma conquista e um título (`title_mensageiro`, `title_embaixador`, `title_patrono`, ver `cosmetics.md`). Quem entra pelo link não ganha nada.

**Tabelas (migração `0049`):** `referral_codes` (um código por pessoa, 8 caracteres sem ambiguidade), `referrals` (`referred_id` único: uma conta indicada conta uma vez; `CHECK referrer <> referred` barra a auto-indicação; `status` `pending` ou `qualified`). As tabelas da escada de semanas de PRO (`referral_milestones`, `referral_rewards`) saíram na migração `0062`, com o plano pago.

**Atribuição:** `POST /auth/register` e o login com Google que **cria** conta aceitam o código (ver `auth.md`); código ruim é ignorado em silêncio.

**Validação e recompensa:** `AdvanceLessonUseCase` avisa o módulo (porta `LessonCompletionListener`, best-effort) quando uma lição é concluída pela primeira vez; `QualifyReferralUseCase` marca a indicação como válida (condicional, só a primeira vez) e reavalia as conquistas do indicador (critério `referrals_qualified`). O título de cada marco libera pela contagem de válidas (`unlock_referrals`), lida a cada escolha.

### `GET /me/referral`

- **Autenticação:** Bearer token (qualquer usuário)
- **Sucesso:** `200` `{ code, qualifiedCount, pendingCount }`. O código é criado na primeira leitura. `pendingCount` são contas que entraram pelo link e ainda não concluíram a primeira lição.
- **Erros:** `401` token ausente ou inválido
