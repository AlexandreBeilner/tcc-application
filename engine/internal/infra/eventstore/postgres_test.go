package eventstore

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain"
)

type fakeExecer struct {
	query string
	args  []any
	err   error
}

func (f *fakeExecer) ExecContext(_ context.Context, query string, args ...any) (sql.Result, error) {
	f.query = query
	f.args = args
	return nil, f.err
}

func TestAppendEvent(t *testing.T) {
	assetID := "asset-1"
	quantity := 10
	unitValue := 25.50
	assembly := "assembly-1"

	ex := &fakeExecer{}
	event := domain.MarketEvent{
		UserID:    "user-1",
		AssetID:   &assetID,
		EventType: domain.EventBuyOrderExecuted,
		Quantity:  &quantity,
		UnitValue: &unitValue,
		// ReferenceID (MO.6.2) segue o evento até a coluna reference_id.
		ReferenceID: &assembly,
	}

	if err := appendEvent(context.Background(), ex, event); err != nil {
		t.Fatalf("appendEvent() erro inesperado: %v", err)
	}

	if ex.query != insertEventSQL {
		t.Errorf("query = %q, want %q", ex.query, insertEventSQL)
	}
	want := []any{event.UserID, event.AssetID, event.EventType, event.Quantity, event.UnitValue, event.ReferenceMonth, event.ReferenceID}
	if len(ex.args) != len(want) {
		t.Fatalf("args = %+v, want %+v", ex.args, want)
	}
	for i := range want {
		if ex.args[i] != want[i] {
			t.Errorf("args[%d] = %v, want %v", i, ex.args[i], want[i])
		}
	}
}

func TestAppendEvent_PropagaErro(t *testing.T) {
	wantErr := errors.New("falha de conexão")
	ex := &fakeExecer{err: wantErr}

	err := appendEvent(context.Background(), ex, domain.MarketEvent{UserID: "user-1", EventType: domain.EventInitialDeposit})
	if !errors.Is(err, wantErr) {
		t.Errorf("err = %v, want %v", err, wantErr)
	}
}
