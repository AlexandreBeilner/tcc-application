// Package scheduler cuida do agendamento em tempo real do Temporizador —
// infraestrutura de tempo (goroutine + timer), nunca a regra de negócio de
// um tick em si (isso é tick.Service.Run/RunScheduled).
package scheduler

import (
	"context"
	"log"
	"time"
)

// Config descreve a agenda do tick (tarefa S.3, decisão do autor de
// 2026-09-26): 1 dia real = TicksPerDay dias simulados, com um tick por dia
// simulado, ancorados na meia-noite de Location e espaçados por
// 24h/TicksPerDay (5 ticks: 00:00, 04:48, 09:36, 14:24, 19:12).
type Config struct {
	Location    *time.Location
	TicksPerDay int
	// MaxCatchUp é o teto de ticks recuperados de uma vez quando o motor ficou
	// fora do ar (o excedente é descartado, com log): recuperar sem limite
	// atropelaria os usuários com dias de mercado de uma vez só.
	MaxCatchUp int
}

// Interval é o espaçamento entre ticks.
func (c Config) Interval() time.Duration {
	return 24 * time.Hour / time.Duration(c.TicksPerDay)
}

// SlotOf devolve o número absoluto do slot de agenda que contém t: cada dia
// local tem TicksPerDay slots, contados a partir de 1970-01-01 na zona da
// agenda. Dois instantes no mesmo slot pertencem ao mesmo tick agendado.
func (c Config) SlotOf(t time.Time) int64 {
	local := t.In(c.Location)
	midnight := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, c.Location)
	days := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC).Unix() / 86400
	within := int64(local.Sub(midnight) / c.Interval())
	if within >= int64(c.TicksPerDay) {
		within = int64(c.TicksPerDay) - 1
	}
	return days*int64(c.TicksPerDay) + within
}

// NextSlotStart devolve o início do próximo slot depois de t.
func (c Config) NextSlotStart(t time.Time) time.Time {
	local := t.In(c.Location)
	midnight := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, c.Location)
	within := int64(local.Sub(midnight) / c.Interval())
	if within+1 >= int64(c.TicksPerDay) {
		return midnight.AddDate(0, 0, 1)
	}
	return midnight.Add(time.Duration(within+1) * c.Interval())
}

// Plan decide quantos ticks devem rodar agora: quantos slots se passaram desde
// o último tick gravado (1 se o Temporizador nunca rodou), limitado a
// MaxCatchUp. Nunca negativo (relógio que andou pra trás não roda nada).
func (c Config) Plan(now, lastTickAt time.Time, found bool) int {
	if !found {
		return 1
	}
	missed := c.SlotOf(now) - c.SlotOf(lastTickAt)
	if missed <= 0 {
		return 0
	}
	if missed > int64(c.MaxCatchUp) {
		log.Printf("temporizador: %d ticks atrasados, recuperando só %d", missed, c.MaxCatchUp)
		return c.MaxCatchUp
	}
	return int(missed)
}

// RunScheduledFunc roda os ticks devidos sob a trava do tick; plan diz quantos.
// Devolve quantos rodaram (tick.Service.RunScheduled).
type RunScheduledFunc func(ctx context.Context, plan func(lastTickAt time.Time, found bool) int) (int, error)

// Run recupera os ticks perdidos na subida e depois dispara um tick a cada
// slot da agenda, até ctx ser cancelado. Toda decisão de "quantos rodar" acontece
// dentro da trava do tick (RunScheduled), então deploy repetido, duas
// instâncias ou um POST /admin/tick no mesmo slot nunca duplicam o dia. Uma
// falha isolada é logada, não derruba o processo.
func Run(ctx context.Context, cfg Config, now func() time.Time, run RunScheduledFunc) {
	attempt := func() {
		ran, err := run(ctx, func(last time.Time, found bool) int { return cfg.Plan(now(), last, found) })
		if err != nil {
			log.Printf("temporizador: erro no tick automático (rodaram %d): %v", ran, err)
			return
		}
		if ran > 0 {
			log.Printf("temporizador: %d tick(s) automático(s) executado(s)", ran)
		}
	}

	attempt()
	for {
		// Prioriza o cancelamento: com o timer já vencido, o select abaixo
		// escolheria entre os dois casos aleatoriamente e ainda tentaria um
		// tick depois do encerramento.
		if ctx.Err() != nil {
			return
		}
		timer := time.NewTimer(time.Until(cfg.NextSlotStart(now())))
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
			if ctx.Err() != nil {
				return
			}
			attempt()
		}
	}
}
