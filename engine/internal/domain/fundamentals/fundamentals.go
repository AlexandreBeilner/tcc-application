// Package fundamentals gera os fundamentos sintéticos das empresas
// (`company_fundamentals`) com coerência macro em relação à Selic simulada
// (spec 3.2.2) — o fator sistêmico e contínuo que replica, na simulação, o
// mecanismo de transmissão da política monetária (Selic alta →
// desaceleração econômica → resultados corporativos mais fracos).
package fundamentals

import (
	"errors"
	"math/rand"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/equity"
)

// Valores ilustrativos do ciclo de relatórios (tarefa 3.14) — a spec 3.2.2/
// 3.3 não fecha estes números como fechou pro GBM (tabela da tarefa 3.1),
// só os invariantes qualitativos (Sofisticado mais sensível à Selic,
// surpresa positiva sobe o preço/negativa desce). Mesmo tratamento de
// selic.DefaultNeutralRate/tick.DefaultInitialPrice: sujeitos à calibração
// fina da tarefa 8.1.
const (
	// DefaultBaseGrowth é o crescimento_base ilustrativo aplicado a toda
	// empresa seedada, na ausência de uma calibração por empresa (a spec
	// não define currículo de crescimento por empresa nesta fase).
	DefaultBaseGrowth = 0.03
	// DefaultNoiseStdDev é o desvio-padrão ilustrativo do ruído
	// idiossincrático por ciclo de relatório.
	DefaultNoiseStdDev = 0.02
	// DefaultBaseRevenue é a receita líquida de partida de uma empresa sem
	// nenhuma linha de company_fundamentals gerada ainda — mesmo papel que
	// tick.DefaultInitialPrice cumpre pro preço de um ativo sem cotação
	// anterior.
	DefaultBaseRevenue = 1_000_000.0

	// Os cinco coeficientes abaixo (tarefa 4.8) eram, até a tarefa K.2
	// (backlog-motor-mercado-realista), um único conjunto genérico aplicado
	// a toda empresa — hoje só sobrevivem como fallback de
	// CoefficientsForSector pra um catalog.Sector fora dos 6 fixos da spec
	// 3.3.2 (não deveria acontecer: catalog.NewCompany já valida o setor na
	// criação da empresa). EBITMargin > NetMargin reflete o efeito de
	// impostos/juros entre os dois indicadores, mesmo invariante contábil
	// que qualquer companhia real — e qualquer setor calibrado em
	// CoefficientsBySector — respeita.

	// DefaultNetMarginPct é a margem líquida de fallback (net_income /
	// net_revenue), usada só quando o setor não é um dos 6 fixos.
	DefaultNetMarginPct = 0.10
	// DefaultEBITMarginPct é a margem EBIT de fallback (ebit / net_revenue)
	// — maior que DefaultNetMarginPct pelo mesmo motivo que EBIT > net
	// income numa demonstração de resultado real (antes de juros/impostos).
	DefaultEBITMarginPct = 0.18
	// DefaultEquityToRevenueRatio (fallback) converte net_revenue em
	// net_equity (patrimônio líquido tipicamente maior que a receita de um
	// único ciclo trimestral).
	DefaultEquityToRevenueRatio = 1.2
	// DefaultDebtToEquityRatio (fallback) converte net_equity em gross_debt
	// — alavancagem moderada (dívida bruta menor que o patrimônio líquido).
	DefaultDebtToEquityRatio = 0.4
	// DefaultCashToRevenueRatio (fallback) converte net_revenue em
	// cash_equivalents.
	DefaultCashToRevenueRatio = 0.15
)

