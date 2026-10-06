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

	ErrRevealLeadNegative = errors.New("a antecedência de aparição não pode ser negativa")
	ErrRevealLeadTooLong  = errors.New("a antecedência de aparição passa dos dias que faltam até o primeiro dia de efeito")
)

// DefaultRevealLeadDays é a antecedência padrão de aparição de um evento: a véspera do
// primeiro dia de efeito, a mesma de um disparo imediato (que já aparece um tick antes de
// produzir efeito). É o valor de todo evento anterior à N.25 e de todo evento em que o
// admin não escolhe.
const DefaultRevealLeadDays = 1

// ValidateRevealLead confere a antecedência de aparição escolhida pelo admin (N.25,
// achado 035): inteiro de 0 até os dias que faltam entre o dia corrente e o primeiro dia
// de efeito. 0 significa "só aparece quando o efeito já começou". Passar de
// triggeredOnDay-currentDay seria equivalente a "já visível", e recusar evita um valor que
// parece mandar mais do que manda.
func ValidateRevealLead(revealLeadDays, triggeredOnDay, currentDay int) error {
	if revealLeadDays < 0 {
		return ErrRevealLeadNegative
	}
	if revealLeadDays > triggeredOnDay-currentDay {
		return ErrRevealLeadTooLong
	}
	return nil
}

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
// Cancelado nunca aparece. Um evento aparece a partir de revealLeadDays dias antes do
// primeiro dia de efeito (triggeredOnDay <= currentDay+revealLeadDays); com o padrão
// (DefaultRevealLeadDays, a véspera) é a mesma antecedência de um disparo imediato.
// Antes disso, mostrar título e narrativa entregaria o evento com semanas de aviso
// (RF16), que só o admin pode escolher (N.25).
func IsPubliclyVisible(status Status, triggeredOnDay, revealLeadDays, currentDay int) bool {
	return status != StatusCancelado && triggeredOnDay <= currentDay+revealLeadDays
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
