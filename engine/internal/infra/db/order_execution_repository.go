package db

import (
	"context"
	"database/sql"
	"errors"

	"tcc-investimentos/engine/internal/domain"
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
	var balance float64
	if err := r.db.QueryRowContext(ctx,
		`SELECT current_balance FROM accounts WHERE user_id = $1`, userID,
	).Scan(&balance); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return orderexecution.Context{}, orderexecution.ErrAccountNotFound
		}
		return orderexecution.Context{}, err
	}

	var positionQty int
	var positionCreatedAt sql.NullTime
	if err := r.db.QueryRowContext(ctx,
		`SELECT quantity, created_at FROM positions WHERE user_id = $1 AND asset_id = $2`, userID, assetID,
	).Scan(&positionQty, &positionCreatedAt); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return orderexecution.Context{}, err
	}

	referencePrice, isSandbox, err := r.referencePrice(ctx, assetID, positionQty, positionCreatedAt)
	if err != nil {
		return orderexecution.Context{}, err
	}

	resting, err := r.loadRestingOrders(ctx, assetID)
	if err != nil {
		return orderexecution.Context{}, err
	}

	return orderexecution.Context{
		ReferencePrice:       referencePrice,
		Resting:              resting,
		IncomingUserBalance:  balance,
		IncomingUserPosition: positionQty,
		Sandbox:              isSandbox,
	}, nil
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
func (r *OrderExecutionRepository) referencePrice(ctx context.Context, assetID string, positionQty int, positionCreatedAt sql.NullTime) (float64, bool, error) {
	var ticker string
	var isSandbox bool
	if err := r.db.QueryRowContext(ctx,
		`SELECT ticker, is_sandbox FROM assets WHERE id = $1`, assetID,
	).Scan(&ticker, &isSandbox); err != nil {
		return 0, false, err
	}

	if isSandbox {
		script, ok := sandbox.PriceScriptForTicker(ticker)
		if !ok {
			return 0, false, ErrSandboxScriptNotFound
		}
		return sandbox.PriceOnDay(script, sandboxDayIndex(positionCreatedAt, float64(positionQty))), true, nil
	}

	// Cache de leitura (tarefa 5.7) — mesma última cotação que
	// CatalogRepository.FindCurrentQuote/TickRepository.SaveTick mantêm
	// quente; aqui só o Price importa, DailyChangePct é ignorado.
	quote, found, err := cachedQuote(ctx, r.cache, assetID, r.loadLatestQuoteFromPostgres)
	if err != nil {
		return 0, false, err
	}
	if !found {
		return tick.DefaultInitialPrice, false, nil
	}
	return quote.Price, false, nil
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
func (r *OrderExecutionRepository) Persist(ctx context.Context, req orderexecution.Request, outcome orderexecution.Outcome) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	for _, fill := range outcome.Fills {
		if err := applyFillSide(ctx, tx, req.AssetID, req.UserID, req.Side, fill.Quantity, fill.Price); err != nil {
			return err
		}
		if !fill.IsSynthetic() {
			counterpartySide := orderbook.SideSell
			if req.Side == orderbook.SideSell {
				counterpartySide = orderbook.SideBuy
			}
			if err := applyFillSide(ctx, tx, req.AssetID, fill.CounterpartyUserID, counterpartySide, fill.Quantity, fill.Price); err != nil {
				return err
			}
			if err := fillRestingOrder(ctx, tx, fill.CounterpartyOrderID, fill.Quantity); err != nil {
				return err
			}
		}
	}

	if err := insertIncomingOrder(ctx, tx, req, outcome); err != nil {
		return err
	}

	return tx.Commit()
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
// quantity (original) já está na mesma linha.
func fillRestingOrder(ctx context.Context, tx *sql.Tx, orderID string, quantity int) error {
	_, err := tx.ExecContext(ctx,
		`UPDATE order_book SET
		   filled_quantity = filled_quantity + $1,
		   status = (CASE WHEN filled_quantity + $1 >= quantity THEN 'filled' ELSE 'partially_filled' END)::order_status
		 WHERE id = $2`,
		quantity, orderID,
	)
	return err
}

// insertIncomingOrder grava a ordem recebida como uma nova linha de
// order_book. Price é o limite informado pelo usuário pra ordem limitada;
// pra ordem a mercado (sem preço próprio — Type == market ignora Price,
// orderbook.go) é o preço médio ponderado de execução, porque a coluna é
// NOT NULL e não existe "o preço" de uma ordem a mercado antes de executar.
func insertIncomingOrder(ctx context.Context, tx *sql.Tx, req orderexecution.Request, outcome orderexecution.Outcome) error {
	status := "pending"
	switch {
	case outcome.FilledQuantity >= req.Quantity:
		status = "filled"
	case outcome.FilledQuantity > 0:
		status = "partially_filled"
	}

	price := req.Price
	if req.Type == orderbook.TypeMarket {
		price = weightedAveragePrice(outcome.Fills)
	}

	_, err := tx.ExecContext(ctx,
		`INSERT INTO order_book (asset_id, user_id, type, side, quantity, filled_quantity, price, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		req.AssetID, req.UserID, req.Type, req.Side, req.Quantity, outcome.FilledQuantity, price, status,
	)
	return err
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
