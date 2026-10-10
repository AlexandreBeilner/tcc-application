-- Tarefa O.3 (backlog-motor-mercado-realista.md, item 2): sem esta coluna,
-- as 4 causas hoje possíveis de `status = cancelled` (cancelamento manual do
-- usuário, expiração no fechamento do dia, ordem a mercado sem liquidez,
-- recotação de bot Market Maker) são indistinguíveis pra quem lê
-- `order_book` depois — a tela "Minhas Ordens" (O.4) precisa mostrar o
-- motivo humanizado na aba Recusadas. NULLABLE, sem DEFAULT: só
-- `status = cancelled` preenche; qualquer outro status (pending,
-- partially_filled, filled) nunca teve motivo de cancelamento nenhum.
CREATE TYPE order_cancel_reason AS ENUM ('user_cancelled', 'expired', 'no_liquidity', 'requoted');

ALTER TABLE order_book ADD COLUMN cancel_reason order_cancel_reason;
