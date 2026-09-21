// Package fixedincomeexecution orquestra compra e resgate antecipado de
// renda fixa (tarefa 3.13) — usa as fórmulas puras de fixedincome
// (PrefixedPrice, EarlyRedemption) e fixedincomeposition (blend da posição
// agregada) contra um Context montado pelo Repository, mesmo raciocínio de
// orderexecution (tarefa 3.12): domínio decide, infra só lê/persiste.
//
// Decisões de escopo desta tarefa, nenhuma delas coberta pelos três
// documentos de referência — sinalizar ao usuário se alguma divergir da
// intenção pedagógica original:
//
//  1. Taxa contratada na compra = fixed_income_assets.interest_rate (a
//     taxa ilustrativa e estática do catálogo, já exibida na tela de
//     listagem, tarefa 3.10) pra TODOS os 8 tipos de produto. **Parcialmente
//     revisitado na tarefa L.1** (backlog-motor-mercado-realista): pros 6
//     tipos pós-fixados (fixedincome.IndexPosFixado), esse número deixou
//     de ser "a taxa anual em si" e virou "o percentual do CDI/Selic
//     contratado" (ex: 110 = "110% do CDI", mesma convenção da lição 3.3 —
//     "CDB 110% CDI vs LCI 90% CDI isento") — ainda estático no catálogo
//     (nada atualiza esse percentual depois do seed), mas agora o
//     RENDIMENTO em si (não a taxa contratada) acompanha a Selic simulada
//     dia a dia via fixedincome.PostFixedValue, em vez de ficar travado
//     pra sempre no valor da compra. Tesouro Prefixado continua sem
//     mudança nenhuma (IndexPrefixado); Tesouro IPCA+ passou por mudança
//     própria na L.2 (nota 2 abaixo) — não a mesma da pós-fixado (a taxa
//     contratada continua travada na compra, só o VNA muda).
//
//  2. Tesouro IPCA+ reaproveitava a MESMA precificação por deságio nominal
//     (PrefixedPrice) do Tesouro Prefixado, não a projeção real de VNA
//     (fixedincome.VNAProjected/IPCAPrice) — **resolvido na tarefa L.2**:
//     Purchase/Redeem (fixedincome.IsIPCAMais(ctx.ProductType)) usam
//     fixedincome.CurrentVNAWindow (nenhum estado persistido — ver doc da
//     função: deriva vnaBase/monthlyIPCA determinística a partir de
//     ipca.Config/seed e VNAEpoch, mesmo raciocínio de "relógio de parede
//     como proxy do dia simulado" da nota 4 abaixo) + VNAProjected pra
//     achar o VNA de hoje, e fixedincome.IPCAPrice (compra) /
//     fixedincome.IPCAEarlyRedemption (resgate) no lugar de PrefixedPrice/
//     EarlyRedemption. ipca.Config vem calibrado por ipca.DefaultConfig
//     (seed própria, derivada da seed global — nunca a mesma raw seed do
//     selic.Config injetado no Temporizador, pra não correlacionar o
//     ruído dos dois processos estocásticos independentes), injetado em
//     Service (composição em cmd/api/main.go).
//
//  3. Taxa de mercado corrente pra marcação a mercado no resgate =
//     market_calendar.selic_rate do dia simulado (Selic/Copom, tarefa
//     3.11) — **resolvido pra pós-fixado na tarefa L.1**: os 6 tipos
//     IndexPosFixado não passam mais por fixedincome.EarlyRedemption
//     nenhuma (não faz sentido "marcar a mercado" um produto cujo próprio
//     rendimento já É o índice de mercado — não há taxa de mercado
//     "diferente" da Selic pra ele divergir); Redeem usa
//     fixedincome.PostFixedValue direto. Tesouro Prefixado e Tesouro
//     IPCA+ continuam os dois usando essa mesma taxa (ctx.
//     CurrentMarketRatePct) como proxy de "taxa de mercado" — **confirmado
//     com o usuário na L.3**: apesar da spec 3.2.1 falar só em "títulos
//     prefixados", Tesouro IPCA+ tem uma taxa REAL contratada travada na
//     compra que funciona como uma prefixada sobre o VNA (diferente dos 6
//     pós-fixados, cujo rendimento já É o índice de mercado) — por isso
//     continua sofrendo marcação a mercado, não vira um sétimo/oitavo tipo
//     isento. Pra IPCA+ (L.2), isso ainda significa reaproveitar a Selic
//     NOMINAL simulada como proxy de taxa de juro REAL de mercado (sem
//     correção de Fisher) — essa simplificação de calibração específica
//     foi resolvida pela L.4 (fixedincome.FisherRealRate).
//
//     3.3. **Achado 011 corrigido no teste de ponta a ponta da Fase L**
//     (pontos-em-aberto-decisao-produto.md): até aqui, "ctx.
//     CurrentMarketRatePct como proxy de taxa de mercado" comparava a taxa
//     CHEIA travada na compra (Position.AverageRate = spread +
//     benchmark-na-compra, fixedincome.OfferedRate desde a L.4) contra o
//     benchmark CRU de agora (sem spread nenhum) — mesmo com o benchmark
//     parado entre compra e resgate, todo resgate antecipado de
//     Prefixado/IPCA+ mostrava um "ganho" artificial de graça, do tamanho
//     do spread do produto. Como o valor creditado em accounts.
//     current_balance vem exatamente dessa marcação (não só o rótulo
//     vs_contracted_rate), isso não era só um número mal rotulado — era
//     dinheiro duplicável de verdade via compra+resgate instantâneo
//     repetido (sem nenhuma carência entre as duas rotas HTTP), validado
//     ao vivo: 4 ciclos seguidos em LTN2027 sem nenhum tick do
//     Temporizador entre eles levaram uma conta de R$ 10.000 pra R$
//     11.129, ~2,71% líquido de IR por ciclo, compondo. Corrigido: Redeem
//     agora soma esse mesmo spread ao benchmark corrente
//     (fixedincome.OfferedRate(ctx.AnnualRatePct/100, benchmarkAtual))
//     antes de marcar a mercado, pros dois branches (Prefixado, IPCA+) —
//     quando o benchmark realmente não mudou desde a compra, os dois lados
//     da comparação ficam idênticos e VsContractedRate vira exatamente 0,
//     em vez de um "ganho" fantasma. Sandbox (RF12) é a exceção: a taxa do
//     roteiro (sandbox.RateOnDay) já vem pronta, sem separar spread de
//     benchmark (mesmo raciocínio de PurchaseContext.IsSandbox) —
//     RedeemContext.IsSandbox faz Redeem pular essa soma pra não quebrar
//     essa taxa já resolvida.
//
//     3.1. **Corrigido no teste de ponta a ponta da Fase L, depois de
//     confirmado com o autor.** A série diária de Selic que
//     fixedincome.PostFixedFactor recebe pra marcar a mercado um resgate
//     de produto pós-fixado era, até aqui, uma aproximação: como
//     `market_calendar` só guarda a Selic CORRENTE (linha singleton, sem
//     histórico), Redeem repetia o único valor conhecido
//     (ctx.CurrentMarketRatePct, o de hoje) por todo o período decorrido —
//     mesma simplificação ainda usada por fii.PortfolioValueVariation pro
//     indexador CDI (fii/portfoliovalue.go). Isso não era só impreciso: uma
//     alta de Selic depois da compra rendia retroativamente sobre TODO o
//     período já decorrido, inclusive os dias em que a Selic estava mais
//     baixa — um ganho que um investidor real nunca teria (só se
//     beneficiaria da alta dali pra frente). Como a tarefa M.1
//     (independente desta) já persiste o histórico diário de verdade
//     (market_indicator_history), Redeem passou a usar a série REAL
//     (ctx.SelicRatesSincePurchase, resolvida por
//     FixedIncomeExecutionRepository.LoadRedeemContext via
//     db.selicRatesSince — um valor por dia simulado registrado desde
//     Position criada) em vez de repetir a Selic corrente — ver nota do
//     campo em RedeemContext. Simulate (nota 3.2 abaixo) continua repetindo
//     a Selic corrente via postFixedDailyRates: é uma projeção pro FUTURO,
//     nunca vai ter "histórico real" pra usar, então a aproximação ali
//     continua sendo a fórmula certa, não um gap.
//
//     3.2. GET /fixed-income/simulate (Simulate, abaixo) continuava usando
//     fixedincome.PrefixedPrice pra TODOS os 8 tipos, inclusive
//     pós-fixados e IPCA+ — não corrigido nem pela L.1 nem pela L.2.
//     **Corrigido pros dois no teste de ponta a ponta da Fase L**
//     (achado da revisão: L.1 reinterpretou fixed_income_assets.
//     interest_rate de "% a.a." pra "% do CDI" pros 6 tipos pós-fixados,
//     mas Simulate continuou alimentando esse número (agora ~100-115) direto
//     em PrefixedPrice como se fosse uma taxa anual — um CDB 110% CDI
//     projetava retorno como se rendesse 110% a.a., ~10x o valor real — uma
//     regressão nova desta fase, não só um gap pré-existente). Simulate
//     agora recebe ProductType/CurrentMarketRatePct (SimulateContext,
//     resolvidos pela camada HTTP via assetCatalogReader.
//     CurrentSelicRatePct) e ramifica pra fixedincome.PostFixedValue —
//     mesma fórmula/aproximação de Redeem (nota 3.1 acima, mas a de
//     Simulate continua sendo uma projeção repetida, não histórico real) —
//     quando fixedincome.IsPostFixado(ctx.ProductType); e pra
//     simulateIPCAMais (fixedincome.IPCAPrice/VNAProjected — mesma
//     composição de Purchase/Redeem desde a L.2) quando
//     fixedincome.IsIPCAMais(ctx.ProductType) — vnaBase/monthlyIPCA (na
//     data de hoje) e projectedVNABase/projectedMonthlyIPCA (na data
//     projetada, req.DaysHeld à frente) resolvidos por Service.Simulate,
//     mesmo raciocínio de Purchase/Redeem. Antes da correção, o unit_price
//     mostrado pro Tesouro IPCA+ chegava a menos da metade do preço real de
//     compra (deságio nominal puro ignorando o VNA composto por anos de
//     inflação simulada desde fixedincome.VNAEpoch) — mesma categoria de
//     distorção do achado do pós-fixado acima, só que sem regressão
//     recente associada (esse gap já existia desde a L.2).
//
//  4. DU restante até o vencimento é calculado a partir de time.Now() vs
//     fixed_income_assets.maturity_date (data de calendário real, seedada
//     como time.Now().AddDate(2,0,0) — cmd/seed/main.go), não do contador
//     de dia simulado (market_calendar.current_day) — coerente com "1 tick
//     = 1 dia real" do Temporizador (3.11): o relógio de parede já é o
//     proxy do dia simulado.
//
//  5. Resgate é sempre integral da posição agregada — não existe resgate
//     parcial. Evita ter que decidir como fatiar quantity/average_rate
//     entre o que fica e o que sai da posição; não confirmado
//     explicitamente com o usuário.
package fixedincomeexecution