// SensitivityByRiskClass são valores ilustrativos de sensibilidade a
// desvios da Selic por `risk_class` do ativo vinculado à empresa (spec
// 3.2.2: setores cíclicos/mais alavancados — Sofisticado — são mais
// sensíveis a juros altos que setores de fluxo de caixa mais estável —
// Conservador). Continua em uso só por bot.FundamentalistFairPrice (retorno
// exigido na fórmula de Justified Price-to-Book) — o crescimento
// (ExpectedGrowth/GrowthSeries/NextGrowth, abaixo) passou a usar
// CoefficientsBySector[sector].SelicSensitivity a partir da tarefa K.2, não
// mais este mapa. As duas fontes de sensibilidade podem divergir pra uma
// mesma empresa (uma por setor, outra por risk_class do ativo) — achado
// registrado em .claude/pontos-em-aberto-decisao-produto.md, decisão de
// unificação (ou não) fica pra uma sessão futura, fora do escopo de K.2
// ("Aplicação da calibração em fundamentals.go").
var SensitivityByRiskClass = map[equity.RiskClass]float64{
	equity.RiskClassConservador: 0.02,
	equity.RiskClassSofisticado: 0.06,
}

// SectorCoefficients agrupa os 5 coeficientes de DeriveFinancials mais a
// sensibilidade de crescimento à Selic — os 6 números que a tarefa K.1
// (.claude/calibracao-fundamentos-setor.md) recalibrou por catalog.Sector,
// com fonte real citada por setor, em vez do único conjunto genérico
// (Default*) usado até a tarefa K.2. Cada campo aqui é o CENTRO da faixa
// que o documento da K.1 propõe pra cada setor, não um teto/piso — a faixa
// de variação plausível entre empresas do mesmo setor (pedido explícito do
// autor: "podemos ter empresas acima ou abaixo da média") é coberta pelo
// multiplicador de qualidade por empresa (CoefficientsForCompany, achado
// 025), aplicado sobre estes valores centrais.
type SectorCoefficients struct {
	NetMarginPct         float64
	EBITMarginPct        float64
	EquityToRevenueRatio float64
	DebtToEquityRatio    float64
	CashToRevenueRatio   float64
	SelicSensitivity     float64
}

// CoefficientsBySector são os coeficientes centrais propostos pela pesquisa
// da tarefa K.1 pros 6 setores fixos da spec 3.3.2 — cada um ancorado em
// empresa(s) real(is) da B3 e fonte citada (detalhe completo, com fonte por
// número, em .claude/calibracao-fundamentos-setor.md):
//
//   - Mineração: Vale (release 1T25) — sensibilidade baixa à Selic, receita
//     majoritariamente dolarizada/exportadora.
//   - Agronegócio: SLC Agrícola (resultado 2024) — alavancagem elevada,
//     dependência de crédito rural.
//   - Bancário/Financeiro: ROE/Basileia do sistema bancário (Banco
//     Central) — patrimônio/dívida são proxy simplificado (banco não tem
//     dívida bruta convencional, ver nota no documento da K.1).
//   - Varejo: Lojas Renner + Magazine Luiza (releases 3T24) — as duas
//     pontas reais da mesma faixa (margem alta vs. margem fina).
//   - Energia: Equatorial + Energisa (releases 4T24/4T25/1T26) — setor
//     defensivo/regulado apesar da alavancagem alta.
//   - Tecnologia: TOTVS (release 4T25) — maior sensibilidade à Selic entre
//     os 6 setores (fluxo de caixa de longo prazo).
var CoefficientsBySector = map[catalog.Sector]SectorCoefficients{
	catalog.SectorMineracao: {
		NetMarginPct: 0.15, EBITMarginPct: 0.24, EquityToRevenueRatio: 1.3,
		DebtToEquityRatio: 0.45, CashToRevenueRatio: 0.15, SelicSensitivity: 0.02,
	},
	catalog.SectorAgronegocio: {
		NetMarginPct: 0.07, EBITMarginPct: 0.12, EquityToRevenueRatio: 1.0,
		DebtToEquityRatio: 1.0, CashToRevenueRatio: 0.08, SelicSensitivity: 0.05,
	},
	catalog.SectorBancario: {
		NetMarginPct: 0.22, EBITMarginPct: 0.30, EquityToRevenueRatio: 2.2,
		DebtToEquityRatio: 1.5, CashToRevenueRatio: 0.30, SelicSensitivity: 0.05,
	},
	catalog.SectorVarejo: {
		NetMarginPct: 0.05, EBITMarginPct: 0.09, EquityToRevenueRatio: 0.6,
		DebtToEquityRatio: 0.9, CashToRevenueRatio: 0.08, SelicSensitivity: 0.06,
	},
	catalog.SectorEnergia: {
		NetMarginPct: 0.12, EBITMarginPct: 0.22, EquityToRevenueRatio: 1.4,
		DebtToEquityRatio: 1.2, CashToRevenueRatio: 0.15, SelicSensitivity: 0.025,
	},
	catalog.SectorTecnologia: {
		NetMarginPct: 0.15, EBITMarginPct: 0.22, EquityToRevenueRatio: 0.9,
		DebtToEquityRatio: 0.35, CashToRevenueRatio: 0.25, SelicSensitivity: 0.07,
	},
}

