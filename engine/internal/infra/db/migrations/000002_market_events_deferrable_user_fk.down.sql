ALTER TABLE market_events
  DROP CONSTRAINT market_events_user_id_fkey,
  ADD CONSTRAINT market_events_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES accounts(user_id);