import (
	"errors"
	"time"

	"tcc-investimentos/engine/internal/domain/fixedincome"
	"tcc-investimentos/engine/internal/domain/fixedincomeposition"
)

var (
	ErrInvalidAmount          = errors.New("valor do aporte deve ser maior que zero")
	ErrBelowMinimumInvestment = errors.New("valor abaixo da aplicação mínima do produto")
	ErrInsufficientBalance    = errors.New("saldo insuficiente para realizar o aporte")
	// ErrAccountNotFound é devolvido por Repository.LoadPurchaseContext
	// quando o usuário não tem conta aberta — nunca deveria acontecer num
	// fluxo normal (POST /accounts é sempre o primeiro passo).
	ErrAccountNotFound = errors.New("conta não encontrada para o usuário")
	// ErrPositionNotFound é devolvido por Repository.LoadRedeemContext
	// quando o usuário não tem posição no título, e por Redeem como guarda
	// de invariante contra chamada incorreta (a validação de negócio já
	// aconteceu no repositório).
	ErrPositionNotFound = errors.New("posição não encontrada para resgate")
	// ErrInvalidDaysHeld é devolvido por Simulate quando days_held não é
	// maior que zero — não há projeção de retorno sem um prazo simulado.
	ErrInvalidDaysHeld = errors.New("dias de permanência simulados devem ser maior que zero")
)