// CoefficientsForSector devolve os coeficientes calibrados de um setor
// (CoefficientsBySector) — com fallback pros 5 coeficientes genéricos
// antigos (Default*, SelicSensitivity 0) quando sector não é um dos 6 fixos
// da spec 3.3.2. Não deveria acontecer com o catálogo validado
// (catalog.NewCompany já rejeita setor fora da lista na criação da
// empresa) — mesmo tratamento defensivo já dado a
// SensitivityByRiskClass[risk_class desconhecida] (zero value do map):
// não trava o ciclo de relatório por um dado de catálogo inesperado.
func CoefficientsForSector(sector catalog.Sector) SectorCoefficients {
	if c, ok := CoefficientsBySector[sector]; ok {
		return c
	}
	return SectorCoefficients{
		NetMarginPct:         DefaultNetMarginPct,
		EBITMarginPct:        DefaultEBITMarginPct,
		EquityToRevenueRatio: DefaultEquityToRevenueRatio,
		DebtToEquityRatio:    DefaultDebtToEquityRatio,
		CashToRevenueRatio:   DefaultCashToRevenueRatio,
	}
}

// NeutralQualityMultiplier é o multiplicador de qualidade de uma empresa
// "média" (companies.quality_multiplier, achado 025): deixa os coeficientes
// do setor exatamente como calibrados na K.1.
const NeutralQualityMultiplier = 1.0

// CoefficientsForCompany aplica o multiplicador de qualidade da empresa
// (companies.quality_multiplier, achado 025) sobre os coeficientes centrais
// do setor (CoefficientsForSector): margem líquida e margem EBIT escalam
// por qualityMultiplier e o índice dívida/patrimônio escala pelo inverso —
// empresa melhor que a média do setor é mais rentável e menos alavancada,
// empresa pior é o contrário. Patrimônio/receita, caixa/receita e a
// sensibilidade à Selic ficam os do setor (são estrutura do negócio, não
// qualidade), então ROE = NetMargin/EquityToRevenue escala por
// qualityMultiplier e a ordem EBIT >= lucro líquido se preserva.
//
// qualityMultiplier não positivo (valor zero de uma struct sem o campo
// preenchido) é tratado como NeutralQualityMultiplier, mesmo tratamento
// defensivo de CoefficientsForSector pra setor desconhecido:
// catalog.NewCompany já rejeita o valor inválido na criação da empresa.
func CoefficientsForCompany(sector catalog.Sector, qualityMultiplier float64) SectorCoefficients {
	coeffs := CoefficientsForSector(sector)
	if qualityMultiplier <= 0 {
		qualityMultiplier = NeutralQualityMultiplier
	}
	coeffs.NetMarginPct *= qualityMultiplier
	coeffs.EBITMarginPct *= qualityMultiplier
	coeffs.DebtToEquityRatio /= qualityMultiplier
	return coeffs
}

