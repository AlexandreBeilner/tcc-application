// Package scheduler cuida do agendamento em tempo real do Temporizador —
// infraestrutura de tempo (goroutine + ticker), nunca a regra de negócio de
// um tick em si (isso é tick.Service.Run).
package scheduler

import (
	"context"
	"log"
	"time"
)

// RunDaily chama run a cada interval (24h em produção, decisão de
// arquitetura da tarefa 3.11: 1 tick = 1 dia real, sem multiplicador de
// velocidade configurável) até ctx ser cancelado. Não alinha com meia-noite
// — o primeiro tick automático sai interval depois da subida do motor, o
// que já é suficiente pro requisito "1x por dia real" (o disparo manual via
// POST /admin/tick cobre o caso de precisar testar sem esperar). Uma falha
// isolada de tick é logada, não derruba o processo — o próximo tick
// agendado tenta de novo.
func RunDaily(ctx context.Context, interval time.Duration, run func(context.Context) error) {
	t := time.NewTicker(interval)
	defer t.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := run(ctx); err != nil {
				log.Printf("temporizador: erro no tick automático: %v", err)
			}
		}
	}
}