// Request é a compra recebida via HTTP, antes de qualquer persistência —
// por valor aportado em R$, não por quantidade de títulos (tela 4.3 do
// inventário: "campo de valor", não "campo de quantidade").
type Request struct {
	UserID  string
	AssetID string
	Amount  float64
}

// RedeemRequest é o resgate recebido via HTTP — sempre integral da posição
// agregada do usuário nesse título (ver nota 5 do doc do pacote).
type RedeemRequest struct {
	UserID  string
	AssetID string
}

// PurchaseContext é o insumo que Purchase precisa pra processar um aporte —
// montado por Repository.LoadPurchaseContext. ProductType (tarefa L.1)
// decide a fórmula de precificação: fixedincome.IsPostFixado(ProductType)
// usa fixedincome.FaceValue como unidade (compra "ao par" — não há deságio
// pra uma taxa que não está travada), qualquer outro tipo continua usando
// fixedincome.PrefixedPrice (comportamento anterior à L.1, inalterado).
// AnnualRatePct (tarefa L.4) foi reinterpretado pra Prefixado/IPCA+, mesmo
// raciocínio da reinterpretação que a L.1 já tinha aplicado aos 6 tipos
// pós-fixados ("% do CDI" em vez de "% a.a."): agora é o SPREAD contratual
// sobre CurrentMarketRatePct (Selic nominal simulada, mesma fonte que
// RedeemContext já usa pra marcação a mercado), não mais a taxa ofertada
// final — fixedincome.OfferedRate soma os dois na hora de travar a taxa
// contratada de uma compra nova, pra ela acompanhar a Selic corrente em
// vez de ficar presa ao valor do seed pra sempre. IsSandbox faz Purchase
// pular esse cálculo (nota 5 do doc do pacote sandbox_helpers.go): o
// roteiro sandbox já sobrescreve AnnualRatePct com uma taxa absoluta
// pronta (Repository), somar CurrentMarketRatePct em cima duplicaria o
// efeito da Selic.
type PurchaseContext struct {
	AccountBalance    float64
	AnnualRatePct     float64
	MaturityDate      time.Time
	MinimumInvestment float64
	CurrentPosition   fixedincomeposition.Position
	ProductType       fixedincome.ProductType
	// CurrentMarketRatePct é a Selic simulada corrente (%), usada pra
	// reprecificar a taxa ofertada de Prefixado/IPCA+ (tarefa L.4) —
	// nunca lida pra pós-fixado (rate já é "% do CDI", sem benchmark a
	// somar) nem pra sandbox (IsSandbox true).
	CurrentMarketRatePct float64
	// IPCAAccumulated12m é o IPCA acumulado em 12 meses simulados mais
	// recente (decimal, ex: 0.03), lido do histórico persistido (M.1) —
	// só usado pra Tesouro IPCA+, pra converter CurrentMarketRatePct
	// (nominal) numa taxa real via fixedincome.FisherRealRate antes de
	// somar o spread (tarefa L.4, resolve a simplificação documentada
	// desde a L.2/L.3).
	IPCAAccumulated12m float64
	IsSandbox          bool
}

