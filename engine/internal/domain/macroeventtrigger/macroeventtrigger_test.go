package macroeventtrigger

import (
	"context"
	"errors"
	"sync"
	"testing"

	"tcc-investimentos/engine/internal/domain/macroevent"
)

func ptr[T any](v T) *T { return &v }

type fakeRepository struct {
	currentDay     int
	loadErr        error
	persistErr     error
	persistedEvent macroevent.Event
	persistCalled  bool
}

func (f *fakeRepository) LoadCurrentDay(_ context.Context) (int, error) {
	return f.currentDay, f.loadErr
}

func (f *fakeRepository) Persist(_ context.Context, event macroevent.Event) (string, error) {
	f.persistCalled = true
	f.persistedEvent = event
	if f.persistErr != nil {
		return "", f.persistErr
	}
	return "event-1", nil
}

func TestTrigger_ComTemplateReaproveitaCatalogo(t *testing.T) {
	repo := &fakeRepository{currentDay: 1}
	svc := NewService(repo)

	req := Request{
		TemplateKey: ptr("legislacao-ambiental-mineracao"),
		Targets:     []TargetInput{{Sector: ptr("Mineração")}},
	}

	id, event, err := svc.Trigger(context.Background(), req)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if id == "" {
		t.Error("id vazio")
	}

	tpl, found := macroevent.FindTemplate("legislacao-ambiental-mineracao")
	if !found {
		t.Fatal("template de apoio não encontrado")
	}
	if event.Title != tpl.Title || event.Narrative != tpl.Narrative {
		t.Errorf("Title/Narrative não vieram do template: got %q/%q", event.Title, event.Narrative)
	}
	if event.Direction != tpl.Direction || event.MagnitudeBand != tpl.Band {
		t.Errorf("Direction/MagnitudeBand não vieram do template")
	}
	if event.AffectsPrice != tpl.AffectsPrice || event.AffectsFundamentals != tpl.AffectsFundamentals {
		t.Errorf("efeitos habilitados não vieram do template")
	}
	if len(event.Targets) != 1 {
		t.Fatalf("len(Targets) = %d, want 1 (só targets vem do payload)", len(event.Targets))
	}
	if !repo.persistCalled {
		t.Error("Persist não foi chamado")
	}
}

func TestTrigger_TemplateDesconhecido(t *testing.T) {
	repo := &fakeRepository{currentDay: 1}
	svc := NewService(repo)

	_, _, err := svc.Trigger(context.Background(), Request{
		TemplateKey: ptr("evento-que-nao-existe"),
		Targets:     []TargetInput{{RiskClass: ptr("Conservador")}},
	})
	if !errors.Is(err, ErrUnknownTemplate) {
		t.Errorf("err = %v, want %v", err, ErrUnknownTemplate)
	}
	if repo.persistCalled {
		t.Error("Persist não deveria ser chamado com template desconhecido")
	}
}

func TestTrigger_AvulsoSemCampoObrigatorioEhRejeitado(t *testing.T) {
	repo := &fakeRepository{currentDay: 1}
	svc := NewService(repo)
	band := macroevent.BandLeve

	req := Request{
		Title:               ptr("título"),
		Narrative:           ptr("narrativa"),
		MagnitudeBand:       &band,
		AffectsPrice:        ptr(true),
		AffectsFundamentals: ptr(false),
		Targets:             []TargetInput{{RiskClass: ptr("Conservador")}},
		// Direction ausente — evento avulso incompleto.
	}

	_, _, err := svc.Trigger(context.Background(), req)
	if !errors.Is(err, ErrMissingFields) {
		t.Errorf("err = %v, want %v", err, ErrMissingFields)
	}
	if repo.persistCalled {
		t.Error("Persist não deveria ser chamado com campo obrigatório ausente")
	}
}

