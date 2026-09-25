package db

import (
	"context"
	"database/sql"
	"errors"

	"github.com/lib/pq"

	"tcc-investimentos/engine/internal/domain"
	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/orderbook"
	"tcc-investimentos/engine/internal/domain/orderexecution"
	"tcc-investimentos/engine/internal/domain/position"
	"tcc-investimentos/engine/internal/domain/sandbox"
	"tcc-investimentos/engine/internal/domain/tick"
	"tcc-investimentos/engine/internal/infra/eventstore"
)

// OrderExecutionRepository implementa orderexecution.Repository contra o
// banco "market" — reconstrói o contexto de execução (liquidez real
// pendente, preço de referência, saldo/posição do usuário) e persiste o
// resultado do matching (tarefa 3.12).
type OrderExecutionRepository struct {
	db    *sql.DB
	cache quoteCache
}

// NewOrderExecutionRepository recebe cache já resolvido pelo chamador —
// mesma decisão de NewCatalogRepository (nunca nil, sempre um valor
// concreto: RedisQuoteCache ou NoopQuoteCache).
func NewOrderExecutionRepository(db *sql.DB, cache quoteCache) *OrderExecutionRepository {
	return &OrderExecutionRepository{db: db, cache: cache}
}

// LoadContext lê, fora de transação (leitura consistente o bastante — a
// checagem de saldo/posição definitiva acontece de novo, com lock, dentro
// da transação de Persist), tudo que orderexecution.Execute precisa: saldo
// e posição atuais do usuário da ordem recebida, o preço de referência
// corrente e as ordens reais pendentes desse ativo, em ordem de chegada.
func (r *OrderExecutionRepository) LoadContext(ctx context.Context, assetID, userID string) (orderexecution.Context, error) {
	// Saldo e posição numa consulta só (tarefa Q.1): LEFT JOIN, porque o usuário
	// pode não ter posição no ativo (quantity e created_at ficam NULL).
	var balance float64
	var positionQty sql.NullInt64
	var positionCreatedAt sql.NullTime
	if err := r.db.QueryRowContext(ctx,
		`SELECT a.current_balance, p.quantity, p.created_at
		 FROM accounts a
		 LEFT JOIN positions p ON p.user_id = a.user_id AND p.asset_id = $2
		 WHERE a.user_id = $1`, userID, assetID,
	).Scan(&balance, &positionQty, &positionCreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return orderexecution.Context{}, orderexecution.ErrAccountNotFound
		}
		return orderexecution.Context{}, err
	}
	heldQty := int(positionQty.Int64)

	static, err := r.assetStatic(ctx, assetID)
	if err != nil {
		return orderexecution.Context{}, err
	}

	referencePrice, err := r.referencePrice(ctx, assetID, static, heldQty, positionCreatedAt)
	if err != nil {
		return orderexecution.Context{}, err
	}

	resting, err := r.loadRestingOrders(ctx, assetID)
	if err != nil {
		return orderexecution.Context{}, err
	}

	var outstandingShares *int64
	var totalHeldExcludingIncoming int64
	if static.outstandingShares.Valid {
		shares := static.outstandingShares.Int64
		outstandingShares = &shares
		totalHeldExcludingIncoming, err = r.totalHeldExcluding(ctx, assetID, userID)
		if err != nil {
			return orderexecution.Context{}, err
		}
	}

	simulatedDay, err := r.currentSimulatedDayScoped(ctx)
	if err != nil {
		return orderexecution.Context{}, err
	}

	return orderexecution.Context{
		ReferencePrice:             referencePrice,
		Resting:                    resting,
		IncomingUserBalance:        balance,
		IncomingUserPosition:       heldQty,
		Sandbox:                    static.isSandbox,
		OutstandingShares:          outstandingShares,
		TotalHeldExcludingIncoming: totalHeldExcludingIncoming,
		SimulatedDay:               simulatedDay,
	}, nil
}

// assetStatic são os dados de um ativo que não mudam durante um tick: ticker,
// se é sandbox e o float (outstanding_shares, NULL para ativo sem float, como
// ETF e renda fixa).
type assetStatic struct {
	ticker            string
	isSandbox         bool
	outstandingShares sql.NullInt64
}