// PurchaseOutcome é o resultado de Purchase, pronto pra persistência.
type PurchaseOutcome struct {
	UnitPrice         float64
	QuantityPurchased float64
	NewPosition       fixedincomeposition.Position
}

// RedeemContext é o insumo que Redeem precisa pra processar um resgate
// antecipado — montado por Repository.LoadRedeemContext. PurchasedAt (a
// data da primeira operação do usuário nesse título,
// fixed_income_positions.created_at) e TaxExempt (fixed_income_assets.
// tax_exempt) sustentam o IR regressivo sobre o resgate (tarefa 6.0.5).
// ProductType (tarefa L.1) decide a fórmula de valorização:
// fixedincome.IsPostFixado(ProductType) usa fixedincome.PostFixedValue
// (rendimento real, série construída a partir de CurrentMarketRatePct —
// nota 3.1 do doc do pacote) em vez de fixedincome.EarlyRedemption
// (marcação a mercado, só faz sentido pra Prefixado/IPCA+).
type RedeemContext struct {
	Position             fixedincomeposition.Position
	MaturityDate         time.Time
	CurrentMarketRatePct float64
	PurchasedAt          time.Time
	TaxExempt            bool
	ProductType          fixedincome.ProductType
	// IPCAAccumulated12m (tarefa L.4) — mesmo campo/fonte de
	// PurchaseContext.IPCAAccumulated12m, só usado pra Tesouro IPCA+
	// converter CurrentMarketRatePct (Selic nominal) numa taxa real via
	// fixedincome.FisherRealRate antes de marcar a mercado.
	IPCAAccumulated12m float64
	// AnnualRatePct (achado 011, teste de ponta a ponta da Fase L —
	// pontos-em-aberto-decisao-produto.md) é o spread contratual do
	// catálogo (fixed_income_assets.interest_rate, mesma convenção de
	// PurchaseContext.AnnualRatePct pra Prefixado/IPCA+ desde a L.4). Sem
	// ele, Redeem comparava a taxa CHEIA travada na compra (spread +
	// benchmark-na-compra, Position.AverageRate) contra o benchmark CRU
	// de agora (sem spread) — todo resgate mostrava "ganho" mesmo com o
	// benchmark parado, de graça, repetível via compra+resgate instantâneo
	// (dinheiro duplicado de verdade em accounts.current_balance, não só um
	// rótulo errado). Redeem agora soma esse mesmo spread ao benchmark
	// corrente (fixedincome.OfferedRate) antes de marcar a mercado — os
	// dois lados da comparação ficam "maçã com maçã", e a marcação some
	// (VsContractedRate == 0) quando o benchmark realmente não se moveu
	// desde a compra.
	AnnualRatePct float64
	// IsSandbox (achado 011) — sandbox (RF12) já entrega
	// CurrentMarketRatePct como taxa absoluta pronta (sandbox.RateOnDay,
	// mesmo roteiro usado na compra, sem separar spread de benchmark —
	// Position.AverageRate de um ativo sandbox também não tem spread
	// somado, ver PurchaseContext.IsSandbox) — Redeem não soma
	// AnnualRatePct em cima pra não duplicar/quebrar essa taxa já pronta.
	IsSandbox bool
	// SelicRatesSincePurchase (gap remanescente da nota 3.1 do doc do
	// pacote, fechado no teste de ponta a ponta da Fase L depois da tarefa
	// M.1 já existir) é a série REAL de Selic simulada registrada desde a
	// compra (market_indicator_history, um valor por dia simulado — db.
	// selicRatesSince), só usada pra produto pós-fixado
	// (fixedincome.IsPostFixado). Substitui a aproximação anterior de
	// repetir só a Selic CORRENTE por todo o período decorrido
	// (postFixedDailyRates, abaixo, que continua servindo Simulate — uma
	// projeção pro FUTURO nunca tem "histórico real" pra usar). Sem essa
	// série real, uma alta de Selic depois da compra era aplicada
	// retroativamente sobre TODO o período já decorrido (inclusive os dias
	// em que a Selic estava mais baixa) — um ganho que um investidor real
	// nunca teria (só se beneficiaria da alta dali pra frente). Série
	// vazia é um resultado válido (resgate no mesmo dia simulado da
	// compra) — fixedincome.PostFixedFactor já trata isso como "nenhum
	// crescimento".
	SelicRatesSincePurchase []float64
}

// RedeemOutcome é o resultado de Redeem, pronto pra persistência. NetValue
// e TaxRate (tarefa 6.0.5) espelham o mesmo par de campos de
// SimulateOutcome — o resgate de verdade também mostra líquido, não só a
// simulação de compra. MarkToMarket é reaproveitado (mesmo shape de
// resposta HTTP, sem quebrar contrato) pra produto pós-fixado desde a L.1:
// MarkToMarketPrice vira o preço efetivo por unidade já com o rendimento
// pós-fixado aplicado, RealizedReturnPct o retorno de verdade desde a
// compra, e VsContractedRate sempre 0 — não existe "desvio da taxa
// contratada" pra um produto cujo rendimento É o índice de mercado (nota 3
// do doc do pacote).
type RedeemOutcome struct {
	TotalValue   float64
	NetValue     float64
	TaxRate      float64
	MarkToMarket fixedincome.EarlyRedemptionResult
}

