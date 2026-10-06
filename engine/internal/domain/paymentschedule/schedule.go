// Package paymentschedule é a agenda de balanços e proventos por ativo (tarefa
// RC.6.6, pacote P8; desenho em .claude/revisao-trilhas-anexos/analise-calendario.md
// e parâmetros calibrados em .claude/calibracao-calendario-proventos.md).
//
// Hoje todas as empresas divulgam balanço no mesmo dia (fundamentals.IsReportDay,
// um relógio único de 91 dias) e todos os FIIs pagam juntos a cada 30 dias. Este
// pacote são só funções puras (sem I/O, sem relógio de parede) que escalonam isso
// por ativo: o dia do balanço ganha um offset em dias úteis, o provento ganha
// data-com, data-ex e pagamento em dia útil, a periodicidade (trimestral,
// semestral, anual) decide quais balanços pagam, e o FII paga no mês-calendário
// real. O tempo vem só de simcalendar.
//
// Compatibilidade: offset 0 reproduz exatamente fundamentals.IsReportDay e o
// índice de ciclo legado, sem nenhum ajuste de dia útil (teste de equivalência
// de 0 a 2000). Os dias são dias simulados (simcalendar), 1-based como o
// `newDay` do tick: dayIndex+1 é o dia que acabou de começar.
package paymentschedule

import (
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/simcalendar"
)

// AddBusinessDays avança n dias úteis a partir de day (o próprio day não
// conta). Com n = 0 devolve o próprio day se for útil, ou o próximo dia útil se
// cair em sábado ou domingo. n negativo é tratado como 0.
func AddBusinessDays(day, n int) int {
	for !simcalendar.IsBusinessDay(day) {
		day++
	}
	for ; n > 0; n-- {
		day++
		for !simcalendar.IsBusinessDay(day) {
			day++
		}
	}
	return day
}

// ReportDay é o dia simulado em que o balanço do ciclo cycleIndex (0-based) sai:
// o fim do ciclo (a cada freqDays) mais offsetBusinessDays dias úteis. Offset 0
// ou negativo é o legado: o próprio dia do fim do ciclo, sem ajuste de fim de
// semana.
func ReportDay(freqDays, offsetBusinessDays, cycleIndex int) int {
	base := (cycleIndex + 1) * freqDays
	if offsetBusinessDays <= 0 {
		return base
	}
	return AddBusinessDays(base, offsetBusinessDays)
}

// CycleIndex devolve o ciclo (0-based) cujo balanço sai em dayIndex+1, e ok =
// false se nenhum sai nesse dia. Com offset 0 é o índice legado
// ((dayIndex+1)/freqDays - 1), usado como semente do ruído de crescimento.
func CycleIndex(dayIndex, freqDays, offsetBusinessDays int) (cycleIndex int, ok bool) {
	if freqDays <= 0 {
		return 0, false
	}
	newDay := dayIndex + 1
	if offsetBusinessDays <= 0 {
		if newDay > 0 && newDay%freqDays == 0 {
			return newDay/freqDays - 1, true
		}
		return 0, false
	}
	// O fim do ciclo (base) fica, no máximo, offset dias úteis antes do balanço:
	// no pior caso offset*7/5 dias corridos mais o fim de semana do começo.
	span := offsetBusinessDays*7/5 + 4
	for base := newDay; base >= newDay-span && base > 0; base-- {
		if base%freqDays != 0 {
			continue
		}
		k := base/freqDays - 1
		if ReportDay(freqDays, offsetBusinessDays, k) == newDay {
			return k, true
		}
	}
	return 0, false
}

// IsReportDay generaliza fundamentals.IsReportDay com o offset por empresa.
func IsReportDay(dayIndex, freqDays, offsetBusinessDays int) bool {
	_, ok := CycleIndex(dayIndex, freqDays, offsetBusinessDays)
	return ok
}

// MaxReportSpanDays é o maior atraso, em dias corridos, que um offset de balanço
// de maxOffsetBusinessDays dias úteis pode causar sobre o fim do ciclo.
func MaxReportSpanDays(maxOffsetBusinessDays int) int {
	if maxOffsetBusinessDays <= 0 {
		return 0
	}
	return maxOffsetBusinessDays*7/5 + 4
}

// EffectiveReportDay é o dia em que o balanço do ciclo cycleIndex realmente sai
// para uma empresa, respeitando o dia de corte do escalonamento: ciclo cujo fim
// (base) é igual ou anterior a cutoverDay já saiu pelo relógio global (legado,
// sem offset); só os ciclos que fecham depois do corte usam o offset. Assim a
// migração nunca gera dois balanços para o mesmo ciclo.
func EffectiveReportDay(freqDays, offsetBusinessDays, cutoverDay, cycleIndex int) int {
	base := (cycleIndex + 1) * freqDays
	if base <= cutoverDay {
		return base
	}
	return ReportDay(freqDays, offsetBusinessDays, cycleIndex)
}

// CycleIndexWithCutover é CycleIndex com o dia de corte: devolve o ciclo cujo
// balanço sai em dayIndex+1, e ok = false se nenhum sai. Com offset 0 ou
// cutoverDay alto o bastante é idêntico ao legado.
func CycleIndexWithCutover(dayIndex, freqDays, offsetBusinessDays, cutoverDay int) (cycleIndex int, ok bool) {
	if freqDays <= 0 {
		return 0, false
	}
	newDay := dayIndex + 1
	span := MaxReportSpanDays(offsetBusinessDays)
	for k := newDay/freqDays - 1; k >= 0 && (k+1)*freqDays >= newDay-span; k-- {
		if EffectiveReportDay(freqDays, offsetBusinessDays, cutoverDay, k) == newDay {
			return k, true
		}
	}
	return 0, false
}

