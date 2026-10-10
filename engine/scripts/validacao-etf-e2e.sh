#!/usr/bin/env bash
# Teste ponta a ponta do motor de ETF fora do caminho feliz (Fase R, tarefa R.12).
# Cria bancos isolados (market_e2e, market_e2e_b) no Postgres do Compose, sem tocar o `market` de desenvolvimento.
#
# Uso (a partir da raiz do repositório, com `docker compose up -d postgres redis` no ar):
#   engine/scripts/validacao-etf-e2e.sh
#
# Cenários: (1) ETF adicionado depois, com o mercado rodando; (2) catálogo crescendo com o mercado no ar;
# (3) constituinte sem liquidez (Market Maker dele desligado); (4) ordens de usuário concorrentes com o tick
# e a arbitragem; (5) determinismo (banco clonado, dois motores, mesma seed). Em cada etapa roda as invariantes
# de engine/scripts/validacao-etf.sql (conservação, saldos e conciliação contra market_events).
set -uo pipefail

DB=market_e2e; DBB=market_e2e_b
NET=$(docker inspect tcc-postgres --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}')
PSQL_ADMIN=(docker compose exec -T postgres psql -U tcc -d postgres -At)
psql_db() { local d=$1; shift; docker compose exec -T postgres psql -U tcc -d "$d" -At "$@"; }
url() { echo "postgres://tcc:tcc@postgres:5432/$1?sslmode=disable"; }
FAIL=0
check() { # descrição, valor obtido, valor esperado
  if [ "$2" = "$3" ]; then echo "   ok    $1 ($2)"; else echo "   FALHA $1: obtido '$2', esperado '$3'"; FAIL=1; fi
}
start_engine() { # nome, banco, redis db
  docker rm -f "$1" >/dev/null 2>&1 || true
  docker run -d --name "$1" --network "$NET" -e ENGINE_ADDR=:8080 -e DATABASE_URL="$(url "$2")" \
    -e REDIS_URL="redis://redis:6379/$3" -e SIMULATION_SEED=42 engine-e2e >/dev/null
  for _ in $(seq 1 40); do docker logs "$1" 2>&1 | grep -q "migrations do banco market aplicadas" && return; sleep 1; done
}
tick() { docker exec "$1" wget -qO- --post-data="" http://localhost:8080/admin/tick >/dev/null; }
ticks() { local eng=$1 n=$2; for _ in $(seq 1 "$n"); do tick "$eng" || echo "   tick falhou"; done; }
seed() { # banco, args...
  local d=$1; shift
  docker run --rm --network "$NET" -v "$(pwd)/engine":/app -v tcc_gomod_bench:/go/pkg/mod -w /app \
    -e DATABASE_URL="$(url "$d")" -e SEED_ALLOW_SYNTHETIC=true golang:1.22-alpine go run ./cmd/seed "$@" >/dev/null 2>&1
}
invariants() { # banco, rótulo
  local bad; bad=$(psql_db "$1" -F ' | ' < engine/scripts/validacao-etf.sql | awk -F' \| ' '$2 != 0 { print }')
  if [ -z "$bad" ]; then echo "   ok    invariantes ($2): tudo 0"; else echo "   FALHA invariantes ($2):"; echo "$bad"; FAIL=1; fi
}
cleanup() { docker rm -f e2e-engine e2e-engine-a e2e-engine-b >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "== preparando ${DB}: 30 ações sintéticas, 3 ETFs sintéticos"
docker build -q -t engine-e2e ./engine >/dev/null
"${PSQL_ADMIN[@]}" -c "DROP DATABASE IF EXISTS ${DB}" -c "DROP DATABASE IF EXISTS ${DBB}" -c "CREATE DATABASE ${DB}" >/dev/null
start_engine e2e-engine "$DB" 5
seed "$DB" --synthetic-assets 30 --synthetic-etfs 3
ticks e2e-engine 25
check "ETFs com cotas emitidas depois de 25 ticks" "$(psql_db $DB -c "SELECT count(*) FROM assets a JOIN variable_income_assets v ON v.asset_id=a.id WHERE a.type='etf' AND v.outstanding_shares>0")" 4
invariants $DB "base"

echo "== (1) ETF adicionado depois, com o mercado rodando"
BEFORE=$(psql_db $DB -c "SELECT string_agg(a.ticker||':'||v.outstanding_shares, ',' ORDER BY a.ticker) FROM assets a JOIN variable_income_assets v ON v.asset_id=a.id WHERE a.type='etf'")
BOTS=$(psql_db $DB -c "SELECT count(*) FROM bot_personalities WHERE archetype <> 'market_maker'")
seed "$DB" --synthetic-assets 30 --synthetic-etfs 6
ticks e2e-engine 3
check "ETFs depois de adicionar 3" "$(psql_db $DB -c "SELECT count(*) FROM assets WHERE type='etf'")" 7
check "ETFs novos emitidos em até 3 ticks" "$(psql_db $DB -c "SELECT count(*) FROM assets a JOIN variable_income_assets v ON v.asset_id=a.id WHERE a.type='etf' AND v.outstanding_shares>0")" 7
check "bots direcionais intactos (Market Maker novo cobre os ETFs novos)" "$(psql_db $DB -c "SELECT count(*) FROM bot_personalities WHERE archetype <> 'market_maker'")" "$BOTS"
AFTER=$(psql_db $DB -c "SELECT string_agg(a.ticker||':'||v.outstanding_shares, ',' ORDER BY a.ticker) FROM assets a JOIN variable_income_assets v ON v.asset_id=a.id WHERE a.type='etf' AND a.ticker IN ('SINT11','SYE0111','SYE0211','SYE0311')")
check "cotas dos ETFs antigos (o fundo pode criar ou resgatar, mas a lista de tickers segue)" "$(echo "$BEFORE" | tr ',' '\n' | cut -d: -f1 | tr '\n' ',')" "$(echo "$AFTER" | tr ',' '\n' | cut -d: -f1 | tr '\n' ',')"
invariants $DB "ETF adicionado depois"

echo "== (2) catálogo crescendo com o mercado no ar (mais 20 ações sintéticas)"
seed "$DB" --synthetic-assets 50 --synthetic-etfs 6
ticks e2e-engine 3
check "ações sintéticas" "$(psql_db $DB -c "SELECT count(*) FROM assets WHERE ticker LIKE 'SYN%'")" 50
invariants $DB "catálogo crescendo"

echo "== (3) constituinte sem liquidez (Market Maker de um constituinte do SYE0111 desligado)"
MM=$(psql_db $DB -c "SELECT c.mm_account_id FROM market_maker_coverage c JOIN assets a ON a.id=c.asset_id WHERE a.ticker='SYN0013' LIMIT 1")
psql_db $DB -c "UPDATE accounts SET is_active=false WHERE user_id='$MM'" >/dev/null
ticks e2e-engine 6
check "Market Maker do constituinte desligado" "$(psql_db $DB -c "SELECT is_active FROM accounts WHERE user_id='$MM'")" f
check "tick segue respondendo com o constituinte sem Market Maker" "$(docker exec e2e-engine wget -qO- --post-data='' http://localhost:8080/admin/tick | grep -c '"day"')" 1
psql_db $DB -c "UPDATE accounts SET is_active=true WHERE user_id='$MM'" >/dev/null
invariants $DB "constituinte sem liquidez"

echo "== (4) ordens de usuário concorrentes com o tick e a arbitragem"
ETFID=$(psql_db $DB -c "SELECT id FROM assets WHERE ticker='SINT11'")
for i in $(seq 1 12); do
  U=$(cat /proc/sys/kernel/random/uuid)
  docker exec e2e-engine wget -qO- --header=Content-Type:application/json --post-data="{\"user_id\":\"$U\"}" http://localhost:8080/accounts >/dev/null
  ( docker exec e2e-engine wget -qO- --header=Content-Type:application/json \
      --post-data="{\"user_id\":\"$U\",\"asset_id\":\"$ETFID\",\"side\":\"buy\",\"type\":\"market\",\"quantity\":3}" http://localhost:8080/orders >/dev/null 2>&1 ) &
done
tick e2e-engine &
wait
ticks e2e-engine 2
check "posições de usuário nunca negativas" "$(psql_db $DB -c "SELECT count(*) FROM positions WHERE quantity < 0")" 0
invariants $DB "ordens concorrentes"

echo "== (5) determinismo (banco clonado, dois motores, mesma seed)"
docker rm -f e2e-engine >/dev/null 2>&1
"${PSQL_ADMIN[@]}" -c "CREATE DATABASE ${DBB} TEMPLATE ${DB}" >/dev/null
start_engine e2e-engine-a "$DB" 6
start_engine e2e-engine-b "$DBB" 7
ticks e2e-engine-a 8
ticks e2e-engine-b 8
HASH="SELECT md5(string_agg(x, ',' ORDER BY x)) FROM (
  SELECT 'q'||asset_id||simulated_day||price AS x FROM asset_quotes
  UNION ALL SELECT 'p'||user_id||asset_id||quantity FROM positions
  UNION ALL SELECT 'a'||user_id||current_balance FROM accounts
  UNION ALL SELECT 'n'||etf_asset_id||simulated_day||nav||coalesce(index_value,0) FROM etf_nav_history) t"
check "hash de cotações, posições, saldos e NAV entre os dois bancos" "$(psql_db $DBB -c "$HASH")" "$(psql_db $DB -c "$HASH")"

echo
if [ "$FAIL" = 0 ]; then echo "== TUDO OK"; else echo "== HÁ FALHAS"; exit 1; fi
