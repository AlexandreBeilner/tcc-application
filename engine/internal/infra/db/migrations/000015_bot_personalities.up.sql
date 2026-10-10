-- Tarefa C.6 do backlog-motor-mercado-realista: persistência de
-- bot.Personality (tarefa C.1) — as 4 dimensões (arquétipo, escopo de
-- especialização, nível de conhecimento, perfil de risco/agressividade)
-- de cada conta is_bot (migration 000010). Sem isso, a Fase D (rodada de
-- negociação) não teria de onde ler "qual é a personalidade deste bot" —
-- e o painel admin da Fase N (GET/POST /admin/bots) não teria o que
-- listar/criar.
CREATE TYPE bot_archetype AS ENUM ('ruido', 'market_maker', 'chartista', 'fundamentalista');

CREATE TABLE bot_personalities (
  account_id uuid PRIMARY KEY REFERENCES accounts(user_id),
  archetype bot_archetype NOT NULL,
  -- Percentual da atividade do bot dentro do próprio escopo de
  -- especialização (bot_personality_scopes) — 85-90% confirmado na
  -- proposta 2.3.2, mesma faixa de bot.SpecializationWithinScopeMin/Max.
  within_scope_pct numeric(5, 4) NOT NULL,
  -- Só preenchido pro arquétipo fundamentalista (bot.Personality.
  -- KnowledgeLevel é *float64 por esse motivo) — CHECK abaixo espelha
  -- exatamente a regra que bot.NewPersonality já valida em código.
  knowledge_level numeric(5, 4),
  max_position_size_pct numeric(5, 4) NOT NULL,
  market_order_preference numeric(5, 4) NOT NULL,
  spread_width_pct numeric(6, 4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bot_personalities_knowledge_level_chk CHECK (
    (archetype = 'fundamentalista' AND knowledge_level IS NOT NULL) OR
    (archetype != 'fundamentalista' AND knowledge_level IS NULL)
  )
);

-- Um bot pode ter vários setores/risk_classes/classes de ativo no escopo
-- (união, não exclusividade mútua — diferente de macro_event_targets, que
-- é o mesmo formato de linha mas describe um único alvo XOR por vez) —
-- por isso uma linha por item de escopo, não um único registro com 3
-- colunas nullable numa linha só.
CREATE TABLE bot_personality_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES bot_personalities(account_id) ON DELETE CASCADE,
  sector company_sector,
  risk_class varchar(20),
  asset_class asset_type,
  CONSTRAINT bot_personality_scope_dimension_chk CHECK (num_nonnulls(sector, risk_class, asset_class) = 1)
);

CREATE INDEX bot_personality_scopes_account_id_idx ON bot_personality_scopes (account_id);