// Config parametriza a geração de fundamentos sintéticos de uma empresa
// por ciclo de relatório.
type Config struct {
	// BaseGrowth é o crescimento_base do ciclo, em decimal (ex: 0.03 para
	// 3% no trimestre), antes do ajuste pelo fator Selic e do ruído.
	BaseGrowth float64
	// Sensitivity é a sensibilidade a desvios da Selic em relação à Selic
	// neutra — tipicamente um valor de SensitivityByRiskClass pra
	// risk_class do ativo vinculado à empresa.
	Sensitivity float64
	// NoiseStdDev é o desvio-padrão do ruído idiossincrático por ciclo.
	NoiseStdDev float64
	Seed        int64
}

// ExpectedGrowth é o componente sistêmico do crescimento de um ciclo —
// crescimento_base ajustado pelo fator Selic (spec 3.2.2), sem o ruído
// idiossincrático de GrowthSeries. É esse valor, conhecido/precificado
// antes da divulgação do relatório, que serve de referência de
// "expectativa": o Fundamentalista (bot.FundamentalistFairPrice) sempre
// projeta o preço justo com este componente sistêmico, nunca com o
// crescimento realizado (actualGrowth, com ruído) de uma empresa
// específica — é assim que o preço reage ao resultado divulgado só na
// medida em que ele diverge desta expectativa, não ao resultado em si
// (spec 3.3), sem precisar de uma fórmula de "surpresa" separada (tarefa
// F.1, backlog-motor-mercado-realista).
func ExpectedGrowth(cfg Config, selicAnnualRate, selicNeutral float64) float64 {
	return cfg.BaseGrowth - cfg.Sensitivity*(selicAnnualRate-selicNeutral)
}

// GrowthSeries gera uma taxa de crescimento trimestral sintética por ciclo
// de relatório (spec 3.2.2):
//
//	crescimento = crescimento_base − sensibilidade × (Selic_atual − Selic_neutra) + ruído
//
// selicAnnualRates é a Selic simulada (% a.a., mesma unidade devolvida por
// selic.Series/selic.CalendarSeries) vigente em cada ciclo — um elemento
// por ciclo de relatório, não por dia; a amostragem da curva diária na
// cadência de 14 dias é responsabilidade de quem compõe esta série (tarefa
// 3.6). selicNeutral é a mesma âncora de reversão à média da Selic
// simulada (ex: selic.DefaultNeutralRate). GrowthSeries recebe os dois
// como parâmetros em vez de importar o pacote selic — mesma decisão de
// desacoplamento já tomada em equity.Series (tarefa 3.1): mantém a função
// pura/determinística por seed sem acoplar dois conceitos de domínio.
func GrowthSeries(cfg Config, selicAnnualRates []float64, selicNeutral float64) []float64 {
	if len(selicAnnualRates) == 0 {
		return nil
	}

	rng := rand.New(rand.NewSource(cfg.Seed))
	growth := make([]float64, len(selicAnnualRates))
	for i, selicRate := range selicAnnualRates {
		noise := rng.NormFloat64() * cfg.NoiseStdDev
		growth[i] = ExpectedGrowth(cfg, selicRate, selicNeutral) + noise
	}
	return growth
}

// NextGrowth avança o crescimento trimestral de uma empresa por um único
// ciclo de relatório, a partir do estado persistido — usado pelo
// Temporizador (tarefa 3.14) em vez de GrowthSeries, que nunca regenera a
// série do zero a cada ciclo (mesma decisão de arquitetura de
// selic.NextCalendarRate/equity.NextPrice, tarefa 3.11). cycleIndex
// (0-based, um por ciclo de fundamentals.IsReportDay verdadeiro — não por
// dia simulado) entra na derivação da rng junto com cfg.Seed pra que o
// ruído desse ciclo seja determinístico sem precisar repassar pelos ciclos
// anteriores (RNF08: mesmos cfg.Seed e cycleIndex sempre produzem o mesmo
// crescimento). selicAnnualRate/selicNeutral são a Selic simulada do dia do
// relatório e a âncora de reversão à média, mesma fonte que GrowthSeries
// usa via selicAnnualRates/selicNeutral.
func NextGrowth(cfg Config, cycleIndex int, selicAnnualRate, selicNeutral float64) float64 {
	rng := rand.New(rand.NewSource(cfg.Seed + int64(cycleIndex)))
	noise := rng.NormFloat64() * cfg.NoiseStdDev
	return ExpectedGrowth(cfg, selicAnnualRate, selicNeutral) + noise
}

