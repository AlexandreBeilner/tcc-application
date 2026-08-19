# DER — Transcrição das Figuras 10 e 11 do TCC

> Transcrição literal das imagens dos diagramas entidade-relacionamento (dbdiagram.io) presentes no TCC, seções 6.5.1 e 6.5.2. Serve de referência direta para a tarefa 1.3 do backlog (Migrations do DER completo) — **este documento cobre só o DER original do TCC**; os campos e tabelas novos da spec (v0.3–v0.5: `username`, `role`, `lessons`, `friendships`, `etf_details` etc.) estão listados à parte na spec seção 4, não nestas imagens. Ao rodar a 1.3, use este documento + a spec seção 4 juntos, não um no lugar do outro.

---

## Figura 10 — Aplicação Gamificada

### `users`
| Coluna | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| name | varchar(100) | |
| email | varchar(100) | |
| password_hash | varchar(255) | |
| created_at | timestamp | |

### `user_identities`
| Coluna | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → `users.id` |
| provider_name | varchar(50) | ex: "google" |
| provider_account_id | varchar(255) | |
| access_token | text | |
| refresh_token | text | |
| token_expires_at | timestamp | |

### `achievements`
| Coluna | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| name | varchar(100) | |
| description | varchar(255) | |
| required_points | int | |

### `user_achievements`
| Coluna | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → `users.id` |
| achievement_id | uuid | FK → `achievements.id` |
| unlocked_at | timestamp | |

**Relacionamentos (Figura 10):**
- `users` 1:N `user_identities` — um usuário pode ter múltiplos provedores OAuth.
- `users` N:M `achievements`, resolvido por `user_achievements` — tabela associativa que registra o histórico de desbloqueios.

---

## Figura 11 — Motor de Simulação do Mercado Financeiro

### `accounts`
| Coluna | Tipo | Nota |
|---|---|---|
| user_id | uuid | PK, FK → `users.id` |
| current_balance | numeric(15,2) | |
| total_invested | numeric(15,2) | |
| total_dividends_received | numeric(15,2) | |
| created_at | timestamp | |
| updated_at | timestamp | |

### `positions`
| Coluna | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → `accounts.user_id` |
| asset_id | uuid | FK → `assets.id` |
| quantity | int | |
| average_price | numeric(15,2) | preço médio ponderado |
| created_at | timestamp | |
| updated_at | timestamp | |

### `assets`
| Coluna | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| ticker | varchar(10) | único |
| name | varchar(100) | |
| type | asset_type (enum) | |
| risk_class | varchar(20) | |

### `fixed_income_assets`
| Coluna | Tipo | Nota |
|---|---|---|
| asset_id | uuid | PK, FK → `assets.id` (herança 1:1) |
| interest_rate | numeric(5,2) | |
| maturity_date | timestamp | |

### `variable_income_assets`
| Coluna | Tipo | Nota |
|---|---|---|
| asset_id | uuid | PK, FK → `assets.id` (herança 1:1) |
| company_id | uuid | FK → `companies.id` |
| share_class | varchar(5) | ex: "ON", "PN" |
| outstanding_shares | bigint | |

### `companies`
| Coluna | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| name | varchar(100) | |
| cnpj | varchar(14) | |
| sector | varchar(50) | |

### `company_fundamentals`
| Coluna | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| company_id | uuid | FK → `companies.id` |
| period_date | timestamp | |
| net_income | numeric(15,2) | lucro líquido |
| ebit | numeric(15,2) | |
| net_equity | numeric(15,2) | patrimônio líquido |
| gross_debt | numeric(15,2) | dívida bruta |
| cash_equivalents | numeric(15,2) | caixa e equivalentes |
| created_at | timestamp | |

### `order_book`
| Coluna | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| asset_id | uuid | FK → `assets.id` |
| user_id | uuid | FK → `accounts.user_id` |
| type | order_type (enum) | ex: limitada / a mercado |
| side | order_side (enum) | compra / venda |
| quantity | int | |
| price | numeric(15,2) | |
| status | order_status (enum) | |
| created_at | timestamp | |

### `market_events`
| Coluna | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → `accounts.user_id` |
| asset_id | uuid | FK → `assets.id` |
| event_type | market_event_type (enum) | |
| quantity | int | |
| unit_value | numeric(15,2) | valor unitário praticado |
| timestamp | timestamp | |

**Relacionamentos (Figura 11):**
- `accounts` 1:N `positions` — uma conta mantém múltiplos ativos sob custódia.
- `positions` liga `accounts` e `assets` (tabela de junção com dados dinâmicos de posse).
- `assets` 1:1 `fixed_income_assets` e `assets` 1:1 `variable_income_assets` — especialização por herança a partir da entidade base.
- `variable_income_assets` N:1 `companies` — uma empresa pode emitir múltiplas classes de ações (ON/PN).
- `companies` 1:N `company_fundamentals` — série temporal histórica de balanços.
- `order_book` N:1 `accounts` (emissor da ordem) e N:1 `assets` (alvo da negociação).
- `market_events` N:1 `accounts` e N:1 `assets` — log imutável (Event Sourcing) de transações consolidadas.

---

## Nota

Este DER **não inclui** as extensões já formalizadas na spec (v0.3–v0.5): `username`/`role`/`report_frequency_days` em `users`/`companies`, `net_revenue` em `company_fundamentals`, `lessons`, `user_lesson_progress`, `macro_events`, `macro_event_targets`, `dividend_events`, `friendships`, `etf_details`, `etf_holdings`, `fii_details`, `daily_missions`, `user_mission_progress`. Essas já estão listadas na tabela da spec seção 4 — ao rodar a tarefa 1.3 do backlog, use este documento + a tabela da spec juntos, não um no lugar do outro.

## Divergências assumidas na implementação (tarefa 1.3)

Registradas aqui porque alteram levemente o que está transcrito acima — decisões tomadas ao converter este DER em migrations reais, cada uma com justificativa:

- **`variable_income_assets.company_id` e `share_class` passam a ser nullable.** No DER original são implicitamente obrigatórios, mas ETFs e FIIs são `variable_income_assets` (via `etf_details`/`fii_details`, herança 1:1) e não têm empresa nem classe de ação — só ações (`acao`) preenchem esses campos.
- **`companies.sector` deixa de ser `varchar(50)` livre e vira enum fixo.** Exigência explícita da spec 3.3.2: os templates de evento macro precisam casar com um conjunto fixo de setores (Mineração, Agronegócio, Bancário/Financeiro, Varejo, Energia, Tecnologia).
- **`sandbox_assets`** implementado como flag `assets.is_sandbox boolean`, não tabela separada — a spec seção 4 oferece as duas opções ("nova tabela ou flag"); flag evita duplicar toda a estrutura de `assets` só para marcar isolamento.
- **`users.password_hash` passa a ser nullable.** O DER original não marca isso, mas a spec (RNF07, tela 1.1) prevê login via OAuth Google além de e-mail/senha — uma conta só-OAuth não tem senha local.
- **XP, nível e streak não entram nesta migration.** Nem o DER original nem a spec seção 4 definem colunas/tabelas pra isso — ficam para as tarefas 5.1 (XP/nível) e 5.3 (streak), que vão desenhar esse pedaço do schema quando forem implementadas.
- **Chaves entre os dois bancos (`accounts.user_id → users.id`, `market_events.user_id`, `order_book.user_id`, `macro_events.created_by`) não são FK de verdade.** Postgres não suporta FK entre databases distintos — ficam como `uuid` simples, validados na aplicação, não no schema.
