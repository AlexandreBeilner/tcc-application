#!/bin/bash
# Papéis e bancos de PRODUÇÃO e staging (LW.3.17). Roda uma única vez, na primeira inicialização do volume
# de dados, como o superusuário POSTGRES_USER. O desenvolvimento usa `infra/postgres/init/` (superusuário só).
#
# Três papéis, nenhum superusuário, sem CREATEDB/CREATEROLE/REPLICATION:
#   selucra_owner    dono dos dois bancos e de todos os objetos; usado SÓ para migrar o schema no boot
#                    (DATABASE_MIGRATE_URL). É o único que pode alterar ou desligar gatilhos.
#   gamification_app só DML no banco gamification (DATABASE_URL do backend).
#   market_app       só DML no banco market (DATABASE_URL do motor). Sem TRUNCATE, sem DDL: não consegue
#                    DROP/DISABLE TRIGGER do `market_events_append_only` (RNF01), nem apagar o log por TRUNCATE.
# O dono NÃO é o papel de runtime de propósito: dono pode desligar o gatilho (a migração 000034 faz isso).
# Privilégios de DML nascem por ALTER DEFAULT PRIVILEGES, então tabelas criadas por migrações futuras já
# chegam com o acesso certo, sem GRANT manual.
set -euo pipefail

: "${DB_OWNER_PASSWORD:?defina DB_OWNER_PASSWORD}"
: "${GAMIFICATION_APP_PASSWORD:?defina GAMIFICATION_APP_PASSWORD}"
: "${MARKET_APP_PASSWORD:?defina MARKET_APP_PASSWORD}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v owner_pw="$DB_OWNER_PASSWORD" -v gam_pw="$GAMIFICATION_APP_PASSWORD" -v mkt_pw="$MARKET_APP_PASSWORD" <<'SQL'
CREATE ROLE selucra_owner    LOGIN PASSWORD :'owner_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE gamification_app LOGIN PASSWORD :'gam_pw'   NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE market_app       LOGIN PASSWORD :'mkt_pw'   NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

-- Persistência poliglota (spec seção 3): dois bancos lógicos distintos, cada papel de runtime só enxerga o seu.
CREATE DATABASE gamification OWNER selucra_owner;
CREATE DATABASE market       OWNER selucra_owner;
REVOKE ALL ON DATABASE gamification FROM PUBLIC;
REVOKE ALL ON DATABASE market       FROM PUBLIC;
GRANT CONNECT ON DATABASE gamification TO gamification_app;
GRANT CONNECT ON DATABASE market       TO market_app;
SQL

grant_runtime() {
  local db="$1" app="$2"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" <<SQL
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ${app};
ALTER DEFAULT PRIVILEGES FOR ROLE selucra_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${app};
ALTER DEFAULT PRIVILEGES FOR ROLE selucra_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${app};
ALTER DEFAULT PRIVILEGES FOR ROLE selucra_owner IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO ${app};
SQL
}
grant_runtime gamification gamification_app
grant_runtime market market_app