// SimulateRequest é a simulação de aporte recebida via HTTP (tarefa
// 6.0.5) — nenhuma persistência, nenhum efeito colateral (sustenta o
// simulador de aporte da tela 4.3 e a Calculadora em modo comparação,
// 6.1/6.2, lição 3.3).
type SimulateRequest struct {
	Amount   float64
	DaysHeld int
}

// SimulateContext é o insumo que Simulate precisa do catálogo — montado
// direto na camada HTTP a partir de assetCatalogReader.
// FindFixedIncomeSpecialization (tarefa 3.10), sem repositório dedicado:
// diferente de Purchase/Redeem, a simulação não lê saldo de conta nem
// posição existente, só dado de catálogo já exposto. ProductType/
// CurrentMarketRatePct (achado do teste de ponta a ponta da Fase L, nota
// 3.2 do doc do pacote) decidem se Simulate ramifica pra
// fixedincome.PostFixedValue (fixedincome.IsPostFixado(ProductType)) em vez
// do deságio nominal — CurrentMarketRatePct só precisa vir preenchido nesse
// caso (assetCatalogReader.CurrentSelicRatePct, camada HTTP); zero-value
// nos dois campos preserva o comportamento anterior (Prefixado/IPCA+, ver
// nota 3.2).
type SimulateContext struct {
	AnnualRatePct float64
	MaturityDate  time.Time
	TaxExempt     bool
	// ProductType (achado da revisão e2e da Fase L) decide, junto de
	// CurrentMarketRatePct, se Simulate usa a projeção pós-fixada em vez do
	// deságio nominal — ver nota 3.2 do doc do pacote.
	ProductType fixedincome.ProductType
	// CurrentMarketRatePct é a Selic simulada corrente (%) — só lida/usada
	// quando fixedincome.IsPostFixado(ProductType) (nota 3.2).
	CurrentMarketRatePct float64
}

// SimulateOutcome é o resultado da simulação, pronto pra resposta HTTP.
type SimulateOutcome struct {
	UnitPrice           float64
	QuantityPurchased   float64
	GrossProjectedValue float64
	TaxRate             float64
	NetProjectedValue   float64
}

// Purchase valida o aporte (valor positivo, acima da aplicação mínima do
// produto, dentro do saldo disponível) e blenda a compra na posição já
// existente (fixedincomeposition.ApplyBuy). A unidade nocional é
// precificada de três jeitos diferentes, a depender do índice do produto
// (fixedincome.IndexOf, tarefas L.1/L.2): produto pós-fixado
// (fixedincome.IsPostFixado) compra "ao par" — unitPrice =
// fixedincome.FaceValue, sem deságio — porque não há taxa travada na
// compra pra descontar (o rendimento só nasce depois, dia a dia, em
// Redeem); Tesouro IPCA+ (fixedincome.IsIPCAMais, tarefa L.2) precifica
// pelo VNA (fixedincome.IPCAPrice = VNAProjected(vnaBase, monthlyIPCA,
// now) × IPCAQuote(rate, remainingDays) — vnaBase/monthlyIPCA vêm
// resolvidos por quem chama, ver nota 2 do doc do pacote); qualquer outro
// tipo (só Tesouro Prefixado sobra) continua descontando pelo deságio
// nominal (fixedincome.PrefixedPrice, taxa contratada = taxa do catálogo),
// comportamento inalterado desde a 3.13.
func Purchase(req Request, ctx PurchaseContext, now time.Time, vnaBase, monthlyIPCA float64) (PurchaseOutcome, error) {
	if req.Amount <= 0 {
		return PurchaseOutcome{}, ErrInvalidAmount
	}
	if req.Amount < ctx.MinimumInvestment {
		return PurchaseOutcome{}, ErrBelowMinimumInvestment
	}
	if req.Amount > ctx.AccountBalance {
		return PurchaseOutcome{}, ErrInsufficientBalance
	}

	rate := ctx.AnnualRatePct / 100
	var unitPrice float64
	switch {
	case fixedincome.IsPostFixado(ctx.ProductType):
		unitPrice = fixedincome.FaceValue
	case ctx.IsSandbox:
		// Roteiro sandbox já resolveu AnnualRatePct pra uma taxa absoluta
		// (Repository) — nunca soma CurrentMarketRatePct em cima (nota do
		// doc de PurchaseContext).
		remainingDays := remainingBusinessDays(now, ctx.MaturityDate)
		unitPrice = fixedincome.PrefixedPrice(rate, remainingDays)
	case fixedincome.IsIPCAMais(ctx.ProductType):
		realBenchmark := fixedincome.FisherRealRate(ctx.CurrentMarketRatePct/100, ctx.IPCAAccumulated12m)
		rate = fixedincome.OfferedRate(ctx.AnnualRatePct/100, realBenchmark)
		remainingDays := remainingBusinessDays(now, ctx.MaturityDate)
		vna := fixedincome.VNAProjected(vnaBase, monthlyIPCA, now)
		unitPrice = fixedincome.IPCAPrice(vna, fixedincome.IPCAQuote(rate, remainingDays))
	default:
		rate = fixedincome.OfferedRate(ctx.AnnualRatePct/100, ctx.CurrentMarketRatePct/100)
		remainingDays := remainingBusinessDays(now, ctx.MaturityDate)
		unitPrice = fixedincome.PrefixedPrice(rate, remainingDays)
	}
	quantity := req.Amount / unitPrice

	newPosition := fixedincomeposition.ApplyBuy(ctx.CurrentPosition, quantity, unitPrice, rate)

	return PurchaseOutcome{
		UnitPrice:         unitPrice,
		QuantityPurchased: quantity,
		NewPosition:       newPosition,
	}, nil
}