// assetStatic lê ticker, is_sandbox e outstanding_shares numa consulta só (eram
// duas) e, dentro de um WithReadScope, uma vez por ativo por tick.
func (r *OrderExecutionRepository) assetStatic(ctx context.Context, assetID string) (assetStatic, error) {
	return scopeFrom(ctx).asset(assetID, func() (assetStatic, error) {
		var st assetStatic
		err := r.db.QueryRowContext(ctx,
			`SELECT a.ticker, a.is_sandbox, via.outstanding_shares
			 FROM assets a
			 LEFT JOIN variable_income_assets via ON via.asset_id = a.id
			 WHERE a.id = $1`, assetID,
		).Scan(&st.ticker, &st.isSandbox, &st.outstandingShares)
		return st, err
	})
}

// currentSimulatedDayScoped é currentSimulatedDay com o cache de leitura do
// tick: o dia simulado só muda em SaveTick, no fim do tick.
func (r *OrderExecutionRepository) currentSimulatedDayScoped(ctx context.Context) (int, error) {
	return scopeFrom(ctx).day(func() (int, error) { return r.currentSimulatedDay(ctx) })
}

// currentSimulatedDay lê market_calendar.current_day (achado 005 parte A,
// pontos-em-aberto-decisao-produto.md) — 0 quando o Temporizador nunca
// rodou (motor recém-subido, tabela ainda vazia), mesmo fallback que
// tick.Service.Run já usa (State{Day: 0, ...}). Chamado por LoadContext pra
// carimbar Context.SimulatedDay, repassado por Service.SubmitWithContext
// pra Request.SimulatedDay antes de persistir.
func (r *OrderExecutionRepository) currentSimulatedDay(ctx context.Context) (int, error) {
	var day int
	err := r.db.QueryRowContext(ctx, `SELECT current_day FROM market_calendar WHERE id = 1`).Scan(&day)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	return day, err
}

// ExpireStaleOrders cancela toda ordem ainda pendente/parcial de um dia
// simulado anterior a currentSimulatedDay (achado 005 parte A) — sem isso,
// order_book cresce sem limite e uma ordem de dias passados (ex: gerada por
// um bot cujo caixa excedia o float do ativo, achado 005 original) continua
// pendurada disputando liquidez indefinidamente, travando o preço de
// fechamento. Chamado por tick.Service.Run antes de runIntradayRounds do
// dia novo — nenhuma ordem de um dia anterior chega a competir pela
// liquidez do dia que está começando. Cancelar não reverte saldo/posição
// (nada é reservado na submissão de uma ordem — só o fill move dinheiro,
// orderexecution.go), então um UPDATE simples é suficiente e correto, sem
// precisar de evento novo em market_events (Event Sourcing só exige evento
// pra escrita de saldo/posição, CLAUDE.md). Devolve quantas ordens
// expiraram, só pra observabilidade (mesmo padrão de bot_fills_count/
// dividends_paid_count na resposta de POST /admin/tick).
//
// Exceção (tarefa P.5, proposta-cobertura-market-maker.md seção 3.7): ordem de
// Market Maker ATIVO não expira por dia. A cotação dele é "de pé", como a de um
// formador real, e a manutenção de cotação (P.4) a substitui por
// cancel_reason = 'requoted' quando o preço sai da tolerância ou o lado é
// consumido; expirá-la todo dia fazia o primeiro turno de cada dia recotar o
// catálogo inteiro. Market Maker inativo (is_active = false) perde a exceção e
// suas ordens expiram normalmente, então desativar um bot tira a cotação dele
// do book no tick seguinte, sem ninguém precisar cancelar à mão.
func (r *OrderExecutionRepository) ExpireStaleOrders(ctx context.Context, currentSimulatedDay int) (int, error) {
	result, err := r.db.ExecContext(ctx,
		`UPDATE order_book ob SET status = 'cancelled', cancel_reason = 'expired'
		 WHERE ob.status IN ('pending', 'partially_filled') AND ob.simulated_day < $1
		   AND NOT EXISTS (
		     SELECT 1 FROM bot_personalities bp
		     JOIN accounts a ON a.user_id = bp.account_id
		     WHERE bp.account_id = ob.user_id AND bp.archetype = 'market_maker' AND a.is_active
		   )`,
		currentSimulatedDay,
	)
	if err != nil {
		return 0, err
	}
	affected, err := result.RowsAffected()
	return int(affected), err
}

