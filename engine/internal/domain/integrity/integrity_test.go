package integrity

import (
	"fmt"
	"testing"
)

func ptrInt(v int) *int       { return &v }
func ptrCents(v int64) *int64 { return &v }

func TestCashDeltaCents(t *testing.T) {
	tests := []struct {
		name      string
		eventType string
		qty       *int
		unit      *int64
		want      int64
	}{
		{"depósito inicial", "initial_deposit", nil, ptrCents(1000000), 1000000},
		{"caixa inicial de bot", "bot_initial_cash", nil, ptrCents(5000000), 5000000},
		{"compra debita quantidade vezes preço", "buy_order_executed", ptrInt(10), ptrCents(2550), -25500},
		{"venda credita quantidade vezes preço", "sell_order_executed", ptrInt(4), ptrCents(1000), 4000},
		{"dividendo é valor por cota vezes cotas", "dividend_payment", ptrInt(100), ptrCents(12), 1200},
		{"compra de renda fixa debita o valor", "fixed_income_purchase", nil, ptrCents(50000), -50000},
		{"resgate de renda fixa credita o valor", "fixed_income_redemption", nil, ptrCents(52000), 52000},
		{"salário credita", "salary_payment", nil, ptrCents(300000), 300000},
		{"crédito do admin credita", "admin_credit", nil, ptrCents(100000), 100000},
		{"provento do fundo debita cotas vezes valor", "etf_dividend_payout", ptrInt(50), ptrCents(30), -1500},
		{"taxa do fundo debita o valor", "etf_expense_payout", ptrInt(1), ptrCents(250), -250},
		{"alocação de float não move caixa", "bot_initial_allocation", ptrInt(1000), ptrCents(1000), 0},
		{"criação de cotas não move caixa", "etf_creation", ptrInt(-5), ptrCents(1000), 0},
		{"resgate de cotas não move caixa", "etf_redemption", ptrInt(5), ptrCents(1000), 0},
		{"transferência de cotas não move caixa", "etf_share_transfer", ptrInt(5), ptrCents(1000), 0},
		{"decisão de assembleia não move caixa", "assembly_decision", ptrInt(50), nil, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, known := CashDeltaCents(tt.eventType, tt.qty, tt.unit)
			if !known || got != tt.want {
				t.Fatalf("CashDeltaCents(%s) = %d, known=%v; quer %d", tt.eventType, got, known, tt.want)
			}
		})
	}
	if _, known := CashDeltaCents("tipo_novo", nil, nil); known {
		t.Fatal("tipo desconhecido não pode ser tratado como conhecido")
	}
}

func TestPositionDelta(t *testing.T) {
	tests := []struct {
		eventType string
		qty       int
		want      int
	}{
		{"buy_order_executed", 10, 10},
		{"sell_order_executed", 4, -4},
		{"bot_initial_allocation", 1000, 1000},
		{"etf_creation", -5, -5}, // já vem com sinal
		{"etf_redemption", 5, 5},
		{"etf_share_transfer", -3, -3},
		{"dividend_payment", 100, 0},
		{"initial_deposit", 0, 0},
	}
	for _, tt := range tests {
		if got := PositionDelta(tt.eventType, ptrInt(tt.qty)); got != tt.want {
			t.Errorf("PositionDelta(%s, %d) = %d; quer %d", tt.eventType, tt.qty, got, tt.want)
		}
	}
}

