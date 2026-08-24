package macroevent

import (
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
)

func ptr[T any](v T) *T { return &v }

func validTarget(t *testing.T) Target {
	t.Helper()
	tg, err := NewTarget(nil, ptr("Conservador"), nil, MetricPrice)
	if err != nil {
		t.Fatalf("target de apoio inválido: %v", err)
	}
	return tg
}

func TestNewTarget_ExclusividadeDeEscopo(t *testing.T) {
	sector := catalog.SectorMineracao

	tests := []struct {
		name      string
		sector    *catalog.Sector
		riskClass *string
		assetID   *string
		wantErr   error
	}{
		{"só setor", &sector, nil, nil, nil},
		{"só risk_class", nil, ptr("Conservador"), nil, nil},
		{"só ativo", nil, nil, ptr("asset-1"), nil},
		{"nenhum preenchido", nil, nil, nil, ErrTargetScopeAmbiguous},
		{"setor e risk_class preenchidos", &sector, ptr("Conservador"), nil, ErrTargetScopeAmbiguous},
		{"setor e ativo preenchidos", &sector, nil, ptr("asset-1"), ErrTargetScopeAmbiguous},
		{"os três preenchidos", &sector, ptr("Conservador"), ptr("asset-1"), ErrTargetScopeAmbiguous},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NewTarget(tt.sector, tt.riskClass, tt.assetID, MetricPrice)
			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("err = %v, want %v", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("err = %v, want nil", err)
			}
			if got.AffectedMetric != MetricPrice {
				t.Errorf("AffectedMetric = %v, want %v", got.AffectedMetric, MetricPrice)
			}
		})
	}
}

func TestNewEvent_TituloObrigatorio(t *testing.T) {
	_, err := NewEvent(nil, "", "narrativa", DirectionNegativo, BandLeve, true, false, []Target{validTarget(t)}, nil)
	if !errors.Is(err, ErrMissingTitle) {
		t.Errorf("err = %v, want %v", err, ErrMissingTitle)
	}
}

func TestNewEvent_NarrativaObrigatoria(t *testing.T) {
	_, err := NewEvent(nil, "título", "", DirectionNegativo, BandLeve, true, false, []Target{validTarget(t)}, nil)
	if !errors.Is(err, ErrMissingNarrative) {
		t.Errorf("err = %v, want %v", err, ErrMissingNarrative)
	}
}

func TestNewEvent_SemNenhumEfeitoHabilitadoEhRejeitado(t *testing.T) {
	_, err := NewEvent(nil, "título", "narrativa", DirectionNegativo, BandLeve, false, false, []Target{validTarget(t)}, nil)
	if !errors.Is(err, ErrNoEffectEnabled) {
		t.Errorf("err = %v, want %v", err, ErrNoEffectEnabled)
	}
}

func TestNewEvent_SemNenhumAlvoEhRejeitado(t *testing.T) {
	_, err := NewEvent(nil, "título", "narrativa", DirectionNegativo, BandLeve, true, false, nil, nil)
	if !errors.Is(err, ErrNoTarget) {
		t.Errorf("err = %v, want %v", err, ErrNoTarget)
	}
}

func TestNewEvent_ValidoComecaPendente(t *testing.T) {
	evt, err := NewEvent(ptr("crise-cambial"), "título", "narrativa", DirectionMisto, BandModerado, true, true, []Target{validTarget(t)}, ptr("admin-1"))
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if evt.Status != StatusPendente {
		t.Errorf("Status = %v, want %v", evt.Status, StatusPendente)
	}
	if evt.TriggeredOnDay != 0 || evt.DurationDays != 0 {
		t.Errorf("TriggeredOnDay/DurationDays = %d/%d, want 0/0 — só preenchidos no disparo (4.4)", evt.TriggeredOnDay, evt.DurationDays)
	}
	if evt.PriceEffectPct != nil || evt.FundamentalsEffectPct != nil || evt.FundamentalsReportDay != nil {
		t.Errorf("efeitos amostrados deveriam ser nil num Event recém-criado")
	}
}

// TestNewEvent_TresEscoposDeAlvo cobre o critério de aceite "um evento
// pode mirar setor, empresa específica (indiretamente, via ativo emitido
// por ela) ou ativo específico" — os três casos usando NewTarget.
func TestNewEvent_TresEscoposDeAlvo(t *testing.T) {
	sector := catalog.SectorTecnologia

	tests := []struct {
		name   string
		target func(t *testing.T) Target
	}{
		{
			name: "setor",
			target: func(t *testing.T) Target {
				tg, err := NewTarget(&sector, nil, nil, MetricPrice)
				if err != nil {
					t.Fatalf("NewTarget setor: %v", err)
				}
				return tg
			},
		},
		{
			name: "empresa específica, via asset_id emitido por ela",
			target: func(t *testing.T) Target {
				tg, err := NewTarget(nil, nil, ptr("asset-empresa-x"), MetricNetIncome)
				if err != nil {
					t.Fatalf("NewTarget empresa/ativo: %v", err)
				}
				return tg
			},
		},
		{
			name: "ativo específico",
			target: func(t *testing.T) Target {
				tg, err := NewTarget(nil, nil, ptr("asset-1"), MetricPrice)
				if err != nil {
					t.Fatalf("NewTarget ativo: %v", err)
				}
				return tg
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			evt, err := NewEvent(nil, "título", "narrativa", DirectionNegativo, BandSevero, true, false, []Target{tt.target(t)}, nil)
			if err != nil {
				t.Fatalf("err = %v, want nil", err)
			}
			if len(evt.Targets) != 1 {
				t.Fatalf("len(Targets) = %d, want 1", len(evt.Targets))
			}
		})
	}
}
