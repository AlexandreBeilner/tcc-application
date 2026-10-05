-- Tarefa N.10 (backlog-motor-mercado-realista.md): o painel admin cancela ordens
-- por intervenção (uma ordem ou um lote por ativo/dono). O motivo próprio
-- distingue o cancelamento do administrador do pedido do dono ('user_cancelled'),
-- da expiração Day ('expired') e da recotação do Market Maker ('requoted').
ALTER TYPE order_cancel_reason ADD VALUE IF NOT EXISTS 'admin';
