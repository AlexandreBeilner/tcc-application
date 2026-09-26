#!/usr/bin/env bash
# Benchmark da cobertura de Market Maker (tarefa P.7, proposta-cobertura-market-maker.md
# seções 6 e 6.1). Cria um banco isolado (market_bench) no Postgres do Compose, semeia o
# catálogo real mais N ações sintéticas, roda DIAS ticks e mede o que o orçamento da 6.1 pede.
#
# Uso (a partir da raiz do repositório, com `docker compose up -d postgres redis` no ar):
#   engine/scripts/benchmark-cobertura.sh [N_ATIVOS_SINTETICOS=30] [DIAS=60]
#
# Só stack de teste: não toca o banco `market` de desenvolvimento. O log de comandos SQL
# (log_statement=all) é ligado no Postgres do Compose durante a execução e desligado no fim.
# Saída: resumo no stdout e CSV por tick em tmp/benchmark-cobertura-<N>.csv.
# Mede também (Fase Q): volume dos ativos líderes e do mediano, dias sem negociação por ativo,
# percentis de comandos SQL por tick e a reação de um ativo da cauda a cinco eventos severos.
set -euo pipefail

N=${1:-30}
DAYS=${2:-60}
OUT="tmp/benchmark-cobertura-${N}.csv"
DB=market_bench
NET=$(docker inspect tcc-postgres --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}')
PSQL_ADMIN=(docker compose exec -T postgres psql -U tcc -d postgres -At)
PSQL=(docker compose exec -T postgres psql -U tcc -d "$DB" -At)
DBURL="postgres://tcc:tcc@postgres:5432/${DB}?sslmode=disable"
MM_PREFIX='00000000-0000-0000-0000-000000000001'

cleanup() {
  docker rm -f bench-engine >/dev/null 2>&1 || true
  "${PSQL_ADMIN[@]}" -c "ALTER SYSTEM RESET log_statement" -c "SELECT pg_reload_conf()" >/dev/null 2>&1 || true
}
trap cleanup EXIT

mkdir -p tmp
echo "== preparando banco ${DB} (${N} ativos sintéticos, ${DAYS} dias)"
"${PSQL_ADMIN[@]}" -c "DROP DATABASE IF EXISTS ${DB}" -c "CREATE DATABASE ${DB}" >/dev/null
docker build -q -t engine-bench ./engine >/dev/null
docker rm -f bench-engine >/dev/null 2>&1 || true
docker run -d --name bench-engine --network "$NET" -e ENGINE_ADDR=:8080 -e DATABASE_URL="$DBURL" \
  -e REDIS_URL=redis://redis:6379/3 -e SIMULATION_SEED=42 engine-bench >/dev/null
for _ in $(seq 1 30); do
  docker logs bench-engine 2>&1 | grep -q "migrations do banco market aplicadas" && break
  sleep 1
done

docker run --rm --network "$NET" -v "$(pwd)/engine":/app -v tcc_gomod_bench:/go/pkg/mod -w /app \
  -e DATABASE_URL="$DBURL" -e SEED_ALLOW_SYNTHETIC=true golang:1.22-alpine \
  go run ./cmd/seed --synthetic-assets "$N" >/dev/null 2>&1
ASSETS=$("${PSQL[@]}" -c "SELECT count(*) FROM market_maker_coverage")
MMS=$("${PSQL[@]}" -c "SELECT count(*) FROM bot_personalities WHERE archetype='market_maker'")
echo "== seed pronto: ${ASSETS} ativos cobertos por ${MMS} Market Maker(s)"