// ListRestingOrders devolve, numa consulta só, as ordens ainda
// pendentes/parciais de userID em cada um de assetIDs (tarefa P.4), com a
// quantidade que ainda falta executar, ordenadas por chegada. Ativo sem
// ordem em repouso não aparece no mapa. É a leitura em lote da manutenção de
// cotação do Market Maker: uma consulta por Market Maker e rodada, não uma por
// ativo coberto.
func (r *OrderExecutionRepository) ListRestingOrders(ctx context.Context, userID string, assetIDs []string) (map[string][]bot.RestingQuote, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, asset_id, side, price, quantity - filled_quantity
		 FROM order_book
		 WHERE user_id = $1 AND asset_id = ANY($2) AND type = 'limit' AND status IN ('pending', 'partially_filled')
		 ORDER BY created_at ASC`,
		userID, pq.Array(assetIDs),
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	resting := make(map[string][]bot.RestingQuote)
	for rows.Next() {
		var assetID, side string
		var quote bot.RestingQuote
		if err := rows.Scan(&quote.ID, &assetID, &side, &quote.Price, &quote.RemainingQuantity); err != nil {
			return nil, err
		}
		quote.Side = orderbook.Side(side)
		resting[assetID] = append(resting[assetID], quote)
	}
	return resting, rows.Err()
}

// CancelRestingOrders marca como cancelled, com o motivo 'requoted', as ordens
// orderIDs que ainda estão pendentes/parciais (tarefa P.4, substitui o antigo
// CancelUserRestingOrders, que cancelava toda a cotação do ativo). Cancelar
// não reverte saldo/posição (nada é reservado na submissão, orderexecution.go),
// então um UPDATE simples basta, sem evento em market_events. Ordem que já não
// está em repouso (executada por completo no meio-tempo) é ignorada.
func (r *OrderExecutionRepository) CancelRestingOrders(ctx context.Context, orderIDs []string) error {
	if len(orderIDs) == 0 {
		return nil
	}
	_, err := r.db.ExecContext(ctx,
		`UPDATE order_book SET status = 'cancelled', cancel_reason = 'requoted'
		 WHERE id = ANY($1) AND status IN ('pending', 'partially_filled')`,
		pq.Array(orderIDs),
	)
	return err
}

// CancelOrder marca como cancelled a ordem orderID de userID (tarefa O.1,
// cancelamento manual pelo próprio usuário) — diferente de
// ExpireStaleOrders/CancelUserRestingOrders acima (bulk, disparados pelo
// sistema/bot), esta é uma única ordem por ID, disparada por uma rota HTTP
// nova. Lê dono e status com FOR UPDATE antes de decidir: um UPDATE ...
// WHERE sozinho não teria como distinguir "ordem não existe", "ordem é de
// outro usuário" e "ordem já não está mais pending/partially_filled" a
// partir de "0 linhas afetadas" — o handler HTTP precisa da causa certa
// pra mapear pro status certo (404 vs. 409). As duas primeiras causas
// colapsam no mesmo ErrOrderNotFound de propósito (não vazar que um ID de
// ordem alheio existe). Cancelar não reverte saldo/posição nem
// filled_quantity já executado (mesma decisão de escopo de
// ExpireStaleOrders: nenhuma ordem pendurada reserva nada na submissão,
// orderexecution.go), então não passa por Event Sourcing.
func (r *OrderExecutionRepository) CancelOrder(ctx context.Context, orderID, userID string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var ownerID, status string
	err = tx.QueryRowContext(ctx,
		`SELECT user_id, status FROM order_book WHERE id = $1 FOR UPDATE`, orderID,
	).Scan(&ownerID, &status)
	if errors.Is(err, sql.ErrNoRows) {
		return orderexecution.ErrOrderNotFound
	}
	if err != nil {
		return err
	}
	if ownerID != userID {
		return orderexecution.ErrOrderNotFound
	}
	if status != "pending" && status != "partially_filled" {
		return orderexecution.ErrOrderNotCancellable
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE order_book SET status = 'cancelled', cancel_reason = 'user_cancelled' WHERE id = $1`, orderID,
	); err != nil {
		return err
	}

	return tx.Commit()
}

