package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tcc-investimentos/engine/internal/domain/account"
	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/botadmin"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/orderexecution"
)

type fakeBotManager struct {
	err       error
	created   botadmin.CreateInput
	updatedID string
	updated   botadmin.UpdateInput
	fundedID  string
	funded    botadmin.FundingInput
}

func sampleAdminBot() botadmin.Bot {
	max := 10
	return botadmin.Bot{
		AccountID: validUserID, IsActive: true, Cash: 1000,
		Personality: bot.Personality{
			Archetype:        bot.ArchetypeMarketMaker,
			Scope:            bot.SpecializationScope{Sectors: []catalog.Sector{catalog.SectorBancario}, WithinScopePct: 0.9},
			RiskProfile:      bot.RiskProfile{MaxPositionSizePct: 0.5, MarketOrderPreference: 0.5, SpreadWidthPct: 0.02},
			MaxCoveredAssets: &max,
		},
		Covered:  []botadmin.AssetRef{{AssetID: validAssetID, Ticker: "AAA3"}},
		Holdings: []botadmin.Holding{{AssetID: validAssetID, Ticker: "AAA3", Quantity: 10, AveragePrice: 5}},
	}
}

func (f *fakeBotManager) List(context.Context) (botadmin.Listing, error) {
	return botadmin.Listing{Bots: []botadmin.Bot{sampleAdminBot()}, UncoveredAssets: []botadmin.AssetRef{{AssetID: validOrderID, Ticker: "ZZZ3"}}}, f.err
}

func (f *fakeBotManager) Create(_ context.Context, in botadmin.CreateInput) (botadmin.Bot, error) {
	f.created = in
	return sampleAdminBot(), f.err
}

func (f *fakeBotManager) Update(_ context.Context, id string, in botadmin.UpdateInput) (botadmin.Bot, error) {
	f.updatedID, f.updated = id, in
	return sampleAdminBot(), f.err
}

func (f *fakeBotManager) Fund(_ context.Context, id string, in botadmin.FundingInput) (botadmin.Bot, error) {
	f.fundedID, f.funded = id, in
	return sampleAdminBot(), f.err
}

func callBots(t *testing.T, m adminBotManager, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	var opts []Option
	if m != nil {
		opts = append(opts, WithBotAdmin(m))
	}
	rec := httptest.NewRecorder()
	New("", nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, opts...).Handler.ServeHTTP(rec, httptest.NewRequest(method, path, strings.NewReader(body)))
	return rec
}

func TestAdminBots_503SemServico(t *testing.T) {
	for _, tc := range []struct{ method, path string }{
		{http.MethodGet, "/admin/bots"},
		{http.MethodPost, "/admin/bots"},
		{http.MethodPatch, "/admin/bots/" + validUserID},
		{http.MethodPost, "/admin/bots/" + validUserID + "/funding"},
	} {
		if rec := callBots(t, nil, tc.method, tc.path, `{}`); rec.Code != http.StatusServiceUnavailable {
			t.Errorf("%s %s sem serviço = %d, want 503", tc.method, tc.path, rec.Code)
		}
	}
}

