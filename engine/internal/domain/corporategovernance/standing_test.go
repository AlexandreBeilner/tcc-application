package corporategovernance

import (
	"context"
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/enginesetting"
)

func TestCooldownDaysLeft(t *testing.T) {
	intPtr := func(v int) *int { return &v }
	tests := []struct {
		name     string
		last     *int
		today    int
		cooldown int
		want     int
	}{
		{"sem efeito anterior", nil, 100, 90, 0},
		{"efeito hoje espera tudo", intPtr(100), 100, 90, 90},
		{"meio do caminho", intPtr(100), 145, 90, 45},
		{"no último dia ainda falta 1", intPtr(100), 189, 90, 1},
		{"no dia exato acabou", intPtr(100), 190, 90, 0},
		{"cooldown zero desliga", intPtr(100), 100, 0, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CooldownDaysLeft(tt.last, tt.today, tt.cooldown)
			if got != tt.want {
				t.Errorf("CooldownDaysLeft = %d, esperado %d", got, tt.want)
			}
			if (got > 0) != InCooldown(tt.last, tt.today, tt.cooldown) {
				t.Errorf("CooldownDaysLeft e InCooldown discordam")
			}
		})
	}
}

func TestService_Standing(t *testing.T) {
	last := 100
	repo := newFakeRepo(CompanyState{})
	repo.standing = &StandingRecord{Name: "Acme", Sector: "Varejo", HoldsShares: true, LastEffectStartDay: &last, Today: 130}
	svc := NewService(repo, fakeSettings{values: enginesetting.Values{GovernanceCooldownDays: 90}})

	got, err := svc.Standing(context.Background(), "c1", "u1")
	if err != nil {
		t.Fatal(err)
	}
	if !got.HoldsShares || got.CooldownDaysLeft != 60 || got.Name != "Acme" || got.Sector != "Varejo" {
		t.Errorf("situação inesperada: %+v", got)
	}

	repo.standing = nil
	if _, err := svc.Standing(context.Background(), "c1", "u1"); !errors.Is(err, ErrUnknownCompany) {
		t.Errorf("empresa inexistente deve dar ErrUnknownCompany, veio %v", err)
	}
	if _, err := svc.Standing(context.Background(), "", "u1"); !errors.Is(err, ErrInvalidInput) {
		t.Errorf("empresa vazia deve dar ErrInvalidInput, veio %v", err)
	}
}
