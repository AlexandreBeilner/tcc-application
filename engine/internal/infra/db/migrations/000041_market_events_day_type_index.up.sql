-- Índice pra leitura "negócios do dia simulado" do painel admin (N.5/N.8): sem ele cada
-- chamada varreria o log inteiro de market_events, que só cresce. Criar índice não
-- viola o trigger append-only (ele só barra UPDATE/DELETE de linha).
CREATE INDEX market_events_day_type_idx ON market_events (simulated_day, event_type);
