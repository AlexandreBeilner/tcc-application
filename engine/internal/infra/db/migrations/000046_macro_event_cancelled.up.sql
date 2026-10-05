-- Tarefa N.11 (backlog-motor-mercado-realista.md): o painel admin cancela um evento macro
-- pendente que ainda não produziu efeito. 'cancelado' é um estado final, ao lado de
-- 'aplicado'; o evento não é apagado (fica no histórico e na auditoria). Cancelado sai
-- da lista de pendentes lida pelo tick (WHERE status = 'pendente') e do feed do usuário.
ALTER TYPE macro_event_status ADD VALUE IF NOT EXISTS 'cancelado';
