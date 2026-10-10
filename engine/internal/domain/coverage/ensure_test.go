package coverage

import (
	"context"
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/bot"
)

// fakeStore simula o banco: mantém os Market Makers e aplica o que o
// provisionamento grava, como o adapter real faria.
type fakeStore struct {
	mms          []MarketMaker
	created      []string
	provisions   []Provision
	createErr    error
	provisionErr error
}

func (f *fakeStore) ListMarketMakers(context.Context) ([]MarketMaker, error) {
	return append([]MarketMaker(nil), f.mms...), nil
}

func (f *fakeStore) CreateMarketMaker(_ context.Context, accountID string, p bot.Personality) error {
	if f.createErr != nil {
		return f.createErr
	}
	if p.Archetype != bot.ArchetypeMarketMaker || p.MaxCoveredAssets == nil {
		return errors.New("personalidade inesperada")
	}
	f.created = append(f.created, accountID)
	f.mms = append(f.mms, MarketMaker{AccountID: accountID, Active: true, MaxAssets: *p.MaxCoveredAssets})
	return nil
}

func (f *fakeStore) ProvisionCoverage(_ context.Context, p Provision) error {
	if f.provisionErr != nil {
		return f.provisionErr
	}
	f.provisions = append(f.provisions, p)
	for i := range f.mms {
		if f.mms[i].AccountID == p.MMAccountID {
			f.mms[i].CoveredAssetIDs = append(f.mms[i].CoveredAssetIDs, p.AssetID)
		}
	}
	return nil
}

func ensureAsset(t *testing.T, e *Ensurer, id string) Result {
	t.Helper()
	res, err := e.EnsureCoverage(context.Background(), Input{AssetID: id, OutstandingShares: 1000, MarketMakerShares: 400, Price: 100})
	if err != nil {
		t.Fatalf("EnsureCoverage(%s): %v", id, err)
	}
	return res
}

func TestEnsureCoverage_CriaPrimeiroMarketMakerEProvisiona(t *testing.T) {
	store := &fakeStore{}
	res := ensureAsset(t, NewEnsurer(store, store), "a1")

	if !res.Provisioned || !res.CreatedMarketMaker || res.MarketMakerID != firstMarketMakerID {
		t.Errorf("Result = %+v", res)
	}
	if len(store.provisions) != 1 {
		t.Fatalf("provisions = %d, want 1", len(store.provisions))
	}
	got := store.provisions[0]
	want := Provision{AssetID: "a1", MMAccountID: firstMarketMakerID, Shares: 400, Price: 100, Cash: 80000, OutstandingShares: 1000}
	if got != want {
		t.Errorf("Provision = %+v, want %+v", got, want)
	}
}

func TestEnsureCoverage_Idempotente(t *testing.T) {
	store := &fakeStore{}
	e := NewEnsurer(store, store)
	ensureAsset(t, e, "a1")
	res := ensureAsset(t, e, "a1")

	if res.Provisioned || res.CreatedMarketMaker || res.MarketMakerID != firstMarketMakerID {
		t.Errorf("segunda chamada = %+v, want sem provisionar", res)
	}
	if len(store.provisions) != 1 || len(store.created) != 1 {
		t.Errorf("provisions = %d, created = %d; want 1 e 1", len(store.provisions), len(store.created))
	}
}

func TestEnsureCoverage_CobertoPorMarketMakerInativoNaoReprovisiona(t *testing.T) {
	store := &fakeStore{mms: []MarketMaker{{AccountID: "mm1", Active: false, MaxAssets: 10, CoveredAssetIDs: []string{"a1"}}}}
	res := ensureAsset(t, NewEnsurer(store, store), "a1")

	if res.Provisioned || len(store.provisions) != 0 {
		t.Errorf("não deveria provisionar ativo já coberto: %+v", res)
	}
}

func TestEnsureCoverage_CatalogoMaiorQueOTetoCriaMarketMakersAdicionais(t *testing.T) {
	store := &fakeStore{}
	e := NewEnsurer(store, store)
	const assets = 25
	for i := 0; i < assets; i++ {
		ensureAsset(t, e, string(rune('a'+i)))
	}
	// Segunda passada (reexecução do seed): nada muda.
	for i := 0; i < assets; i++ {
		ensureAsset(t, e, string(rune('a'+i)))
	}

	if len(store.mms) != 3 {
		t.Fatalf("Market Makers = %d, want 3 (25 ativos, teto 10)", len(store.mms))
	}
	seen := map[string]int{}
	total := 0
	for _, mm := range store.mms {
		if len(mm.CoveredAssetIDs) > mm.MaxAssets {
			t.Errorf("%s cobre %d, acima do teto %d", mm.AccountID, len(mm.CoveredAssetIDs), mm.MaxAssets)
		}
		for _, id := range mm.CoveredAssetIDs {
			seen[id]++
			total++
		}
	}
	if total != assets || len(seen) != assets {
		t.Errorf("cobertura total = %d, distintos = %d; want %d cada", total, len(seen), assets)
	}
	for id, n := range seen {
		if n != 1 {
			t.Errorf("ativo %s coberto %d vezes, want exatamente 1", id, n)
		}
	}
}

func TestEnsureCoverage_PropagaErros(t *testing.T) {
	boom := errors.New("boom")
	for name, store := range map[string]*fakeStore{
		"criar":       {createErr: boom},
		"provisionar": {provisionErr: boom},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := NewEnsurer(store, store).EnsureCoverage(context.Background(), Input{AssetID: "a1", MarketMakerShares: 1, Price: 1})
			if !errors.Is(err, boom) {
				t.Errorf("err = %v, want boom", err)
			}
		})
	}
}

func TestNewMarketMakerID(t *testing.T) {
	if got := NewMarketMakerID(0); got != firstMarketMakerID {
		t.Errorf("0 = %s", got)
	}
	if a, b := NewMarketMakerID(1), NewMarketMakerID(2); a == b || a == firstMarketMakerID {
		t.Errorf("IDs colidem: %s %s", a, b)
	}
}
