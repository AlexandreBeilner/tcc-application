package tick

import (
	"context"
	"testing"

	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/domain/orderbook"
	"tcc-investimentos/engine/internal/domain/orderexecution"
)

// arbWorld simula, com estado, o book (ordens a mercado do participante), as
// posições e o caixa dele e a troca de cotas por cesta: o suficiente pra
// verificar a arbitragem de ponta a ponta sem banco.
type arbWorld struct {
	held     map[string]int64
	cash     float64
	price    map[string]float64
	depth    map[string]int64 // quanto o book absorve por ordem (ausente = tudo)
	orders   []orderexecution.Request
	created  []etf.ShareExchange
	redeemed []etf.ShareExchange
	provided []float64
}

func newArbWorld() *arbWorld {
	return &arbWorld{
		held:  map[string]int64{},
		price: map[string]float64{"a": 100, "b": 100, "etf1": 100},
		depth: map[string]int64{},
	}
}

func (w *arbWorld) Submit(_ context.Context, req orderexecution.Request) (orderexecution.Outcome, error) {
	w.orders = append(w.orders, req)
	qty := int64(req.Quantity)
	if d, ok := w.depth[req.AssetID]; ok && qty > d {
		qty = d
	}
	if req.Side == orderbook.SideSell && qty > w.held[req.AssetID] {
		qty = w.held[req.AssetID]
	}
	if qty <= 0 {
		return orderexecution.Outcome{RemainingQuantity: req.Quantity}, nil
	}
	sign := int64(1)
	if req.Side == orderbook.SideSell {
		sign = -1
	}
	w.held[req.AssetID] += sign * qty
	w.cash -= float64(sign*qty) * w.price[req.AssetID]
	return orderexecution.Outcome{
		Fills:          []orderexecution.Fill{{Price: w.price[req.AssetID], Quantity: int(qty)}},
		FilledQuantity: int(qty),
	}, nil
}

func (w *arbWorld) SubmitWithContext(ctx context.Context, req orderexecution.Request, _ orderexecution.Context) (orderexecution.Outcome, error) {
	return w.Submit(ctx, req)
}

func (w *arbWorld) ProvisionCash(_ context.Context, _ string, amount float64) error {
	w.cash += amount
	w.provided = append(w.provided, amount)
	return nil
}

func (w *arbWorld) ParticipantCash(context.Context) (float64, error) { return w.cash, nil }

func (w *arbWorld) ParticipantHoldings(context.Context, []string) (map[string]int64, error) {
	out := make(map[string]int64, len(w.held))
	for k, v := range w.held {
		out[k] = v
	}
	return out, nil
}

func (w *arbWorld) Create(_ context.Context, e etf.ShareExchange) error {
	for _, leg := range e.Basket {
		if w.held[leg.AssetID] < leg.Quantity {
			return etf.ErrInvalidBasketLeg
		}
		w.held[leg.AssetID] -= leg.Quantity
	}
	w.held[e.ETFAssetID] += e.Shares
	w.created = append(w.created, e)
	return nil
}

func (w *arbWorld) Redeem(_ context.Context, e etf.ShareExchange) error {
	if w.held[e.ETFAssetID] < e.Shares {
		return etf.ErrInvalidShareAmount
	}
	w.held[e.ETFAssetID] -= e.Shares
	for _, leg := range e.Basket {
		w.held[leg.AssetID] += leg.Quantity
	}
	w.redeemed = append(w.redeemed, e)
	return nil
}

// arbFixture: fundo de 10.000 cotas com 6.000 de a e 4.000 de b a 100 (NAV 100 a
// preço cheio das cotas de a e b; iNAV = (6000*100+4000*100)/10000 = 100).
func arbFixture(etfPrice float64) (*Service, *roundRun, *arbWorld) {
	world := newArbWorld()
	fund := etf.FundSnapshot{
		ETFAssetID: "etf1", FundAccountID: "fund1", Shares: 10000,
		Holdings: []etf.FundHolding{{AssetID: "a", Quantity: 6000}, {AssetID: "b", Quantity: 4000}},
	}
	svc := newTestService(&fakeRepository{})
	svc.orderSubmitter = world
	svc.WithETF(ETFDeps{Funds: &fakeETFFunds{}, Participant: world, Exchanger: world})
	run := &roundRun{
		equities:        map[string]*equityRoundState{"a": {Price: 100}, "b": {Price: 100}, "etf1": {Price: etfPrice}},
		volumeByAssetID: map[string]int{},
		etfFunds:        map[string]etf.FundSnapshot{"etf1": fund},
	}
	return svc, run, world
}

func TestArbitrageETFs_SemDesvioNaoFazNada(t *testing.T) {
	svc, run, world := arbFixture(100.8)

	if err := svc.arbitrageETFs(context.Background(), run); err != nil {
		t.Fatalf("err = %v", err)
	}
	if len(world.orders) != 0 || len(world.provided) != 0 || len(world.created)+len(world.redeemed) != 0 {
		t.Errorf("ordens = %d, caixa = %v, trocas = %d, want nada dentro da faixa", len(world.orders), world.provided, len(world.created)+len(world.redeemed))
	}
}

