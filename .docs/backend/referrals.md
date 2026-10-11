# Módulo `referrals` (indicação entre amigos)

Backlog: `.claude/backlog-monetizacao.md` (MO.7.2). Decisões: ponto 046 (item 6) e ponto 052 em `.claude/pontos-em-aberto-decisao-produto.md`.

**Regras fechadas:** qualquer pessoa, PRO ou não, indica por um link `/cadastro?ref=<código>`. A indicação só **vale** depois que a pessoa indicada **conclui a primeira lição** (freio contra conta descartável, ponto 052; sem limite por IP). A recompensa é só de quem indica, **sem teto**: 5, 20 e 50 indicações válidas dão **1 semana de PRO** cada, e acima de 50 **+1 semana a cada 50** (100, 150, 200...). Cada marco também libera uma conquista e um título (`title_mensageiro`, `title_embaixador`, `title_patrono`, ver `cosmetics.md`). Quem entra pelo link não ganha nada.

**Tabelas (migração `0049`):** `referral_codes` (um código por pessoa, 8 caracteres sem ambiguidade), `referrals` (`referred_id` único: uma conta indicada conta uma vez; `CHECK referrer <> referred` barra a auto-indicação; `status` `pending` ou `qualified`), `referral_milestones` (escada como dado: 5, 20, 50), `referral_rewards` (um marco por pessoa, chave `(referrer_id, threshold)`: marco concedido uma única vez; `promo_ends_at` é gravado **antes** de chamar o provedor, então repetir a chamada é duplicata para o RevenueCat).

**Atribuição:** `POST /auth/register` e o login com Google que **cria** conta aceitam o código (ver `auth.md`); código ruim é ignorado em silêncio.

**Validação e recompensa:** `AdvanceLessonUseCase` avisa o módulo (porta `LessonCompletionListener`, best-effort) quando uma lição é concluída pela primeira vez; `QualifyReferralUseCase` marca a indicação como válida (condicional, só a primeira vez), cria os marcos alcançados, concede o PRO promocional de cada marco pendente (serializado por indicador com advisory lock) e reavalia as conquistas do indicador. Falha do provedor deixa o marco **pendente** e a próxima indicação válida repete, sem perder nada.

**PRO promocional:** `GrantPromotionalProUseCase` (módulo `billing`) empilha a concessão depois do acesso atual da pessoa. Com `BILLING_PROVIDER=revenuecat` chama `POST /v1/subscribers/{app_user_id}/entitlements/{entitlement}/promotional` com `end_time_ms` (conferido na documentação do RevenueCat em 2026-10-11; fim a menos de 2 h de uma concessão ativa conta como duplicata) e reconsulta; com `dev` grava a projeção; com `disabled` falha e o marco fica pendente.

### `GET /me/referral`

- **Autenticação:** Bearer token (qualquer usuário)
- **Sucesso:** `200` `{ code, qualifiedCount, pendingCount, next: { threshold, rewardDays, remaining }, milestones: [{ threshold, rewardDays, reached, granted }] }`. O código é criado na primeira leitura. `pendingCount` são contas que entraram pelo link e ainda não concluíram a primeira lição. `reached` sem `granted` = marco alcançado com a concessão pendente.
- **Erros:** `401` token ausente ou inválido
