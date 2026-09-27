package domain

import "testing"

// TestMarketEventType_CasaComEnumPostgres garante que as constantes Go não
// derivem do enum market_event_type definido na migration 000001 — um
// typo aqui só falharia em runtime contra o Postgres real, então travamos
// os valores esperados num teste.
func TestMarketEventType_CasaComEnumPostgres(t *testing.T) {
	tests := []struct {
		got  MarketEventType
		want string
	}{
		{EventInitialDeposit, "initial_deposit"},
		{EventBuyOrderExecuted, "buy_order_executed"},
		{EventSellOrderExecuted, "sell_order_executed"},
		{EventFixedIncomePurchase, "fixed_income_purchase"},
		{EventFixedIncomeRedemption, "fixed_income_redemption"},
		{EventDividendPayment, "dividend_payment"},
		{EventBotInitialAllocation, "bot_initial_allocation"},
		{EventBotInitialCash, "bot_initial_cash"},
		{EventSalaryPayment, "salary_payment"},
	}

	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			if string(tt.got) != tt.want {
				t.Errorf("got %q, want %q", tt.got, tt.want)
			}
		})
	}
}