// RevenueSeries encadeia uma série de crescimento (GrowthSeries) numa
// trajetória de receita líquida (`net_revenue` de company_fundamentals),
// aplicando cada taxa multiplicativamente sobre o ciclo anterior — mesmo
// papel que fixedincome.VNAMonthlySeries cumpre pro VNA do Tesouro IPCA+
// (tarefa 3.4): transforma uma série de taxas numa série de nível.
// Derivar net_income/ebit/net_equity/gross_debt/cash_equivalents a partir
// da receita é DeriveFinancials (tarefa 4.8).
func RevenueSeries(baseRevenue float64, growth []float64) []float64 {
	revenues := make([]float64, len(growth))
	revenue := baseRevenue
	for i, g := range growth {
		revenue *= 1 + g
		revenues[i] = revenue
	}
	return revenues
}

// Financials são os seis campos de uma linha de company_fundamentals já
// derivados (tarefa 4.8) — insumo dos indicadores de ação de RF21
// (indicators.go).
type Financials struct {
	NetRevenue      float64
	NetIncome       float64
	EBIT            float64
	NetEquity       float64
	GrossDebt       float64
	CashEquivalents float64
}

// DeriveFinancials deriva net_income/ebit/net_equity/gross_debt/
// cash_equivalents a partir de net_revenue já calculado (RevenueSeries/
// NextGrowth), aplicando os coeficientes calibrados por setor
// (CoefficientsForCompany: setor calibrado na K.2 mais o multiplicador de
// qualidade da empresa, achado 025). Usada pelo Temporizador (tarefa 3.14) a cada
// ciclo de relatório, junto de RevenueSeries/NextGrowth.
func DeriveFinancials(sector catalog.Sector, qualityMultiplier, netRevenue float64) Financials {
	coeffs := CoefficientsForCompany(sector, qualityMultiplier)
	netEquity := netRevenue * coeffs.EquityToRevenueRatio
	return Financials{
		NetRevenue:      netRevenue,
		NetIncome:       netRevenue * coeffs.NetMarginPct,
		EBIT:            netRevenue * coeffs.EBITMarginPct,
		NetEquity:       netEquity,
		GrossDebt:       netEquity * coeffs.DebtToEquityRatio,
		CashEquivalents: netRevenue * coeffs.CashToRevenueRatio,
	}
}

var (
	// ErrInvalidTargetPrice é devolvido por BootstrapFinancialsForTargetPrice
	// quando targetPrice não é positivo — não existe VPA que produza um
	// preço justo não-positivo.
	ErrInvalidTargetPrice = errors.New("preço-alvo precisa ser positivo para calibrar fundamentos iniciais")
	// ErrInvalidOutstandingShares é devolvido quando outstandingShares não é
	// positivo — não dá pra converter patrimônio líquido em VPA sem uma
	// base de ações em circulação válida.
	ErrInvalidOutstandingShares = errors.New("ações em circulação precisam ser positivas para calibrar fundamentos iniciais")
	// ErrInvalidNeutralRate é devolvido quando selicNeutral não é positivo —
	// mesma exigência de bot.ErrInvalidRequiredReturn (retorno exigido
	// precisa ser positivo pra uma leitura útil de Justified P/B), aqui
	// verificada direto porque BootstrapFinancialsForTargetPrice assume
	// requiredReturn == selicNeutral (dia zero do seed, sem desvio de
	// Selic ainda — ver comentário da função).
	ErrInvalidNeutralRate = errors.New("selic neutra precisa ser positiva para calibrar fundamentos iniciais")
	// ErrInvalidGrowthRate é devolvido quando growthRate é tão negativo que
	// zera ou inverte o fator (1+growthRate) — a mesma fórmula de Justified
	// P/B que bot.FundamentalistFairPrice usa não tem leitura útil com esse
	// fator não-positivo.
	ErrInvalidGrowthRate = errors.New("taxa de crescimento não pode zerar ou inverter o fator (1+crescimento) ao calibrar fundamentos iniciais")
)

