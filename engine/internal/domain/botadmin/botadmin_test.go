package botadmin

import (
	"context"
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/coverage"
	"tcc-investimentos/engine/internal/domain/orderexecution"
)

// fakeWorld é um banco em memória que implementa as cinco interfaces do serviço, do
// jeito que os adapters reais se comportam (cobertura gravada, ordens canceladas).
type fakeWorld struct {
	bots      map[string]Bot
	order     []string
	assets    map[string]string // asset_id -> ticker negociável
	cancelled []orderexecution.CancelFilter
	cancelErr error
	writeErr  error
}

func newFakeWorld() *fakeWorld {
	return &fakeWorld{bots: map[string]Bot{}, assets: map[string]string{"a1": "AAA3", "a2": "BBB3", "a3": "CCC3"}}
}

func (w *fakeWorld) List(context.Context) (Listing, error) {
	var l Listing
	for _, id := range w.order {
		l.Bots = append(l.Bots, w.bots[id])
	}
	return l, nil
}

func (w *fakeWorld) Find(_ context.Context, id string) (Bot, bool, error) {
	b, ok := w.bots[id]
	return b, ok, nil
}

func (w *fakeWorld) TradableAsset(_ context.Context, id string) (AssetRef, bool, error) {
	t, ok := w.assets[id]
	return AssetRef{AssetID: id, Ticker: t}, ok, nil
}

func (w *fakeWorld) CountAdminBots(context.Context) (int, error) {
	n := 0
	for id := range w.bots {
		if len(id) > 24 && id[:24] == adminBotIDPrefixForTest {
			n++
		}
	}
	return n, nil
}

const adminBotIDPrefixForTest = "00000000-0000-0000-0002-"

func (w *fakeWorld) CreateBot(_ context.Context, id string, cash float64, p bot.Personality) error {
	if w.writeErr != nil {
		return w.writeErr
	}
	w.bots[id] = Bot{AccountID: id, Personality: p, IsActive: true, Cash: cash}
	w.order = append(w.order, id)
	return nil
}

func (w *fakeWorld) SetActive(_ context.Context, id string, active bool) error {
	b := w.bots[id]
	b.IsActive = active
	w.bots[id] = b
	return nil
}

func (w *fakeWorld) SetMaxCoveredAssets(_ context.Context, id string, max int) error {
	b := w.bots[id]
	b.Personality.MaxCoveredAssets = &max
	w.bots[id] = b
	return nil
}

func (w *fakeWorld) RemoveCoverage(_ context.Context, id, assetID string) error {
	b := w.bots[id]
	kept := b.Covered[:0:0]
	for _, a := range b.Covered {
		if a.AssetID != assetID {
			kept = append(kept, a)
		}
	}
	b.Covered = kept
	w.bots[id] = b
	return nil
}

func (w *fakeWorld) ListMarketMakers(context.Context) ([]coverage.MarketMaker, error) {
	var out []coverage.MarketMaker
	for _, id := range w.order {
		b := w.bots[id]
		if b.Personality.Archetype != bot.ArchetypeMarketMaker {
			continue
		}
		mm := coverage.MarketMaker{AccountID: id, Active: b.IsActive, MaxAssets: *b.Personality.MaxCoveredAssets}
		for _, a := range b.Covered {
			mm.CoveredAssetIDs = append(mm.CoveredAssetIDs, a.AssetID)
		}
		out = append(out, mm)
	}
	return out, nil
}

func (w *fakeWorld) CreateMarketMaker(context.Context, string, bot.Personality) error { return nil }

func (w *fakeWorld) ProvisionCoverage(_ context.Context, p coverage.Provision) error {
	b := w.bots[p.MMAccountID]
	b.Covered = append(b.Covered, AssetRef{AssetID: p.AssetID, Ticker: w.assets[p.AssetID]})
	w.bots[p.MMAccountID] = b
	return nil
}

func (w *fakeWorld) CancelBatch(_ context.Context, f orderexecution.CancelFilter) ([]string, error) {
	w.cancelled = append(w.cancelled, f)
	return nil, w.cancelErr
}

