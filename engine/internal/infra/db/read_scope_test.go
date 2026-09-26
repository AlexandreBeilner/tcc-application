package db

import (
	"context"
	"database/sql"
	"errors"
	"testing"
)

func TestReadScope_CarregaUmaVezPorAtivo(t *testing.T) {
	scope := (&OrderExecutionRepository{}).WithReadScope(context.Background())
	s := scopeFrom(scope)

	loads := 0
	load := func() (assetStatic, error) {
		loads++
		return assetStatic{ticker: "VALR3", outstandingShares: sql.NullInt64{Int64: 100, Valid: true}}, nil
	}
	for i := 0; i < 5; i++ {
		st, err := s.asset("a1", load)
		if err != nil || st.ticker != "VALR3" {
			t.Fatalf("asset = %+v, %v", st, err)
		}
	}
	if loads != 1 {
		t.Errorf("loads = %d, want 1", loads)
	}
	if _, err := s.asset("a2", load); err != nil || loads != 2 {
		t.Errorf("outro ativo deveria carregar de novo: loads = %d, err = %v", loads, err)
	}
}

func TestReadScope_NaoCacheiaErro(t *testing.T) {
	s := scopeFrom((&OrderExecutionRepository{}).WithReadScope(context.Background()))
	boom := errors.New("falha")
	if _, err := s.asset("a1", func() (assetStatic, error) { return assetStatic{}, boom }); !errors.Is(err, boom) {
		t.Fatalf("err = %v", err)
	}
	if _, err := s.day(func() (int, error) { return 0, boom }); !errors.Is(err, boom) {
		t.Fatalf("err = %v", err)
	}
	loads := 0
	if st, err := s.asset("a1", func() (assetStatic, error) { loads++; return assetStatic{ticker: "X"}, nil }); err != nil || st.ticker != "X" || loads != 1 {
		t.Errorf("depois do erro deveria carregar: %+v %v loads=%d", st, err, loads)
	}
}

func TestReadScope_DiaCarregadoUmaVez(t *testing.T) {
	s := scopeFrom((&OrderExecutionRepository{}).WithReadScope(context.Background()))
	loads := 0
	for i := 0; i < 4; i++ {
		day, err := s.day(func() (int, error) { loads++; return 7, nil })
		if err != nil || day != 7 {
			t.Fatalf("day = %d, %v", day, err)
		}
	}
	if loads != 1 {
		t.Errorf("loads = %d, want 1", loads)
	}
}

// Sem escopo (requisição HTTP de usuário) nunca cacheia: cada leitura vai ao
// banco, então um usuário nunca vê dado velho de um tick anterior.
func TestReadScope_SemEscopoNaoCacheia(t *testing.T) {
	s := scopeFrom(context.Background())
	if s != nil {
		t.Fatal("contexto sem escopo deveria devolver nil")
	}
	loads := 0
	for i := 0; i < 3; i++ {
		if _, err := s.day(func() (int, error) { loads++; return 1, nil }); err != nil {
			t.Fatal(err)
		}
	}
	if loads != 3 {
		t.Errorf("loads = %d, want 3 (sem cache)", loads)
	}
}

// Dois ticks (dois escopos) nunca compartilham cache.
func TestReadScope_EscoposIndependentes(t *testing.T) {
	r := &OrderExecutionRepository{}
	a := scopeFrom(r.WithReadScope(context.Background()))
	b := scopeFrom(r.WithReadScope(context.Background()))
	if _, err := a.day(func() (int, error) { return 1, nil }); err != nil {
		t.Fatal(err)
	}
	day, _ := b.day(func() (int, error) { return 2, nil })
	if day != 2 {
		t.Errorf("segundo escopo leu %d, want 2 (cache não pode vazar entre ticks)", day)
	}
}

func TestReadScope_ForgetForcaNovaLeitura(t *testing.T) {
	s := scopeFrom((&OrderExecutionRepository{}).WithReadScope(context.Background()))
	loads := 0
	load := func() (assetStatic, error) {
		loads++
		return assetStatic{ticker: "X"}, nil
	}
	_, _ = s.asset("a", load)
	_, _ = s.asset("a", load)
	s.forget("a")
	_, _ = s.asset("a", load)
	if loads != 2 {
		t.Errorf("cargas = %d, want 2 (a segunda leitura veio do cache, a terceira depois do forget)", loads)
	}
	var none *readScope
	none.forget("a") // sem escopo não faz nada nem entra em pânico
}
