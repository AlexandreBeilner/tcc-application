// Package bot — personalidade do bot (tarefa C.1). Ver doc do pacote em
// allocation.go pro contexto geral (proposta motor-mercado-realista, seção
// 2). Esta peça define só o "quem é esse bot" (as 4 dimensões da proposta
// 2.3.2) — a função de decisão de ordem por arquétipo (Ruído/Market Maker/
// Chartista/Fundamentalista) é escopo das tarefas C.2-C.5, cada uma
// declarando sua própria interface pequena (leitura de preço/fundamentos/
// evento) no ponto de consumo, no padrão já estabelecido pelo resto do
// engine/ (.claude/arquitetura-engine-go.md) — Personality em si não
// precisa de nenhum colaborador externo, só descreve dados.
package bot

import (
	"errors"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/equity"
)

// Archetype é a estratégia-base da função de decisão de um bot (proposta
// 2.3.2, item 1).
type Archetype string

const (
	ArchetypeRuido           Archetype = "ruido"
	ArchetypeMarketMaker     Archetype = "market_maker"
	ArchetypeChartista       Archetype = "chartista"
	ArchetypeFundamentalista Archetype = "fundamentalista"
)

var validArchetypes = map[Archetype]bool{
	ArchetypeRuido: true, ArchetypeMarketMaker: true,
	ArchetypeChartista: true, ArchetypeFundamentalista: true,
}

// IsValidArchetype indica se archetype é um dos 4 valores fixos da
// proposta 2.3.2 — mesmo padrão de catalog.IsValidAssetType/IsValidSector.
func IsValidArchetype(archetype Archetype) bool {
	return validArchetypes[archetype]
}

// validRiskClasses/validAssetClasses são cópias locais deliberadas, não
// uma dependência de catalog/equity por validação — equity.RiskClass não
// expõe um IsValid próprio (só paramsByRiskClass, não exportado), e
// catalog.AssetType cobre os 11 tipos do enum Postgres, mas o escopo de
// especialização de um bot só faz sentido pras 3 classes de Renda Variável
// (proposta 2.3.2, item 5 — bots não cobrem Renda Fixa, seção 9 trata isso
// à parte). Mesmo raciocínio de "domínios irmãos não se importam" já
// documentado em allocation.go pra deterministicSeed.
var validRiskClasses = map[equity.RiskClass]bool{
	equity.RiskClassConservador: true,
	equity.RiskClassSofisticado: true,
}

var validAssetClasses = map[catalog.AssetType]bool{
	catalog.AssetAcao: true,
	catalog.AssetETF:  true,
	catalog.AssetFII:  true,
}

// MaxSpreadWidthPct é o teto da largura de spread de um bot (fração do preço de
// referência, tarefa P.6, proposta-cobertura-market-maker.md seção 3.8). Valor
// ilustrativo, sem fonte real (mesma regra dos demais coeficientes do motor,
// sujeito à calibração futura): só barra valores absurdos vindos de um
// consumidor futuro (painel de bots, Fase N), já que o seed usa 0,02. Na B3 o
// formador de mercado também tem um spread máximo contratado. Fecha o achado
// 002, em que só se rejeitava spread >= 2 e passava, por exemplo, 1,999999.
const MaxSpreadWidthPct = 0.10

// SpecializationWithinScopeMin/Max é a faixa confirmada na proposta 2.3.2
// (item 2) pro percentual da atividade de um bot que fica dentro do seu
// próprio escopo (setores/risk_classes/classes de ativo que ele "entende")
// — o restante (1 - WithinScopePct) é o residual fora do escopo, que
// existe só pra nenhum ativo fora de cobertura ficar sem liquidez nenhuma.
// Mesmo padrão de MarketMakerShareMin/Max (allocation.go): a faixa é
// garantida por validação do construtor, não por sorteio — quem decide o
// valor exato dentro dela é o catálogo de bots (tarefa C.6).
const (
	SpecializationWithinScopeMin = 0.85
	SpecializationWithinScopeMax = 0.90
)

// DefaultMaxCoveredAssets é o teto padrão de ativos que um Market Maker cobre
// (proposta-cobertura-market-maker.md, seção 3.2; decisão de 2026-09-23). Não
// há dado externo que fixe 10: é um padrão ajustável por bot, não um limite
// do sistema. Não reduz o tempo do tick, só limita o estrago de um Market
// Maker desativado ou com estoque esgotado.
const DefaultMaxCoveredAssets = 10

// KnowledgeLevelMin/Max é a faixa fixa do nível de conhecimento do
// arquétipo Fundamentalista (proposta 2.3.2, item 3) — escalar 0-1, sem
// unidade própria.
const (
	KnowledgeLevelMin = 0.0
	KnowledgeLevelMax = 1.0
)

