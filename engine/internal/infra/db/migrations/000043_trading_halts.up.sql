-- Tarefa N.9 (backlog-motor-mercado-realista.md): "disjuntor" operacional do painel
-- admin. Uma pausa vigente (lifted_at IS NULL) barra ordem nova de usuário e de bot
-- (global ou de um ativo) sem parar o tick. Ordens já em repouso permanecem. A linha
-- nunca é apagada: retomar só preenche lifted_at, e o histórico fica pra auditoria.
CREATE TABLE trading_halts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global', 'asset')),
  asset_id uuid REFERENCES assets(id),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  -- Id do admin no banco de usuários (outro banco, sem FK), informado pelo backend.
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  lifted_at timestamptz,
  lifted_by uuid,
  CHECK ((scope = 'global' AND asset_id IS NULL) OR (scope = 'asset' AND asset_id IS NOT NULL)),
  CHECK ((lifted_at IS NULL) = (lifted_by IS NULL))
);

-- No máximo uma pausa vigente por escopo: global e uma por ativo.
CREATE UNIQUE INDEX trading_halts_one_active_global ON trading_halts ((true)) WHERE scope = 'global' AND lifted_at IS NULL;
CREATE UNIQUE INDEX trading_halts_one_active_per_asset ON trading_halts (asset_id) WHERE scope = 'asset' AND lifted_at IS NULL;