func (w *fakeWorld) service() *Service { return NewService(w, w, w, w, w) }

func marketMakerInput() CreateInput {
	return CreateInput{
		Archetype: bot.ArchetypeMarketMaker, Sectors: []catalog.Sector{catalog.SectorBancario}, WithinScopePct: 0.9,
		MaxPositionSizePct: 0.5, MarketOrderPreference: 0.5, SpreadWidthPct: 0.02, InitialCash: 50000,
	}
}

func chartistInput() CreateInput {
	in := marketMakerInput()
	in.Archetype = bot.ArchetypeChartista
	return in
}

func TestCreate_Validacao(t *testing.T) {
	level := 0.7
	tests := []struct {
		name   string
		mutate func(*CreateInput)
		want   error
	}{
		{"caixa zero", func(in *CreateInput) { in.InitialCash = 0 }, ErrInvalidInitialCash},
		{"caixa acima do teto", func(in *CreateInput) { in.InitialCash = MaxInitialCash + 1 }, ErrInvalidInitialCash},
		{"arquétipo desconhecido", func(in *CreateInput) { in.Archetype = "outro" }, bot.ErrUnknownArchetype},
		{"escopo vazio", func(in *CreateInput) { in.Sectors = nil }, bot.ErrEmptySpecializationScope},
		{"setor desconhecido", func(in *CreateInput) { in.Sectors = []catalog.Sector{"inexistente"} }, bot.ErrUnknownSectorInScope},
		{"atividade fora da faixa", func(in *CreateInput) { in.WithinScopePct = 0.5 }, bot.ErrInvalidWithinScopePct},
		{"spread acima do teto", func(in *CreateInput) { in.SpreadWidthPct = 0.5 }, bot.ErrSpreadWidthAboveMax},
		{"posição zero", func(in *CreateInput) { in.MaxPositionSizePct = 0 }, bot.ErrInvalidMaxPositionSizePct},
		{"conhecimento num arquétipo sem a dimensão", func(in *CreateInput) { in.KnowledgeLevel = &level }, bot.ErrKnowledgeLevelWrongArchetype},
		{"teto de cobertura zero", func(in *CreateInput) { zero := 0; in.MaxCoveredAssets = &zero }, bot.ErrInvalidMaxCoveredAssets},
		{"teto de cobertura fora do Market Maker", func(in *CreateInput) {
			in.Archetype = bot.ArchetypeChartista
			five := 5
			in.MaxCoveredAssets = &five
		}, bot.ErrMaxCoveredAssetsWrongArchetype},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			world := newFakeWorld()
			in := marketMakerInput()
			tt.mutate(&in)
			if _, err := world.service().Create(context.Background(), in); !errors.Is(err, tt.want) {
				t.Errorf("err = %v, want %v", err, tt.want)
			}
			if len(world.bots) != 0 {
				t.Error("entrada inválida não pode criar bot")
			}
		})
	}
}

func TestCreate_FundamentalistaExigeConhecimento(t *testing.T) {
	in := chartistInput()
	in.Archetype = bot.ArchetypeFundamentalista
	if _, err := newFakeWorld().service().Create(context.Background(), in); !errors.Is(err, bot.ErrMissingKnowledgeLevel) {
		t.Errorf("err = %v, want ErrMissingKnowledgeLevel", err)
	}
	level := 0.8
	in.KnowledgeLevel = &level
	created, err := newFakeWorld().service().Create(context.Background(), in)
	if err != nil || created.Personality.KnowledgeLevel == nil || *created.Personality.KnowledgeLevel != 0.8 {
		t.Errorf("created = %+v, err = %v", created, err)
	}
}

