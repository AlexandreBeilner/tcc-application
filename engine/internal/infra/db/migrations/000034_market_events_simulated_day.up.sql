-- Tarefa S.10 (backlog-motor-mercado-realista.md): o calendário da simulação
-- mostra os fatos do próprio usuário (ordens, proventos recebidos, aportes e
-- resgates de renda fixa) no dia simulado em que aconteceram. market_events só
-- tinha o instante real ("timestamp"), então ganha o dia simulado, gravado no
-- INSERT a partir de market_calendar (eventstore). Backfill aproximado, mesmo
-- critério da 000032: o tempo real decorrido vira dias simulados anteriores ao
-- dia corrente, ordem preservada.
ALTER TABLE market_events ADD COLUMN simulated_day int NOT NULL DEFAULT 0;

-- O backfill é UPDATE e o log é append-only por gatilho (000003): o gatilho fica
-- desligado só durante este UPDATE (mesmo statement multi-comando, uma transação),
-- porque a coluna é derivada e nenhum fato já gravado muda de valor.
ALTER TABLE market_events DISABLE TRIGGER market_events_append_only;

UPDATE market_events SET simulated_day = GREATEST(0,
  COALESCE((SELECT current_day FROM market_calendar WHERE id = 1), 0)
  - floor(extract(epoch FROM (now() - "timestamp")) / 86400)::int);

ALTER TABLE market_events ENABLE TRIGGER market_events_append_only;

CREATE INDEX market_events_user_day_idx ON market_events (user_id, simulated_day);
