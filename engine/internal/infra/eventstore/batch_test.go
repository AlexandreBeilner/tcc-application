package eventstore

import (
	"context"
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain"
)

func batchEvent(user string, eventType domain.MarketEventType, asset *string, qty *int, unit *float64) domain.MarketEvent {
	return domain.MarketEvent{UserID: user, AssetID: asset, EventType: eventType, Quantity: qty, UnitValue: unit}
}

// Lote vazio é no-op (não chega a usar a transação).
func TestAppendBatchTx_LoteVazioENoOp(t *testing.T) {
	if err := AppendBatchTx(context.Background(), nil, nil); err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
}

// Lote inválido é rejeitado antes de qualquer SQL, sem gravar nada.
func TestAppendBatchTx_RejeitaLoteInvalido(t *testing.T) {
	asset, qty, unit := "a1", 10, 1.5
	valid := batchEvent("u1", domain.EventDividendPayment, &asset, &qty, &unit)

	tests := map[string][]domain.MarketEvent{
		"tipos diferentes": {valid, batchEvent("u2", domain.EventBuyOrderExecuted, &asset, &qty, &unit)},
		"sem ativo":        {valid, batchEvent("u2", domain.EventDividendPayment, nil, &qty, &unit)},
		"sem quantidade":   {valid, batchEvent("u2", domain.EventDividendPayment, &asset, nil, &unit)},
		"sem valor":        {valid, batchEvent("u2", domain.EventDividendPayment, &asset, &qty, nil)},
	}
	for name, events := range tests {
		t.Run(name, func(t *testing.T) {
			if err := AppendBatchTx(context.Background(), nil, events); !errors.Is(err, ErrInvalidBatch) {
				t.Errorf("err = %v, want ErrInvalidBatch", err)
			}
		})
	}
}
