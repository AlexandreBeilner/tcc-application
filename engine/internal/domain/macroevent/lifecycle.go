// lifecycle.go cobre o ciclo de vida de um evento macro depois do disparo (tarefa
// N.11): agendar pra um dia futuro, cancelar enquanto nada foi aplicado, o que o
// usuário já pode ver e como o painel filtra o histórico.
//
// Estados: pendente → aplicado (o tick esgota os efeitos) ou pendente → cancelado
// (o admin desiste antes de o primeiro efeito entrar). Aplicado e cancelado são
// finais. Um evento agendado é só um pendente cujo primeiro dia de efeito
// (TriggeredOnDay) ainda não chegou.
package macroevent

import "errors"

// MaxScheduleAheadDays é quantos dias simulados à frente um evento pode ser
// agendado (um ano de mercado). Sem teto, um erro de digitação agendaria um evento
// pra daqui a décadas e ele ficaria pendente pra sempre.
const MaxScheduleAheadDays = 365

var (
	ErrApplyDayInPast = errors.New("o dia de aplicação precisa ser posterior ao dia simulado atual")
	ErrApplyDayTooFar = errors.New("o dia de aplicação passa do limite de agendamento")
	ErrNotPending     = errors.New("só um evento pendente pode ser cancelado")
	ErrEffectStarted  = errors.New("o evento já começou a produzir efeito e não pode mais ser cancelado")
)

// ValidateApplyDay confere o dia de aplicação de um evento agendado: o primeiro dia
// que um tick futuro avalia é currentDay+1, e o teto é MaxScheduleAheadDays à frente.
func ValidateApplyDay(applyOnDay, currentDay int) error {
	if applyOnDay <= currentDay {
		return ErrApplyDayInPast
	}
	if applyOnDay > currentDay+MaxScheduleAheadDays {
		return ErrApplyDayTooFar
	}
	return nil
}

// IsScheduled diz se o evento ainda não começou: o primeiro dia de efeito é futuro.
// Um evento disparado agora também espera o próximo tick, então "agendado" aqui
// significa só "ainda sem efeito aplicado".
func IsScheduled(triggeredOnDay, currentDay int) bool {
	return triggeredOnDay > currentDay
}

// CanCancel confere se o evento pode ser cancelado: precisa estar pendente e ainda
// sem efeito aplicado (o tick que avalia triggeredOnDay ainda não rodou).
func CanCancel(status Status, triggeredOnDay, currentDay int) error {
	if status != StatusPendente {
		return ErrNotPending
	}
	if !IsScheduled(triggeredOnDay, currentDay) {
		return ErrEffectStarted
	}
	return nil
}

// IsPubliclyVisible diz se o usuário já pode ver o evento no feed e no calendário.
// Cancelado nunca aparece. Um evento agendado só aparece na véspera do primeiro dia
// de efeito (triggeredOnDay <= currentDay+1), a mesma antecedência de um disparo
// imediato; antes disso, mostrar título e narrativa entregaria o evento com semanas
// de aviso.
func IsPubliclyVisible(status Status, triggeredOnDay, currentDay int) bool {
	return status != StatusCancelado && triggeredOnDay <= currentDay+1
}

// View escolhe quem está lendo o histórico.
type View string

const (
	// ViewPublic é o feed do usuário: só o que IsPubliclyVisible permite.
	ViewPublic View = "public"
	// ViewAdmin é o painel: tudo, inclusive cancelado e agendado.
	ViewAdmin View = "admin"
)

// ListFilter reúne a paginação e os filtros do histórico (painel: status, alvo e
// período). Os filtros de alvo são excludentes entre si (no máximo um) e o período é
// em dias simulados de TriggeredOnDay, inclusivo nas duas pontas.
type ListFilter struct {
	Limit, Offset int
	View          View
	Status        *Status
	Sector        *string
	RiskClass     *string
	AssetID       *string
	FromDay       *int
	ToDay         *int
}

// ValidStatus diz se s é um dos status conhecidos.
func ValidStatus(s Status) bool {
	return s == StatusPendente || s == StatusAplicado || s == StatusCancelado
}