// consistentSnapshot monta uma base coerente: duas contas, uma negociando um ativo com float 100.
func consistentSnapshot() Snapshot {
	r := NewReplay()
	for _, e := range []Event{
		{UserID: "u1", EventType: "initial_deposit", UnitCents: ptrCents(1000000)},
		{UserID: "bot", EventType: "bot_initial_cash", UnitCents: ptrCents(5000000)},
		{UserID: "bot", AssetID: "a1", EventType: "bot_initial_allocation", Quantity: ptrInt(100), UnitCents: ptrCents(1000)},
		{UserID: "u1", AssetID: "a1", EventType: "buy_order_executed", Quantity: ptrInt(10), UnitCents: ptrCents(1000)},
		{UserID: "bot", AssetID: "a1", EventType: "sell_order_executed", Quantity: ptrInt(10), UnitCents: ptrCents(1000)},
	} {
		r.Apply(e)
	}
	return Snapshot{
		Accounts:  []Account{{UserID: "u1", BalanceCents: 990000}, {UserID: "bot", IsBot: true, BalanceCents: 5010000}},
		Positions: []Position{{UserID: "u1", AssetID: "a1", Ticker: "ACME3", Quantity: 10}, {UserID: "bot", AssetID: "a1", Ticker: "ACME3", Quantity: 90}},
		Floats:    []Float{{AssetID: "a1", Ticker: "ACME3", Outstanding: 100}},
		Replay:    r,
	}
}

func TestEvaluate_BaseConsistenteNaoTemDivergencia(t *testing.T) {
	report := Evaluate(consistentSnapshot())
	if report.Total != 0 || len(report.Divergences) != 0 || report.Truncated {
		t.Fatalf("esperava zero divergências; veio %+v", report)
	}
	if report.Checked.Events != 5 || report.Checked.Accounts != 2 || report.Checked.Positions != 2 || report.Checked.Assets != 1 {
		t.Fatalf("contagem conferida errada: %+v", report.Checked)
	}
}

func TestEvaluate_DivergenciasPlantadas(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(s *Snapshot)
		kind   Kind
		want   Divergence
	}{
		{
			"saldo diferente do reconstruído",
			func(s *Snapshot) { s.Accounts[0].BalanceCents = 995000 },
			KindBalanceMismatch,
			Divergence{UserID: "u1", Expected: "9900.00", Found: "9950.00", Detail: "diferença de 50.00"},
		},
		{
			"posição diferente da reconstruída",
			func(s *Snapshot) { s.Positions[0].Quantity = 12; s.Floats[0].Outstanding = 102 },
			KindPositionMismatch,
			Divergence{UserID: "u1", AssetID: "a1", Ticker: "ACME3", Expected: "10", Found: "12"},
		},
		{
			"posição que existe nos eventos mas sumiu da projeção",
			func(s *Snapshot) { s.Positions = s.Positions[1:]; s.Floats[0].Outstanding = 90 },
			KindPositionMismatch,
			Divergence{UserID: "u1", AssetID: "a1", Ticker: "ACME3", Expected: "10", Found: "0"},
		},
		{
			"float diferente da soma das posições",
			func(s *Snapshot) { s.Floats[0].Outstanding = 120 },
			KindFloatMismatch,
			Divergence{AssetID: "a1", Ticker: "ACME3", Expected: "120", Found: "100"},
		},
		{
			"saldo negativo",
			func(s *Snapshot) {
				s.Accounts[0].BalanceCents = -500
			},
			KindNegativeBalance,
			Divergence{UserID: "u1", Expected: "0.00 ou mais", Found: "-5.00"},
		},
		{
			"compra em repouso sem caixa",
			func(s *Snapshot) {
				s.RestingOrders = []RestingOrder{{ID: "o1", UserID: "u1", AssetID: "a1", Ticker: "ACME3", Side: "buy", RemainingQty: 2000, PriceCents: 1000}}
			},
			KindRestingOrderUnfunded,
			Divergence{UserID: "u1", AssetID: "a1", Ticker: "ACME3", OrderID: "o1", Expected: "20000.00", Found: "9900.00"},
		},
		{
			"venda em repouso sem posição",
			func(s *Snapshot) {
				s.RestingOrders = []RestingOrder{{ID: "o2", UserID: "u1", AssetID: "a1", Ticker: "ACME3", Side: "sell", RemainingQty: 11, PriceCents: 1000}}
			},
			KindRestingOrderUnfunded,
			Divergence{UserID: "u1", AssetID: "a1", Ticker: "ACME3", OrderID: "o2", Expected: "11", Found: "10"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := consistentSnapshot()
			tt.mutate(&s)
			report := Evaluate(s)
			if report.Counts[tt.kind] != 1 {
				t.Fatalf("esperava 1 divergência %s; contagens %v, lista %+v", tt.kind, report.Counts, report.Divergences)
			}
			var got *Divergence
			for i := range report.Divergences {
				if report.Divergences[i].Kind == tt.kind {
					got = &report.Divergences[i]
				}
			}
			want := tt.want
			want.Kind = tt.kind
			if got != nil && want.Detail == "" {
				got.Detail = "" // o texto livre só é conferido quando o caso o informa
			}
			if got == nil || *got != want {
				t.Fatalf("divergência = %+v; quer %+v", got, want)
			}
		})
	}
}

