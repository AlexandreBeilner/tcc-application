-- Tarefa N.7 (backlog-motor-mercado-realista.md): parâmetros operacionais do motor que o
-- painel admin pode alterar em runtime. Uma linha por chave alterada; sem linha vale o
-- padrão do ambiente. A lista de chaves é fechada no domínio (enginesetting), então chave
-- nova não pede migration. updated_by é o id do admin no banco de usuários (outro banco,
-- sem FK).
CREATE TABLE engine_settings (
  key text PRIMARY KEY,
  value integer NOT NULL,
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1
);
