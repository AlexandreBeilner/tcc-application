-- Índice pra leitura "ordens de um bot por dia simulado" do painel admin (N.14): sem ele
-- o desempenho de cada bot varreria o book inteiro, que acumula ordens expiradas.
CREATE INDEX order_book_user_day_idx ON order_book (user_id, simulated_day);