func TestEvaluate_OrdemNaoDivergeQuandoOsFundosCobrem(t *testing.T) {
	s := consistentSnapshot()
	s.RestingOrders = []RestingOrder{
		{ID: "ok-buy", UserID: "u1", AssetID: "a1", Side: "buy", RemainingQty: 99, PriceCents: 1000}, // 990.00 <= 9900.00
		{ID: "ok-sell", UserID: "u1", AssetID: "a1", Side: "sell", RemainingQty: 10},
		{ID: "mercado", UserID: "u1", AssetID: "a1", Side: "buy", RemainingQty: 5000, IsMarketOrder: true},
	}
	if report := Evaluate(s); report.Total != 0 {
		t.Fatalf("ordens cobertas não divergem: %+v", report.Divergences)
	}
}

func TestEvaluate_TipoDeEventoDesconhecidoVira(t *testing.T) {
	s := consistentSnapshot()
	s.Replay.Apply(Event{UserID: "u1", EventType: "evento_do_futuro"})
	report := Evaluate(s)
	if report.Counts[KindUnknownEventType] != 1 {
		t.Fatalf("esperava 1 divergência de tipo desconhecido; %v", report.Counts)
	}
}

func TestEvaluate_ContaSemEventoTemSaldoDivergente(t *testing.T) {
	s := consistentSnapshot()
	s.Accounts = append(s.Accounts, Account{UserID: "u-sem-historico", BalanceCents: 1000000})
	report := Evaluate(s)
	if report.Counts[KindBalanceMismatch] != 1 {
		t.Fatalf("conta sem eventos com saldo deveria divergir: %v", report.Counts)
	}
}

func TestEvaluate_TruncaAListaMasMantemAsContagens(t *testing.T) {
	r := NewReplay()
	var accounts []Account
	for i := 0; i < MaxListedDivergences+50; i++ {
		accounts = append(accounts, Account{UserID: fmt.Sprintf("u%04d", i), BalanceCents: 100})
	}
	report := Evaluate(Snapshot{Accounts: accounts, Replay: r})
	if report.Total != MaxListedDivergences+50 || report.Counts[KindBalanceMismatch] != MaxListedDivergences+50 {
		t.Fatalf("contagem exata esperada: total=%d counts=%v", report.Total, report.Counts)
	}
	if len(report.Divergences) != MaxListedDivergences || !report.Truncated {
		t.Fatalf("lista deveria truncar em %d: len=%d truncated=%v", MaxListedDivergences, len(report.Divergences), report.Truncated)
	}
}

func TestEvaluate_OrdemDeterministica(t *testing.T) {
	s := consistentSnapshot()
	s.Accounts[0].BalanceCents = 1
	s.Accounts[1].BalanceCents = 2
	s.Floats[0].Outstanding = 7
	first := Evaluate(s)
	second := Evaluate(s)
	if len(first.Divergences) != len(second.Divergences) {
		t.Fatal("tamanhos diferentes")
	}
	for i := range first.Divergences {
		if first.Divergences[i] != second.Divergences[i] {
			t.Fatalf("posição %d difere entre duas execuções", i)
		}
	}
	if first.Divergences[0].Kind != KindBalanceMismatch || first.Divergences[len(first.Divergences)-1].Kind != KindFloatMismatch {
		t.Fatalf("ordem por categoria esperada: %+v", first.Divergences)
	}
}
