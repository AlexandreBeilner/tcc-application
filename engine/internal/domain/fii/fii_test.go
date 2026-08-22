package fii

import (
	"errors"
	"testing"
)

func ptr[T any](v T) *T { return &v }

func TestNewDetails_TijoloValido(t *testing.T) {
	got, err := NewDetails(TypeTijolo, ptr("Shopping"), ptr(500_000_000.0), ptr(5.5), nil)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if got.Type != TypeTijolo {
		t.Errorf("Type = %v, want %v", got.Type, TypeTijolo)
	}
	if got.Indexador != nil {
		t.Errorf("Indexador = %v, want nil", got.Indexador)
	}
}

func TestNewDetails_PapelValido(t *testing.T) {
	got, err := NewDetails(TypePapel, nil, ptr(300_000_000.0), nil, ptr("IPCA+"))
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if got.Type != TypePapel {
		t.Errorf("Type = %v, want %v", got.Type, TypePapel)
	}
	if got.VacancyRate != nil {
		t.Errorf("VacancyRate = %v, want nil", got.VacancyRate)
	}
}

func TestNewDetails_TijoloComIndexadorPreenchidoEhRejeitado(t *testing.T) {
	_, err := NewDetails(TypeTijolo, ptr("Logístico"), ptr(500_000_000.0), ptr(5.5), ptr("CDI"))
	if !errors.Is(err, ErrTijoloComIndexador) {
		t.Errorf("err = %v, want ErrTijoloComIndexador", err)
	}
}

func TestNewDetails_PapelComVacancyRatePreenchidaEhRejeitado(t *testing.T) {
	_, err := NewDetails(TypePapel, nil, ptr(300_000_000.0), ptr(2.0), ptr("CDI"))
	if !errors.Is(err, ErrPapelComVacancyRate) {
		t.Errorf("err = %v, want ErrPapelComVacancyRate", err)
	}
}

func TestNewDetails_TijoloSemSegmentoNemPatrimonioAindaEhValido(t *testing.T) {
	// Segment/NetWorth não são exigidos por perfil (nem o schema, nem o
	// critério de aceite desta tarefa obrigam) — só a exclusividade
	// mútua de VacancyRate/Indexador importa.
	_, err := NewDetails(TypeTijolo, nil, nil, nil, nil)
	if err != nil {
		t.Errorf("err = %v, want nil", err)
	}
}

func TestNewDetails_TipoDesconhecido(t *testing.T) {
	_, err := NewDetails(Type("galpao"), nil, nil, nil, nil)
	if !errors.Is(err, ErrUnknownType) {
		t.Errorf("err = %v, want ErrUnknownType", err)
	}
}