var (
	ErrUnknownArchetype                = errors.New("arquétipo de bot desconhecido")
	ErrEmptySpecializationScope        = errors.New("escopo de especialização do bot precisa de pelo menos um setor, risk_class ou classe de ativo")
	ErrUnknownSectorInScope            = errors.New("setor desconhecido no escopo de especialização do bot")
	ErrUnknownRiskClassInScope         = errors.New("risk_class desconhecida no escopo de especialização do bot")
	ErrUnknownAssetClassInScope        = errors.New("classe de ativo desconhecida (ou fora de Renda Variável) no escopo de especialização do bot")
	ErrInvalidWithinScopePct           = errors.New("percentual dentro do escopo precisa estar entre 0.85 e 0.90")
	ErrKnowledgeLevelWrongArchetype    = errors.New("nível de conhecimento só é aceito pro arquétipo fundamentalista")
	ErrMissingKnowledgeLevel           = errors.New("arquétipo fundamentalista precisa de nível de conhecimento")
	ErrInvalidKnowledgeLevel           = errors.New("nível de conhecimento precisa estar entre 0 e 1")
	ErrInvalidMaxPositionSizePct       = errors.New("tamanho de posição tolerado precisa estar entre 0 (exclusivo) e 1")
	ErrInvalidMarketOrderPreferencePct = errors.New("preferência por ordem a mercado precisa estar entre 0 e 1")
	ErrInvalidSpreadWidthPct           = errors.New("largura de spread não pode ser negativa")
	ErrSpreadWidthAboveMax             = errors.New("largura de spread acima do teto do formador de mercado")
	ErrInvalidMaxCoveredAssets         = errors.New("teto de ativos cobertos deve ser positivo")
	ErrMaxCoveredAssetsWrongArchetype  = errors.New("teto de ativos cobertos só existe no arquétipo Market Maker")
)

// SpecializationScope é "o que o bot entende" (proposta 2.3.2, item 2) —
// um conjunto (união, não exclusividade mútua — diferente de
// macroevent.Target, que descreve um único alvo por vez) de setores,
// risk_classes e/ou classes de ativo de Renda Variável, mais o percentual
// da atividade do bot que fica dentro desse conjunto.
type SpecializationScope struct {
	Sectors        []catalog.Sector
	RiskClasses    []equity.RiskClass
	AssetClasses   []catalog.AssetType
	WithinScopePct float64
}

// NewSpecializationScope valida o escopo de especialização de um bot:
// pelo menos uma das três listas não-vazia (escopo vazio não teria
// nenhuma leitura de "o que o bot entende"), todo valor de cada lista
// pertencendo ao conjunto conhecido, e WithinScopePct dentro da faixa
// confirmada (85-90%).
func NewSpecializationScope(sectors []catalog.Sector, riskClasses []equity.RiskClass, assetClasses []catalog.AssetType, withinScopePct float64) (SpecializationScope, error) {
	if len(sectors) == 0 && len(riskClasses) == 0 && len(assetClasses) == 0 {
		return SpecializationScope{}, ErrEmptySpecializationScope
	}
	for _, s := range sectors {
		if !catalog.IsValidSector(s) {
			return SpecializationScope{}, ErrUnknownSectorInScope
		}
	}
	for _, rc := range riskClasses {
		if !validRiskClasses[rc] {
			return SpecializationScope{}, ErrUnknownRiskClassInScope
		}
	}
	for _, ac := range assetClasses {
		if !validAssetClasses[ac] {
			return SpecializationScope{}, ErrUnknownAssetClassInScope
		}
	}
	if withinScopePct < SpecializationWithinScopeMin || withinScopePct > SpecializationWithinScopeMax {
		return SpecializationScope{}, ErrInvalidWithinScopePct
	}

	return SpecializationScope{
		Sectors:        sectors,
		RiskClasses:    riskClasses,
		AssetClasses:   assetClasses,
		WithinScopePct: withinScopePct,
	}, nil
}

// RiskProfile é o perfil de risco/agressividade de um bot (proposta 2.3.2)
// — tamanho de posição tolerado, preferência por ordem a mercado vs.
// limitada, e largura de spread ao redor do preço de referência que o bot
// pratica ao ofertar (mais relevante pro Market Maker, C.3, mas comum aos
// 4 arquétipos por uniformidade de struct).
type RiskProfile struct {
	// MaxPositionSizePct é a fração do caixa/posição disponível que o bot
	// tolera comprometer numa única ordem — (0, 1].
	MaxPositionSizePct float64
	// MarketOrderPreference é a probabilidade do bot preferir ordem a
	// mercado em vez de limitada — [0, 1] (0 = sempre limitada, 1 = sempre
	// a mercado).
	MarketOrderPreference float64
	// SpreadWidthPct é a largura do spread (fração do preço de
	// referência) que o bot pratica ao ofertar dos dois lados — [0, MaxSpreadWidthPct] (0 é
	// válido pra arquétipo sem oferta de spread, ex: Ruído/Chartista/
	// Fundamentalista negociando a mercado).
	SpreadWidthPct float64
}

