// Package integrity é a verificação de integridade financeira do painel admin (tarefa
// N.21). Como `market_events` é a fonte da verdade (Event Sourcing, CLAUDE.md), o painel
// precisa poder provar que o estado projetado (`accounts`, `positions`, o float em
// `outstanding_shares`) bate com o histórico: o saldo e a posição de cada conta são
// reconstruídos só a partir dos eventos e comparados com a projeção.
//
// A verificação é SOMENTE LEITURA e só reporta: corrigir uma divergência é decisão humana,
// nunca um botão. As regras (o efeito de cada tipo de evento no caixa e na posição, a
// comparação, a classificação) são funções puras; ler o banco e rodar em segundo plano ficam
// de fora (interface Source e Service).
package integrity

import (
	"fmt"
	"sort"
)

// Kind classifica uma divergência. Os valores são parte do contrato com o painel.
type Kind string

const (
	// KindBalanceMismatch: o saldo projetado em `accounts` difere do reconstruído dos eventos.
	KindBalanceMismatch Kind = "balance_mismatch"
	// KindPositionMismatch: a posição projetada em `positions` difere da reconstruída.
	KindPositionMismatch Kind = "position_mismatch"
	// KindNegativeBalance: saldo negativo (o CHECK da migration 000025 deveria impedir).
	KindNegativeBalance Kind = "negative_balance"
	// KindNegativePosition: quantidade de posição negativa.
	KindNegativePosition Kind = "negative_position"
	// KindFloatMismatch: a soma das posições de um ativo difere do float (`outstanding_shares`).
	KindFloatMismatch Kind = "float_mismatch"
	// KindRestingOrderUnfunded: ordem em repouso cujo dono, sozinho, não tem caixa (compra)
	// ou posição (venda) pra honrá-la (achado 015: ordem "fantasma").
	KindRestingOrderUnfunded Kind = "resting_order_unfunded"
	// KindUnknownEventType: evento de um tipo que esta verificação não sabe reconstruir. Existe
	// pra um tipo novo nunca passar despercebido: quem o criou precisa ensinar a regra aqui.
	KindUnknownEventType Kind = "unknown_event_type"
)

// AllKinds é a ordem estável das categorias no relatório.
var AllKinds = []Kind{
	KindBalanceMismatch,
	KindPositionMismatch,
	KindNegativeBalance,
	KindNegativePosition,
	KindFloatMismatch,
	KindRestingOrderUnfunded,
	KindUnknownEventType,
}

// MaxListedDivergences limita quantas divergências vão detalhadas no relatório; as contagens
// por categoria continuam exatas. Uma base muito quebrada não pode estourar a resposta.
const MaxListedDivergences = 200

// Event é um evento já lido do log, com o valor unitário em centavos (numeric(15,2) vira
// inteiro exato: nenhuma comparação de dinheiro passa por ponto flutuante).
type Event struct {
	UserID    string
	AssetID   string // vazio quando o evento não tem ativo
	EventType string
	Quantity  *int
	UnitCents *int64
}

// CashDeltaCents é o efeito do evento no caixa da conta, em centavos. `known` é falso pra um
// tipo que esta verificação não conhece.
func CashDeltaCents(eventType string, quantity *int, unitCents *int64) (delta int64, known bool) {
	unit := int64(0)
	if unitCents != nil {
		unit = *unitCents
	}
	qty := int64(0)
	if quantity != nil {
		qty = int64(*quantity)
	}
	switch eventType {
	// Créditos em caixa pelo valor unitário (qty nulo ou 1): capital inicial, caixa do bot,
	// salário (T.2), crédito do admin (N.17), resgate de renda fixa.
	case "initial_deposit", "bot_initial_cash", "salary_payment", "admin_credit", "fixed_income_redemption":
		return unit, true
	case "fixed_income_purchase", "etf_expense_payout":
		return -unit, true
	// Compra e venda: valor por cota vezes a quantidade.
	case "buy_order_executed":
		return -qty * unit, true
	case "sell_order_executed", "dividend_payment":
		return qty * unit, true
	case "etf_dividend_payout":
		return -qty * unit, true
	// Não movem caixa (só posição): alocação inicial do float de bot, criação e resgate de
	// cotas de ETF (a contrapartida é em espécie) e a transferência de cotas.
	case "bot_initial_allocation", "etf_creation", "etf_redemption", "etf_share_transfer":
		return 0, true
	}
	return 0, false
}

