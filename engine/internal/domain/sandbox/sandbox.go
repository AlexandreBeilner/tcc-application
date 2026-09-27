// Package sandbox modela o ambiente de aprendizagem individual e
// determinístico (RF12/RNF08, tarefa 4.11) — nunca ganhou task própria em
// nenhuma semana já numerada antes desta, apesar de orderexecution (3.12) e
// fixedincomeexecution (3.13) já rejeitarem explicitamente qualquer ativo
// `is_sandbox = true` desde que foram escritos.
//
// Decisão de design confirmada com o usuário em 2026-08-23 (backlog 4.11,
// não estava em nenhum dos três documentos de referência): em vez de
// reaproveitar os geradores estocásticos do Mercado Ao Vivo (equity.NextPrice,
// selic.NextCalendarRate) com uma seed por usuário, cada ativo fictício de
// sandbox usa um roteiro fixo e pré-computado — a mesma série pra todo
// usuário, sem aleatoriedade nenhuma. Isso garante a equidade pedagógica de
// RNF08 trivialmente (dois usuários no mesmo estágio da trilha veem
// exatamente a mesma curva, não só a mesma distribuição estatística) e evita
// reabrir o motor de séries estocásticas (tick.Advance) só pra essa decisão.
//
// "Dia" do roteiro conta a partir da primeira operação do usuário naquele
// ativo (spec 3.1: sandbox é individual e roteirizado, não sincronizado com o
// Mercado Ao Vivo), medido em dias SIMULADOS (tarefa S.1, achado 022): o
// ponto de partida é positions.created_day / fixed_income_positions.
// created_day (dia simulado da primeira compra) e o "agora" é
// market_calendar.current_day, nunca o relógio de parede. created_day é preservado por
// ON CONFLICT ... DO UPDATE (nunca sobrescrito numa compra seguinte) e o
// resgate de renda fixa sempre apaga a linha inteira (fixedincomeexecution
// nota 5), então uma recompra depois de um resgate legitimamente reinicia a
// contagem — é uma "primeira operação" nova.
//
// Os roteiros ficam indexados por ticker, não por AssetID: assets.id é
// gerado pelo Postgres (gen_random_uuid(), catalog_repository.go), então não
// dá pra fixar um roteiro por UUID em tempo de compilação. O catálogo de
// roteiros deste pacote é pequeno e ilustrativo (por conceito de lição, não
// o catálogo completo do currículo — isso é a tarefa 7.2), mesmo tratamento
// "sujeito à calibração 8.1" já usado pros outros dados ilustrativos do
// catálogo (interest_rate, net_worth etc.).
//
// A tarefa cobre as duas classes de ativo, cada uma com o tipo de roteiro
// que já consumia no Mercado Ao Vivo — não são o mesmo dado: PriceScript
// (renda variável — ação/ETF/FII, insumo = preço, consumido por
// orderexecution via internal/infra/db/order_execution_repository.go) e
// RateScript (renda fixa pós-fixada e a taxa de mercado usada em
// EarlyRedemption pro prefixado, consumido por fixedincomeexecution via
// internal/infra/db/fixed_income_execution_repository.go). IPCAScript
// (Tesouro IPCA+) é definido e testado por simetria, mas — mesma decisão de
// escopo já tomada pro Mercado Ao Vivo, fixedincomeexecution.go nota 2 —
// **não tem consumidor real**: Tesouro IPCA+ sandbox reaproveita RateScript
// como todos os outros 7 tipos, porque fixedincomeexecution já reaproveita a
// mesma precificação por deságio nominal (PrefixedPrice) pra ele em vez da
// projeção real de VNA. Nenhum ativo sandbox de Tesouro IPCA+ é seedado
// nesta tarefa por esse motivo — não haveria rota nenhuma exercitando
// IPCAScript.
package sandbox

// PriceScript é a curva de preço fixa e determinística de um ativo sandbox
// de renda variável — mesma curva pra todo usuário; só o índice que mapeia
// pro "agora" de cada usuário é individual (ver DaysSince/PriceOnDay).
type PriceScript struct {
	PricesByDay []float64
}

// RateScript é a curva de taxa anual (%) fixa e determinística de um ativo
// sandbox de renda fixa — serve tanto de taxa contratada (lida no dia da
// compra) quanto de taxa de mercado corrente (lida no dia do resgate, pra
// marcação a mercado) — fixedincomeexecution já trata as duas grandezas
// como a mesma "taxa do dia" pro Mercado Ao Vivo (interest_rate do catálogo
// na compra, market_calendar.selic_rate no resgate), então o sandbox só
// precisa de uma curva, lida em dois dias diferentes.
type RateScript struct {
	AnnualRateByDay []float64
}

// IPCAScript é a curva de IPCA mensal fixa e determinística pro Tesouro
// IPCA+ sandbox — definida e testada por simetria com RateScript/PriceScript,
// mas sem consumidor real hoje (ver doc do pacote).
type IPCAScript struct {
	MonthlyIPCAByDay []float64
}

