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
// antecipado — montado por Repository.LoadRedeemContext.
type RedeemContext struct {
	Position             fixedincomeposition.Position
	MaturityDate         time.Time
	CurrentMarketRatePct float64
}

// RedeemOutcome é o resultado de Redeem, pronto pra persistência.
type RedeemOutcome struct {
	TotalValue   float64
	MarkToMarket fixedincome.EarlyRedemptionResult
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
// 5 do doc do pacote) — não há resgate parcial.
func Redeem(ctx RedeemContext, now time.Time) (RedeemOutcome, error) {
	if ctx.Position.Quantity <= 0 {
		return RedeemOutcome{}, ErrPositionNotFound
	}

	remainingDays := remainingBusinessDays(now, ctx.MaturityDate)
	result := fixedincome.EarlyRedemption(ctx.Position.AveragePrice, ctx.Position.AverageRate, ctx.CurrentMarketRatePct/100, remainingDays)

	return RedeemOutcome{
		TotalValue:   ctx.Position.Quantity * result.MarkToMarketPrice,
		MarkToMarket: result,
	}, nil
}

// remainingBusinessDays converte a diferença de calendário entre now e
// maturityDate num DU aproximado (mesma base de 252 dias úteis/ano das
// fórmulas de fixedincome — ver nota 4 do doc do pacote), nunca menor que 1
// pra evitar expoente zero/negativo em PrefixedPrice/EarlyRedemption num
// título muito perto do vencimento.
func remainingBusinessDays(now, maturityDate time.Time) int {
	calendarDays := maturityDate.Sub(now).Hours() / 24
	businessDays := int(calendarDays * fixedincome.BusinessDaysPerYear / 365.0)
	if businessDays < 1 {
		return 1
	}
	return businessDays
}
