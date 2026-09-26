package db

import (
	"context"
	"database/sql"
	"errors"
	"sort"

	"tcc-investimentos/engine/internal/domain"
	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/domain/orderbook"
	"tcc-investimentos/engine/internal/domain/position"
	"tcc-investimentos/engine/internal/infra/eventstore"
)

// ETFShareRepository implementa etf.ShareExchanger (tarefa R.2): criação e
// resgate de cotas de ETF em espécie, numa única transação.
type ETFShareRepository struct {
	db *sql.DB
}

func NewETFShareRepository(db *sql.DB) *ETFShareRepository {
	return &ETFShareRepository{db: db}
}

var (
	_ etf.ShareExchanger  = (*ETFShareRepository)(nil)
	_ etf.ShareTransferer = (*ETFShareRepository)(nil)
)

// Create: o participante entrega a cesta ao fundo e recebe cotas novas
// (outstanding_shares sobe).
func (r *ETFShareRepository) Create(ctx context.Context, exchange etf.ShareExchange) error {
	return r.run(ctx, exchange, true)
}

// Redeem: o participante devolve cotas e recebe a cesta do fundo
// (outstanding_shares desce).
func (r *ETFShareRepository) Redeem(ctx context.Context, exchange etf.ShareExchange) error {
	return r.run(ctx, exchange, false)
}

// run grava os eventos etf_creation/etf_redemption ANTES de projetar posições e
// cotas (Event Sourcing, CLAUDE.md), tudo na mesma transação. Cada evento leva
// a quantidade COM SINAL igual ao delta da posição daquela conta naquele ativo
// (participante perde constituinte e ganha cota na criação; o fundo ganha
// constituinte), então a posição de qualquer conta continua reconstruível
// somando os eventos. Nenhum caixa se move: a troca é em espécie. Qualquer falha
// (participante sem a cesta, sem as cotas, float violado, cotas em posições
// diferentes de outstanding_shares) aborta tudo, sem criação pela metade.
func (r *ETFShareRepository) run(ctx context.Context, exchange etf.ShareExchange, creation bool) error {
	if err := exchange.Validate(); err != nil {
		return err
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	// Trava o ETF: criações e resgates do mesmo fundo se serializam.
	var fundAccountID sql.NullString
	var outstanding sql.NullInt64
	err = tx.QueryRowContext(ctx,
		`SELECT ed.fund_account_id, via.outstanding_shares
		 FROM etf_details ed JOIN variable_income_assets via ON via.asset_id = ed.asset_id
		 WHERE ed.asset_id = $1 FOR UPDATE OF via`, exchange.ETFAssetID,
	).Scan(&fundAccountID, &outstanding)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && !fundAccountID.Valid) {
		return etf.ErrETFNotFound
	}
	if err != nil {
		return err
	}
	if fundAccountID.String != exchange.FundAccountID {
		return etf.ErrWrongFundAccount
	}

	basket := append([]etf.BasketLeg(nil), exchange.Basket...)
	sort.Slice(basket, func(i, j int) bool { return basket[i].AssetID < basket[j].AssetID })

	eventType := domain.EventETFCreation
	participantSide, fundSide, shareSide := orderbook.SideSell, orderbook.SideBuy, orderbook.SideBuy
	shareDelta := exchange.Shares
	if !creation {
		eventType = domain.EventETFRedemption
		participantSide, fundSide, shareSide = orderbook.SideBuy, orderbook.SideSell, orderbook.SideSell
		shareDelta = -exchange.Shares
	}

	for _, leg := range basket {
		if err := appendExchangeEvents(ctx, tx, eventType, leg.AssetID, leg.Price, []signedQuantity{
			{exchange.ParticipantAccountID, sideSign(participantSide) * leg.Quantity},
			{exchange.FundAccountID, sideSign(fundSide) * leg.Quantity},
		}); err != nil {
			return err
		}
	}
	if err := appendExchangeEvents(ctx, tx, eventType, exchange.ETFAssetID, exchange.SharePrice, []signedQuantity{
		{exchange.ParticipantAccountID, shareDelta},
	}); err != nil {
		return err
	}

	for _, leg := range basket {
		if err := applyPositionFill(ctx, tx, exchange.ParticipantAccountID, leg.AssetID, participantSide, int(leg.Quantity), leg.Price); err != nil {
			return mapFundsViolation(err)
		}
		if err := applyPositionFill(ctx, tx, exchange.FundAccountID, leg.AssetID, fundSide, int(leg.Quantity), leg.Price); err != nil {
			return mapFundsViolation(err)
		}
		if err := validateConstituentFloat(ctx, tx, leg.AssetID); err != nil {
			return err
		}
	}
	if err := applyPositionFill(ctx, tx, exchange.ParticipantAccountID, exchange.ETFAssetID, shareSide, int(exchange.Shares), exchange.SharePrice); err != nil {
		return mapFundsViolation(err)
	}

	newOutstanding := outstanding.Int64 + shareDelta
	if newOutstanding < 0 {
		return position.ErrInsufficientQuantity
	}
	if _, err := tx.ExecContext(ctx,
		`UPDATE variable_income_assets SET outstanding_shares = $2 WHERE asset_id = $1`, exchange.ETFAssetID, newOutstanding,
	); err != nil {
		return err
	}

	var totalShares sql.NullInt64
	if err := tx.QueryRowContext(ctx, `SELECT SUM(quantity) FROM positions WHERE asset_id = $1`, exchange.ETFAssetID).Scan(&totalShares); err != nil {
		return err
	}
	if err := position.ValidateFloatCeiling(totalShares.Int64, newOutstanding); err != nil {
		return err
	}
	if totalShares.Int64 != newOutstanding {
		return etf.ErrShareConservation
	}

	return tx.Commit()
}

