package paymentschedule

import (
	"hash/fnv"

	"tcc-investimentos/engine/internal/domain/catalog"
)

// Faixas dos parâmetros por ativo. Fontes e selos ([FONTE], [OBSERVADO],
// [ILUSTRATIVO]) em .claude/calibracao-calendario-proventos.md; os pesos de
// periodicidade são ilustrativos (não há estatística pública agregada).
const (
	// ReportWindowBusinessDays é a janela do offset do balanço, [0, 32) dias
	// úteis, cerca de 45 dias corridos (prazo legal do ITR, Resolução CVM 80).
	ReportWindowBusinessDays = 32
	// MinComLagBusinessDays e MaxComLagBusinessDays: a data-com sai 0 a 3 dias
	// úteis depois da declaração (o balanço).
	MinComLagBusinessDays = 0
	MaxComLagBusinessDays = 3
	// MinPaymentLagBusinessDays e MaxPaymentLagBusinessDays: o pagamento sai 5 a
	// 30 dias úteis depois da data-ex, abaixo do teto legal de 60 dias corridos
	// (Lei 6.404/76, art. 205, § 3º).
	MinPaymentLagBusinessDays = 5
	MaxPaymentLagBusinessDays = 30
)

type band struct {
	from, to int // inclusive
	weight   int // em %, a soma das faixas é 100
}

var (
	// Atraso do balanço em dias úteis: 5% até o dia 20, 30% de 21 a 25, 65% de
	// 26 a 31 (a maior parte divulga nas últimas semanas do prazo).
	reportOffsetBands = []band{{0, 20, 5}, {21, 25, 30}, {26, 31, 65}}
	// Dia útil de pagamento do FII no mês seguinte: concentrado no 10º.
	fiiPaymentBands = []band{{5, 8, 25}, {9, 11, 55}, {12, 15, 20}}

	// Pesos [trimestral, semestral, anual] em %, por setor.
	policyWeights = map[catalog.Sector][3]int{
		catalog.SectorMineracao:   {20, 60, 20},
		catalog.SectorAgronegocio: {20, 40, 40},
		catalog.SectorBancario:    {70, 20, 10},
		catalog.SectorVarejo:      {15, 25, 60},
		catalog.SectorEnergia:     {40, 45, 15},
		catalog.SectorTecnologia:  {10, 30, 60},
	}
)

// Schedule é a agenda padrão de um ativo, derivada só do ticker e do setor. O
// valor é gravado no cadastro na criação do ativo (e editável); nunca é
// recalculado a cada tick.
type Schedule struct {
	// ReportOffsetBusinessDays: atraso do balanço depois do fim do ciclo, em dias úteis.
	ReportOffsetBusinessDays int
	Policy                   Policy
	ComLagBusinessDays       int
	PaymentLagBusinessDays   int
	// FIIPaymentBusinessDay: dia útil do mês seguinte em que o FII paga (só para FII).
	FIIPaymentBusinessDay int
}

// DefaultsFor deriva a agenda de uma chave estável com hash FNV-1a (estável entre bancos
// recriados, diferente do UUID gerado pelo Postgres): o ticker, para FIIs, e o CNPJ, para
// empresas (ON e PN da mesma empresa compartilham a agenda, e a empresa não tem ticker
// próprio). Mesma chave e setor dão sempre a mesma agenda; setor desconhecido (ou vazio,
// o caso do FII) paga trimestral, o legado.
func DefaultsFor(ticker string, sector catalog.Sector) Schedule {
	policy := Quarterly
	if weights, ok := policyWeights[sector]; ok {
		policy = pickPolicy(weights, hash(ticker, "policy"))
	}
	return Schedule{
		ReportOffsetBusinessDays: pickFromBands(reportOffsetBands, ticker, "report"),
		Policy:                   policy,
		ComLagBusinessDays:       MinComLagBusinessDays + int(hash(ticker, "com")%uint64(MaxComLagBusinessDays-MinComLagBusinessDays+1)),
		PaymentLagBusinessDays:   MinPaymentLagBusinessDays + int(hash(ticker, "pay")%uint64(MaxPaymentLagBusinessDays-MinPaymentLagBusinessDays+1)),
		FIIPaymentBusinessDay:    pickFromBands(fiiPaymentBands, ticker, "fii"),
	}
}

func hash(ticker, salt string) uint64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(salt + ":" + ticker))
	return h.Sum64()
}

func pickPolicy(weights [3]int, h uint64) Policy {
	r := int(h % 100)
	switch {
	case r < weights[0]:
		return Quarterly
	case r < weights[0]+weights[1]:
		return Semiannual
	default:
		return Annual
	}
}

// pickFromBands sorteia a faixa pelo peso e o valor dentro dela de forma uniforme,
// com dois hashes independentes do mesmo ticker.
func pickFromBands(bands []band, ticker, salt string) int {
	r := int(hash(ticker, salt+":band") % 100)
	cumulative := 0
	for _, b := range bands {
		cumulative += b.weight
		if r < cumulative {
			return b.from + int(hash(ticker, salt+":value")%uint64(b.to-b.from+1))
		}
	}
	last := bands[len(bands)-1]
	return last.to
}
