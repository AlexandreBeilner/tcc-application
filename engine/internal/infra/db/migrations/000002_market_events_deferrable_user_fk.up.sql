-- A criação de conta (RNF06, tarefa 1.5) grava o evento imutável
-- ('initial_deposit') antes de projetar a linha em accounts, na mesma
-- transação — mas market_events.user_id referencia accounts(user_id), que
-- só passa a existir depois. DEFERRABLE INITIALLY DEFERRED adia a checagem
-- da FK pro commit da transação, sem abrir mão da integridade referencial.
ALTER TABLE market_events
  DROP CONSTRAINT market_events_user_id_fkey,
  ADD CONSTRAINT market_events_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES accounts(user_id)
    DEFERRABLE INITIALLY DEFERRED;
