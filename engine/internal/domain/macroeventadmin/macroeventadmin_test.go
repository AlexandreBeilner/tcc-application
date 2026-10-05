package macroeventadmin

import (
	"context"
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/macroevent"
)

func fptr(v float64) *float64 { return &v }
func sptr(v string) *string   { return &v }

type fakeRepo struct {
	rec          macroevent.Record
	findErr      error
	currentDay   int
	prices       []AssetPrice
	pricesCalled bool
	cancelled    bool
	cancelErr    error
}

func (f *fakeRepo) Find(context.Context, string) (macroevent.Record, error) {
	if f.cancelled {
		r := f.rec
		r.Status = macroevent.StatusCancelado
		return r, nil
	}
	return f.rec, f.findErr
}
func (f *fakeRepo) LoadCurrentDay(context.Context) (int, error) { return f.currentDay, nil }
func (f *fakeRepo) CancelPending(_ context.Context, _ string, decide func(macroevent.Status, int, int) error) error {
	if f.cancelErr != nil {
		return f.cancelErr
	}
	if err := decide(f.rec.Status, f.rec.TriggeredOnDay, f.currentDay); err != nil {
		return err
	}
	f.cancelled = true
	return nil
}
func (f *fakeRepo) StockPrices(context.Context, []macroevent.Target, int, int) ([]AssetPrice, error) {
	f.pricesCalled = true
	return f.prices, nil
}

func record(status macroevent.Status, triggered int, target macroevent.Target) macroevent.Record {
	return macroevent.Record{ID: "e1", Event: macroevent.Event{
		Title: "t", Status: status, TriggeredOnDay: triggered, DurationDays: 2, AffectsPrice: true,
		Targets: []macroevent.Target{target},
	}}
}

func TestDetail_EstadoDeCicloDeVida(t *testing.T) {
	sector := catalog.Sector("Tecnologia")
	target := macroevent.Target{Sector: &sector}
	tests := []struct {
		name                      string
		status                    macroevent.Status
		triggered, current        int
		wantScheduled, wantCancel bool
	}{
		{"agendado", macroevent.StatusPendente, 130, 100, true, true},
		{"começa no próximo tick", macroevent.StatusPendente, 101, 100, true, true},
		{"efeito em andamento", macroevent.StatusPendente, 99, 100, false, false},
		{"aplicado", macroevent.StatusAplicado, 90, 100, false, false},
		{"cancelado", macroevent.StatusCancelado, 130, 100, false, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := NewService(&fakeRepo{rec: record(tt.status, tt.triggered, target), currentDay: tt.current})
			d, err := svc.Detail(context.Background(), "e1", 0)
			if err != nil {
				t.Fatal(err)
			}
			if d.Scheduled != tt.wantScheduled || d.Cancellable != tt.wantCancel {
				t.Errorf("scheduled = %v, cancellable = %v, want %v e %v", d.Scheduled, d.Cancellable, tt.wantScheduled, tt.wantCancel)
			}
		})
	}
}

func TestDetail_ImpactoSoAparecePosJanela(t *testing.T) {
	sector := catalog.Sector("Tecnologia")
	repo := &fakeRepo{
		rec:        record(macroevent.StatusAplicado, 101, macroevent.Target{Sector: &sector}),
		currentDay: 104,
		prices:     []AssetPrice{{AssetID: "a1", Ticker: "ACME3", Sector: "Tecnologia", PriceBefore: fptr(10), PriceAfter: fptr(11)}},
	}
	svc := NewService(repo)

	// Janela de 5 dias: base 100, fim 105; o mercado está no 104, ainda não dá.
	d, _ := svc.Detail(context.Background(), "e1", 5)
	if d.Impact.Available || repo.pricesCalled || d.Impact.AvailableOnDay != 105 {
		t.Errorf("antes do fim da janela: available = %v, consultou preços = %v, disponível no dia %d", d.Impact.Available, repo.pricesCalled, d.Impact.AvailableOnDay)
	}

	repo.currentDay = 105
	d, _ = svc.Detail(context.Background(), "e1", 5)
	if !d.Impact.Available || len(d.Impact.Targets) != 1 || *d.Impact.Targets[0].AverageChangePct != 10 {
		t.Errorf("impacto = %+v, want disponível com +10%%", d.Impact)
	}
}