type signedQuantity struct {
	userID   string
	quantity int64
}

func sideSign(side orderbook.Side) int64 {
	if side == orderbook.SideBuy {
		return 1
	}
	return -1
}

func appendExchangeEvents(ctx context.Context, tx *sql.Tx, eventType domain.MarketEventType, assetID string, price float64, deltas []signedQuantity) error {
	for _, d := range deltas {
		quantity := int(d.quantity)
		if err := eventstore.AppendTx(ctx, tx, domain.MarketEvent{
			UserID:    d.userID,
			AssetID:   &assetID,
			EventType: eventType,
			Quantity:  &quantity,
			UnitValue: &price,
		}); err != nil {
			return err
		}
	}
	return nil
}

// validateConstituentFloat confere o teto de float (A.3) do constituinte
// depois da troca; ativo sem outstanding_shares (NULL) fica de fora, como na
// execução de ordens.
func validateConstituentFloat(ctx context.Context, tx *sql.Tx, assetID string) error {
	var outstanding sql.NullInt64
	if err := tx.QueryRowContext(ctx,
		`SELECT outstanding_shares FROM variable_income_assets WHERE asset_id = $1`, assetID,
	).Scan(&outstanding); err != nil {
		return err
	}
	if !outstanding.Valid {
		return nil
	}
	var held sql.NullInt64
	if err := tx.QueryRowContext(ctx, `SELECT SUM(quantity) FROM positions WHERE asset_id = $1`, assetID).Scan(&held); err != nil {
		return err
	}
	return position.ValidateFloatCeiling(held.Int64, outstanding.Int64)
}

// Transfer move cotas de uma conta para outra (tarefa R.4), numa transação:
// trava o ETF, grava os eventos etf_share_transfer (quantidade com sinal) antes
// de projetar as posições e confere que o total de cotas em posições continua
// igual a outstanding_shares. Quem entrega sem as cotas aborta tudo.
func (r *ETFShareRepository) Transfer(ctx context.Context, transfer etf.ShareTransfer) error {
	if err := transfer.Validate(); err != nil {
		return err
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var outstanding sql.NullInt64
	err = tx.QueryRowContext(ctx,
		`SELECT outstanding_shares FROM variable_income_assets WHERE asset_id = $1 FOR UPDATE`, transfer.ETFAssetID,
	).Scan(&outstanding)
	if errors.Is(err, sql.ErrNoRows) {
		return etf.ErrETFNotFound
	}
	if err != nil {
		return err
	}

	if err := appendExchangeEvents(ctx, tx, domain.EventETFShareTransfer, transfer.ETFAssetID, transfer.Price, []signedQuantity{
		{transfer.FromAccountID, -transfer.Quantity},
		{transfer.ToAccountID, transfer.Quantity},
	}); err != nil {
		return err
	}
	if err := applyPositionFill(ctx, tx, transfer.FromAccountID, transfer.ETFAssetID, orderbook.SideSell, int(transfer.Quantity), transfer.Price); err != nil {
		return mapFundsViolation(err)
	}
	if err := applyPositionFill(ctx, tx, transfer.ToAccountID, transfer.ETFAssetID, orderbook.SideBuy, int(transfer.Quantity), transfer.Price); err != nil {
		return mapFundsViolation(err)
	}

	var total sql.NullInt64
	if err := tx.QueryRowContext(ctx, `SELECT SUM(quantity) FROM positions WHERE asset_id = $1`, transfer.ETFAssetID).Scan(&total); err != nil {
		return err
	}
	if total.Int64 != outstanding.Int64 {
		return etf.ErrShareConservation
	}
	return tx.Commit()
}
