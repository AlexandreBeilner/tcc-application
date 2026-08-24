package macroevent

import (
	"errors"
	"math/rand"
)

// ErrUnknownBand é devolvido por qualquer função desta tabela pra uma
// Band fora das três constantes conhecidas.
var ErrUnknownBand = errors.New("banda de magnitude de evento macro desconhecida")

// EffectRange é a faixa (mín/máx, em escala percentual — mesma convenção
// de price_effect_pct/fundamentals_effect_pct/etf.WeightPct: 12.5 significa
// 12,5%, não 0.125) de onde SamplePriceEffectPct/SampleFundamentalsEffectPct
// sorteiam a magnitude de um evento, antes do sinal de Direction ser
// aplicado.
type EffectRange struct {
	MinPct float64
	MaxPct float64
}

// priceEffectRanges e fundamentalsEffectRanges espelham, coluna por
// coluna, a tabela da spec 3.3.2 — valores fechados pela spec (não um
// placeholder ilustrativo como SensitivityByRiskClass/priceSensitivity em
// fundamentals, esses sim sujeitos à calibração da tarefa 8.1).
var priceEffectRanges = map[Band]EffectRange{
	BandLeve:     {MinPct: 3, MaxPct: 5},
	BandModerado: {MinPct: 8, MaxPct: 12},
	BandSevero:   {MinPct: 15, MaxPct: 25},
}

var fundamentalsEffectRanges = map[Band]EffectRange{
	BandLeve:     {MinPct: 5, MaxPct: 10},
	BandModerado: {MinPct: 10, MaxPct: 20},
	BandSevero:   {MinPct: 20, MaxPct: 35},
}

// durationDaysByBand é a tabela fixa de duração do efeito imediato de
// preço por banda — decisão de projeto (backlog 4.2, não é a spec 3.3.2
// que só define as faixas de efeito): a tela 10.2 do inventário não tem
// campo de duração no formulário de disparo, então não é configurável
// pelo admin. Valores ilustrativos, sujeitos à calibração da tarefa 8.1,
// mesmo tratamento dado a SensitivityByRiskClass/priceSensitivity
// (pacote fundamentals) e DefaultInitialPrice (pacote tick).
var durationDaysByBand = map[Band]int{
	BandLeve:     1,
	BandModerado: 2,
	BandSevero:   3,
}

// PriceEffectRange devolve a faixa (spec 3.3.2) de onde o efeito imediato
// de preço de um evento dessa banda é sorteado.
func PriceEffectRange(band Band) (EffectRange, error) {
	r, ok := priceEffectRanges[band]
	if !ok {
		return EffectRange{}, ErrUnknownBand
	}
	return r, nil
}

// FundamentalsEffectRange devolve a faixa (spec 3.3.2) de onde o efeito
// nos fundamentos (próximo relatório) de um evento dessa banda é
// sorteado.
func FundamentalsEffectRange(band Band) (EffectRange, error) {
	r, ok := fundamentalsEffectRanges[band]
	if !ok {
		return EffectRange{}, ErrUnknownBand
	}
	return r, nil
}

// DurationDays devolve quantos dias simulados consecutivos o efeito
// imediato de preço de um evento dessa banda dura (ver durationDaysByBand).
func DurationDays(band Band) (int, error) {
	d, ok := durationDaysByBand[band]
	if !ok {
		return 0, ErrUnknownBand
	}
	return d, nil
}

// sampleMagnitudeAndSign sorteia um valor uniforme dentro de r e aplica o
// sinal de direction — positivo sempre soma, negativo sempre subtrai,
// misto sorteia o sinal 50/50. A spec 3.3.2 descreve "misto" só como
// "câmbio beneficia exportador, prejudica importador simultaneamente" —
// sem nenhum critério de setor/ativo pra decidir qual lado fica positivo
// e qual fica negativo num evento específico; essa granularidade (aplicar
// sinais diferentes por Target dentro do mesmo evento misto) fica fora de
// escopo desta tarefa, documentada aqui como limitação conhecida — misto
// aplica um único sinal sorteado a todos os alvos do evento.
func sampleMagnitudeAndSign(r EffectRange, direction Direction, rng *rand.Rand) float64 {
	magnitude := r.MinPct + rng.Float64()*(r.MaxPct-r.MinPct)

	switch direction {
	case DirectionNegativo:
		return -magnitude
	case DirectionMisto:
		if rng.Float64() < 0.5 {
			return -magnitude
		}
		return magnitude
	default: // DirectionPositivo
		return magnitude
	}
}

// SamplePriceEffectPct sorteia o percentual de efeito imediato de preço
// de um evento (band, direction), já com o sinal aplicado — o valor
// gravado uma única vez em macro_events.price_effect_pct na criação do
// evento (tarefa 4.4), não re-sorteado a cada dia em que o efeito está
// ativo.
func SamplePriceEffectPct(band Band, direction Direction, rng *rand.Rand) (float64, error) {
	r, err := PriceEffectRange(band)
	if err != nil {
		return 0, err
	}
	return sampleMagnitudeAndSign(r, direction, rng), nil
}

// SampleFundamentalsEffectPct sorteia o percentual de efeito nos
// fundamentos do próximo relatório de um evento (band, direction), já com
// o sinal aplicado — mesmo papel de SamplePriceEffectPct pro efeito
// gravado em macro_events.fundamentals_effect_pct.
func SampleFundamentalsEffectPct(band Band, direction Direction, rng *rand.Rand) (float64, error) {
	r, err := FundamentalsEffectRange(band)
	if err != nil {
		return 0, err
	}
	return sampleMagnitudeAndSign(r, direction, rng), nil
}
