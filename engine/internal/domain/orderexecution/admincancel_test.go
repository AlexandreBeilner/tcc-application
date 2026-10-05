package orderexecution

import (
	"context"
	"errors"
	"testing"
)

type fakeAdminRepository struct {
	cancelledID string
	cancelErr   error
	batchFilter CancelFilter
	batchMax    int
	batchIDs    []string
	batchErr    error
	batchCalled bool
}

func (f *fakeAdminRepository) AdminCancelOrder(_ context.Context, orderID string) error {
	f.cancelledID = orderID
	return f.cancelErr
}

func (f *fakeAdminRepository) AdminCancelBatch(_ context.Context, filter CancelFilter, max int) ([]string, error) {
	f.batchCalled = true
	f.batchFilter, f.batchMax = filter, max
	return f.batchIDs, f.batchErr
}

func TestAdminService_Cancel_RepassaOIdESuasFalhas(t *testing.T) {
	tests := []struct {
		name string
		err  error
	}{
		{"sucesso", nil},
		{"ordem inexistente", ErrOrderNotFound},
		{"ordem já executada ou cancelada", ErrOrderNotCancellable},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeAdminRepository{cancelErr: tt.err}
			err := NewAdminService(repo).Cancel(context.Background(), "ord-1")
			if !errors.Is(err, tt.err) {
				t.Errorf("Cancel err = %v, want %v", err, tt.err)
			}
			if repo.cancelledID != "ord-1" {
				t.Errorf("id repassado = %q, want ord-1", repo.cancelledID)
			}
		})
	}
}

func TestAdminService_CancelBatch(t *testing.T) {
	tests := []struct {
		name       string
		filter     CancelFilter
		wantCalled bool
		wantErr    error
	}{
		{"por ativo", CancelFilter{AssetID: "a"}, true, nil},
		{"por dono", CancelFilter{UserID: "u"}, true, nil},
		{"dono e ativo", CancelFilter{AssetID: "a", UserID: "u"}, true, nil},
		{"filtro vazio é recusado", CancelFilter{}, false, ErrCancelFilterRequired},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeAdminRepository{batchIDs: []string{"x", "y"}}
			ids, err := NewAdminService(repo).CancelBatch(context.Background(), tt.filter)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if repo.batchCalled != tt.wantCalled {
				t.Errorf("repositório chamado = %v, want %v", repo.batchCalled, tt.wantCalled)
			}
			if tt.wantCalled {
				if repo.batchMax != MaxAdminCancelBatch || len(ids) != 2 {
					t.Errorf("max = %d ids = %v, want teto %d e 2 ids", repo.batchMax, ids, MaxAdminCancelBatch)
				}
			}
		})
	}
}

func TestBatchTooLargeError_DizQuantasOrdensEOTeto(t *testing.T) {
	err := error(&BatchTooLargeError{Matched: 501, Max: 500})
	var target *BatchTooLargeError
	if !errors.As(err, &target) || target.Matched != 501 {
		t.Fatalf("errors.As falhou: %v", err)
	}
	if got := err.Error(); got != "o filtro atinge 501 ordens, acima do teto de 500 por lote" {
		t.Errorf("mensagem = %q", got)
	}
}