func TestTrigger_AvulsoValidoSoAfetaPreco(t *testing.T) {
	repo := &fakeRepository{currentDay: 3}
	svc := NewService(repo)
	direction := macroevent.DirectionNegativo
	band := macroevent.BandModerado

	req := Request{
		Title:               ptr("título avulso"),
		Narrative:           ptr("narrativa avulsa"),
		Direction:           &direction,
		MagnitudeBand:       &band,
		AffectsPrice:        ptr(true),
		AffectsFundamentals: ptr(false),
		Targets:             []TargetInput{{AssetID: ptr("asset-1")}},
	}

	_, event, err := svc.Trigger(context.Background(), req)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if event.TriggeredOnDay != 3 {
		t.Errorf("TriggeredOnDay = %d, want 3", event.TriggeredOnDay)
	}
	if event.DurationDays != 2 {
		t.Errorf("DurationDays = %d, want 2 (BandModerado)", event.DurationDays)
	}
	if event.PriceEffectPct == nil {
		t.Fatal("PriceEffectPct = nil, want amostrado (affects_price = true)")
	}
	if *event.PriceEffectPct > 0 {
		t.Errorf("PriceEffectPct = %v, want negativo (direction negativo)", *event.PriceEffectPct)
	}
	if event.FundamentalsEffectPct != nil || event.FundamentalsReportDay != nil {
		t.Error("FundamentalsEffectPct/FundamentalsReportDay deveriam ser nil — evento não afeta fundamentos")
	}
	if event.Status != macroevent.StatusPendente {
		t.Errorf("Status = %v, want %v", event.Status, macroevent.StatusPendente)
	}
}

// TestTrigger_FundamentalsReportDayRespeitaJanelaDeCorte cobre o critério
// de aceite "fundamentals_report_day calculado respeita a regra de corte
// de 2 dias" — os dois lados do corte, com o ciclo global de 14 dias
// (fundamentals.DefaultReportFrequencyDays).
func TestTrigger_FundamentalsReportDayRespeitaJanelaDeCorte(t *testing.T) {
	tests := []struct {
		name       string
		currentDay int
		want       int
	}{
		{"exatamente 2 dias de antecedência vai pro relatório mais próximo (dia 14)", 12, 14},
		{"1 dia de antecedência empurra pro próximo ciclo (dia 28)", 13, 28},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{currentDay: tt.currentDay}
			svc := NewService(repo)
			direction := macroevent.DirectionNegativo
			band := macroevent.BandLeve

			req := Request{
				Title:               ptr("t"),
				Narrative:           ptr("n"),
				Direction:           &direction,
				MagnitudeBand:       &band,
				AffectsPrice:        ptr(false),
				AffectsFundamentals: ptr(true),
				Targets:             []TargetInput{{RiskClass: ptr("Conservador")}},
			}

			_, event, err := svc.Trigger(context.Background(), req)
			if err != nil {
				t.Fatalf("err = %v, want nil", err)
			}
			if event.FundamentalsReportDay == nil || *event.FundamentalsReportDay != tt.want {
				t.Errorf("FundamentalsReportDay = %v, want %d", event.FundamentalsReportDay, tt.want)
			}
		})
	}
}

func TestTrigger_SetorDesconhecidoEhRejeitado(t *testing.T) {
	repo := &fakeRepository{currentDay: 1}
	svc := NewService(repo)

	_, _, err := svc.Trigger(context.Background(), Request{
		TemplateKey: ptr("legislacao-ambiental-mineracao"),
		Targets:     []TargetInput{{Sector: ptr("Inexistente")}},
	})
	if !errors.Is(err, ErrUnknownSector) {
		t.Errorf("err = %v, want %v", err, ErrUnknownSector)
	}
}

func TestTrigger_AlvoComEscopoAmbiguoPropagaErro(t *testing.T) {
	repo := &fakeRepository{currentDay: 1}
	svc := NewService(repo)

	_, _, err := svc.Trigger(context.Background(), Request{
		TemplateKey: ptr("legislacao-ambiental-mineracao"),
		Targets:     []TargetInput{{RiskClass: ptr("Conservador"), AssetID: ptr("asset-1")}},
	})
	if !errors.Is(err, macroevent.ErrTargetScopeAmbiguous) {
		t.Errorf("err = %v, want %v", err, macroevent.ErrTargetScopeAmbiguous)
	}
	if repo.persistCalled {
		t.Error("Persist não deveria ser chamado com alvo de escopo ambíguo")
	}
}

func TestTrigger_SemAlvoPropagaErro(t *testing.T) {
	repo := &fakeRepository{currentDay: 1}
	svc := NewService(repo)

	_, _, err := svc.Trigger(context.Background(), Request{
		TemplateKey: ptr("legislacao-ambiental-mineracao"),
	})
	if !errors.Is(err, macroevent.ErrNoTarget) {
		t.Errorf("err = %v, want %v", err, macroevent.ErrNoTarget)
	}
}