// BootstrapFinancialsForTargetPrice deriva os fundamentos iniciais
// (`company_fundamentals`) de uma empresa nova de modo que o preço justo
// que bot.FundamentalistFairPrice calcularia a partir deles bata,
// exatamente, com targetPrice — em vez de escolher um net_revenue "no
// chute" e verificar depois se o preço justo resultante é plausível
// (o que produziu o achado 003 de
// .claude/pontos-em-aberto-decisao-produto.md: um net_revenue pequeno
// demais gerava VPA≈0 pra VALR3/BNDD4, o Fundamentalista tentava convergir
// o mercado pra um "preço justo" de bilhões e corrompia o book).
//
// A inversão parte da mesma fórmula de Justified Price-to-Book de
// FundamentalistFairPrice — fairPrice = VPA × (ROE/requiredReturn) ×
// (1+growth) — e resolve pra VPA dado um fairPrice-alvo:
//
//	VPA = targetPrice / ((ROE/requiredReturn) × (1+growthRate))
//	netEquity = VPA × outstandingShares
//	netRevenue = netEquity / coeffs.EquityToRevenueRatio
//
// ROE usa os coeficientes calibrados de sector com o multiplicador de
// qualidade da empresa (CoefficientsForCompany, K.2 + achado 025) — o
// mesmo que DeriveFinancials aplica depois. requiredReturn assume == selicNeutral: no
// instante do seed, antes de qualquer ciclo de relatório, a Selic simulada
// ainda não teve chance de desviar da sua âncora neutra, então o termo de
// desvio de FundamentalistFairPrice (sensibilidade × desvio) é zero —
// riskClass não entra na conta por isso, symmetric ao caso
// selicAnnualRate == selicNeutral de FundamentalistFairPrice.
//
// Generaliza pra qualquer ativo futuro (currículo completo, tarefa 7.2):
// dado qualquer sector/outstandingShares/targetPrice, devolve o net_revenue
// exato que faz o Fundamentalista nascer "satisfeito" com o preço de
// partida — nenhuma álgebra manual nem constante por ativo.
func BootstrapFinancialsForTargetPrice(sector catalog.Sector, qualityMultiplier, targetPrice float64, outstandingShares int64, growthRate, selicNeutral float64) (Financials, error) {
	if targetPrice <= 0 {
		return Financials{}, ErrInvalidTargetPrice
	}
	if outstandingShares <= 0 {
		return Financials{}, ErrInvalidOutstandingShares
	}
	if selicNeutral <= 0 {
		return Financials{}, ErrInvalidNeutralRate
	}
	growthFactor := 1 + growthRate
	if growthFactor <= 0 {
		return Financials{}, ErrInvalidGrowthRate
	}

	// coeffs.NetMarginPct/coeffs.EquityToRevenueRatio são proporcionais ao
	// mesmo net_revenue desconhecido que esta função resolve (netIncome =
	// netRevenue × NetMarginPct, netEquity = netRevenue ×
	// EquityToRevenueRatio) — netRevenue cancela na razão, sobra exatamente
	// NetMarginPct/EquityToRevenueRatio. Chama ROE com esses dois
	// coeficientes (em vez de dividir os dois à mão) pra não duplicar a
	// fórmula que bot.FundamentalistFairPrice também usa via fundamentals.
	// ROE — ok é sempre true aqui (EquityToRevenueRatio é uma constante > 0
	// calibrada por setor, nunca o net_equity real de uma empresa).
	coeffs := CoefficientsForCompany(sector, qualityMultiplier)
	roe, _ := ROE(coeffs.NetMarginPct, coeffs.EquityToRevenueRatio)
	vpa := targetPrice / ((roe / selicNeutral) * growthFactor)
	netEquity := vpa * float64(outstandingShares)
	netRevenue := netEquity / coeffs.EquityToRevenueRatio
	return DeriveFinancials(sector, qualityMultiplier, netRevenue), nil
}
