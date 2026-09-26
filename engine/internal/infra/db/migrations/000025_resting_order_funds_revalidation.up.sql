-- Achado 015 (pontos-em-aberto-decisao-produto.md): ordem limitada em repouso não
-- reserva saldo nem posição, então preenchia depois de o dono já ter gasto o caixa
-- (saldo negativo) e uma ordem "fantasma" travava um lado do book. O motor agora
-- revalida o dono da ordem em repouso no momento do match e cancela a ordem sem
-- fundos com este motivo; os CHECKs abaixo são a rede de proteção para a janela de
-- concorrência que a leitura sem lock do contexto ainda deixa.
ALTER TYPE order_cancel_reason ADD VALUE IF NOT EXISTS 'insufficient_funds';

ALTER TABLE accounts ADD CONSTRAINT accounts_balance_non_negative_chk CHECK (current_balance >= 0);
ALTER TABLE positions ADD CONSTRAINT positions_quantity_non_negative_chk CHECK (quantity >= 0);