// Redeem valoriza a posição inteira até hoje — de três jeitos diferentes,
// a depender do índice do produto (mesma decisão de Purchase, tarefas
// L.1/L.2). Produto pós-fixado (fixedincome.IsPostFixado) usa
// fixedincome.PostFixedValue: o principal investido (Position.AveragePrice
// × Position.Quantity) rende o percentual contratado do índice
// (Position.AverageRate, já em decimal — ex: 1.10 pra "110% do CDI",
// mesma unidade de rate em Purchase) sobre a série REAL de Selic simulada
// desde a compra (ctx.SelicRatesSincePurchase — ver nota da struct e nota
// 3.1 do doc do pacote pra história do porquê isso já foi uma aproximação).
// Tesouro
// IPCA+ (fixedincome.IsIPCAMais, tarefa L.2) usa
// fixedincome.IPCAEarlyRedemption sobre o VNA de hoje
// (VNAProjected(vnaBase, monthlyIPCA, now) — vnaBase/monthlyIPCA resolvidos
// por quem chama, nota 2 do doc do pacote), no lugar do Valor Nominal fixo
// que EarlyRedemption usa pra Prefixado. Qualquer outro tipo (só Tesouro
// Prefixado sobra) continua marcado a mercado (fixedincome.EarlyRedemption,
// taxa de mercado corrente = Selic simulada do dia — nota 3 do doc do
// pacote), comportamento inalterado desde a 3.13. Resgate é sempre
// integral (nota 5 do doc do pacote) — não há resgate parcial.
// NetValue/TaxRate (tarefa 6.0.5) aplicam o IR regressivo
// (fixedincome.RegressiveIncomeTaxRate) sobre o ganho desde a aplicação
// (TotalValue − valor efetivamente aplicado, Position.AveragePrice ×
// Position.Quantity), contado em dias corridos desde PurchasedAt — nunca
// sobre ativo TaxExempt, que sempre devolve líquido = bruto.
func Redeem(ctx RedeemContext, now time.Time, vnaBase, monthlyIPCA float64) (RedeemOutcome, error) {
	if ctx.Position.Quantity <= 0 {
		return RedeemOutcome{}, ErrPositionNotFound
	}

	daysHeld := int(now.Sub(ctx.PurchasedAt).Hours() / 24)
	investedAmount := ctx.Position.AveragePrice * ctx.Position.Quantity

	var totalValue float64
	var result fixedincome.EarlyRedemptionResult
	switch {
	case fixedincome.IsPostFixado(ctx.ProductType):
		pctOfIndex := ctx.Position.AverageRate * 100
		totalValue = fixedincome.PostFixedValue(investedAmount, pctOfIndex, ctx.SelicRatesSincePurchase)
		result = fixedincome.EarlyRedemptionResult{
			MarkToMarketPrice: totalValue / ctx.Position.Quantity,
			RealizedReturnPct: (totalValue/investedAmount - 1) * 100,
			VsContractedRate:  0,
		}
	case fixedincome.IsIPCAMais(ctx.ProductType):
		remainingDays := remainingBusinessDays(now, ctx.MaturityDate)
		vna := fixedincome.VNAProjected(vnaBase, monthlyIPCA, now)
		currentMarketRealRate := fixedincome.FisherRealRate(ctx.CurrentMarketRatePct/100, ctx.IPCAAccumulated12m)
		if !ctx.IsSandbox {
			// Soma o mesmo spread que Position.AverageRate já embute
			// (fixedincome.OfferedRate, tarefa L.4) — achado 011, ver nota
			// do campo AnnualRatePct em RedeemContext.
			currentMarketRealRate = fixedincome.OfferedRate(ctx.AnnualRatePct/100, currentMarketRealRate)
		}
		result = fixedincome.IPCAEarlyRedemption(ctx.Position.AveragePrice, ctx.Position.AverageRate, currentMarketRealRate, vna, remainingDays)
		totalValue = ctx.Position.Quantity * result.MarkToMarketPrice
	default:
		remainingDays := remainingBusinessDays(now, ctx.MaturityDate)
		marketRate := ctx.CurrentMarketRatePct / 100
		if !ctx.IsSandbox {
			// Mesmo raciocínio do branch IPCA+ acima — achado 011.
			marketRate = fixedincome.OfferedRate(ctx.AnnualRatePct/100, marketRate)
		}
		result = fixedincome.EarlyRedemption(ctx.Position.AveragePrice, ctx.Position.AverageRate, marketRate, remainingDays)
		totalValue = ctx.Position.Quantity * result.MarkToMarketPrice
	}

	taxRate := 0.0
	netValue := totalValue
	if !ctx.TaxExempt {
		taxRate = fixedincome.RegressiveIncomeTaxRate(daysHeld)
		if profit := totalValue - investedAmount; profit > 0 {
			netValue = totalValue - profit*taxRate
		}
	}

	return RedeemOutcome{
		TotalValue:   totalValue,
		NetValue:     netValue,
		TaxRate:      taxRate,
		MarkToMarket: result,
	}, nil
}