"${PSQL_ADMIN[@]}" -c "ALTER SYSTEM SET log_statement='all'" -c "SELECT pg_reload_conf()" >/dev/null
# Cada tick grava uma linha em RAW na hora (janela de tempo + métricas do tick), então uma queda
# de sessão não perde o progresso. Os comandos SQL são contados uma vez só no fim, lendo o log do
# Postgres uma única vez e atribuindo cada linha à janela do tick por timestamp (ler o log a cada
# tick custava mais que o próprio tick, porque ele cresce com log_statement=all).
RAW="tmp/benchmark-cobertura-${N}.raw.csv"
: > "$RAW"
for I in $(seq 1 "$DAYS"); do
  T0=$(date -u +%Y-%m-%dT%H:%M:%S.%NZ); S0=$(date +%s.%N)
  RESP=$(docker exec bench-engine wget -qO- --post-data="" http://localhost:8080/admin/tick)
  S1=$(date +%s.%N); sleep 0.5; T1=$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)
  field() { echo "$RESP" | grep -o "\"$1\":[0-9]*" | cut -d: -f2; }
  DAY=$(field day)
  MMORD=$("${PSQL[@]}" -c "SELECT count(*) FROM order_book WHERE user_id='${MM_PREFIX}' AND simulated_day=$((DAY-1))")
  MMREQ=$("${PSQL[@]}" -c "SELECT count(*) FROM order_book WHERE cancel_reason='requoted' AND simulated_day>=$((DAY-1))")
  printf "%s,%.2f,%s,%s,%s,%s,%s,%s,%s\n" "$DAY" "$(echo "$S1 - $S0" | bc)" "$T0" "$T1" "$(field intraday_rounds_count)" \
    "$(field bot_fills_count)" "$(field uncovered_assets_count)" "$MMORD" "$MMREQ" >> "$RAW"
  echo "   tick ${I}/${DAYS} (dia ${DAY})" >&2
done
"${PSQL_ADMIN[@]}" -c "ALTER SYSTEM RESET log_statement" -c "SELECT pg_reload_conf()" >/dev/null

echo "dia,segundos,comandos_sql,rodadas,fills,descobertos,ordens_mm,recotacoes_mm,cmd_mm,cmd_bots,cmd_fixo" > "$OUT"
PGLOG="tmp/benchmark-cobertura-${N}.pglog"; MMIDS="tmp/benchmark-cobertura-${N}.mmids"
docker logs --timestamps tcc-postgres > "$PGLOG" 2>&1 || true
"${PSQL[@]}" -c "SELECT account_id FROM bot_personalities WHERE archetype='market_maker'" > "$MMIDS"
# Divisão do custo (tarefa Q.7): o log só traz o usuário nos parâmetros da primeira consulta de um turno
# (leitura de saldo/posição do bot, ou leitura das ordens em repouso do Market Maker). Cada turno herda esse
# ator até o próximo; a leitura de calendário, a gravação de cotações do dia, a expiração, os dividendos e
# as cargas de roster voltam para o custo fixo do tick. Fill de um bot é cobrado a quem iniciou a ordem.
awk -F, 'FILENAME==ARGV[1] { n++; d[n]=$1; sec[n]=$2; t0[n]=substr($3,1,26); t1[n]=substr($4,1,26); r[n]=$5; f[n]=$6; u[n]=$7; mo[n]=$8; mr[n]=$9; next }
  FILENAME==ARGV[2] { mm[$1]=1; next }
  { sub(/\r$/, "") }
  { split($0, w, " "); ts=substr(w[1],1,26); kind=w[6] }
  kind=="LOG:" && (w[7]=="statement:" || w[7]=="execute") {
    head=$0; fixed=0; actorq=0
    if (head ~ /market_calendar|INSERT INTO asset_quotes|dividend_events|market_maker_coverage|FROM bot_personalities|SELECT a.user_id, a.is_bot|SELECT e.id, e.triggered|SELECT c.id, c.report|SELECT a.id, a.type|SELECT asset_id, user_id, quantity FROM positions WHERE asset_id = ANY|UPDATE order_book ob SET status/) fixed=1
    if (head ~ /SELECT a.current_balance, p.quantity|SELECT id, asset_id, side, price, quantity - filled_quantity/) actorq=1
    if (fixed) actor="fixo"
    pending=actorq
    if (!actorq) tally(ts)
    else pts=ts
    next }
  kind=="DETAIL:" && pending { pending=0
    if (match($0, /\$1 = \x27[0-9a-f-]+\x27/)) { id=substr($0, RSTART+6, RLENGTH-7); actor=(id in mm) ? "mm" : "bots" }
    tally(pts); next }
  function tally(t,   k) {
    for (k=(i>0?i:1); k<=n; k++) { if (t<t0[k]) break; if (t<t1[k]) { c[k]++; cat[k,actor]++; i=k; break } } }
  BEGIN { actor="fixo" }
  END { for (k=1;k<=n;k++) printf "%s,%s,%d,%s,%s,%s,%s,%s,%d,%d,%d\n", d[k], sec[k], c[k], r[k], f[k], u[k], mo[k], mr[k], cat[k,"mm"], cat[k,"bots"], cat[k,"fixo"] }' \
  "$RAW" "$MMIDS" "$PGLOG" >> "$OUT"
rm -f "$PGLOG" "$MMIDS"

