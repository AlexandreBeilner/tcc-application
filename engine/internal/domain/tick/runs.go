package tick

import (
	"context"
	"time"
)

// Trigger diz quem disparou um tick (tarefa N.6): o agendador no slot certo, o
// agendador recuperando slots perdidos, ou um admin (POST /admin/tick, avançar N dias).
type Trigger string

const (
	TriggerScheduled Trigger = "scheduled"
	TriggerCatchUp   Trigger = "catchup"
	TriggerManual    Trigger = "manual"
)

// RunStatus é o desfecho de um tick no histórico.
type RunStatus string

const (
	RunSuccess RunStatus = "success"
	RunFailed  RunStatus = "failed"
)

// MaxAdvanceDays é o teto de dias simulados que "avançar N dias" roda de uma vez
// (N.6): mais que isso atropelaria os usuários com um mês de mercado numa chamada.
const MaxAdvanceDays = 30

// RunCounters espelha os contadores de observabilidade de Result (os mesmos que
// POST /admin/tick devolve), pra o histórico mostrar o que cada tick fez.
type RunCounters struct {
	SelicRate               float64
	IsCopomDay              bool
	IsReportDay             bool
	QuotesCount             int
	FundamentalsCount       int
	DividendsGeneratedCount int
	DividendsPaidCount      int
	BotFillsCount           int
	ExpiredOrdersCount      int
	UncoveredAssetsCount    int
	IntradayRoundsCount     int
}

// RunRecord é uma linha do histórico de ticks. Day = 0 quando o tick falhou antes
// de o dia ser conhecido (dias reais começam em 1). CatchUpDiscarded só vem
// preenchido no primeiro tick de uma recuperação que descartou slots atrasados.
type RunRecord struct {
	Day              int
	Trigger          Trigger
	Status           RunStatus
	ErrorMessage     string
	StartedAt        time.Time
	Duration         time.Duration
	CatchUpDiscarded int
	Counters         RunCounters
}

// RunRecorder é o colaborador que grava o histórico de ticks (implementado por
// *db.TickRepository). Opcional (WithRunRecorder): sem ele o tick roda igual,
// só não deixa histórico.
type RunRecorder interface {
	RecordRun(ctx context.Context, record RunRecord) error
}

// countersOf extrai de um Result os mesmos números que o handler de POST
// /admin/tick expõe.
func countersOf(r Result) RunCounters {
	return RunCounters{
		SelicRate:               r.State.SelicRate,
		IsCopomDay:              r.IsCopomDay,
		IsReportDay:             r.IsReportDay,
		QuotesCount:             len(r.Quotes),
		FundamentalsCount:       len(r.Fundamentals),
		DividendsGeneratedCount: len(r.NewDividends),
		DividendsPaidCount:      len(r.DuePayments),
		BotFillsCount:           r.IntradayFillsCount,
		ExpiredOrdersCount:      r.ExpiredOrdersCount,
		UncoveredAssetsCount:    r.UncoveredAssetsCount,
		IntradayRoundsCount:     len(r.IntradayRounds),
	}
}
