// Package simcalendar é a única fonte de tempo das regras de negócio do
// motor (tarefa S.1, achado 022): traduz o dia simulado (market_calendar.
// current_day, o contador que só o Temporizador avança) em data de calendário,
// dia da semana e dia útil. Nenhuma regra de domínio lê o relógio de parede —
// prazo/IR/VNA da renda fixa, datas de dividendo e o dia do roteiro sandbox
// derivam todos daqui, então tick manual do admin e recuperação de dias
// perdidos nunca dessincronizam essas grandezas do rendimento.
//
// Decisão do autor (2026-09-26, Fase S): o dia simulado é dia de CALENDÁRIO
// (7 por semana), com data-base fixa numa segunda-feira; feriados são
// ignorados por ora. Selic/CDI rendem só em dia útil (segunda a sexta, base
// 252), já o IR da renda fixa conta dias corridos direto.
package simcalendar

import "time"

// BaseDate é a data do dia simulado 0 — fixa (não derivada de deploy/seed) de
// propósito, pra data e dia da semana serem determinísticos (RNF08). É uma
// segunda-feira.
var BaseDate = time.Date(2026, time.January, 5, 0, 0, 0, 0, time.UTC)

// DateOf devolve a data de calendário (UTC, hora zerada) do dia simulado.
func DateOf(day int) time.Time {
	return BaseDate.AddDate(0, 0, day)
}

// DayOf é o inverso de DateOf: o dia simulado que contém date (a hora é
// ignorada). Datas anteriores à BaseDate dão dia negativo.
func DayOf(date time.Time) int {
	d := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	return int(d.Sub(BaseDate).Hours() / 24)
}

// Weekday devolve o dia da semana do dia simulado.
func Weekday(day int) time.Weekday {
	return DateOf(day).Weekday()
}

// IsBusinessDay diz se o dia simulado é útil (segunda a sexta).
func IsBusinessDay(day int) bool {
	wd := Weekday(day)
	return wd != time.Saturday && wd != time.Sunday
}

// BusinessDaysBetween conta os dias úteis em (fromDay, toDay], ou seja, a
// partir do dia seguinte a fromDay até toDay inclusive — a mesma convenção do
// rendimento diário (o dia da compra não rende, cada dia útil seguinte rende
// um). Devolve 0 se toDay <= fromDay.
func BusinessDaysBetween(fromDay, toDay int) int {
	count := 0
	for d := fromDay + 1; d <= toDay; d++ {
		if IsBusinessDay(d) {
			count++
		}
	}
	return count
}