echo "== resultados (CSV completo em ${OUT})"
awk -F, 'NR>1 { n++; s+=$3; t+=$2; if ($2>tmax) tmax=$2; if ($3>smax) smax=$3; r+=$4; f+=$5; d+=$6; if ($3>5000) over++ }
  END { printf "ticks=%d  comandos_sql: media=%.0f max=%d  ticks_acima_de_5000=%d  tempo_s: media=%.2f max=%.2f  rodadas/tick=%.2f  fills/tick=%.1f  descobertos/tick=%.1f\n", n, s/n, smax, over, t/n, tmax, r/n, f/n, d/n }' "$OUT"
awk -F, 'NR>1 { print $3 }' "$OUT" | sort -n | awk '{ v[NR]=$1 } END { printf "comandos_sql por tick: p50=%d p95=%d p99=%d\n", v[int(NR*0.5)+1], v[int(NR*0.95)+1], v[int(NR*0.99)+1] }'
BOTS=$("${PSQL[@]}" -c "SELECT count(*) FROM bot_personalities WHERE archetype != 'market_maker'")
awk -F, 'NR>1 { n++; m+=$9; b+=$10; x+=$11; if ($3>5000) { on++; om+=$9; ob+=$10; ox+=$11 } }
  END { printf "custo medio por tick: market_maker=%.0f bots_direcionais=%.0f fixo=%.0f\n", m/n, b/n, x/n
        if (on > 0) printf "nos %d ticks acima de 5000: market_maker=%.0f bots_direcionais=%.0f fixo=%.0f\n", on, om/on, ob/on, ox/on }' "$OUT"
echo "pool de bots direcionais: ${BOTS}; ativos negociáveis: ${ASSETS}"

echo "-- cobertura ao fim do dia ${DAYS}: ativos com compra e venda em repouso"
"${PSQL[@]}" -c "SELECT count(*) FILTER (WHERE has_buy AND has_sell) || ' de ' || count(*) FROM (
  SELECT a.id, bool_or(ob.side='buy') AS has_buy, bool_or(ob.side='sell') AS has_sell
  FROM assets a LEFT JOIN order_book ob ON ob.asset_id=a.id AND ob.status IN ('pending','partially_filled')
  WHERE a.type IN ('acao','fii') AND NOT a.is_sandbox GROUP BY a.id) t"
echo "-- ativos sem um dos lados da cotação ao fim do dia (ticker, lados em repouso, preço, float, menor cotação em repouso)"
"${PSQL[@]}" -c "SELECT a.ticker, coalesce(string_agg(DISTINCT ob.side::text, '+'), 'nenhum'), (SELECT price FROM asset_quotes q WHERE q.asset_id=a.id ORDER BY simulated_day DESC LIMIT 1),
  via.outstanding_shares, min(ob.quantity - ob.filled_quantity)
  FROM assets a JOIN variable_income_assets via ON via.asset_id=a.id LEFT JOIN order_book ob ON ob.asset_id=a.id AND ob.status IN ('pending','partially_filled')
  WHERE a.type IN ('acao','fii') AND NOT a.is_sandbox GROUP BY a.id, a.ticker, via.outstanding_shares
  HAVING NOT (bool_or(ob.side='buy') AND bool_or(ob.side='sell'))"
echo "-- Market Makers: caixa e posição mínimos (esgotamento)"
"${PSQL[@]}" -c "SELECT a.user_id, round(a.current_balance) AS caixa, (SELECT min(quantity) FROM positions p WHERE p.user_id=a.user_id) AS menor_posicao,
  (SELECT count(*) FROM market_maker_coverage c WHERE c.mm_account_id=a.user_id) AS ativos
  FROM accounts a JOIN bot_personalities bp ON bp.account_id=a.user_id AND bp.archetype='market_maker' ORDER BY 1"
