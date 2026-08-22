-- Log append-only de verdade (RNF01, spec 3.4, tarefa 2.1): nenhuma
-- UPDATE/DELETE é permitida em market_events. Reforço mecânico, não só
-- disciplina de código na aplicação — mesmo espírito do depguard em
-- .golangci.yml, mas garantido pelo próprio banco.
CREATE FUNCTION prevent_market_events_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'market_events é append-only: % não é permitido (id=%)', TG_OP, OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER market_events_append_only
  BEFORE UPDATE OR DELETE ON market_events
  FOR EACH ROW EXECUTE FUNCTION prevent_market_events_mutation();