// ListOrders devolve todas as ordens de userID (tarefa O.3, GET /orders),
// mais recente primeiro, sem paginação (escopo de protótipo) — fecha o
// achado 012 (pontos-em-aberto-decisao-produto.md): sem esta rota,
// CancelOrder não tinha nenhum caminho real pelo qual um cliente
// descobrisse qual id de ordem passar depois de um reload de página.
func (r *OrderExecutionRepository) ListOrders(ctx context.Context, userID string) ([]orderexecution.OrderRecord, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, asset_id, side, type, quantity, filled_quantity, price, status, cancel_reason, created_at
		 FROM order_book
		 WHERE user_id = $1
		 ORDER BY created_at DESC`, userID,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	records := make([]orderexecution.OrderRecord, 0)
	for rows.Next() {
		var rec orderexecution.OrderRecord
		var side, orderType, status string
		var cancelReason sql.NullString
		if err := rows.Scan(
			&rec.ID, &rec.AssetID, &side, &orderType, &rec.Quantity, &rec.FilledQuantity,
			&rec.Price, &status, &cancelReason, &rec.CreatedAt,
		); err != nil {
			return nil, err
		}
		rec.Side, rec.Type, rec.Status = orderbook.Side(side), orderbook.Type(orderType), status
		if cancelReason.Valid {
			reason := orderexecution.CancelReason(cancelReason.String)
			rec.CancelReason = &reason
		}
		records = append(records, rec)
	}
	return records, rows.Err()
}

// totalHeldExcluding soma as posições de todos os detentores do ativo menos as
// do próprio usuário da ordem (insumo de position.ValidateFloatCeiling). O
// float em si (outstanding_shares) vem de assetStatic.
func (r *OrderExecutionRepository) totalHeldExcluding(ctx context.Context, assetID, userID string) (int64, error) {
	var total int64
	err := r.db.QueryRowContext(ctx,
		`SELECT COALESCE(SUM(quantity), 0) FROM positions WHERE asset_id = $1 AND user_id != $2`, assetID, userID,
	).Scan(&total)
	return total, err
}

// referencePrice resolve o preço de referência e se o ativo é sandbox —
// isSandbox é repassado pro chamador (orderexecution.Context.Sandbox)
// porque só ativo sandbox (RF12/RNF08, tarefa 4.11) ainda recebe
// preenchimento sintético de ordem a mercado (tarefa A.2, proposta
// motor-mercado-realista 2.7 — sandbox fica fora do redesenho de liquidez
// real). Preço de ativo sandbox usa sandbox.PriceScript, indexado pelo
// ticker (não dá pra indexar por assetID em tempo de compilação — gerado
// pelo Postgres) e pelo dia decorrido desde a primeira operação do usuário
// da ordem *nesse ativo* (positionCreatedAt/positionQty — sandboxDayIndex
// reinicia em dia 0 se ele ainda não tinha posição nenhuma OU se a posição
// existente está zerada, ver doc de sandboxDayIndex), nunca asset_quotes —
// o Temporizador nunca gera cotação pra ativo sandbox (ver tick.md). Ativo
// do Mercado Ao Vivo mantém o comportamento original: última linha de
// asset_quotes (tarefa 3.11), tick.DefaultInitialPrice se ainda não há
// nenhuma — mas ali o preço de referência agora só serve pra exibição
// (ex: weightedAveragePrice de uma ordem sem nenhum fill real), nunca mais
// pra preencher a ordem sinteticamente.
func (r *OrderExecutionRepository) referencePrice(ctx context.Context, assetID string, static assetStatic, positionQty int, positionCreatedAt sql.NullTime) (float64, error) {
	ticker, isSandbox := static.ticker, static.isSandbox
	if isSandbox {
		script, ok := sandbox.PriceScriptForTicker(ticker)
		if !ok {
			return 0, ErrSandboxScriptNotFound
		}
		return sandbox.PriceOnDay(script, sandboxDayIndex(positionCreatedAt, float64(positionQty))), nil
	}

	// Cache de leitura (tarefa 5.7) — mesma última cotação que
	// CatalogRepository.FindCurrentQuote/TickRepository.SaveTick mantêm
	// quente; aqui só o Price importa, DailyChangePct é ignorado.
	quote, found, err := cachedQuote(ctx, r.cache, assetID, r.loadLatestQuoteFromPostgres)
	if err != nil {
		return 0, err
	}
	if !found {
		return tick.DefaultInitialPrice, nil
	}
	return quote.Price, nil
}

func (r *OrderExecutionRepository) loadLatestQuoteFromPostgres(ctx context.Context, assetID string) (catalog.Quote, bool, error) {
	var price float64
	err := r.db.QueryRowContext(ctx,
		`SELECT price FROM asset_quotes WHERE asset_id = $1 ORDER BY simulated_day DESC LIMIT 1`, assetID,
	).Scan(&price)
	if errors.Is(err, sql.ErrNoRows) {
		return catalog.Quote{}, false, nil
	}
	if err != nil {
		return catalog.Quote{}, false, err
	}
	return catalog.Quote{Price: price}, true, nil
}

// loadRestingOrders só lê ordens `limit` (tarefa A.2): ordem `market` nunca
// fica pendurada no book, mesmo quando sobra quantidade sem contraparte
// real (`orderexecution.Execute` já garante isso no Outcome), mas a linha
// dela em order_book pode ainda assim ter status `pending`/`partially_filled`
// (reflete quantidade pedida vs. preenchida, pra auditoria) — sem esse
// filtro por `type`, essa linha voltaria a ser lida aqui como se fosse
// liquidez real pendurada, corrompendo o replay de orderbook.Book.Submit.
func (r *OrderExecutionRepository) loadRestingOrders(ctx context.Context, assetID string) ([]orderexecution.RestingOrder, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, user_id, side, type, price, quantity - filled_quantity AS remaining
		 FROM order_book
		 WHERE asset_id = $1 AND type = 'limit' AND status IN ('pending', 'partially_filled')
		 ORDER BY created_at ASC`, assetID,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var resting []orderexecution.RestingOrder
	for rows.Next() {
		var ro orderexecution.RestingOrder
		var side, orderType string
		if err := rows.Scan(&ro.ID, &ro.UserID, &side, &orderType, &ro.Price, &ro.RemainingQuantity); err != nil {
			return nil, err
		}
		ro.Side, ro.Type = orderbook.Side(side), orderbook.Type(orderType)
		resting = append(resting, ro)
	}
	return resting, rows.Err()
}