func TestTrigger_ErroAoCarregarDiaCorrentePropaga(t *testing.T) {
	repo := &fakeRepository{loadErr: errors.New("falha de leitura")}
	svc := NewService(repo)

	_, _, err := svc.Trigger(context.Background(), Request{
		TemplateKey: ptr("legislacao-ambiental-mineracao"),
		Targets:     []TargetInput{{RiskClass: ptr("Conservador")}},
	})
	if err == nil {
		t.Fatal("err = nil, want erro propagado de LoadCurrentDay")
	}
	if repo.persistCalled {
		t.Error("Persist não deveria ser chamado quando LoadCurrentDay falha")
	}
}

// TestTrigger_EventoMistoComDirecaoPropriaPorAlvo cobre o critério de
// aceite principal da tarefa E.1: um evento "misto" com 2 alvos de sinais
// opostos (o caso didático da spec — câmbio beneficia Exportador,
// prejudica Importador, no mesmo evento) — cada alvo precisa carregar sua
// própria direção corretamente, com o efeito de preço amostrado com o
// sinal certo por alvo (não mais um único sinal sorteado pro evento
// inteiro aplicado a todos).
func TestTrigger_EventoMistoComDirecaoPropriaPorAlvo(t *testing.T) {
	repo := &fakeRepository{currentDay: 1}
	svc := NewService(repo)
	direction := macroevent.DirectionMisto
	band := macroevent.BandModerado
	positivo := macroevent.DirectionPositivo
	negativo := macroevent.DirectionNegativo

	req := Request{
		Title:               ptr("desvalorização do real"),
		Narrative:           ptr("exportadoras ganham, importadoras perdem"),
		Direction:           &direction,
		MagnitudeBand:       &band,
		AffectsPrice:        ptr(true),
		AffectsFundamentals: ptr(false),
		Targets: []TargetInput{
			{Sector: ptr("Mineração"), Direction: &positivo},
			{Sector: ptr("Tecnologia"), Direction: &negativo},
		},
	}

	_, event, err := svc.Trigger(context.Background(), req)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(event.Targets) != 2 {
		t.Fatalf("len(Targets) = %d, want 2", len(event.Targets))
	}

	exportador := event.Targets[0]
	importador := event.Targets[1]

	if exportador.Direction == nil || *exportador.Direction != macroevent.DirectionPositivo {
		t.Fatalf("exportador.Direction = %v, want %v", exportador.Direction, macroevent.DirectionPositivo)
	}
	if importador.Direction == nil || *importador.Direction != macroevent.DirectionNegativo {
		t.Fatalf("importador.Direction = %v, want %v", importador.Direction, macroevent.DirectionNegativo)
	}

	if exportador.PriceEffectPct == nil || *exportador.PriceEffectPct <= 0 {
		t.Fatalf("exportador.PriceEffectPct = %v, want positivo", exportador.PriceEffectPct)
	}
	if importador.PriceEffectPct == nil || *importador.PriceEffectPct >= 0 {
		t.Fatalf("importador.PriceEffectPct = %v, want negativo", importador.PriceEffectPct)
	}
}

// TestTrigger_EventoNaoMistoNaoPrecisaDeclararDirecaoPorAlvo é o teste de
// regressão do critério de aceite da E.1: um evento "não-misto" continua
// funcionando sem que nenhum Target declare direção própria — os alvos
// ficam com Direction/PriceEffectPct/FundamentalsEffectPct nil (herdam o
// efeito do evento, exatamente como antes da E.1).
func TestTrigger_EventoNaoMistoNaoPrecisaDeclararDirecaoPorAlvo(t *testing.T) {
	repo := &fakeRepository{currentDay: 1}
	svc := NewService(repo)
	direction := macroevent.DirectionNegativo
	band := macroevent.BandLeve

	req := Request{
		Title:               ptr("evento simples"),
		Narrative:           ptr("narrativa"),
		Direction:           &direction,
		MagnitudeBand:       &band,
		AffectsPrice:        ptr(true),
		AffectsFundamentals: ptr(false),
		Targets:             []TargetInput{{Sector: ptr("Mineração")}},
	}

	_, event, err := svc.Trigger(context.Background(), req)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(event.Targets) != 1 {
		t.Fatalf("len(Targets) = %d, want 1", len(event.Targets))
	}

	target := event.Targets[0]
	if target.Direction != nil {
		t.Errorf("target.Direction = %v, want nil (evento não-misto não precisa declarar por alvo)", *target.Direction)
	}
	if target.PriceEffectPct != nil {
		t.Errorf("target.PriceEffectPct = %v, want nil (herda Event.PriceEffectPct)", *target.PriceEffectPct)
	}
	if event.PriceEffectPct == nil {
		t.Fatal("event.PriceEffectPct = nil, want amostrado")
	}
}