// NewRiskProfile valida os 3 campos do perfil de risco/agressividade.
func NewRiskProfile(maxPositionSizePct, marketOrderPreference, spreadWidthPct float64) (RiskProfile, error) {
	if maxPositionSizePct <= 0 || maxPositionSizePct > 1 {
		return RiskProfile{}, ErrInvalidMaxPositionSizePct
	}
	if marketOrderPreference < 0 || marketOrderPreference > 1 {
		return RiskProfile{}, ErrInvalidMarketOrderPreferencePct
	}
	if spreadWidthPct < 0 {
		return RiskProfile{}, ErrInvalidSpreadWidthPct
	}
	if spreadWidthPct > MaxSpreadWidthPct {
		return RiskProfile{}, ErrSpreadWidthAboveMax
	}

	return RiskProfile{
		MaxPositionSizePct:    maxPositionSizePct,
		MarketOrderPreference: marketOrderPreference,
		SpreadWidthPct:        spreadWidthPct,
	}, nil
}

// Personality são as 4 dimensões que definem um bot (proposta 2.3.2):
// arquétipo, escopo de especialização, nível de conhecimento (só
// Fundamentalista) e perfil de risco/agressividade.
type Personality struct {
	Archetype Archetype
	Scope     SpecializationScope
	// KnowledgeLevel é nil pros 3 arquétipos que não têm essa dimensão —
	// só o Fundamentalista carrega um valor, fixo desde o seed (proposta
	// 2.3.2, item 3: "sem dimensão de aprendizado").
	KnowledgeLevel *float64
	RiskProfile    RiskProfile
	// MaxCoveredAssets é o teto de ativos que o bot cobre como formador de
	// mercado (tarefa P.1). nil pros 3 arquétipos que não cotam cobertura;
	// o Market Maker sempre carrega um valor positivo (DefaultMaxCoveredAssets
	// até WithMaxCoveredAssets ajustar).
	MaxCoveredAssets *int
}

// WithMaxCoveredAssets devolve uma cópia da personalidade com o teto de
// ativos cobertos ajustado. Só o Market Maker aceita, e o valor precisa ser
// positivo.
func (p Personality) WithMaxCoveredAssets(max int) (Personality, error) {
	if p.Archetype != ArchetypeMarketMaker {
		return Personality{}, ErrMaxCoveredAssetsWrongArchetype
	}
	if max <= 0 {
		return Personality{}, ErrInvalidMaxCoveredAssets
	}
	p.MaxCoveredAssets = &max
	return p, nil
}

// NewPersonality valida a combinação das 4 dimensões: arquétipo dentre os
// 4 valores fixos, escopo e perfil de risco já validados por seus próprios
// construtores (Scope/RiskProfile chegam prontos — quem chama monta cada
// um via NewSpecializationScope/NewRiskProfile antes), e o nível de
// conhecimento só aceito (e exigido) quando archetype ==
// ArchetypeFundamentalista — nos outros 3 arquétipos, knowledgeLevel
// precisa ser nil (proposta não prevê essa dimensão fora do
// Fundamentalista; aceitar um valor ali seria um dado sem efeito nenhum na
// função de decisão futura, silenciosamente ignorado).
func NewPersonality(archetype Archetype, scope SpecializationScope, knowledgeLevel *float64, riskProfile RiskProfile) (Personality, error) {
	if !validArchetypes[archetype] {
		return Personality{}, ErrUnknownArchetype
	}

	if archetype == ArchetypeFundamentalista {
		if knowledgeLevel == nil {
			return Personality{}, ErrMissingKnowledgeLevel
		}
		if *knowledgeLevel < KnowledgeLevelMin || *knowledgeLevel > KnowledgeLevelMax {
			return Personality{}, ErrInvalidKnowledgeLevel
		}
	} else if knowledgeLevel != nil {
		return Personality{}, ErrKnowledgeLevelWrongArchetype
	}

	personality := Personality{
		Archetype:      archetype,
		Scope:          scope,
		KnowledgeLevel: knowledgeLevel,
		RiskProfile:    riskProfile,
	}
	if archetype == ArchetypeMarketMaker {
		max := DefaultMaxCoveredAssets
		personality.MaxCoveredAssets = &max
	}
	return personality, nil
}
