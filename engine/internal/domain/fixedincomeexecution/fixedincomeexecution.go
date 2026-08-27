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
//     listagem, tarefa 3.10) pra TODOS os 8 tipos de produto, inclusive
//     Tesouro Selic e Tesouro IPCA+. É a única fonte de taxa "por compra"
//     que já existe no catálogo — se essa taxa nunca mudar (não há nada
//     que a atualize hoje), compras repetidas do mesmo título blendam pra
//     um valor idêntico, o que é matematicamente correto mesmo que trivial
//     na prática atual; o mecanismo (fixedincomeposition.ApplyBuy) já fica
//     pronto pro dia em que a taxa do catálogo passar a variar.
//
//  2. Tesouro IPCA+ reaproveita a MESMA precificação por deságio nominal
//     (PrefixedPrice) dos outros 7 tipos, não a projeção real de VNA
//     (fixedincome.VNAProjected/IPCAPrice). A precificação por VNA
//     exigiria um estado de série mensal de IPCA persistido e
//     path-dependent (não existe hoje — nem sequer o pacote ipca tem
//     Config calibrado, ver seu doc: "travar um default aqui seria
//     inventar um número que a tarefa 8.1 ainda vai decidir") — fora do
//     escopo desta tarefa. VNAProjected/IPCAPrice continuam sem
//     consumidor real no motor.
//
//  3. Taxa de mercado corrente pra marcação a mercado no resgate =
//     market_calendar.selic_rate do dia simulado (Selic/Copom, tarefa
//     3.11), uniformemente pros 8 tipos — inclusive Tesouro Selic, que na
//     vida real tem risco de mercado ~zero por ser pós-fixado (a taxa
//     acompanha o mercado por definição). Essa nuance não foi modelada
//     aqui: o critério de aceite da 3.13 pede só "ganho/perda de marcação
//     a mercado corretamente" de forma genérica, sem distinguir por tipo.
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
// montado por Repository.LoadPurchaseContext.
type PurchaseContext struct {
	AccountBalance    float64
	AnnualRatePct     float64
	MaturityDate      time.Time
	MinimumInvestment float64
	CurrentPosition   fixedincomeposition.Position
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
// tax_exempt) sustentam o IR regressivo sobre o resgate (tarefa 6.0.5) —
// nenhum dos dois existia antes dessa tarefa, que só marcava a mercado sem
// calcular líquido de imposto.
type RedeemContext struct {
	Position             fixedincomeposition.Position
	MaturityDate         time.Time
	CurrentMarketRatePct float64
	PurchasedAt          time.Time
	TaxExempt            bool
}

// RedeemOutcome é o resultado de Redeem, pronto pra persistência. NetValue
// e TaxRate (tarefa 6.0.5) espelham o mesmo par de campos de
// SimulateOutcome — o resgate de verdade também mostra líquido, não só a
// simulação de compra.
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
// posição existente, só dado de catálogo já exposto.
type SimulateContext struct {
	AnnualRatePct float64
	MaturityDate  time.Time
	TaxExempt     bool
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
// produto, dentro do saldo disponível), precifica a unidade nocional pelo
// deságio nominal (fixedincome.PrefixedPrice, taxa contratada = taxa do
// catálogo — ver nota 1/2 do doc do pacote) e blenda a compra na posição já
// existente (fixedincomeposition.ApplyBuy).
func Purchase(req Request, ctx PurchaseContext, now time.Time) (PurchaseOutcome, error) {
	if req.Amount <= 0 {
		return PurchaseOutcome{}, ErrInvalidAmount
	}
	if req.Amount < ctx.MinimumInvestment {
		return PurchaseOutcome{}, ErrBelowMinimumInvestment
	}
	if req.Amount > ctx.AccountBalance {
		return PurchaseOutcome{}, ErrInsufficientBalance
	}

	remainingDays := remainingBusinessDays(now, ctx.MaturityDate)
	annualRate := ctx.AnnualRatePct / 100
	unitPrice := fixedincome.PrefixedPrice(annualRate, remainingDays)
	quantity := req.Amount / unitPrice

	newPosition := fixedincomeposition.ApplyBuy(ctx.CurrentPosition, quantity, unitPrice, annualRate)

	return PurchaseOutcome{
		UnitPrice:         unitPrice,
		QuantityPurchased: quantity,
		NewPosition:       newPosition,
	}, nil
}

// Redeem marca a mercado a posição inteira (fixedincome.EarlyRedemption,
// taxa de mercado corrente = Selic simulada do dia — ver nota 3 do doc do
// pacote) e converte o resultado por unidade no valor total resgatado
// (Position.Quantity × MarkToMarketPrice). Resgate é sempre integral (nota
// 5 do doc do pacote) — não há resgate parcial. NetValue/TaxRate (tarefa
// 6.0.5) aplicam o IR regressivo (fixedincome.RegressiveIncomeTaxRate)
// sobre o ganho desde a aplicação (TotalValue − valor efetivamente
// aplicado, Position.AveragePrice × Position.Quantity), contado em dias
// corridos desde PurchasedAt — nunca sobre ativo TaxExempt, que sempre
// devolve líquido = bruto.
func Redeem(ctx RedeemContext, now time.Time) (RedeemOutcome, error) {
	if ctx.Position.Quantity <= 0 {
		return RedeemOutcome{}, ErrPositionNotFound
	}

	remainingDays := remainingBusinessDays(now, ctx.MaturityDate)
	result := fixedincome.EarlyRedemption(ctx.Position.AveragePrice, ctx.Position.AverageRate, ctx.CurrentMarketRatePct/100, remainingDays)
	totalValue := ctx.Position.Quantity * result.MarkToMarketPrice

	taxRate := 0.0
	netValue := totalValue
	if !ctx.TaxExempt {
		daysHeld := int(now.Sub(ctx.PurchasedAt).Hours() / 24)
		taxRate = fixedincome.RegressiveIncomeTaxRate(daysHeld)
		investedAmount := ctx.Position.AveragePrice * ctx.Position.Quantity
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

// Simulate projeta o retorno de um aporte hipotético em renda fixa sem
// gravar nada (tarefa 6.0.5): precifica a unidade nocional pelo deságio
// nominal na data de hoje (fixedincome.PrefixedPrice, mesma fórmula de
// Purchase), depois reaplica a mesma fórmula com o DU restante encolhido
// pelos dias simulados (menos tempo até o vencimento → preço mais próximo
// do Valor Nominal → ganho projetado) e aplica a alíquota regressiva de IR
// (fixedincome.RegressiveIncomeTaxRate) sobre esse ganho, se o produto não
// for isento.
func Simulate(req SimulateRequest, ctx SimulateContext, now time.Time) (SimulateOutcome, error) {
	if req.Amount <= 0 {
		return SimulateOutcome{}, ErrInvalidAmount
	}
	if req.DaysHeld <= 0 {
		return SimulateOutcome{}, ErrInvalidDaysHeld
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
