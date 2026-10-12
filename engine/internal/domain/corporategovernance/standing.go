package corporategovernance

import (
	"context"
	"fmt"
)

// StandingRecord é o que o repositório lê de uma empresa para responder "como ela está para
// receber uma pauta": quem é, se a pessoa consultada tem ações dela agora e quando começou o
// último efeito.
type StandingRecord struct {
	Name               string
	Sector             string
	HoldsShares        bool
	LastEffectStartDay *int
	Today              int
}

// Standing é a situação de uma empresa diante da governança, do ponto de vista de uma pessoa.
type Standing struct {
	CompanyID   string
	Name        string
	Sector      string
	HoldsShares bool
	// CooldownDaysLeft são os dias simulados que faltam para a empresa poder mudar de novo
	// (0 = livre).
	CooldownDaysLeft int
}

// CooldownDaysLeft diz quantos dias simulados faltam para acabar o cooldown. Cooldown 0 desliga
// a trava; sem efeito anterior não há espera. Concorda com InCooldown: devolve > 0 só quando
// InCooldown é verdadeiro.
func CooldownDaysLeft(lastStartDay *int, today, cooldownDays int) int {
	if !InCooldown(lastStartDay, today, cooldownDays) {
		return 0
	}
	return cooldownDays - (today - *lastStartDay)
}

// Standing devolve a situação da empresa para a pessoa `userID` (posição atual, nunca a do
// snapshot). Serve ao backend para barrar proposta e apoio de quem não é acionista e de
// empresa que ainda está em cooldown.
func (s *Service) Standing(ctx context.Context, companyID, userID string) (Standing, error) {
	if companyID == "" || userID == "" {
		return Standing{}, fmt.Errorf("%w: empresa e usuário são obrigatórios", ErrInvalidInput)
	}
	rec, found, err := s.repo.CompanyStanding(ctx, companyID, userID)
	if err != nil {
		return Standing{}, err
	}
	if !found {
		return Standing{}, ErrUnknownCompany
	}
	values, err := s.settings.Current(ctx)
	if err != nil {
		return Standing{}, err
	}
	return Standing{
		CompanyID: companyID, Name: rec.Name, Sector: rec.Sector, HoldsShares: rec.HoldsShares,
		CooldownDaysLeft: CooldownDaysLeft(rec.LastEffectStartDay, rec.Today, values.GovernanceCooldownDays),
	}, nil
}
