// Package marketcalendar responde "que dia é no mercado simulado" e "o que
// acontece em cada dia" (tarefa S.10): o relógio (dia simulado, data, dia da
// semana, mercado aberto, trimestre) e a linha do tempo de fatos globais
// (eventos macro, Copom, relatório, proventos) e do próprio usuário. Tudo
// deriva de simcalendar (a única fonte de tempo do domínio) e das mesmas
// funções de calendário que o Temporizador usa (selic.IsCopomMeetingDay,
// fundamentals.IsReportDay), sem duplicar regra.
package marketcalendar

import (
	"time"

	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/simcalendar"
)

// Clock é o estado do relógio do mercado num dia simulado.
type Clock struct {
	Day     int
	Date    time.Time
	Weekday time.Weekday
	// MarketOpen é falso em sábado e domingo simulados (decisão do autor de
	// 2026-09-26; a recusa de ordem em si é a tarefa S.11).
	MarketOpen bool
	// DaysUntilOpen é 0 com o mercado aberto; no fim de semana, quantos dias
	// simulados faltam pra segunda (sábado 2, domingo 1).
	DaysUntilOpen int
	// QuarterDay é o dia dentro do trimestre corrente (1 a QuarterLength); o
	// dia de relatório é o QuarterLength-ésimo.
	QuarterDay    int
	QuarterLength int
}

// ClockAt monta o relógio do dia simulado day.
func ClockAt(day int) Clock {
	length := fundamentals.DefaultReportFrequencyDays
	c := Clock{
		Day:           day,
		Date:          simcalendar.DateOf(day),
		Weekday:       simcalendar.Weekday(day),
		MarketOpen:    simcalendar.IsBusinessDay(day),
		QuarterLength: length,
		QuarterDay:    quarterDay(day, length),
	}
	for d := day; !simcalendar.IsBusinessDay(d); d++ {
		c.DaysUntilOpen++
	}
	return c
}

// quarterDay: o dia 1 abre o trimestre e o dia `length` é o de relatório
// (fundamentals.IsReportDay(day-1, length)); o dia 0 (motor sem nenhum tick)
// conta como dia 1.
func quarterDay(day, length int) int {
	if day < 1 {
		return 1
	}
	return (day-1)%length + 1
}
