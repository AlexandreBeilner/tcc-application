// Package macroeventadmin atende o painel admin sobre eventos macro já disparados
// (tarefa N.11): detalhe com o impacto realizado de preço por alvo e cancelamento de
// um evento que ainda não produziu efeito. Disparar e agendar continuam em
// macroeventtrigger; as regras de estado (macroevent.CanCancel) vivem em macroevent.
package macroeventadmin

import (
	"context"
	"errors"
	"math"

	"tcc-investimentos/engine/internal/domain/macroevent"
)

// ErrNotFound: o evento macro não existe.
var ErrNotFound = errors.New("evento macro não encontrado")

// Janela do impacto realizado: quantos dias simulados depois do dia de referência a
// variação é medida.
const (
	DefaultImpactWindowDays = 5
	MaxImpactWindowDays     = 90
)

// ErrInvalidWindow: a janela de impacto fora de 1 a MaxImpactWindowDays.
var ErrInvalidWindow = errors.New("a janela do impacto precisa estar entre 1 e 90 dias")

// AssetPrice é uma ação alcançável por algum alvo, com o preço no dia de referência e
// no fim da janela (nil quando não há cotação naquele dia).
type AssetPrice struct {
	AssetID     string
	Ticker      string
	Sector      string
	RiskClass   string
	PriceBefore *float64
	PriceAfter  *float64
}

// Repository é o que o serviço precisa do banco — implementado por *db.MacroEventRepository.
type Repository interface {
	Find(ctx context.Context, id string) (macroevent.Record, error)
	LoadCurrentDay(ctx context.Context) (int, error)
	// CancelPending grava o cancelamento de forma atômica, sob a trava do tick, depois
	// de decide aprovar o estado lido na mesma transação. ErrNotFound se o id não existe.
	CancelPending(ctx context.Context, id string, decide func(status macroevent.Status, triggeredOnDay, currentDay int) error) error
	// StockPrices devolve as ações alcançadas por algum dos alvos com o preço em
	// baseDay e em endDay.
	StockPrices(ctx context.Context, targets []macroevent.Target, baseDay, endDay int) ([]AssetPrice, error)
}

// Service orquestra o detalhe e o cancelamento.
type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service { return &Service{repo: repo} }

// Detail é o evento com o estado de ciclo de vida e o impacto realizado.
type Detail struct {
	Record      macroevent.Record
	CurrentDay  int
	Scheduled   bool
	Cancellable bool
	Impact      Impact
}

// Detail lê o evento, calcula se está agendado/cancelável e o impacto realizado por
// alvo. windowDays <= 0 usa DefaultImpactWindowDays.
func (s *Service) Detail(ctx context.Context, id string, windowDays int) (Detail, error) {
	if windowDays <= 0 {
		windowDays = DefaultImpactWindowDays
	}
	if windowDays > MaxImpactWindowDays {
		return Detail{}, ErrInvalidWindow
	}
	rec, err := s.repo.Find(ctx, id)
	if err != nil {
		return Detail{}, err
	}
	currentDay, err := s.repo.LoadCurrentDay(ctx)
	if err != nil {
		return Detail{}, err
	}
	detail := Detail{
		Record:      rec,
		CurrentDay:  currentDay,
		Scheduled:   rec.Status == macroevent.StatusPendente && macroevent.IsScheduled(rec.TriggeredOnDay, currentDay),
		Cancellable: macroevent.CanCancel(rec.Status, rec.TriggeredOnDay, currentDay) == nil,
	}

	baseDay, endDay := rec.TriggeredOnDay-1, rec.TriggeredOnDay-1+windowDays
	detail.Impact = Impact{WindowDays: windowDays, BaseDay: baseDay, EndDay: endDay}
	// Cancelado nunca produziu efeito, e antes de a janela fechar não há o que medir.
	if rec.Status == macroevent.StatusCancelado || currentDay < endDay || !rec.AffectsPrice {
		detail.Impact.AvailableOnDay = endDay
		return detail, nil
	}
	prices, err := s.repo.StockPrices(ctx, rec.Targets, baseDay, endDay)
	if err != nil {
		return Detail{}, err
	}
	detail.Impact = BuildImpact(rec.Targets, prices, baseDay, endDay, windowDays)
	return detail, nil
}

// Cancel cancela um evento pendente que ainda não produziu efeito e devolve o evento
// já cancelado. Erros: ErrNotFound, macroevent.ErrNotPending, macroevent.ErrEffectStarted,
// e o erro de tick em andamento da infraestrutura.
func (s *Service) Cancel(ctx context.Context, id string) (macroevent.Record, error) {
	if err := s.repo.CancelPending(ctx, id, macroevent.CanCancel); err != nil {
		return macroevent.Record{}, err
	}
	return s.repo.Find(ctx, id)
}

// AssetImpact é a variação de uma ação alcançada por um alvo.
type AssetImpact struct {
	AssetID     string
	Ticker      string
	PriceBefore float64
	PriceAfter  float64
	ChangePct   float64
}

// TargetImpact agrupa as ações de um alvo; AverageChangePct é a média simples das
// variações (nil se nenhuma ação do alvo tem cotação nos dois dias).
type TargetImpact struct {
	Target           macroevent.Target
	Assets           []AssetImpact
	AverageChangePct *float64
}

// Impact é o impacto realizado de preço, medido entre BaseDay (o último dia antes do
// efeito começar) e EndDay (BaseDay + WindowDays). Available é false até o mercado
// chegar em EndDay (AvailableOnDay diz quando).
type Impact struct {
	Available      bool
	WindowDays     int
	BaseDay        int
	EndDay         int
	AvailableOnDay int
	Targets        []TargetImpact
}

func matches(t macroevent.Target, a AssetPrice) bool {
	switch {
	case t.AssetID != nil:
		return *t.AssetID == a.AssetID
	case t.RiskClass != nil:
		return *t.RiskClass == a.RiskClass
	case t.Sector != nil:
		return string(*t.Sector) == a.Sector
	}
	return false
}

// BuildImpact agrupa as variações por alvo. Uma ação alcançada por dois alvos aparece
// nos dois grupos (cada alvo mostra tudo o que ele cobre), e ação sem cotação nos dois
// dias fica de fora.
func BuildImpact(targets []macroevent.Target, prices []AssetPrice, baseDay, endDay, windowDays int) Impact {
	impact := Impact{Available: true, WindowDays: windowDays, BaseDay: baseDay, EndDay: endDay, AvailableOnDay: endDay}
	for _, target := range targets {
		group := TargetImpact{Target: target, Assets: []AssetImpact{}}
		sum := 0.0
		for _, a := range prices {
			if !matches(target, a) || a.PriceBefore == nil || a.PriceAfter == nil || *a.PriceBefore <= 0 {
				continue
			}
			change := round2((*a.PriceAfter/(*a.PriceBefore) - 1) * 100)
			group.Assets = append(group.Assets, AssetImpact{
				AssetID: a.AssetID, Ticker: a.Ticker, PriceBefore: *a.PriceBefore, PriceAfter: *a.PriceAfter, ChangePct: change,
			})
			sum += change
		}
		if len(group.Assets) > 0 {
			avg := round2(sum / float64(len(group.Assets)))
			group.AverageChangePct = &avg
		}
		impact.Targets = append(impact.Targets, group)
	}
	return impact
}

func round2(v float64) float64 { return math.Round(v*100) / 100 }
