-- Tarefa S.10 (backlog-motor-mercado-realista.md): o calendário da simulação
-- mostra os fatos do próprio usuário (ordens, proventos recebidos, aportes e
-- resgates de renda fixa) no dia simulado em que aconteceram. market_events só
-- tinha o instante real ("timestamp"), então ganha o dia simulado, gravado no
-- INSERT a partir de market_calendar (eventstore). Backfill aproximado, mesmo
-- critério da 000032: o tempo real decorrido vira dias simulados anteriores ao
-- dia corrente, ordem preservada.
ALTER TABLE market_events ADD COLUMN simulated_day int NOT NULL DEFAULT 0;

UPDATE market_events SET simulated_day = GREATEST(0,
  COALESCE((SELECT current_day FROM market_calendar WHERE id = 1), 0)
  - floor(extract(epoch FROM (now() - "timestamp")) / 86400)::int);

CREATE INDEX market_events_user_day_idx ON market_events (user_id, simulated_day);