// PositionDelta é o efeito do evento na posição do ativo, em quantidade. Compra e alocação
// somam, venda subtrai e os eventos de ETF já trazem a quantidade COM SINAL (igual ao delta
// da posição daquela conta, migrations 000026 e 000028).
func PositionDelta(eventType string, quantity *int) int {
	qty := 0
	if quantity != nil {
		qty = *quantity
	}
	switch eventType {
	case "buy_order_executed", "bot_initial_allocation", "etf_creation", "etf_redemption", "etf_share_transfer":
		return qty
	case "sell_order_executed":
		return -qty
	}
	return 0
}

// PositionKey identifica a posição de uma conta em um ativo.
type PositionKey struct {
	UserID  string
	AssetID string
}

// Replay acumula o estado reconstruído dos eventos, na ordem em que chegam.
type Replay struct {
	cash      map[string]int64
	positions map[PositionKey]int
	unknown   map[string]int
	events    int
}

func NewReplay() *Replay {
	return &Replay{cash: map[string]int64{}, positions: map[PositionKey]int{}, unknown: map[string]int{}}
}

// Apply incorpora um evento.
func (r *Replay) Apply(e Event) {
	r.events++
	delta, known := CashDeltaCents(e.EventType, e.Quantity, e.UnitCents)
	if !known {
		r.unknown[e.EventType]++
		return
	}
	// Toda conta que tem evento entra no mapa, mesmo com efeito zero: é a diferença entre
	// "conta sem histórico" e "conta cujo histórico soma zero".
	r.cash[e.UserID] += delta
	if e.AssetID != "" {
		if d := PositionDelta(e.EventType, e.Quantity); d != 0 {
			r.positions[PositionKey{UserID: e.UserID, AssetID: e.AssetID}] += d
		}
	}
}

// Account é a conta projetada.
type Account struct {
	UserID       string
	IsBot        bool
	BalanceCents int64
}

// Position é a posição projetada.
type Position struct {
	UserID   string
	AssetID  string
	Ticker   string
	Quantity int
}

// Float é o float de um ativo de renda variável.
type Float struct {
	AssetID     string
	Ticker      string
	Outstanding int64
}

// RestingOrder é uma ordem em repouso (pendente ou parcialmente preenchida), com o que falta.
type RestingOrder struct {
	ID            string
	UserID        string
	AssetID       string
	Ticker        string
	Side          string // "buy" ou "sell"
	RemainingQty  int
	PriceCents    int64
	IsMarketOrder bool
}

// Snapshot é tudo o que a verificação compara, lido numa única fotografia consistente do banco.
type Snapshot struct {
	Accounts      []Account
	Positions     []Position
	Floats        []Float
	RestingOrders []RestingOrder
	Replay        *Replay
}

// Divergence é uma inconsistência encontrada. Esperado é o que os eventos dizem (ou a regra
// exige); Encontrado é o que está projetado. Valores monetários em reais com duas casas.
type Divergence struct {
	Kind     Kind
	UserID   string
	AssetID  string
	Ticker   string
	OrderID  string
	Expected string
	Found    string
	Detail   string
}

// Counters resume o que foi conferido.
type Counters struct {
	Events        int
	Accounts      int
	Positions     int
	Assets        int
	RestingOrders int
}

// Report é o resultado: zero divergências em uma base consistente.
type Report struct {
	Checked     Counters
	Counts      map[Kind]int
	Total       int
	Divergences []Divergence
	// Truncated é verdadeiro quando há mais divergências do que as listadas.
	Truncated bool
}

func reais(cents int64) string {
	sign := ""
	if cents < 0 {
		sign = "-"
		cents = -cents
	}
	return fmt.Sprintf("%s%d.%02d", sign, cents/100, cents%100)
}