// PriceOnDay devolve o preço do dia dayIndex do roteiro, clampando no
// último dia da série se dayIndex for maior (o roteiro "estabiliza" no
// último valor, não extrapola) — mesmo raciocínio de clamping que
// PriceOnDay em outros pacotes do motor já aplicam pra série finita.
func PriceOnDay(script PriceScript, dayIndex int) float64 {
	return script.PricesByDay[clampIndex(dayIndex, len(script.PricesByDay))]
}

// RateOnDay devolve a taxa anual (%) do dia dayIndex do roteiro, mesmo
// clamping de PriceOnDay.
func RateOnDay(script RateScript, dayIndex int) float64 {
	return script.AnnualRateByDay[clampIndex(dayIndex, len(script.AnnualRateByDay))]
}

// IPCAOnDay devolve o IPCA mensal do dia dayIndex do roteiro, mesmo
// clamping de PriceOnDay. Sem consumidor real hoje (ver doc do pacote) —
// existe pra ser testado isoladamente e ficar pronto pro dia em que Tesouro
// IPCA+ ganhar uma precificação por VNA de verdade, tanto no Mercado Ao Vivo
// quanto no sandbox.
func IPCAOnDay(script IPCAScript, dayIndex int) float64 {
	return script.MonthlyIPCAByDay[clampIndex(dayIndex, len(script.MonthlyIPCAByDay))]
}

func clampIndex(dayIndex, length int) int {
	if dayIndex < 0 {
		return 0
	}
	if dayIndex >= length {
		return length - 1
	}
	return dayIndex
}

// DaysSince converte o tempo decorrido desde a primeira operação do usuário
// naquele ativo num índice de dia do roteiro, ambos em DIA SIMULADO
// (positions.created_day / market_calendar.current_day, tarefa S.1) — nunca
// negativo (um dia corrente anterior ao da primeira operação, por qualquer
// motivo de infraestrutura, sempre cai no dia 0, nunca num índice inválido).
func DaysSince(firstOperationDay, currentDay int) int {
	days := currentDay - firstOperationDay
	if days < 0 {
		return 0
	}
	return days
}

// priceScriptsByTicker é o catálogo pequeno e ilustrativo de roteiros de
// preço — um por conceito de lição que precisa de um ativo sandbox pra
// demonstrar (lição 2.3: primeira operação de ações, spec 3.1 já cita o
// exemplo "sobe 3% nos primeiros 3 dias, depois estabiliza").
var priceScriptsByTicker = map[string]PriceScript{
	"SAND3": {PricesByDay: []float64{100.00, 101.00, 102.00, 103.00}},
}

// rateScriptsByTicker é o catálogo pequeno e ilustrativo de roteiros de
// taxa — lição 1.7 (marcação a mercado) precisa mostrar os dois cenários,
// perda e ganho extraordinário, de forma controlada: taxa contratada 10% no
// dia da compra (dia 0), sobe pra 15% nos dias 1–3 (resgatar aí marca a
// mercado com perda — taxa de mercado acima da contratada), cai pra 6% do
// dia 4 em diante (resgatar aí marca a mercado com ganho extraordinário —
// taxa de mercado abaixo da contratada).
var rateScriptsByTicker = map[string]RateScript{
	"SANDPRE": {AnnualRateByDay: []float64{10.0, 15.0, 15.0, 15.0, 6.0}},
}

// ipcaScriptsByTicker existe só pra IPCAScript não ficar sem nenhum roteiro
// testável — ver doc do pacote (sem consumidor real, sem ativo seedado).
var ipcaScriptsByTicker = map[string]IPCAScript{
	"SANDIPCA": {MonthlyIPCAByDay: []float64{0.40, 0.45, 0.50, 0.35}},
}

// PriceScriptForTicker devolve o roteiro de preço cadastrado pra esse
// ticker, se existir — ok = false se o ticker não tem roteiro (ativo
// sandbox seedado sem um roteiro correspondente, erro de cadastro).
func PriceScriptForTicker(ticker string) (PriceScript, bool) {
	script, ok := priceScriptsByTicker[ticker]
	return script, ok
}

// RateScriptForTicker devolve o roteiro de taxa cadastrado pra esse ticker,
// mesmo raciocínio de PriceScriptForTicker.
func RateScriptForTicker(ticker string) (RateScript, bool) {
	script, ok := rateScriptsByTicker[ticker]
	return script, ok
}

// IPCAScriptForTicker devolve o roteiro de IPCA cadastrado pra esse ticker,
// mesmo raciocínio de PriceScriptForTicker.
func IPCAScriptForTicker(ticker string) (IPCAScript, bool) {
	script, ok := ipcaScriptsByTicker[ticker]
	return script, ok
}
