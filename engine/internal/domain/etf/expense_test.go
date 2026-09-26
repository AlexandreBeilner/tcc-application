package etf

import (
	"math"
	"testing"
)

func TestDailyExpense(t *testing.T) {
	tests := []struct {
		name          string
		netAssets, pc float64
		want          float64
	}{
		{"0,5% ao ano sobre 1 milhão", 1_000_000, 0.5, 1_000_000 * 0.005 / 365},
		{"sem patrimônio", 0, 0.5, 0},
		{"sem taxa", 1_000_000, 0, 0},
		{"patrimônio negativo", -5, 0.5, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := DailyExpense(tt.netAssets, tt.pc); math.Abs(got-tt.want) > 1e-9 {
				t.Errorf("DailyExpense = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestDailyExpense_AcumuladaEm365DiasReduzASomaDaTaxaAnual(t *testing.T) {
	// sem outro movimento, 365 dias de taxa somam a taxa anual sobre o patrimônio inicial
	// (a base cai um pouco a cada dia, então soma menos que 0,5% cheio, mas perto)
	net := 1_000_000.0
	var total float64
	for i := 0; i < 365; i++ {
		fee := DailyExpense(net, 0.5)
		total += fee
		net -= fee
	}
	if total < 4950 || total > 5000 {
		t.Errorf("taxa acumulada em um ano = %v, want entre 4.950 e 5.000", total)
	}
}

func TestExpensePayment(t *testing.T) {
	tests := []struct {
		name               string
		cash, divPay, fees float64
		want               float64
	}{
		{"caixa cobre", 1000, 0, 10.129, 10.12},
		{"caixa livre menor que a taxa", 5, 0, 10, 5},
		{"caixa todo devido aos cotistas", 100, 100, 10, 0},
		{"sem caixa", 0, 0, 10, 0},
		{"sem taxa", 100, 0, 0, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ExpensePayment(tt.cash, tt.divPay, tt.fees); got != tt.want {
				t.Errorf("ExpensePayment = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestCashShortfall(t *testing.T) {
	if got := CashShortfall(100, 0, 30); got != 0 {
		t.Errorf("caixa cobre = %v, want 0", got)
	}
	if got := CashShortfall(20, 0, 30); got != 10 {
		t.Errorf("faltam 10 = %v", got)
	}
	if got := CashShortfall(100, 100, 30); got != 30 {
		t.Errorf("caixa todo devido = %v, want 30", got)
	}
}

func TestRaiseCashOrders(t *testing.T) {
	f := FundSnapshot{Holdings: []FundHolding{{AssetID: "a", Quantity: 600}, {AssetID: "b", Quantity: 400}}}
	prices := map[string]float64{"a": 10, "b": 10}
	orders, err := RaiseCashOrders(f, prices, 1000) // 10% do patrimônio de 10.000, com folga de 2%: 10,2%
	if err != nil {
		t.Fatal(err)
	}
	if len(orders) != 2 || orders[0].AssetID != "a" || orders[0].Quantity != 62 || orders[1].Quantity != 41 {
		t.Errorf("ordens = %+v, want vender 62 de a e 41 de b (fração proporcional, arredondada pra cima)", orders)
	}
	var raised float64
	for _, o := range orders {
		raised += float64(o.Quantity) * o.Price
	}
	if raised < 1000 {
		t.Errorf("levantou %v, want ao menos 1.000", raised)
	}

	all, _ := RaiseCashOrders(f, prices, 1_000_000)
	if len(all) != 2 || all[0].Quantity != 600 || all[1].Quantity != 400 {
		t.Errorf("acima do patrimônio = %+v, want vender tudo, nunca mais do que detém", all)
	}
	if none, _ := RaiseCashOrders(f, prices, 0); none != nil {
		t.Errorf("sem falta = %+v, want nenhuma ordem", none)
	}
	if _, err := RaiseCashOrders(f, map[string]float64{"a": 10}, 100); err == nil {
		t.Error("err = nil, want erro de preço ausente")
	}
}