// Persist grava o resultado de orderexecution.Execute atomicamente: pra
// cada Fill (real, ou sintético só no caso sandbox — tarefa A.2), o evento
// imutável em market_events de cada lado envolvido é gravado **antes** de
// projetar em accounts/positions — Event Sourcing é a fonte da verdade
// financeira (CLAUDE.md) — e só então a própria ordem recebida é inserida
// em order_book. Fill sintético (orderexecution.MarketCounterparty) só
// projeta o lado do usuário que enviou a ordem; não existe uma conta/
// posição real do outro lado.
//
// Limitação de escopo conhecida (3.12): a validação de saldo/posição
// acontece em Execute contra o snapshot lido por LoadContext, sem lock —
// duas ordens do mesmo usuário processadas concorrentemente podem, em
// teoria, passar as duas pela validação antes de qualquer uma debitar. As
// atualizações de saldo aqui são incrementais (`current_balance = current_balance - $1`),
// então o valor final nunca fica incorreto, só a validação prévia poderia
// aceitar uma ordem que — combinada com outra em voo — estoura o saldo.
// Aceitável pro escopo de protótipo de TCC (uso via um usuário de cada vez
// na demonstração); uma correção completa exigiria mover a leitura de
// saldo/posição pra dentro desta mesma transação, com FOR UPDATE, antes de
// chamar Execute.
//
// Devolve o id da linha de order_book recém-criada pra ordem recebida
// (tarefa O.3, achado 012) — insertIncomingOrder usa RETURNING id.
func (r *OrderExecutionRepository) Persist(ctx context.Context, req orderexecution.Request, outcome orderexecution.Outcome) (string, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer func() { _ = tx.Rollback() }()

	for _, fill := range outcome.Fills {
		if err := applyFillSide(ctx, tx, req.AssetID, req.UserID, req.Side, fill.Quantity, fill.Price); err != nil {
			return "", err
		}
		if !fill.IsSynthetic() {
			counterpartySide := orderbook.SideSell
			if req.Side == orderbook.SideSell {
				counterpartySide = orderbook.SideBuy
			}
			if err := applyFillSide(ctx, tx, req.AssetID, fill.CounterpartyUserID, counterpartySide, fill.Quantity, fill.Price); err != nil {
				return "", err
			}
			if err := fillRestingOrder(ctx, tx, fill.CounterpartyOrderID, fill.Quantity); err != nil {
				return "", err
			}
		}
	}

	orderID, err := insertIncomingOrder(ctx, tx, req, outcome)
	if err != nil {
		return "", err
	}

	if err := tx.Commit(); err != nil {
		return "", err
	}
	return orderID, nil
}