func TestDetail_CanceladoENaoPrecoNaoConsultamPrecos(t *testing.T) {
	sector := catalog.Sector("Tecnologia")
	for _, rec := range []macroevent.Record{
		record(macroevent.StatusCancelado, 101, macroevent.Target{Sector: &sector}),
		func() macroevent.Record {
			r := record(macroevent.StatusAplicado, 101, macroevent.Target{Sector: &sector})
			r.AffectsPrice = false
			return r
		}(),
	} {
		repo := &fakeRepo{rec: rec, currentDay: 500}
		d, err := NewService(repo).Detail(context.Background(), "e1", 5)
		if err != nil || d.Impact.Available || repo.pricesCalled {
			t.Errorf("status %s: err = %v, available = %v, consultou = %v", rec.Status, err, d.Impact.Available, repo.pricesCalled)
		}
	}
}

func TestDetail_JanelaInvalidaEEventoInexistente(t *testing.T) {
	sector := catalog.Sector("Tecnologia")
	svc := NewService(&fakeRepo{rec: record(macroevent.StatusPendente, 101, macroevent.Target{Sector: &sector})})
	if _, err := svc.Detail(context.Background(), "e1", MaxImpactWindowDays+1); !errors.Is(err, ErrInvalidWindow) {
		t.Errorf("err = %v, want ErrInvalidWindow", err)
	}
	svc = NewService(&fakeRepo{findErr: ErrNotFound})
	if _, err := svc.Detail(context.Background(), "x", 5); !errors.Is(err, ErrNotFound) {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestCancel(t *testing.T) {
	sector := catalog.Sector("Tecnologia")
	tests := []struct {
		name               string
		status             macroevent.Status
		triggered, current int
		want               error
	}{
		{"pendente agendado cancela", macroevent.StatusPendente, 130, 100, nil},
		{"efeito já começou", macroevent.StatusPendente, 99, 100, macroevent.ErrEffectStarted},
		{"já aplicado", macroevent.StatusAplicado, 90, 100, macroevent.ErrNotPending},
		{"já cancelado", macroevent.StatusCancelado, 130, 100, macroevent.ErrNotPending},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepo{rec: record(tt.status, tt.triggered, macroevent.Target{Sector: &sector}), currentDay: tt.current}
			got, err := NewService(repo).Cancel(context.Background(), "e1")
			if !errors.Is(err, tt.want) {
				t.Fatalf("err = %v, want %v", err, tt.want)
			}
			if tt.want == nil && got.Status != macroevent.StatusCancelado {
				t.Errorf("status devolvido = %s, want cancelado", got.Status)
			}
			if tt.want != nil && repo.cancelled {
				t.Error("gravou o cancelamento mesmo recusando")
			}
		})
	}
}

func TestBuildImpact_AgrupaPorAlvoEIgnoraSemCotacao(t *testing.T) {
	tech, energy := catalog.Sector("Tecnologia"), catalog.Sector("Energia")
	targets := []macroevent.Target{
		{Sector: &tech},
		{AssetID: sptr("a2")},
		{RiskClass: sptr("alto")},
		{Sector: &energy},
	}
	prices := []AssetPrice{
		{AssetID: "a1", Ticker: "AAA3", Sector: "Tecnologia", RiskClass: "baixo", PriceBefore: fptr(10), PriceAfter: fptr(12)},
		{AssetID: "a2", Ticker: "BBB3", Sector: "Tecnologia", RiskClass: "alto", PriceBefore: fptr(20), PriceAfter: fptr(19)},
		{AssetID: "a3", Ticker: "CCC3", Sector: "Tecnologia", RiskClass: "baixo", PriceBefore: nil, PriceAfter: fptr(5)},
	}
	got := BuildImpact(targets, prices, 100, 105, 5)

	if len(got.Targets) != 4 {
		t.Fatalf("grupos = %d", len(got.Targets))
	}
	// Tecnologia: a1 (+20%) e a2 (-5%); a3 sem cotação antes fica de fora.
	if len(got.Targets[0].Assets) != 2 || *got.Targets[0].AverageChangePct != 7.5 {
		t.Errorf("tecnologia = %+v", got.Targets[0])
	}
	// Ativo direto e classe de risco repetem a2 (cada alvo mostra o que cobre).
	if len(got.Targets[1].Assets) != 1 || got.Targets[1].Assets[0].ChangePct != -5 {
		t.Errorf("ativo direto = %+v", got.Targets[1])
	}
	if len(got.Targets[2].Assets) != 1 || got.Targets[2].Assets[0].Ticker != "BBB3" {
		t.Errorf("classe de risco = %+v", got.Targets[2])
	}
	// Setor sem nenhuma ação: grupo vazio, sem média.
	if len(got.Targets[3].Assets) != 0 || got.Targets[3].AverageChangePct != nil {
		t.Errorf("energia = %+v", got.Targets[3])
	}
}
