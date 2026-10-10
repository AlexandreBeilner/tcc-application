package macroevent

import (
	"errors"
	"testing"
)

func TestValidateApplyDay(t *testing.T) {
	tests := []struct {
		name    string
		apply   int
		current int
		want    error
	}{
		{"amanhã é o primeiro dia válido", 101, 100, nil},
		{"hoje já passou", 100, 100, ErrApplyDayInPast},
		{"ontem", 99, 100, ErrApplyDayInPast},
		{"no teto", 100 + MaxScheduleAheadDays, 100, nil},
		{"além do teto", 101 + MaxScheduleAheadDays, 100, ErrApplyDayTooFar},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ValidateApplyDay(tt.apply, tt.current); !errors.Is(got, tt.want) {
				t.Errorf("ValidateApplyDay(%d, %d) = %v, want %v", tt.apply, tt.current, got, tt.want)
			}
		})
	}
}

// pendente → aplicado | cancelado: só o pendente sem efeito aplicado cancela.
func TestCanCancel(t *testing.T) {
	tests := []struct {
		name      string
		status    Status
		triggered int
		current   int
		want      error
	}{
		{"pendente que começa amanhã", StatusPendente, 101, 100, nil},
		{"pendente agendado pra daqui a 30 dias", StatusPendente, 130, 100, nil},
		{"pendente cujo primeiro dia é hoje (já avaliado)", StatusPendente, 100, 100, ErrEffectStarted},
		{"pendente com efeito em andamento", StatusPendente, 98, 100, ErrEffectStarted},
		{"aplicado", StatusAplicado, 130, 100, ErrNotPending},
		{"cancelado de novo", StatusCancelado, 130, 100, ErrNotPending},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := CanCancel(tt.status, tt.triggered, tt.current); !errors.Is(got, tt.want) {
				t.Errorf("CanCancel = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIsPubliclyVisible(t *testing.T) {
	tests := []struct {
		name      string
		status    Status
		triggered int
		lead      int
		current   int
		want      bool
	}{
		{"disparado agora (começa amanhã) já aparece", StatusPendente, 101, DefaultRevealLeadDays, 100, true},
		{"agendado pra depois de amanhã ainda não", StatusPendente, 102, DefaultRevealLeadDays, 100, false},
		{"agendado aparece na véspera", StatusPendente, 102, DefaultRevealLeadDays, 101, true},
		{"aplicado sempre aparece", StatusAplicado, 90, DefaultRevealLeadDays, 100, true},
		{"cancelado nunca aparece", StatusCancelado, 101, DefaultRevealLeadDays, 100, false},
		{"cancelado que já devia ter começado", StatusCancelado, 90, DefaultRevealLeadDays, 100, false},
		// N.25: a antecedência é do evento
		{"antecedência 5: ainda não a 6 dias do efeito", StatusPendente, 106, 5, 100, false},
		{"antecedência 5: aparece a 5 dias do efeito", StatusPendente, 105, 5, 100, true},
		{"antecedência 5: segue visível depois", StatusPendente, 105, 5, 103, true},
		{"antecedência 0: não aparece na véspera", StatusPendente, 101, 0, 100, false},
		{"antecedência 0: aparece quando o efeito começa", StatusPendente, 101, 0, 101, true},
		{"antecedência alta não vence o cancelamento", StatusCancelado, 105, 5, 100, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsPubliclyVisible(tt.status, tt.triggered, tt.lead, tt.current); got != tt.want {
				t.Errorf("IsPubliclyVisible = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestValidateRevealLead(t *testing.T) {
	tests := []struct {
		name      string
		lead      int
		triggered int
		current   int
		want      error
	}{
		{"padrão num disparo imediato", DefaultRevealLeadDays, 101, 100, nil},
		{"zero é válido", 0, 101, 100, nil},
		{"igual aos dias que faltam", 5, 105, 100, nil},
		{"negativo", -1, 105, 100, ErrRevealLeadNegative},
		{"mais que os dias que faltam", 6, 105, 100, ErrRevealLeadTooLong},
		{"disparo imediato com 2 dias", 2, 101, 100, ErrRevealLeadTooLong},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ValidateRevealLead(tt.lead, tt.triggered, tt.current); got != tt.want {
				t.Errorf("ValidateRevealLead = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIsScheduled(t *testing.T) {
	if !IsScheduled(101, 100) || IsScheduled(100, 100) || IsScheduled(99, 100) {
		t.Error("IsScheduled errado nas bordas")
	}
}
