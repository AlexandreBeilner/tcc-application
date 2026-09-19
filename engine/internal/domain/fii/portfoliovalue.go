// Package fii — reavaliação periódica de PortfolioValue do FII papel
// (tarefa G.3, backlog-motor-mercado-realista): análogo a como um título de
// renda fixa acumula valor com o tempo (proposta seção 4) — a carteira de
// recebíveis rende de acordo com seu próprio indexador (CDI/IPCA+/
// prefixado), sem o ruído idiossincrático que NetWorthVariation aplica pro
// perfil tijolo (networth.go): rendimento de carteira de renda fixa é
// contratado/indexado, não uma avaliação de mercado sujeita a surpresa.
package fii

import (
	"errors"
	"math"
)

// Os 3 indexadores possíveis de uma carteira de FII papel (fii_details.
// indexador, papel profile) — a coluna é varchar(20) livre no Postgres
// (sem CHECK/enum, migration 000001), então PortfolioValueVariation
// devolve ok = false pra qualquer valor fora destes três, em vez de travar
// o tick (mesmo tratamento de "dado ausente/desconhecido não é erro" já
// dado a outros insumos ausentes do catálogo, ex: dividendRecordsForCycle).
const (
	IndexadorCDI       = "CDI"
	IndexadorIPCAPlus  = "IPCA+"
	IndexadorPrefixado = "Prefixado"
)

// DefaultIPCAPlusAnnualRatePct/DefaultPrefixadoAnnualRatePct são taxas
// anuais nominais ilustrativas (mesma escala 0-100 de selic.Config, ex:
// 10.0 = 10% a.a.) — CDI não precisa de uma constante própria porque lê a
// Selic simulada do dia (proxy de CDI já usado em outras partes do motor,
// mesma simplificação late de tesouro_selic ser 1:1 com a Selic). IPCA+
// usa um número ilustrativo em vez do IPCA simulado de verdade porque
// `ipca.MonthlySeries` não tem nenhum consumidor no tick diário ainda
// (achado documentado na Fase M do backlog — fora do escopo desta tarefa,
// que depende só de G.1); Prefixado é, por definição, uma taxa travada
// que não reage a nenhuma variável simulada. Ambas sujeitas à calibração
// fina da tarefa 8.1, mesmo tratamento de todo coeficiente sem tabela
// numérica fechada pela spec/proposta.
const (
	DefaultIPCAPlusAnnualRatePct  = 6.0
	DefaultPrefixadoAnnualRatePct = 10.0
)

// ErrUnknownIndexador é devolvido por PortfolioValueVariation quando
// indexador não é um dos 3 valores conhecidos (IndexadorCDI/IPCAPlus/
// Prefixado) — quem chama decide se isso deve pular a reavaliação daquele
// FII (mesmo tratamento que Advance já dá a outro dado de catálogo
// ausente/inesperado).
var ErrUnknownIndexador = errors.New("indexador de carteira de FII papel desconhecido")

// PortfolioValueVariation é a fração decimal (ex: 0.0037 para +0,37%) que
// a carteira de um FII papel rende num ciclo de cycleDays dias corridos,
// segundo seu indexador — sempre positiva/determinística, sem ruído
// idiossincrático (diferente de NetWorthVariation): rendimento de carteira
// de renda fixa é contratado/indexado, não uma avaliação de mercado.
// selicAnnualRate (escala 0-100, mesma convenção de selic.Config) só é
// lida quando indexador == IndexadorCDI. A composição usa dias corridos
// sobre 365 (não os 252 dias úteis de fixedincome.BusinessDaysPerYear) —
// FII não segue a convenção de DU de título individual em nenhum outro
// lugar do motor (ex: dividend.DefaultPaymentLagDays já usa dia simulado
// corrido).
func PortfolioValueVariation(indexador string, selicAnnualRate float64, cycleDays int) (float64, error) {
	var annualRatePct float64
	switch indexador {
	case IndexadorCDI:
		annualRatePct = selicAnnualRate
	case IndexadorIPCAPlus:
		annualRatePct = DefaultIPCAPlusAnnualRatePct
	case IndexadorPrefixado:
		annualRatePct = DefaultPrefixadoAnnualRatePct
	default:
		return 0, ErrUnknownIndexador
	}
	return math.Pow(1+annualRatePct/100, float64(cycleDays)/365) - 1, nil
}

// NextPortfolioValue reavalia o PortfolioValue vigente de um FII papel por
// um único ciclo, a partir do último valor persistido (fii_details.
// portfolio_value) — nunca regenera uma série do zero (mesma decisão de
// arquitetura de NextNetWorth/equity.NextPrice/fundamentals.NextGrowth,
// tarefa 3.11).
func NextPortfolioValue(indexador string, currentPortfolioValue, selicAnnualRate float64, cycleDays int) (float64, error) {
	variation, err := PortfolioValueVariation(indexador, selicAnnualRate, cycleDays)
	if err != nil {
		return 0, err
	}
	return currentPortfolioValue * (1 + variation), nil
}