func TestAdminListBots(t *testing.T) {
	rec := callBots(t, &fakeBotManager{}, http.MethodGet, "/admin/bots", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	var body struct {
		Bots []struct {
			AccountID        string `json:"account_id"`
			Archetype        string `json:"archetype"`
			MaxCoveredAssets *int   `json:"max_covered_assets"`
			Scope            struct {
				Sectors      []string `json:"sectors"`
				RiskClasses  []string `json:"risk_classes"`
				AssetClasses []string `json:"asset_classes"`
			} `json:"scope"`
			CoveredAssets []struct{ Ticker string }  `json:"covered_assets"`
			Holdings      []struct{ Quantity int64 } `json:"holdings"`
		} `json:"bots"`
		UncoveredAssets []struct{ Ticker string } `json:"uncovered_assets"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Bots) != 1 || body.Bots[0].Archetype != "market_maker" || *body.Bots[0].MaxCoveredAssets != 10 ||
		len(body.Bots[0].CoveredAssets) != 1 || body.Bots[0].Holdings[0].Quantity != 10 || len(body.UncoveredAssets) != 1 {
		t.Errorf("body = %s", rec.Body)
	}
	if body.Bots[0].Scope.RiskClasses == nil || body.Bots[0].Scope.AssetClasses == nil {
		t.Error("listas vazias do escopo devem sair como [] e não null")
	}
}

func TestAdminCreateBot(t *testing.T) {
	const body = `{"archetype":"chartista","sectors":["Bancário/Financeiro"],"asset_classes":["fii"],"within_scope_pct":0.9,` +
		`"max_position_size_pct":0.3,"market_order_preference":0.4,"spread_width_pct":0.01,"initial_cash":25000}`

	t.Run("repassa os campos pro serviço", func(t *testing.T) {
		fake := &fakeBotManager{}
		rec := callBots(t, fake, http.MethodPost, "/admin/bots", body)
		if rec.Code != http.StatusCreated {
			t.Fatalf("status = %d: %s", rec.Code, rec.Body)
		}
		in := fake.created
		if in.Archetype != bot.ArchetypeChartista || len(in.Sectors) != 1 || in.Sectors[0] != catalog.SectorBancario ||
			in.AssetClasses[0] != catalog.AssetFII || in.WithinScopePct != 0.9 || in.MaxPositionSizePct != 0.3 || in.InitialCash != 25000 {
			t.Errorf("input = %+v", in)
		}
	})

	t.Run("corpo inválido é 400", func(t *testing.T) {
		if rec := callBots(t, &fakeBotManager{}, http.MethodPost, "/admin/bots", `{`); rec.Code != http.StatusBadRequest {
			t.Errorf("status = %d", rec.Code)
		}
	})

	t.Run("mapeia os erros do domínio", func(t *testing.T) {
		for _, tt := range []struct {
			err  error
			want int
		}{
			{bot.ErrInvalidWithinScopePct, http.StatusBadRequest},
			{bot.ErrSpreadWidthAboveMax, http.StatusBadRequest},
			{botadmin.ErrInvalidInitialCash, http.StatusBadRequest},
			{account.ErrAlreadyExists, http.StatusConflict},
			{errors.New("falha de banco"), http.StatusInternalServerError},
		} {
			if rec := callBots(t, &fakeBotManager{err: tt.err}, http.MethodPost, "/admin/bots", body); rec.Code != tt.want {
				t.Errorf("%v = %d, want %d", tt.err, rec.Code, tt.want)
			}
		}
	})
}

func TestAdminUpdateBot(t *testing.T) {
	t.Run("repassa só os campos informados", func(t *testing.T) {
		fake := &fakeBotManager{}
		rec := callBots(t, fake, http.MethodPatch, "/admin/bots/"+validUserID, `{"is_active":false,"covered_asset_ids":["`+validAssetID+`"]}`)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d: %s", rec.Code, rec.Body)
		}
		if fake.updatedID != validUserID || fake.updated.IsActive == nil || *fake.updated.IsActive ||
			fake.updated.MaxCoveredAssets != nil || fake.updated.CoveredAssetIDs == nil || len(*fake.updated.CoveredAssetIDs) != 1 {
			t.Errorf("updated = %+v", fake.updated)
		}
	})

	t.Run("lista vazia de cobertura chega como lista vazia, não como ausente", func(t *testing.T) {
		fake := &fakeBotManager{}
		callBots(t, fake, http.MethodPatch, "/admin/bots/"+validUserID, `{"covered_asset_ids":[]}`)
		if fake.updated.CoveredAssetIDs == nil || len(*fake.updated.CoveredAssetIDs) != 0 {
			t.Errorf("covered_asset_ids = %v, want lista vazia (tirar toda a cobertura)", fake.updated.CoveredAssetIDs)
		}
	})

	t.Run("entradas inválidas", func(t *testing.T) {
		for name, tc := range map[string]struct{ path, body string }{
			"id não é UUID":    {"/admin/bots/abc", `{"is_active":true}`},
			"corpo inválido":   {"/admin/bots/" + validUserID, `{`},
			"ativo não é UUID": {"/admin/bots/" + validUserID, `{"covered_asset_ids":["x"]}`},
		} {
			if rec := callBots(t, &fakeBotManager{}, http.MethodPatch, tc.path, tc.body); rec.Code != http.StatusBadRequest {
				t.Errorf("%s = %d, want 400", name, rec.Code)
			}
		}
	})

	t.Run("mapeia os erros do domínio", func(t *testing.T) {
		for _, tt := range []struct {
			err  error
			want int
		}{
			{botadmin.ErrBotNotFound, http.StatusNotFound},
			{botadmin.ErrAssetAlreadyCovered, http.StatusConflict},
			{botadmin.ErrNotMarketMaker, http.StatusBadRequest},
			{botadmin.ErrCoverageExceedsLimit, http.StatusBadRequest},
			{botadmin.ErrNothingToUpdate, http.StatusBadRequest},
			{&orderexecution.BatchTooLargeError{Matched: 600, Max: 500}, http.StatusUnprocessableEntity},
		} {
			if rec := callBots(t, &fakeBotManager{err: tt.err}, http.MethodPatch, "/admin/bots/"+validUserID, `{"is_active":true}`); rec.Code != tt.want {
				t.Errorf("%v = %d, want %d", tt.err, rec.Code, tt.want)
			}
		}
	})
}

func TestAdminUpdateBot_PersonalidadeEMarketOrderPreferenceIgnorada(t *testing.T) {
	fake := &fakeBotManager{}
	body := `{"sectors":["Varejo"],"risk_classes":[],"asset_classes":["fii"],"within_scope_pct":0.88,"knowledge_level":0.7,` +
		`"max_position_size_pct":0.2,"spread_width_pct":0.03,"market_order_preference":0.99}`
	rec := callBots(t, fake, http.MethodPatch, "/admin/bots/"+validUserID, body)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	in := fake.updated
	if in.Sectors == nil || (*in.Sectors)[0] != catalog.SectorVarejo || in.RiskClasses == nil || len(*in.RiskClasses) != 0 ||
		(*in.AssetClasses)[0] != catalog.AssetFII || *in.WithinScopePct != 0.88 || *in.KnowledgeLevel != 0.7 ||
		*in.MaxPositionSizePct != 0.2 || *in.SpreadWidthPct != 0.03 {
		t.Errorf("input = %+v", in)
	}
	// O campo market_order_preference não existe no UpdateInput (achado 001): é ignorado.
}

func TestAdminUpdateBot_ErrosDePersonalidadeSao400(t *testing.T) {
	for _, err := range []error{bot.ErrSpreadWidthAboveMax, bot.ErrKnowledgeLevelWrongArchetype, bot.ErrEmptySpecializationScope} {
		if rec := callBots(t, &fakeBotManager{err: err}, http.MethodPatch, "/admin/bots/"+validUserID, `{"spread_width_pct":0.5}`); rec.Code != http.StatusBadRequest {
			t.Errorf("%v = %d, want 400", err, rec.Code)
		}
	}
}

func TestAdminFundBot(t *testing.T) {
	path := "/admin/bots/" + validUserID + "/funding"

	t.Run("repassa caixa e posições", func(t *testing.T) {
		fake := &fakeBotManager{}
		rec := callBots(t, fake, http.MethodPost, path, `{"cash":5000,"holdings":[{"asset_id":"`+validAssetID+`","quantity":40}]}`)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d: %s", rec.Code, rec.Body)
		}
		if fake.fundedID != validUserID || fake.funded.Cash != 5000 || len(fake.funded.Holdings) != 1 ||
			fake.funded.Holdings[0].AssetID != validAssetID || fake.funded.Holdings[0].Quantity != 40 {
			t.Errorf("funded = %+v", fake.funded)
		}
	})

	t.Run("entradas inválidas", func(t *testing.T) {
		for name, tc := range map[string]struct{ path, body string }{
			"id não é UUID":    {"/admin/bots/abc/funding", `{"cash":1}`},
			"corpo inválido":   {path, `{`},
			"ativo não é UUID": {path, `{"holdings":[{"asset_id":"x","quantity":1}]}`},
		} {
			if rec := callBots(t, &fakeBotManager{}, http.MethodPost, tc.path, tc.body); rec.Code != http.StatusBadRequest {
				t.Errorf("%s = %d, want 400", name, rec.Code)
			}
		}
	})

	t.Run("mapeia os erros do domínio", func(t *testing.T) {
		for _, tt := range []struct {
			err  error
			want int
		}{
			{botadmin.ErrBotNotFound, http.StatusNotFound},
			{botadmin.ErrNothingToFund, http.StatusBadRequest},
			{botadmin.ErrInvalidFundingCash, http.StatusBadRequest},
			{botadmin.ErrInvalidFundingQuantity, http.StatusBadRequest},
			{botadmin.ErrAssetNotTradable, http.StatusBadRequest},
			{botadmin.ErrNoQuoteToValue, http.StatusBadRequest},
			{botadmin.ErrFloatCeilingExceeded, http.StatusConflict},
			{errors.New("falha de banco"), http.StatusInternalServerError},
		} {
			if rec := callBots(t, &fakeBotManager{err: tt.err}, http.MethodPost, path, `{"cash":1}`); rec.Code != tt.want {
				t.Errorf("%v = %d, want %d", tt.err, rec.Code, tt.want)
			}
		}
	})
}