func TestCreate_IDsEAtivoPorPadrao(t *testing.T) {
	world := newFakeWorld()
	svc := world.service()
	ctx := context.Background()

	first, err := svc.Create(ctx, chartistInput())
	if err != nil {
		t.Fatal(err)
	}
	second, _ := svc.Create(ctx, chartistInput())
	if first.AccountID != NewAdminBotID(1) || second.AccountID != NewAdminBotID(2) {
		t.Errorf("ids = %s, %s", first.AccountID, second.AccountID)
	}
	if !first.IsActive || first.Cash != 50000 {
		t.Errorf("bot novo = %+v, want ativo com o caixa pedido", first)
	}

	mm, err := svc.Create(ctx, marketMakerInput())
	if err != nil {
		t.Fatal(err)
	}
	if mm.AccountID != coverage.NewMarketMakerID(0) || *mm.Personality.MaxCoveredAssets != bot.DefaultMaxCoveredAssets {
		t.Errorf("Market Maker = %s teto %v, want o ID do esquema de cobertura e o teto padrão", mm.AccountID, *mm.Personality.MaxCoveredAssets)
	}
	if len(mm.Covered) != 0 {
		t.Error("Market Maker novo nasce sem cobertura")
	}
}

func TestCreate_MarketMakerNovoViraCandidatoDoAssign(t *testing.T) {
	world := newFakeWorld()
	svc := world.service()
	ctx := context.Background()
	old, _ := svc.Create(ctx, marketMakerInput())
	if _, err := svc.Update(ctx, old.AccountID, UpdateInput{CoveredAssetIDs: &[]string{"a1", "a2"}}); err != nil {
		t.Fatal(err)
	}
	fresh, _ := svc.Create(ctx, marketMakerInput())

	mms, _ := world.ListMarketMakers(ctx)
	got, ok := coverage.Assign("a3", mms)
	if !ok || got != fresh.AccountID {
		t.Errorf("Assign = %q, %v, want o Market Maker novo (menos carregado) %q", got, ok, fresh.AccountID)
	}
}

func TestUpdate_AtivarEDesativarNaoTocaSaldo(t *testing.T) {
	world := newFakeWorld()
	svc := world.service()
	ctx := context.Background()
	created, _ := svc.Create(ctx, chartistInput())

	off, inactive := svc.Update(ctx, created.AccountID, UpdateInput{IsActive: ptr(false)})
	if inactive != nil || off.IsActive || off.Cash != 50000 {
		t.Errorf("desativado = %+v, err = %v", off, inactive)
	}
	on, err := svc.Update(ctx, created.AccountID, UpdateInput{IsActive: ptr(true)})
	if err != nil || !on.IsActive || on.Cash != 50000 {
		t.Errorf("reativado = %+v, err = %v", on, err)
	}
}

func TestUpdate_Erros(t *testing.T) {
	world := newFakeWorld()
	svc := world.service()
	ctx := context.Background()
	chartist, _ := svc.Create(ctx, chartistInput())
	mm, _ := svc.Create(ctx, marketMakerInput())
	other, _ := svc.Create(ctx, marketMakerInput())
	if _, err := svc.Update(ctx, other.AccountID, UpdateInput{CoveredAssetIDs: &[]string{"a3"}}); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name string
		id   string
		in   UpdateInput
		want error
	}{
		{"corpo vazio", mm.AccountID, UpdateInput{}, ErrNothingToUpdate},
		{"bot inexistente", "nao-existe", UpdateInput{IsActive: ptr(false)}, ErrBotNotFound},
		{"teto num bot que não é Market Maker", chartist.AccountID, UpdateInput{MaxCoveredAssets: ptrInt(3)}, ErrNotMarketMaker},
		{"cobertura num bot que não é Market Maker", chartist.AccountID, UpdateInput{CoveredAssetIDs: &[]string{"a1"}}, ErrNotMarketMaker},
		{"teto não positivo", mm.AccountID, UpdateInput{MaxCoveredAssets: ptrInt(0)}, bot.ErrInvalidMaxCoveredAssets},
		{"ativo repetido", mm.AccountID, UpdateInput{CoveredAssetIDs: &[]string{"a1", "a1"}}, ErrDuplicateAssetIDs},
		{"ativo não negociável", mm.AccountID, UpdateInput{CoveredAssetIDs: &[]string{"cdb"}}, ErrAssetNotTradable},
		{"ativo já coberto por outro Market Maker", mm.AccountID, UpdateInput{CoveredAssetIDs: &[]string{"a3"}}, ErrAssetAlreadyCovered},
		{"cobertura acima do teto", mm.AccountID, UpdateInput{MaxCoveredAssets: ptrInt(1), CoveredAssetIDs: &[]string{"a1", "a2"}}, ErrCoverageExceedsLimit},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			before := world.bots[mm.AccountID]
			if _, err := svc.Update(ctx, tt.id, tt.in); !errors.Is(err, tt.want) {
				t.Errorf("err = %v, want %v", err, tt.want)
			}
			if after := world.bots[mm.AccountID]; len(after.Covered) != len(before.Covered) || *after.Personality.MaxCoveredAssets != *before.Personality.MaxCoveredAssets {
				t.Error("alteração recusada não pode gravar nada")
			}
		})
	}
}