// DaysSinceReport é quantos dias se passaram desde o último balanço da empresa
// (0 no próprio dia do balanço, ok = false se ainda não houve nenhum), contado
// até o dia dayIndex+1.
func DaysSinceReport(dayIndex, freqDays, offsetBusinessDays, cutoverDay int) (days int, ok bool) {
	if freqDays <= 0 {
		return 0, false
	}
	newDay := dayIndex + 1
	for k := newDay/freqDays - 1; k >= 0; k-- {
		if day := EffectiveReportDay(freqDays, offsetBusinessDays, cutoverDay, k); day <= newDay {
			return newDay - day, true
		}
	}
	return 0, false
}

// ComDay é a data-com: o último dia de negociação com direito ao provento,
// lagBusinessDays dias úteis depois da declaração (o dia do balanço).
func ComDay(declarationDay, lagBusinessDays int) int {
	return AddBusinessDays(declarationDay, lagBusinessDays)
}

// ExDay é a data-ex: o primeiro dia útil seguinte à data-com, quando o ativo
// passa a ser negociado sem direito ao provento (regra da B3).
func ExDay(comDay int) int {
	return AddBusinessDays(comDay, 1)
}

// PaymentDay é o dia de pagamento: lagBusinessDays dias úteis depois da data-ex,
// sempre em dia útil.
func PaymentDay(exDay, lagBusinessDays int) int {
	return AddBusinessDays(exDay, lagBusinessDays)
}

// Policy é a periodicidade do provento de ação: quais balanços pagam. O tipo mora em
// catalog (o cadastro da empresa o guarda) e é reexportado aqui com as constantes.
type Policy = catalog.DividendPolicy

const (
	// Quarterly paga em todo balanço trimestral (o comportamento legado).
	Quarterly = catalog.DividendQuarterly
	// Semiannual paga nos balanços do 2º e do 4º trimestre, com o lucro dos dois.
	Semiannual = catalog.DividendSemiannual
	// Annual paga só no balanço do 4º trimestre, com o lucro do ano.
	Annual = catalog.DividendAnnual
)

// EquityPayoutCycles diz, para os 4 trimestres do ano (índice 0 = 1º), em quais
// o balanço paga provento. Política desconhecida cai no legado (trimestral).
func EquityPayoutCycles(p Policy) [4]bool {
	switch p {
	case Semiannual:
		return [4]bool{false, true, false, true}
	case Annual:
		return [4]bool{false, false, false, true}
	default:
		return [4]bool{true, true, true, true}
	}
}

// PaysInCycle diz se o balanço do ciclo cycleIndex (0-based, o ciclo 0 é o 1º
// trimestre do ano) paga provento.
func PaysInCycle(p Policy, cycleIndex int) bool {
	if cycleIndex < 0 {
		return false
	}
	return EquityPayoutCycles(p)[cycleIndex%4]
}

// PoolCycles é quantos ciclos de lucro entram no provento de um pagamento: 1
// (trimestral), 2 (semestral) ou 4 (anual). O chamador soma o lucro líquido
// desses ciclos antes de EquityValuePerShare.
func PoolCycles(p Policy) int {
	switch p {
	case Semiannual:
		return 2
	case Annual:
		return 4
	default:
		return 1
	}
}

// legacyPaymentLagDays é o atraso corrido do pagamento no relógio global antigo
// (catalog.DefaultPaymentLagDays), usado nos ciclos sem agenda.
const legacyPaymentLagDays = catalog.DefaultPaymentLagDays

// EquityCycle é a agenda de provento do balanço de um ciclo de uma empresa.
type EquityCycle struct {
	Report int  // dia do balanço (declaração)
	Ex     int  // data-ex
	Pay    int  // dia de pagamento
	Pays   bool // o balanço paga provento
	// PoolCycles é quantos ciclos de lucro entram no valor pago (1 quando trimestral).
	PoolCycles int
}

// EquityCycleAt resolve a agenda do ciclo cycleIndex. Empresa sem agenda atribuída
// (assigned = false) ou ciclo que fechou antes do dia de corte seguem o legado: paga
// todo balanço, na própria data da declaração (ex = declaração), com pagamento
// legacyPaymentLagDays corridos depois e lucro de um ciclo. Os demais seguem a
// política, com data-com, data-ex e pagamento em dia útil.
func EquityCycleAt(freqDays, offsetBusinessDays, cutoverDay int, assigned bool, p Policy, comLagBusinessDays, payLagBusinessDays, cycleIndex int) EquityCycle {
	report := EffectiveReportDay(freqDays, offsetBusinessDays, cutoverDay, cycleIndex)
	if !assigned || (cycleIndex+1)*freqDays <= cutoverDay {
		return EquityCycle{Report: report, Ex: report, Pay: report + legacyPaymentLagDays, Pays: true, PoolCycles: 1}
	}
	ex := ExDay(ComDay(report, comLagBusinessDays))
	return EquityCycle{
		Report:     report,
		Ex:         ex,
		Pay:        PaymentDay(ex, payLagBusinessDays),
		Pays:       PaysInCycle(p, cycleIndex),
		PoolCycles: PoolCycles(p),
	}
}