func TestArbitrageETFs_AgioCriaCotasEAsVendeAoMercado(t *testing.T) {
	svc, run, world := arbFixture(105) // ágio de 5%: lote cheio, 2% das cotas = 200

	if err := svc.arbitrageETFs(context.Background(), run); err != nil {
		t.Fatalf("err = %v", err)
	}
	if len(world.created) != 1 || world.created[0].Shares != 200 {
		t.Fatalf("criações = %+v, want 1 de 200 cotas", world.created)
	}
	basket := world.created[0].Basket
	if len(basket) != 2 || basket[0].Quantity != 120 || basket[1].Quantity != 80 {
		t.Errorf("cesta = %+v, want 120 de a e 80 de b (pro-rata do fundo)", basket)
	}
	if world.held["etf1"] != 0 || world.held["a"] != 0 || world.held["b"] != 0 {
		t.Errorf("posições do participante = %v, want cotas vendidas e cesta entregue ao fundo", world.held)
	}
	last := world.orders[len(world.orders)-1]
	if last.AssetID != "etf1" || last.Side != orderbook.SideSell || last.Quantity != 200 {
		t.Errorf("última ordem = %+v, want venda a mercado das 200 cotas", last)
	}
	if len(world.provided) != 1 {
		t.Errorf("caixa provisionado = %v, want 1 provisionamento pro custo da cesta", world.provided)
	}
}

func TestArbitrageETFs_DesagioResgataECestaVaiAosBooks(t *testing.T) {
	svc, run, world := arbFixture(95)

	if err := svc.arbitrageETFs(context.Background(), run); err != nil {
		t.Fatalf("err = %v", err)
	}
	if len(world.redeemed) != 1 || world.redeemed[0].Shares != 200 {
		t.Fatalf("resgates = %+v, want 1 de 200 cotas", world.redeemed)
	}
	if world.held["etf1"] != 0 || world.held["a"] != 0 || world.held["b"] != 0 {
		t.Errorf("posições do participante = %v, want cotas destruídas e cesta vendida", world.held)
	}
	if len(world.orders) != 3 || world.orders[0].Side != orderbook.SideBuy || world.orders[0].AssetID != "etf1" {
		t.Errorf("ordens = %+v, want compra das cotas e depois venda das 2 pernas", world.orders)
	}
}

func TestArbitrageETFs_BookQueAbsorveuSoParteReduzOLote(t *testing.T) {
	svc, run, world := arbFixture(105)
	world.depth["b"] = 40 // b sustenta só 40 de 80: metade do lote

	if err := svc.arbitrageETFs(context.Background(), run); err != nil {
		t.Fatalf("err = %v", err)
	}
	if len(world.created) != 1 || world.created[0].Shares != 100 {
		t.Fatalf("criações = %+v, want 1 de 100 cotas (b limita)", world.created)
	}
	if world.held["a"] != 60 {
		t.Errorf("sobra de a = %d, want 60 (comprou 120, entregou 60)", world.held["a"])
	}
}

func TestArbitrageETFs_SemLiquidezNaoCriaNada(t *testing.T) {
	svc, run, world := arbFixture(105)
	world.depth["a"], world.depth["b"] = 0, 0

	if err := svc.arbitrageETFs(context.Background(), run); err != nil {
		t.Fatalf("err = %v", err)
	}
	if len(world.created) != 0 {
		t.Errorf("criações = %d, want 0", len(world.created))
	}
}

func TestArbitrageETFs_RespeitaCaixaJaExistente(t *testing.T) {
	svc, run, world := arbFixture(105)
	world.cash = 1_000_000

	if err := svc.arbitrageETFs(context.Background(), run); err != nil {
		t.Fatalf("err = %v", err)
	}
	if len(world.provided) != 0 {
		t.Errorf("caixa provisionado = %v, want nada (o participante já tinha caixa)", world.provided)
	}
}

func TestArbitrageETFs_ConstituenteForaDoUniversoNaoAge(t *testing.T) {
	svc, run, world := arbFixture(105)
	delete(run.equities, "b")

	if err := svc.arbitrageETFs(context.Background(), run); err != nil {
		t.Fatalf("err = %v", err)
	}
	if len(world.orders) != 0 {
		t.Errorf("ordens = %d, want 0", len(world.orders))
	}
}

func TestArbitrageETFs_SemWithETFNaoFazNada(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	if err := svc.arbitrageETFs(context.Background(), etfTestRun()); err != nil {
		t.Errorf("err = %v, want nil", err)
	}
}

func TestArbitrageETFs_UsaSobraDeConstituinteDoParticipante(t *testing.T) {
	svc, run, world := arbFixture(105)
	world.held["a"] = 500 // sobra de uma arbitragem anterior, mais que os 120 da cesta

	if err := svc.arbitrageETFs(context.Background(), run); err != nil {
		t.Fatalf("err = %v", err)
	}
	for _, o := range world.orders {
		if o.AssetID == "a" && o.Side == orderbook.SideBuy {
			t.Errorf("comprou %d de a, want nenhuma compra (a sobra cobre a cesta)", o.Quantity)
		}
	}
	if world.held["a"] != 380 {
		t.Errorf("a do participante = %d, want 380 (500 menos os 120 entregues)", world.held["a"])
	}
}