// postFixedDailyRates monta a série diária que fixedincome.PostFixedFactor
// espera — hoje sempre o mesmo currentMarketRatePct repetido por
// businessDaysHeld dias (ver nota 3.1 do doc do pacote: aproximação
// enquanto a tarefa M.1, independente desta, não persiste o histórico
// diário real de Selic). daysHeld (dias corridos) é convertido pra DU pela
// mesma proporção 252/365 do resto do pacote (calendarToBusinessDays).
func postFixedDailyRates(currentMarketRatePct float64, daysHeld int) []float64 {
	businessDaysHeld := calendarToBusinessDays(daysHeld)
	if businessDaysHeld < 0 {
		businessDaysHeld = 0
	}
	rates := make([]float64, businessDaysHeld)
	for i := range rates {
		rates[i] = currentMarketRatePct
	}
	return rates
}

// Simulate projeta o retorno de um aporte hipotético em renda fixa sem
// gravar nada (tarefa 6.0.5). Produto pós-fixado (fixedincome.IsPostFixado,
// achado do teste de ponta a ponta da Fase L, nota 3.2 do doc do pacote)
// ramifica pra simulatePostFixado — o deságio nominal abaixo não faz
// sentido pra um produto comprado ao par, mesmo raciocínio de Purchase/
// Redeem desde a L.1. Tesouro IPCA+ (fixedincome.IsIPCAMais, achado da
// mesma revisão) ramifica pra simulateIPCAMais — vnaBase/monthlyIPCA (na
// data da compra) e projectedVNABase/projectedMonthlyIPCA (na data
// projetada, req.DaysHeld à frente — pode cair numa janela de VNA
// diferente, por isso um par separado, não reaproveitado do primeiro) são
// resolvidos por quem chama (Service.Simulate), mesmo raciocínio de
// Purchase/Redeem (nota 2 do doc do pacote): CurrentVNAWindow é pura/
// barata, sem I/O, então nenhum custo real em resolver os dois pares
// sempre, mesmo pra produto que não é IPCA+. Qualquer outro tipo (só
// Tesouro Prefixado sobra) precifica a unidade nocional pelo deságio
// nominal na data de hoje (fixedincome.PrefixedPrice, mesma fórmula de
// Purchase), depois reaplica a mesma fórmula com o DU restante encolhido
// pelos dias simulados (menos tempo até o vencimento → preço mais próximo
// do Valor Nominal → ganho projetado) e aplica a alíquota regressiva de IR
// (fixedincome.RegressiveIncomeTaxRate) sobre esse ganho, se o produto não
// for isento.
func Simulate(req SimulateRequest, ctx SimulateContext, now time.Time, vnaBase, monthlyIPCA, projectedVNABase, projectedMonthlyIPCA float64) (SimulateOutcome, error) {
	if req.Amount <= 0 {
		return SimulateOutcome{}, ErrInvalidAmount
	}
	if req.DaysHeld <= 0 {
		return SimulateOutcome{}, ErrInvalidDaysHeld
	}

	if fixedincome.IsPostFixado(ctx.ProductType) {
		return simulatePostFixado(req, ctx), nil
	}
	if fixedincome.IsIPCAMais(ctx.ProductType) {
		return simulateIPCAMais(req, ctx, now, vnaBase, monthlyIPCA, projectedVNABase, projectedMonthlyIPCA), nil
	}

	remainingDaysAtPurchase := remainingBusinessDays(now, ctx.MaturityDate)
	annualRate := ctx.AnnualRatePct / 100
	unitPrice := fixedincome.PrefixedPrice(annualRate, remainingDaysAtPurchase)
	quantity := req.Amount / unitPrice

	remainingAtProjection := remainingDaysAtPurchase - calendarToBusinessDays(req.DaysHeld)
	if remainingAtProjection < 0 {
		remainingAtProjection = 0
	}
	grossValue := quantity * fixedincome.PrefixedPrice(annualRate, remainingAtProjection)

	taxRate := 0.0
	netValue := grossValue
	if !ctx.TaxExempt {
		taxRate = fixedincome.RegressiveIncomeTaxRate(req.DaysHeld)
		if profit := grossValue - req.Amount; profit > 0 {
			netValue = grossValue - profit*taxRate
		}
	}

	return SimulateOutcome{
		UnitPrice:           unitPrice,
		QuantityPurchased:   quantity,
		GrossProjectedValue: grossValue,
		TaxRate:             taxRate,
		NetProjectedValue:   netValue,
	}, nil
}

