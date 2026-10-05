package tradinghalt

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestNewHalt(t *testing.T) {
	long := strings.Repeat("x", MaxReasonLength+1)
	tests := []struct {
		name    string
		scope   Scope
		assetID string
		reason  string
		wantErr error
	}{
		{"global válida", ScopeGlobal, "", "manutenção", nil},
		{"ativo válida", ScopeAsset, "a1", "volatilidade", nil},
		{"escopo inválido", Scope("x"), "", "m", ErrInvalidScope},
		{"ativo sem asset_id", ScopeAsset, "", "m", ErrAssetRequired},
		{"global com asset_id", ScopeGlobal, "a1", "m", ErrAssetNotAllowed},
		{"motivo vazio", ScopeGlobal, "", "   ", ErrReasonRequired},
		{"motivo longo demais", ScopeGlobal, "", long, ErrReasonTooLong},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			halt, err := NewHalt(tt.scope, tt.assetID, tt.reason, "admin-1")
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if err == nil && (halt.CreatedBy != "admin-1" || halt.Reason != strings.TrimSpace(tt.reason)) {
				t.Errorf("halt = %+v", halt)
			}
		})
	}
}

func TestBlocking_AMaisRestritivaVence(t *testing.T) {
	a1, a2 := "a1", "a2"
	lifted := time.Now()
	global := Halt{ID: "g", Scope: ScopeGlobal}
	onA1 := Halt{ID: "h1", Scope: ScopeAsset, AssetID: &a1}
	tests := []struct {
		name    string
		active  []Halt
		assetID string
		wantID  string
	}{
		{"sem pausa", nil, "a1", ""},
		{"pausa do ativo barra o ativo", []Halt{onA1}, "a1", "h1"},
		{"pausa do ativo não barra outro", []Halt{onA1}, "a2", ""},
		{"global barra qualquer ativo", []Halt{global}, a2, "g"},
		{"global e ativo: a global vence", []Halt{onA1, global}, "a1", "g"},
		{"pausa encerrada não barra", []Halt{{ID: "old", Scope: ScopeGlobal, LiftedAt: &lifted}}, "a1", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Blocking(tt.active, tt.assetID)
			switch {
			case tt.wantID == "" && got != nil:
				t.Errorf("Blocking = %+v, want nil", got)
			case tt.wantID != "" && (got == nil || got.ID != tt.wantID):
				t.Errorf("Blocking = %+v, want %s", got, tt.wantID)
			}
		})
	}
}

type fakeRepo struct {
	inserted           Halt
	insertErr          error
	liftedID, liftedBy string
	liftErr            error
	active, recent     []Halt
}

func (f *fakeRepo) Insert(_ context.Context, h Halt) (Halt, error) {
	f.inserted = h
	h.ID = "new"
	return h, f.insertErr
}

func (f *fakeRepo) Lift(_ context.Context, id, by string) (Halt, error) {
	f.liftedID, f.liftedBy = id, by
	return Halt{ID: id}, f.liftErr
}

func (f *fakeRepo) Active(context.Context) ([]Halt, error)      { return f.active, nil }
func (f *fakeRepo) Recent(context.Context, int) ([]Halt, error) { return f.recent, nil }

func TestService_Pause_ValidaAntesDeGravar(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo)
	if _, err := svc.Pause(context.Background(), ScopeAsset, "", "m", "admin"); !errors.Is(err, ErrAssetRequired) {
		t.Fatalf("err = %v, want ErrAssetRequired", err)
	}
	if repo.inserted.CreatedBy != "" {
		t.Error("o repositório não devia ser chamado com pausa inválida")
	}
	halt, err := svc.Pause(context.Background(), ScopeGlobal, "", "manutenção", "admin")
	if err != nil || halt.ID != "new" || repo.inserted.Scope != ScopeGlobal {
		t.Errorf("halt = %+v err = %v", halt, err)
	}
}

func TestService_Pause_PropagaPausaDuplicada(t *testing.T) {
	svc := NewService(&fakeRepo{insertErr: ErrAlreadyHalted})
	if _, err := svc.Pause(context.Background(), ScopeGlobal, "", "m", "admin"); !errors.Is(err, ErrAlreadyHalted) {
		t.Errorf("err = %v, want ErrAlreadyHalted", err)
	}
}

func TestService_Lift_RepassaIdEAdmin(t *testing.T) {
	repo := &fakeRepo{}
	if _, err := NewService(repo).Lift(context.Background(), "h1", "admin-2"); err != nil {
		t.Fatal(err)
	}
	if repo.liftedID != "h1" || repo.liftedBy != "admin-2" {
		t.Errorf("lift = %s/%s", repo.liftedID, repo.liftedBy)
	}
}

func TestService_Status_ResumeSemMotivoNemAutor(t *testing.T) {
	a1 := "a1"
	repo := &fakeRepo{active: []Halt{
		{Scope: ScopeAsset, AssetID: &a1, Reason: "interno"},
		{Scope: ScopeGlobal, Reason: "interno"},
	}}
	status, err := NewService(repo).Status(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !status.Global || len(status.AssetIDs) != 1 || status.AssetIDs[0] != "a1" {
		t.Errorf("status = %+v", status)
	}
	empty, _ := NewService(&fakeRepo{}).Status(context.Background())
	if empty.Global || empty.AssetIDs == nil || len(empty.AssetIDs) != 0 {
		t.Errorf("sem pausas = %+v, want global false e lista vazia (não nil)", empty)
	}
}

func TestService_List_JuntaVigentesEHistorico(t *testing.T) {
	repo := &fakeRepo{active: []Halt{{ID: "a"}}, recent: []Halt{{ID: "r"}}}
	listing, err := NewService(repo).List(context.Background())
	if err != nil || len(listing.Active) != 1 || len(listing.Recent) != 1 {
		t.Errorf("listing = %+v err = %v", listing, err)
	}
}