// applyFillSide grava o evento e projeta saldo/posição de um dos lados de
// um Fill — side é o lado desse usuário nesse Fill específico (pode ser o
// lado da ordem recebida ou o oposto, se for a contraparte real).
func applyFillSide(ctx context.Context, tx *sql.Tx, assetID, userID string, side orderbook.Side, quantity int, price float64) error {
	eventType := domain.EventSellOrderExecuted
	if side == orderbook.SideBuy {
		eventType = domain.EventBuyOrderExecuted
	}
	if err := eventstore.AppendTx(ctx, tx, domain.MarketEvent{
		UserID:    userID,
		AssetID:   &assetID,
		EventType: eventType,
		Quantity:  &quantity,
		UnitValue: &price,
	}); err != nil {
		return err
	}

	cost := price * float64(quantity)
	if side == orderbook.SideBuy {
		if _, err := tx.ExecContext(ctx,
			`UPDATE accounts SET current_balance = current_balance - $1, total_invested = total_invested + $1, updated_at = now() WHERE user_id = $2`,
			cost, userID,
		); err != nil {
			return err
		}
	} else {
		if _, err := tx.ExecContext(ctx,
			`UPDATE accounts SET current_balance = current_balance + $1, updated_at = now() WHERE user_id = $2`,
			cost, userID,
		); err != nil {
			return err
		}
	}

	return applyPositionFill(ctx, tx, userID, assetID, side, quantity, price)
}

// applyPositionFill lê a posição atual do usuário nesse ativo com lock
// (FOR UPDATE — mais de um Fill do mesmo Persist pode tocar a mesma
// posição, ex: dois fills de compra na mesma ordem a mercado) e grava o
// novo estado calculado por position.ApplyBuy/ApplySell.
func applyPositionFill(ctx context.Context, tx *sql.Tx, userID, assetID string, side orderbook.Side, quantity int, price float64) error {
	var current position.Position
	err := tx.QueryRowContext(ctx,
		`SELECT quantity, average_price FROM positions WHERE user_id = $1 AND asset_id = $2 FOR UPDATE`,
		userID, assetID,
	).Scan(&current.Quantity, &current.AveragePrice)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	var next position.Position
	if side == orderbook.SideBuy {
		next = position.ApplyBuy(current, quantity, price)
	} else {
		next, err = position.ApplySell(current, quantity)
		if err != nil {
			return err
		}
	}

	_, err = tx.ExecContext(ctx,
		`INSERT INTO positions (user_id, asset_id, quantity, average_price)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (user_id, asset_id) DO UPDATE SET
		   quantity = EXCLUDED.quantity, average_price = EXCLUDED.average_price, updated_at = now()`,
		userID, assetID, next.Quantity, next.AveragePrice,
	)
	return err
}