// simulatePostFixado projeta o retorno de um produto pós-fixado (achado do
// teste de ponta a ponta da Fase L, nota 3.2 do doc do pacote): unidade
// comprada ao par (fixedincome.FaceValue, sem deságio — mesma decisão de
// Purchase desde a L.1) e projeção via fixedincome.PostFixedValue sobre a
// Selic corrente repetida pelos dias simulados (mesma aproximação de
// postFixedDailyRates/Redeem, nota 3.1 do doc do pacote). ctx.AnnualRatePct
// aqui é o percentual do CDI/Selic contratado (convenção da L.1, ex: 110
// para "110% do CDI"), nunca "% a.a." — Simulate (chamador) já garantiu
// req.Amount/req.DaysHeld positivos antes de chamar esta função.
func simulatePostFixado(req SimulateRequest, ctx SimulateContext) SimulateOutcome {
	unitPrice := fixedincome.FaceValue
	quantity := req.Amount / unitPrice
	grossValue := fixedincome.PostFixedValue(req.Amount, ctx.AnnualRatePct, postFixedDailyRates(ctx.CurrentMarketRatePct, req.DaysHeld))

	taxRate := 0.0
	netValue := grossValue
	if !ctx.TaxExempt {
		taxRate = fixedincome.RegressiveIncomeTaxRate(req.DaysHeld)
		if profit := grossValue - req.Amount; profit > 0 {
			netValue = grossValue - profit*taxRate
		}
	}

	return SimulateOutcome{
		UnitPrice:           unitPrice,
		QuantityPurchased:   quantity,
		GrossProjectedValue: grossValue,
		TaxRate:             taxRate,
		NetProjectedValue:   netValue,
	}
}

// simulateIPCAMais projeta o retorno de um Tesouro IPCA+ (achado do teste
// de ponta a ponta da Fase L, nota 3.2 do doc do pacote): antes desta
// correção, Simulate alimentava fixedincome.PrefixedPrice (deságio nominal
// puro) com a taxa REAL contratada, ignorando o VNA inteiramente — o
// simulador mostrava um `unit_price` inferior à metade do preço real de
// compra (fixedincome.IPCAPrice/VNAProjected, mesma fórmula de Purchase
// desde a L.2). Corrigido: precifica a unidade pelo VNA na data de hoje
// (vnaBase/monthlyIPCA), depois reprecifica a mesma taxa real contratada
// sobre o VNA projetado na data futura (projectedVNABase/
// projectedMonthlyIPCA — pode cair numa janela de VNA diferente da compra
// se req.DaysHeld atravessar o dia 15 de um mês, por isso um
// CurrentVNAWindow separado, não o mesmo par reaproveitado) — mesma
// composição de Purchase/Redeem, nunca deságio nominal puro.
func simulateIPCAMais(req SimulateRequest, ctx SimulateContext, now time.Time, vnaBase, monthlyIPCA, projectedVNABase, projectedMonthlyIPCA float64) SimulateOutcome {
	rate := ctx.AnnualRatePct / 100
	remainingDaysAtPurchase := remainingBusinessDays(now, ctx.MaturityDate)
	vna := fixedincome.VNAProjected(vnaBase, monthlyIPCA, now)
	unitPrice := fixedincome.IPCAPrice(vna, fixedincome.IPCAQuote(rate, remainingDaysAtPurchase))
	quantity := req.Amount / unitPrice

	remainingAtProjection := remainingDaysAtPurchase - calendarToBusinessDays(req.DaysHeld)
	if remainingAtProjection < 0 {
		remainingAtProjection = 0
	}
	projectedAt := now.AddDate(0, 0, req.DaysHeld)
	vnaAtProjection := fixedincome.VNAProjected(projectedVNABase, projectedMonthlyIPCA, projectedAt)
	grossValue := quantity * fixedincome.IPCAPrice(vnaAtProjection, fixedincome.IPCAQuote(rate, remainingAtProjection))

	taxRate := 0.0
	netValue := grossValue
	if !ctx.TaxExempt {
		taxRate = fixedincome.RegressiveIncomeTaxRate(req.DaysHeld)
		if profit := grossValue - req.Amount; profit > 0 {
			netValue = grossValue - profit*taxRate
		}
	}

	return SimulateOutcome{
		UnitPrice:           unitPrice,
		QuantityPurchased:   quantity,
		GrossProjectedValue: grossValue,
		TaxRate:             taxRate,
		NetProjectedValue:   netValue,
	}
}

// calendarToBusinessDays converte dias corridos em DU aproximado, mesma
// proporção 252/365 usada por remainingBusinessDays — extraída porque
// Simulate precisa da mesma conversão aplicada a uma contagem de dias
// simulada (req.DaysHeld), não a uma diferença de calendário entre duas
// datas.
func calendarToBusinessDays(calendarDays int) int {
	return int(float64(calendarDays) * fixedincome.BusinessDaysPerYear / 365.0)
}

// remainingBusinessDays converte a diferença de calendário entre now e
// maturityDate num DU aproximado (mesma base de 252 dias úteis/ano das
// fórmulas de fixedincome — ver nota 4 do doc do pacote), nunca menor que 1
// pra evitar expoente zero/negativo em PrefixedPrice/EarlyRedemption num
// título muito perto do vencimento.
func remainingBusinessDays(now, maturityDate time.Time) int {
	calendarDays := int(maturityDate.Sub(now).Hours() / 24)
	businessDays := calendarToBusinessDays(calendarDays)
	if businessDays < 1 {
		return 1
	}
	return businessDays
}
