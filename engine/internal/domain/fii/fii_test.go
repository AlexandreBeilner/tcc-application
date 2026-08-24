package fii

import (
	"errors"
	"testing"
)

func ptr[T any](v T) *T { return &v }

func TestNewDetails_TijoloValido(t *testing.T) {
	got, err := NewDetails(TypeTijolo, ptr("Shopping"), ptr(500_000_000.0), ptr(5.5), nil, nil)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if got.Type != TypeTijolo {
		t.Errorf("Type = %v, want %v", got.Type, TypeTijolo)
	}
	if got.Indexador != nil {
		t.Errorf("Indexador = %v, want nil", got.Indexador)
	}
	if got.PortfolioValue != nil {
		t.Errorf("PortfolioValue = %v, want nil", got.PortfolioValue)
	}
}

func TestNewDetails_PapelValido(t *testing.T) {
	got, err := NewDetails(TypePapel, nil, nil, nil, ptr("IPCA+"), ptr(300_000_000.0))
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if got.Type != TypePapel {
		t.Errorf("Type = %v, want %v", got.Type, TypePapel)
	}
	if got.VacancyRate != nil {
		t.Errorf("VacancyRate = %v, want nil", got.VacancyRate)
	}
	if got.NetWorth != nil {
		t.Errorf("NetWorth = %v, want nil", got.NetWorth)
	}
	if got.PortfolioValue == nil || *got.PortfolioValue != 300_000_000.0 {
		t.Errorf("PortfolioValue = %v, want 300_000_000.0", got.PortfolioValue)
	}
}

func TestNewDetails_TijoloComIndexadorPreenchidoEhRejeitado(t *testing.T) {
	_, err := NewDetails(TypeTijolo, ptr("Logístico"), ptr(500_000_000.0), ptr(5.5), ptr("CDI"), nil)
	if !errors.Is(err, ErrTijoloComIndexador) {
		t.Errorf("err = %v, want ErrTijoloComIndexador", err)
	}
}

func TestNewDetails_TijoloComPortfolioValuePreenchidoEhRejeitado(t *testing.T) {
	_, err := NewDetails(TypeTijolo, ptr("Logístico"), ptr(500_000_000.0), ptr(5.5), nil, ptr(300_000_000.0))
	if !errors.Is(err, ErrTijoloComPortfolioValue) {
		t.Errorf("err = %v, want ErrTijoloComPortfolioValue", err)
	}
}

func TestNewDetails_PapelComVacancyRatePreenchidaEhRejeitado(t *testing.T) {
	_, err := NewDetails(TypePapel, nil, nil, ptr(2.0), ptr("CDI"), ptr(300_000_000.0))
	if !errors.Is(err, ErrPapelComVacancyRate) {
		t.Errorf("err = %v, want ErrPapelComVacancyRate", err)
	}
}

func TestNewDetails_PapelComNetWorthPreenchidoEhRejeitado(t *testing.T) {
	_, err := NewDetails(TypePapel, nil, ptr(300_000_000.0), nil, ptr("CDI"), ptr(300_000_000.0))
	if !errors.Is(err, ErrPapelComNetWorth) {
		t.Errorf("err = %v, want ErrPapelComNetWorth", err)
	}
}

func TestNewDetails_TijoloSemSegmentoNemPatrimonioAindaEhValido(t *testing.T) {
	// Segment/NetWorth não são exigidos por perfil (nem o schema, nem o
	// critério de aceite desta tarefa obrigam) — só a exclusividade
	// mútua de VacancyRate/Indexador e NetWorth/PortfolioValue importa.
	_, err := NewDetails(TypeTijolo, nil, nil, nil, nil, nil)
	if err != nil {
		t.Errorf("err = %v, want nil", err)
	}
}

func TestNewDetails_TipoDesconhecido(t *testing.T) {
	_, err := NewDetails(Type("galpao"), nil, nil, nil, nil, nil)
	if !errors.Is(err, ErrUnknownType) {
		t.Errorf("err = %v, want ErrUnknownType", err)
	}
}