// fillRestingOrder incrementa filled_quantity de uma ordem real que já
// estava pendurada no book e atualiza seu status — cálculo feito inteiro
// em SQL (sem round-trip extra pra ler a quantidade original) porque
// quantity (original) já está na mesma linha. `AND status IN ('pending',
// 'partially_filled')` (achado ao vivo, sessão da tarefa O.1) fecha uma
// corrida real contra CancelOrder: Execute decide este match contra
// Context.Resting, lido por LoadContext **fora** de transação — se o dono
// da ordem pendurada a cancelar (CancelOrder, que toma FOR UPDATE nessa
// mesma linha) entre essa leitura e este UPDATE, o UPDATE sem essa
// cláusula corria pra depois de CancelOrder commitar (mesmo lock de linha
// do Postgres serializa as duas escritas) e sobrescrevia 'cancelled' de
// volta pra 'partially_filled'/'filled' — reproduzido manualmente contra
// Postgres real com duas transações concorrentes (BEGIN; SELECT ... FOR
// UPDATE; sleep; UPDATE status='cancelled'; COMMIT — correndo contra
// BEGIN; sleep; este UPDATE; COMMIT). affected == 0 agora sinaliza que a
// ordem pendurada não está mais disponível (foi cancelada, ou terminou de
// preencher por outro caminho, no intervalo) — ErrRestingOrderNoLongerAvailable
// aborta a transação inteira do submissor (defer tx.Rollback() em
// Persist), mesma consequência de ErrInsufficientPosition contra a mesma
// ordem "furada" (achado 005): nenhum saldo/posição já debitado nesta
// mesma transação (applyFillSide, chamado antes deste ponto pros dois
// lados do Fill) fica de pé.
func fillRestingOrder(ctx context.Context, tx *sql.Tx, orderID string, quantity int) error {
	result, err := tx.ExecContext(ctx,
		`UPDATE order_book SET
		   filled_quantity = filled_quantity + $1,
		   status = (CASE WHEN filled_quantity + $1 >= quantity THEN 'filled' ELSE 'partially_filled' END)::order_status
		 WHERE id = $2 AND status IN ('pending', 'partially_filled')`,
		quantity, orderID,
	)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return orderexecution.ErrRestingOrderNoLongerAvailable
	}
	return nil
}

// insertIncomingOrder grava a ordem recebida como uma nova linha de
// order_book e devolve o id gerado (tarefa O.3, RETURNING id — antes desta
// tarefa o id nunca era lido de volta, então POST /orders não tinha como
// ecoá-lo pro cliente). Price é o limite informado pelo usuário pra ordem
// limitada; pra ordem a mercado (sem preço próprio — Type == market ignora
// Price, orderbook.go) é o preço médio ponderado de execução, porque a
// coluna é NOT NULL e não existe "o preço" de uma ordem a mercado antes de
// executar. simulated_day (achado 005 parte A) vem de req.SimulatedDay,
// carimbado por Service.SubmitWithContext a partir do Context recém-
// carregado — todo order_book novo já nasce sabendo em que dia simulado
// nasceu, insumo que ExpireStaleOrders precisa pra nunca deixar ordem
// acumular indefinidamente.
func insertIncomingOrder(ctx context.Context, tx *sql.Tx, req orderexecution.Request, outcome orderexecution.Outcome) (string, error) {
	status := "pending"
	var cancelReason *orderexecution.CancelReason
	switch {
	case outcome.FilledQuantity >= req.Quantity:
		status = "filled"
	case outcome.FilledQuantity > 0:
		status = "partially_filled"
	case req.Type == orderbook.TypeMarket:
		// Ordem a mercado nunca fica pendurada esperando contraparte (RF04,
		// tarefa A.2) — sem nenhum fill real, a sobra não vai executar
		// depois (loadRestingOrders só lê type = 'limit'), então "pending"
		// seria enganoso pra sempre; 'cancelled' reflete que já está
		// definitivamente resolvida, com cancel_reason = no_liquidity
		// (tarefa O.3) marcando a causa pra tela "Minhas Ordens" (O.4).
		status = "cancelled"
		reason := orderexecution.CancelReasonNoLiquidity
		cancelReason = &reason
	}

	price := req.Price
	if req.Type == orderbook.TypeMarket {
		price = weightedAveragePrice(outcome.Fills)
	}

	var cancelReasonParam *string
	if cancelReason != nil {
		r := string(*cancelReason)
		cancelReasonParam = &r
	}

	var orderID string
	err := tx.QueryRowContext(ctx,
		`INSERT INTO order_book (asset_id, user_id, type, side, quantity, filled_quantity, price, status, simulated_day, cancel_reason)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 RETURNING id`,
		req.AssetID, req.UserID, req.Type, req.Side, req.Quantity, outcome.FilledQuantity, price, status, req.SimulatedDay, cancelReasonParam,
	).Scan(&orderID)
	return orderID, err
}

func weightedAveragePrice(fills []orderexecution.Fill) float64 {
	var totalCost float64
	var totalQuantity int
	for _, f := range fills {
		totalCost += f.Price * float64(f.Quantity)
		totalQuantity += f.Quantity
	}
	if totalQuantity == 0 {
		return 0
	}
	return totalCost / float64(totalQuantity)
}