func TestTrigger_AlvoComDirecaoMistaEhRejeitado(t *testing.T) {
	repo := &fakeRepository{currentDay: 1}
	svc := NewService(repo)
	direction := macroevent.DirectionMisto
	band := macroevent.BandModerado
	misto := macroevent.DirectionMisto

	req := Request{
		Title:               ptr("t"),
		Narrative:           ptr("n"),
		Direction:           &direction,
		MagnitudeBand:       &band,
		AffectsPrice:        ptr(true),
		AffectsFundamentals: ptr(false),
		Targets:             []TargetInput{{Sector: ptr("Mineração"), Direction: &misto}},
	}

	_, _, err := svc.Trigger(context.Background(), req)
	if !errors.Is(err, macroevent.ErrTargetDirectionMustBeSigned) {
		t.Errorf("err = %v, want %v", err, macroevent.ErrTargetDirectionMustBeSigned)
	}
	if repo.persistCalled {
		t.Error("Persist não deveria ser chamado com direção de alvo misto")
	}
}

func TestTrigger_ErroAoPersistirPropaga(t *testing.T) {
	repo := &fakeRepository{currentDay: 1, persistErr: errors.New("falha de escrita")}
	svc := NewService(repo)

	_, _, err := svc.Trigger(context.Background(), Request{
		TemplateKey: ptr("legislacao-ambiental-mineracao"),
		Targets:     []TargetInput{{RiskClass: ptr("Conservador")}},
	})
	if err == nil {
		t.Fatal("err = nil, want erro propagado de Persist")
	}
}

// concurrentFakeRepository é fakeRepository com Persist seguro pra chamada
// concorrente (mutex própria) — usado só por
// TestTrigger_ChamadasConcorrentesNaoTemDataRaceNoRng, que dispara Trigger
// de várias goroutines ao mesmo tempo (o cenário real de dois admins, ou um
// duplo clique, batendo em POST /macro-events quase juntos).
type concurrentFakeRepository struct {
	mu         sync.Mutex
	currentDay int
	calls      int
}

func (f *concurrentFakeRepository) LoadCurrentDay(_ context.Context) (int, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.currentDay, nil
}

func (f *concurrentFakeRepository) Persist(_ context.Context, _ macroevent.Event) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	return "event-id", nil
}

// TestTrigger_ChamadasConcorrentesNaoTemDataRaceNoRng cobre o achado do
// review do PR da E.1/E.2: s.rng é um *rand.Rand compartilhado por todo
// disparo (NewService), e Trigger/sampleTargetEffects passaram a chamá-lo
// várias vezes por disparo — sem a trava (rngMu, ver doc de Service), duas
// chamadas concorrentes de Trigger dariam uma data race real (detectável
// com `go test -race ./...`, que este teste sozinho não liga, mas que passa
// a não falhar mais nele depois da correção). Evento "misto" com 2 alvos de
// direção própria maximiza quantas vezes cada goroutine toca s.rng.
func TestTrigger_ChamadasConcorrentesNaoTemDataRaceNoRng(t *testing.T) {
	repo := &concurrentFakeRepository{currentDay: 1}
	svc := NewService(repo)
	direction := macroevent.DirectionMisto
	band := macroevent.BandSevero
	positivo := macroevent.DirectionPositivo
	negativo := macroevent.DirectionNegativo

	req := Request{
		Title:               ptr("evento concorrente"),
		Narrative:           ptr("narrativa"),
		Direction:           &direction,
		MagnitudeBand:       &band,
		AffectsPrice:        ptr(true),
		AffectsFundamentals: ptr(true),
		Targets: []TargetInput{
			{Sector: ptr("Mineração"), Direction: &positivo},
			{Sector: ptr("Tecnologia"), Direction: &negativo},
		},
	}

	const goroutines = 20
	var wg sync.WaitGroup
	errs := make([]error, goroutines)
	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, _, err := svc.Trigger(context.Background(), req)
			errs[i] = err
		}(i)
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Errorf("goroutine %d: err = %v, want nil", i, err)
		}
	}
	if repo.calls != goroutines {
		t.Errorf("Persist calls = %d, want %d", repo.calls, goroutines)
	}
}
