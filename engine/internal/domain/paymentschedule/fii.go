package paymentschedule

import (
	"time"

	"tcc-investimentos/engine/internal/domain/simcalendar"
)

// MaxFIIPaymentBusinessDay é o teto do dia útil de pagamento do FII dentro do
// mês (um mês tem pelo menos 20 dias úteis).
const MaxFIIPaymentBusinessDay = 20

// FIIPayoutDays devolve a agenda do FII para o mês de referência (year, month),
// no mês-calendário real: data-com no último dia útil do mês, data-ex no dia útil
// seguinte e pagamento no paymentBusinessDay-ésimo dia útil do mês seguinte.
// paymentBusinessDay fora de 1..MaxFIIPaymentBusinessDay é ajustado ao intervalo.
// Os três valores são dias simulados.
func FIIPayoutDays(year int, month time.Month, paymentBusinessDay int) (comDay, exDay, payDay int) {
	paymentBusinessDay = max(1, min(paymentBusinessDay, MaxFIIPaymentBusinessDay))

	firstOfNext := time.Date(year, month+1, 1, 0, 0, 0, 0, time.UTC)
	comDay = simcalendar.DayOf(firstOfNext) - 1
	for !simcalendar.IsBusinessDay(comDay) {
		comDay--
	}
	exDay = ExDay(comDay)
	payDay = AddBusinessDays(simcalendar.DayOf(firstOfNext), paymentBusinessDay-1)
	return comDay, exDay, payDay
}

// FIIPayoutOn diz se day é a data-ex de algum mês de referência e devolve a agenda
// desse provento (data-com, data-ex e pagamento). A data-ex é o dia útil seguinte
// ao último dia útil do mês de referência, sempre no mês seguinte, então o mês de
// referência é o anterior ao de day. O motor gera o provento nesse dia: o snapshot
// de quem tem a cota é o do fechamento da data-com.
func FIIPayoutOn(day, paymentBusinessDay int) (comDay, exDay, payDay int, ok bool) {
	year, month := referenceMonthBefore(day)
	comDay, exDay, payDay = FIIPayoutDays(year, month, paymentBusinessDay)
	if exDay != day {
		return 0, 0, 0, false
	}
	return comDay, exDay, payDay, true
}

// LastFIIExDay é a data-ex mais recente que já ocorreu até day (inclusive), e false
// se não houver nenhuma depois do dia 0.
func LastFIIExDay(day int) (int, bool) {
	year, month := referenceMonthBefore(day)
	for i := 0; i < 3; i++ {
		_, ex, _ := FIIPayoutDays(year, month, 1)
		if ex <= day {
			return ex, ex > 0
		}
		month--
		if month < time.January {
			month, year = time.December, year-1
		}
	}
	return 0, false
}

func referenceMonthBefore(day int) (int, time.Month) {
	date := simcalendar.DateOf(day)
	prev := time.Date(date.Year(), date.Month()-1, 1, 0, 0, 0, 0, time.UTC)
	return prev.Year(), prev.Month()
}
