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