// Evaluate compara a projeção com a reconstrução e devolve o relatório. A ordem das
// divergências é determinística (por categoria, depois por conta e ativo), pra duas
// verificações da mesma base darem o mesmo resultado.
func Evaluate(s Snapshot) Report {
	replay := s.Replay
	if replay == nil {
		replay = NewReplay()
	}
	report := Report{
		Checked: Counters{
			Events:        replay.events,
			Accounts:      len(s.Accounts),
			Positions:     len(s.Positions),
			Assets:        len(s.Floats),
			RestingOrders: len(s.RestingOrders),
		},
		Counts: map[Kind]int{},
	}
	var found []Divergence
	add := func(d Divergence) { found = append(found, d) }

	accountBalance := map[string]int64{}
	for _, a := range s.Accounts {
		accountBalance[a.UserID] = a.BalanceCents
		replayed := replay.cash[a.UserID]
		if a.BalanceCents != replayed {
			add(Divergence{
				Kind: KindBalanceMismatch, UserID: a.UserID,
				Expected: reais(replayed), Found: reais(a.BalanceCents),
				Detail: fmt.Sprintf("diferença de %s", reais(a.BalanceCents-replayed)),
			})
		}
		if a.BalanceCents < 0 {
			add(Divergence{Kind: KindNegativeBalance, UserID: a.UserID, Expected: "0.00 ou mais", Found: reais(a.BalanceCents)})
		}
	}

	projected := map[PositionKey]int{}
	tickers := map[string]string{}
	heldByAsset := map[string]int64{}
	for _, p := range s.Positions {
		projected[PositionKey{UserID: p.UserID, AssetID: p.AssetID}] = p.Quantity
		tickers[p.AssetID] = p.Ticker
		heldByAsset[p.AssetID] += int64(p.Quantity)
		if p.Quantity < 0 {
			add(Divergence{Kind: KindNegativePosition, UserID: p.UserID, AssetID: p.AssetID, Ticker: p.Ticker,
				Expected: "0 ou mais", Found: fmt.Sprint(p.Quantity)})
		}
	}
	for _, f := range s.Floats {
		tickers[f.AssetID] = f.Ticker
	}
	// Posição reconstruída sem linha projetada (ou o inverso) também diverge: a união das chaves.
	keys := map[PositionKey]struct{}{}
	for k := range projected {
		keys[k] = struct{}{}
	}
	for k := range replay.positions {
		keys[k] = struct{}{}
	}
	for k := range keys {
		if projected[k] != replay.positions[k] {
			add(Divergence{Kind: KindPositionMismatch, UserID: k.UserID, AssetID: k.AssetID, Ticker: tickers[k.AssetID],
				Expected: fmt.Sprint(replay.positions[k]), Found: fmt.Sprint(projected[k])})
		}
	}

	for _, f := range s.Floats {
		if held := heldByAsset[f.AssetID]; held != f.Outstanding {
			add(Divergence{Kind: KindFloatMismatch, AssetID: f.AssetID, Ticker: f.Ticker,
				Expected: fmt.Sprint(f.Outstanding), Found: fmt.Sprint(held),
				Detail: "soma das posições difere das cotas em circulação"})
		}
	}

	for _, o := range s.RestingOrders {
		switch o.Side {
		case "buy":
			// Ordem a mercado em repouso não tem preço de limite, então não há custo a conferir.
			if o.IsMarketOrder {
				continue
			}
			need := int64(o.RemainingQty) * o.PriceCents
			if balance := accountBalance[o.UserID]; need > balance {
				add(Divergence{Kind: KindRestingOrderUnfunded, UserID: o.UserID, AssetID: o.AssetID, Ticker: o.Ticker, OrderID: o.ID,
					Expected: reais(need), Found: reais(balance), Detail: "compra em repouso maior que o caixa do dono"})
			}
		case "sell":
			if held := projected[PositionKey{UserID: o.UserID, AssetID: o.AssetID}]; o.RemainingQty > held {
				add(Divergence{Kind: KindRestingOrderUnfunded, UserID: o.UserID, AssetID: o.AssetID, Ticker: o.Ticker, OrderID: o.ID,
					Expected: fmt.Sprint(o.RemainingQty), Found: fmt.Sprint(held), Detail: "venda em repouso maior que a posição do dono"})
			}
		}
	}

	types := make([]string, 0, len(replay.unknown))
	for t := range replay.unknown {
		types = append(types, t)
	}
	sort.Strings(types)
	for _, t := range types {
		add(Divergence{Kind: KindUnknownEventType, Expected: "tipo conhecido", Found: t,
			Detail: fmt.Sprintf("%d evento(s) do tipo %q que a verificação não sabe reconstruir", replay.unknown[t], t)})
	}

	rank := map[Kind]int{}
	for i, k := range AllKinds {
		rank[k] = i
	}
	sort.SliceStable(found, func(i, j int) bool {
		a, b := found[i], found[j]
		if rank[a.Kind] != rank[b.Kind] {
			return rank[a.Kind] < rank[b.Kind]
		}
		if a.UserID != b.UserID {
			return a.UserID < b.UserID
		}
		if a.AssetID != b.AssetID {
			return a.AssetID < b.AssetID
		}
		return a.OrderID < b.OrderID
	})
	for _, d := range found {
		report.Counts[d.Kind]++
	}
	report.Total = len(found)
	if len(found) > MaxListedDivergences {
		report.Truncated = true
		found = found[:MaxListedDivergences]
	}
	report.Divergences = found
	return report
}