func TestUpdate_TetoAbaixoDaCoberturaAtualERecusado(t *testing.T) {
	world := newFakeWorld()
	svc := world.service()
	ctx := context.Background()
	mm, _ := svc.Create(ctx, marketMakerInput())
	if _, err := svc.Update(ctx, mm.AccountID, UpdateInput{CoveredAssetIDs: &[]string{"a1", "a2"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Update(ctx, mm.AccountID, UpdateInput{MaxCoveredAssets: ptrInt(1)}); !errors.Is(err, ErrCoverageExceedsLimit) {
		t.Errorf("err = %v, want ErrCoverageExceedsLimit", err)
	}
}

func TestUpdate_ReatribuirCoberturaCancelaSoAsOrdensDoAtivoRemovido(t *testing.T) {
	world := newFakeWorld()
	svc := world.service()
	ctx := context.Background()
	mm, _ := svc.Create(ctx, marketMakerInput())
	if _, err := svc.Update(ctx, mm.AccountID, UpdateInput{CoveredAssetIDs: &[]string{"a1", "a2"}}); err != nil {
		t.Fatal(err)
	}
	if len(world.cancelled) != 0 {
		t.Fatal("cobrir ativo novo não cancela nada")
	}

	updated, err := svc.Update(ctx, mm.AccountID, UpdateInput{CoveredAssetIDs: &[]string{"a2", "a3"}})
	if err != nil {
		t.Fatal(err)
	}
	if len(world.cancelled) != 1 || world.cancelled[0] != (orderexecution.CancelFilter{AssetID: "a1", UserID: mm.AccountID}) {
		t.Errorf("cancelamentos = %+v, want só o ativo a1 do Market Maker (interseção ativo + dono)", world.cancelled)
	}
	tickers := map[string]bool{}
	for _, a := range updated.Covered {
		tickers[a.Ticker] = true
	}
	if len(updated.Covered) != 2 || !tickers["BBB3"] || !tickers["CCC3"] {
		t.Errorf("cobertura = %+v, want BBB3 e CCC3", updated.Covered)
	}
}

func TestUpdate_FalhaNoCancelamentoNaoTiraACobertura(t *testing.T) {
	world := newFakeWorld()
	svc := world.service()
	ctx := context.Background()
	mm, _ := svc.Create(ctx, marketMakerInput())
	if _, err := svc.Update(ctx, mm.AccountID, UpdateInput{CoveredAssetIDs: &[]string{"a1"}}); err != nil {
		t.Fatal(err)
	}
	world.cancelErr = &orderexecution.BatchTooLargeError{Matched: 600, Max: 500}

	_, err := svc.Update(ctx, mm.AccountID, UpdateInput{CoveredAssetIDs: &[]string{}})
	var tooLarge *orderexecution.BatchTooLargeError
	if !errors.As(err, &tooLarge) {
		t.Fatalf("err = %v, want BatchTooLargeError", err)
	}
	if len(world.bots[mm.AccountID].Covered) != 1 {
		t.Error("se o cancelamento falhou, a cobertura não pode ter sido tirada (ficaria cotação órfã)")
	}
}

func ptr(b bool) *bool  { return &b }
func ptrInt(n int) *int { return &n }