echo "-- volume diário por ativo, % do float, últimos 20 dias (líderes = 20% de maior float)"
"${PSQL[@]}" -c "WITH per_asset AS (
    SELECT q.asset_id, via.outstanding_shares AS float_shares,
           avg(q.total_quantity::numeric / via.outstanding_shares * 100) AS pct,
           count(*) FILTER (WHERE coalesce(q.total_quantity, 0) = 0) AS dias_sem_negociacao,
           count(*) AS dias
    FROM asset_quotes q JOIN variable_income_assets via ON via.asset_id = q.asset_id
    WHERE q.simulated_day > (SELECT max(simulated_day) - 20 FROM asset_quotes) AND via.outstanding_shares > 0
    GROUP BY q.asset_id, via.outstanding_shares),
  tiers AS (SELECT *, ntile(5) OVER (ORDER BY float_shares DESC) AS tier FROM per_asset)
  SELECT 'lideres    media=' || round(avg(pct) FILTER (WHERE tier = 1), 3) || ' min=' || round(min(pct) FILTER (WHERE tier = 1), 3) || ' max=' || round(max(pct) FILTER (WHERE tier = 1), 3) FROM tiers
  UNION ALL SELECT 'mediano    ' || round((percentile_cont(0.5) WITHIN GROUP (ORDER BY pct))::numeric, 3) FROM tiers
  UNION ALL SELECT 'todos      media=' || round(avg(pct), 3) || ' min=' || round(min(pct), 3) || ' max=' || round(max(pct), 3) FROM tiers
  UNION ALL SELECT 'ativos abaixo de 0,15%: ' || count(*) FILTER (WHERE pct < 0.15) || ' de ' || count(*) FROM tiers
  UNION ALL SELECT 'dias sem negociação: ' || sum(dias_sem_negociacao) || ' de ' || sum(dias) || ' (ativos com algum: ' || count(*) FILTER (WHERE dias_sem_negociacao > 0) || ')' FROM tiers"
echo "-- reação a cinco eventos severos negativos no setor de um ativo da cauda (menor float)"
TAIL=$("${PSQL[@]}" -c "SELECT a.id||'|'||a.ticker||'|'||co.sector FROM assets a JOIN variable_income_assets via ON via.asset_id=a.id JOIN companies co ON co.id=via.company_id WHERE a.type='acao' AND NOT a.is_sandbox ORDER BY via.outstanding_shares ASC, a.ticker LIMIT 1")
TAIL_ID=${TAIL%%|*}; REST=${TAIL#*|}; TAIL_TICKER=${REST%%|*}; TAIL_SECTOR=${REST#*|}
LASTPRICE(){ "${PSQL[@]}" -c "SELECT price FROM asset_quotes WHERE asset_id='$TAIL_ID' ORDER BY simulated_day DESC LIMIT 1"; }
P0=$(LASTPRICE); MINP=$P0
for i in 1 2 3 4 5; do
  docker exec bench-engine wget -qO- --header=Content-Type:application/json \
    --post-data="{\"title\":\"Choque severo $i\",\"narrative\":\"benchmark\",\"direction\":\"negativo\",\"magnitude_band\":\"severo\",\"affects_price\":true,\"affects_fundamentals\":false,\"targets\":[{\"sector\":\"$TAIL_SECTOR\"}]}" \
    http://localhost:8080/macro-events >/dev/null 2>&1 || true
done
for _ in $(seq 1 6); do
  docker exec bench-engine wget -qO- --post-data="" http://localhost:8080/admin/tick >/dev/null
  P=$(LASTPRICE); MINP=$(echo "$P $MINP" | awk '{ print ($1<$2)?$1:$2 }')
done
echo "   ${TAIL_TICKER} (setor ${TAIL_SECTOR}): preço antes ${P0}, mínimo em 6 dias ${MINP}, variação máxima $(echo "$P0 $MINP" | awk '{ printf "%.1f%%", ($2-$1)/$1*100 }')"
echo "-- cenário do achado 013: compra e venda de 50 a mercado em 10 ativos (100 unidades de um ativo sintético a R$ 100 passam do capital inicial)"
OK=0; TOTAL=0
for ASSET in $("${PSQL[@]}" -c "SELECT id FROM assets WHERE type='acao' AND NOT is_sandbox ORDER BY ticker LIMIT 10"); do
  U=$(cat /proc/sys/kernel/random/uuid)
  docker exec bench-engine wget -qO- --header=Content-Type:application/json --post-data="{\"user_id\":\"$U\"}" http://localhost:8080/accounts >/dev/null
  for SIDE in buy sell; do
    F=$(docker exec bench-engine wget -qO- --header=Content-Type:application/json \
      --post-data="{\"user_id\":\"$U\",\"asset_id\":\"$ASSET\",\"side\":\"$SIDE\",\"type\":\"market\",\"quantity\":50}" http://localhost:8080/orders 2>/dev/null | grep -o '"filled_quantity":[0-9]*' | cut -d: -f2 || true)
    TOTAL=$((TOTAL+1)); [ "${F:-0}" = "50" ] && OK=$((OK+1))
  done
done
echo "   ${OK} de ${TOTAL} ordens preenchidas por completo"
