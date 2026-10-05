// Package botadmin é a gestão de bots pelo painel admin (tarefas N.1 e N.15):
// listar, criar, alterar (ativar/desativar, teto de cobertura, reatribuir
// cobertura, personalidade) e aportar caixa ou posição. Nenhuma regra de
// personalidade é reescrita aqui: criação e edição reaproveitam
// bot.NewSpecializationScope/NewRiskProfile/NewPersonality, e a atribuição de
// cobertura reaproveita coverage.Assign/Provisioner (P.1/P.9), nunca um caminho
// paralelo.
package botadmin

import (
	"context"
	"errors"
	"fmt"

	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/coverage"
	"tcc-investimentos/engine/internal/domain/equity"
	"tcc-investimentos/engine/internal/domain/orderexecution"
	"tcc-investimentos/engine/internal/domain/position"
)

// MaxInitialCash é o teto do caixa inicial de um bot criado pelo painel. Valor
// ilustrativo (sem fonte real): só barra um zero a mais digitado por engano. É
// alto porque o float sintético é grande: o seed dá aos bots do pool caixas de
// dezenas de bilhões (um Market Maker passa de R$ 300 bilhões), e um bot criado
// pelo painel precisa poder ter porte comparável.
const MaxInitialCash = 1_000_000_000_000.0

var (
	ErrBotNotFound          = errors.New("bot não encontrado")
	ErrInvalidInitialCash   = errors.New("o caixa inicial do bot precisa ser positivo e de no máximo R$ 1.000.000.000.000,00")
	ErrNothingToUpdate      = errors.New("informe pelo menos um campo a alterar")
	ErrNotMarketMaker       = errors.New("cobertura e teto de cobertura só existem no arquétipo Market Maker")
	ErrAssetNotTradable     = errors.New("o ativo não é negociável (precisa ser ação, ETF ou FII fora do sandbox)")
	ErrAssetAlreadyCovered  = errors.New("o ativo já é coberto por outro Market Maker (tire-o de lá primeiro)")
	ErrCoverageExceedsLimit = errors.New("a cobertura pedida passa do teto de ativos do Market Maker")
	ErrDuplicateAssetIDs    = errors.New("covered_asset_ids repete um ativo")

	ErrNothingToFund          = errors.New("informe caixa e/ou posição a aportar")
	ErrInvalidFundingCash     = errors.New("o aporte de caixa precisa ser positivo e de no máximo R$ 1.000.000.000.000,00")
	ErrInvalidFundingQuantity = errors.New("a quantidade a aportar precisa ser um inteiro positivo")
	ErrDuplicateFundingAsset  = errors.New("holdings repete um ativo")
	ErrNoQuoteToValue         = errors.New("o ativo não tem cotação pra valorizar a posição aportada")
	ErrNoOutstandingShares    = errors.New("o ativo não tem cotas em circulação definidas")
	ErrFloatCeilingExceeded   = errors.New("a posição passaria do total de cotas em circulação do ativo: o float já está distribuído, aporte só caixa ou escolha um ativo com folga")
)

// MaxFundingQuantity é o teto de cotas por linha de aporte: market_events.quantity é
// um inteiro de 32 bits.
const MaxFundingQuantity = 2_000_000_000

// AssetRef identifica um ativo na listagem.
type AssetRef struct {
	AssetID string
	Ticker  string
}

// Holding é uma posição aberta de um bot.
type Holding struct {
	AssetID      string
	Ticker       string
	Quantity     int64
	AveragePrice float64
}

// Bot é o bot visto pelo painel: identidade, personalidade, interruptor, caixa,
// posições e (Market Maker) os ativos que cobre.
type Bot struct {
	AccountID   string
	Personality bot.Personality
	IsActive    bool
	Cash        float64
	Covered     []AssetRef
	Holdings    []Holding
}

// Listing é a resposta de GET /admin/bots: os bots e os ativos negociáveis que
// hoje não têm Market Maker ativo cobrindo (a mesma conta de uncovered_assets da
// visão geral).
type Listing struct {
	Bots            []Bot
	UncoveredAssets []AssetRef
}

// Reader é a leitura do painel de bots, implementada por *db.BotAdminRepository.
type Reader interface {
	List(ctx context.Context) (Listing, error)
	Find(ctx context.Context, accountID string) (Bot, bool, error)
	// TradableAsset devolve o ativo se ele é negociável no book (ação, ETF ou FII
	// fora do sandbox).
	TradableAsset(ctx context.Context, assetID string) (AssetRef, bool, error)
	// CountAdminBots conta os bots já criados pelo painel (prefixo de ID próprio),
	// base do ID determinístico do próximo.
	CountAdminBots(ctx context.Context) (int, error)
	// FundingTarget devolve o ativo negociável com a última cotação e as cotas em
	// circulação (0 quando desconhecidas), pra valorizar e validar um aporte.
	FundingTarget(ctx context.Context, assetID string) (FundingTarget, bool, error)
}

// Writer é a escrita do painel de bots, implementada por *db.BotAdminRepository.
type Writer interface {
	// CreateBot grava conta (com o caixa por evento imutável) e personalidade
	// numa transação só.
	CreateBot(ctx context.Context, accountID string, cash float64, personality bot.Personality) error
	// SetActive só alterna accounts.is_active, nunca toca saldo nem posição (A.4).
	SetActive(ctx context.Context, accountID string, active bool) error
	SetMaxCoveredAssets(ctx context.Context, accountID string, max int) error
	RemoveCoverage(ctx context.Context, accountID, assetID string) error
	// UpdatePersonality troca os parâmetros editáveis da personalidade (escopo, posição
	// máxima, spread, conhecimento) numa transação só; arquétipo, preferência por ordem
	// a mercado e teto de cobertura ficam como estão.
	UpdatePersonality(ctx context.Context, accountID string, personality bot.Personality) error
	// FundBot grava o aporte como evento imutável (caixa e alocação) e projeta saldo e
	// posições na mesma transação, validando o teto de float; recusa o aporte inteiro
	// com position.ErrFloatExceeded se alguma linha passar do teto.
	FundBot(ctx context.Context, accountID string, cash float64, lines []FundingLine) error
}

// FundingTarget é o ativo de um aporte de posição.
type FundingTarget struct {
	AssetRef
	LastPrice         float64
	OutstandingShares int64
}

// FundingHolding é uma linha do aporte pedida pelo painel.
type FundingHolding struct {
	AssetID  string
	Quantity int64
}

// FundingLine é uma linha do aporte já valorizada pela última cotação.
type FundingLine struct {
	AssetID           string
	Quantity          int64
	Price             float64
	OutstandingShares int64
}

// FundingInput é o aporte: caixa e/ou posições. Nunca remove caixa nem posição.
type FundingInput struct {
	Cash     float64
	Holdings []FundingHolding
}

// OrderCanceller é o cancelamento em lote da N.10, reaproveitado pra limpar a
// cotação de um Market Maker num ativo que ele deixa de cobrir.
type OrderCanceller interface {
	CancelBatch(ctx context.Context, filter orderexecution.CancelFilter) ([]string, error)
}

// Service orquestra criação e alteração de bots.
type Service struct {
	reader      Reader
	writer      Writer
	coverage    coverage.MarketMakerLister
	provisioner coverage.Provisioner
	canceller   OrderCanceller
}

func NewService(reader Reader, writer Writer, lister coverage.MarketMakerLister, provisioner coverage.Provisioner, canceller OrderCanceller) *Service {
	return &Service{reader: reader, writer: writer, coverage: lister, provisioner: provisioner, canceller: canceller}
}

// List devolve todos os bots e os ativos sem cobertura.
func (s *Service) List(ctx context.Context) (Listing, error) {
	return s.reader.List(ctx)
}

// CreateInput é o que o painel informa pra criar um bot. A personalidade passa
// pelos construtores de domínio, então valores inválidos viram os erros de
// bot.Err*.
type CreateInput struct {
	Archetype             bot.Archetype
	Sectors               []catalog.Sector
	RiskClasses           []equity.RiskClass
	AssetClasses          []catalog.AssetType
	WithinScopePct        float64
	KnowledgeLevel        *float64
	MaxPositionSizePct    float64
	MarketOrderPreference float64
	SpreadWidthPct        float64
	// MaxCoveredAssets só vale pro Market Maker (nil = bot.DefaultMaxCoveredAssets).
	MaxCoveredAssets *int
	InitialCash      float64
}

// NewAdminBotID é o ID determinístico do bot direcional criado pelo painel, de
// índice n (1-based). Determinístico (não aleatório) porque o ID entra na semente
// das rodadas (RNF08); prefixo próprio pra nunca colidir com o pool do seed.
func NewAdminBotID(n int) string {
	return fmt.Sprintf("00000000-0000-0000-0002-%012d", n)
}

// Create valida a personalidade e o caixa e cria o bot. A posição inicial não é
// aceita: o float de todo ativo já está distribuído entre os detentores (B.1/P.2)
// e a posição teria que sair de alguém; o bot começa só com caixa e ganha posição
// negociando. Market Maker novo nasce sem cobertura: vira o candidato de
// coverage.Assign (o menos carregado) pro próximo ativo, ou recebe ativos
// explícitos por UpdateBot.
func (s *Service) Create(ctx context.Context, in CreateInput) (Bot, error) {
	if in.InitialCash <= 0 || in.InitialCash > MaxInitialCash {
		return Bot{}, ErrInvalidInitialCash
	}
	scope, err := bot.NewSpecializationScope(in.Sectors, in.RiskClasses, in.AssetClasses, in.WithinScopePct)
	if err != nil {
		return Bot{}, err
	}
	risk, err := bot.NewRiskProfile(in.MaxPositionSizePct, in.MarketOrderPreference, in.SpreadWidthPct)
	if err != nil {
		return Bot{}, err
	}
	personality, err := bot.NewPersonality(in.Archetype, scope, in.KnowledgeLevel, risk)
	if err != nil {
		return Bot{}, err
	}
	if in.MaxCoveredAssets != nil {
		if personality, err = personality.WithMaxCoveredAssets(*in.MaxCoveredAssets); err != nil {
			return Bot{}, err
		}
	}

	accountID, err := s.nextID(ctx, in.Archetype)
	if err != nil {
		return Bot{}, err
	}
	if err := s.writer.CreateBot(ctx, accountID, in.InitialCash, personality); err != nil {
		return Bot{}, fmt.Errorf("criar bot %s: %w", accountID, err)
	}
	created, found, err := s.reader.Find(ctx, accountID)
	if err != nil {
		return Bot{}, err
	}
	if !found {
		return Bot{}, ErrBotNotFound
	}
	return created, nil
}

// nextID escolhe o ID do bot novo: o Market Maker segue o esquema da cobertura
// (coverage.NewMarketMakerID, o mesmo do provisionamento automático); os demais
// usam o prefixo do painel.
func (s *Service) nextID(ctx context.Context, archetype bot.Archetype) (string, error) {
	if archetype == bot.ArchetypeMarketMaker {
		marketMakers, err := s.coverage.ListMarketMakers(ctx)
		if err != nil {
			return "", fmt.Errorf("listar Market Makers: %w", err)
		}
		return coverage.NewMarketMakerID(len(marketMakers)), nil
	}
	count, err := s.reader.CountAdminBots(ctx)
	if err != nil {
		return "", err
	}
	return NewAdminBotID(count + 1), nil
}

// UpdateInput é o PATCH: campo nil não muda. CoveredAssetIDs, quando presente, é o
// conjunto final de ativos do Market Maker (substitui o atual).
type UpdateInput struct {
	IsActive         *bool
	MaxCoveredAssets *int
	CoveredAssetIDs  *[]string
	// Personalidade (N.15): campo nil não muda. A preferência por ordem a mercado fica
	// de fora de propósito (achado 001): o campo está reservado e sem efeito.
	Sectors            *[]catalog.Sector
	RiskClasses        *[]equity.RiskClass
	AssetClasses       *[]catalog.AssetType
	WithinScopePct     *float64
	KnowledgeLevel     *float64
	MaxPositionSizePct *float64
	SpreadWidthPct     *float64
}

func (in UpdateInput) changesPersonality() bool {
	return in.Sectors != nil || in.RiskClasses != nil || in.AssetClasses != nil || in.WithinScopePct != nil ||
		in.KnowledgeLevel != nil || in.MaxPositionSizePct != nil || in.SpreadWidthPct != nil
}

// Update valida o estado final por inteiro antes de gravar qualquer coisa, então
// só falha de infraestrutura deixa a alteração pela metade. Ordem de aplicação:
// teto, ativos novos, ativos removidos (cancelando as ordens em repouso do Market
// Maker neles: a cotação de Market Maker ativo não expira por dia, P.5), e por
// último o interruptor.
func (s *Service) Update(ctx context.Context, accountID string, in UpdateInput) (Bot, error) {
	if in.IsActive == nil && in.MaxCoveredAssets == nil && in.CoveredAssetIDs == nil && !in.changesPersonality() {
		return Bot{}, ErrNothingToUpdate
	}
	current, found, err := s.reader.Find(ctx, accountID)
	if err != nil {
		return Bot{}, err
	}
	if !found {
		return Bot{}, ErrBotNotFound
	}

	plan, err := s.planCoverage(ctx, current, in)
	if err != nil {
		return Bot{}, err
	}
	personality, err := planPersonality(current, in)
	if err != nil {
		return Bot{}, err
	}
	if err := s.apply(ctx, current, in, plan, personality); err != nil {
		return Bot{}, err
	}

	updated, found, err := s.reader.Find(ctx, accountID)
	if err != nil {
		return Bot{}, err
	}
	if !found {
		return Bot{}, ErrBotNotFound
	}
	return updated, nil
}

// coveragePlan é o que Update vai mudar na cobertura, já validado.
type coveragePlan struct {
	max     *int
	added   []string
	removed []string
}

func (s *Service) planCoverage(ctx context.Context, current Bot, in UpdateInput) (coveragePlan, error) {
	var plan coveragePlan
	if in.MaxCoveredAssets == nil && in.CoveredAssetIDs == nil {
		return plan, nil
	}
	if current.Personality.Archetype != bot.ArchetypeMarketMaker {
		return plan, ErrNotMarketMaker
	}

	limit := *current.Personality.MaxCoveredAssets
	if in.MaxCoveredAssets != nil {
		adjusted, err := current.Personality.WithMaxCoveredAssets(*in.MaxCoveredAssets)
		if err != nil {
			return plan, err
		}
		limit = *adjusted.MaxCoveredAssets
		plan.max = in.MaxCoveredAssets
	}

	final := make(map[string]bool, len(current.Covered))
	for _, a := range current.Covered {
		final[a.AssetID] = true
	}
	if in.CoveredAssetIDs != nil {
		desired := make(map[string]bool, len(*in.CoveredAssetIDs))
		for _, id := range *in.CoveredAssetIDs {
			if desired[id] {
				return plan, ErrDuplicateAssetIDs
			}
			desired[id] = true
		}
		for _, a := range current.Covered {
			if !desired[a.AssetID] {
				plan.removed = append(plan.removed, a.AssetID)
			}
		}
		for _, id := range *in.CoveredAssetIDs {
			if !final[id] {
				plan.added = append(plan.added, id)
			}
		}
		final = desired
	}
	if len(final) > limit {
		return plan, ErrCoverageExceedsLimit
	}
	return plan, s.validateAdded(ctx, plan.added)
}

// validateAdded confere que cada ativo novo é negociável e ainda sem Market Maker
// (de nenhum, ativo ou não: dois Market Makers no mesmo ativo duplicariam o float
// provisionado). Mover um ativo entre Market Makers é remover de um e depois
// adicionar no outro.
func (s *Service) validateAdded(ctx context.Context, added []string) error {
	if len(added) == 0 {
		return nil
	}
	marketMakers, err := s.coverage.ListMarketMakers(ctx)
	if err != nil {
		return fmt.Errorf("listar Market Makers: %w", err)
	}
	covered := make(map[string]bool)
	for _, mm := range marketMakers {
		for _, id := range mm.CoveredAssetIDs {
			covered[id] = true
		}
	}
	for _, id := range added {
		if _, ok, err := s.reader.TradableAsset(ctx, id); err != nil {
			return err
		} else if !ok {
			return ErrAssetNotTradable
		}
		if covered[id] {
			return ErrAssetAlreadyCovered
		}
	}
	return nil
}

// planPersonality monta a personalidade final pelos construtores de domínio (a mesma
// validação da criação, nunca regra duplicada). nil quando o PATCH não mexe nela. A
// preferência por ordem a mercado, o arquétipo e o teto de cobertura vêm do bot atual.
func planPersonality(current Bot, in UpdateInput) (*bot.Personality, error) {
	if !in.changesPersonality() {
		return nil, nil
	}
	p := current.Personality
	sectors, riskClasses, assetClasses, within := p.Scope.Sectors, p.Scope.RiskClasses, p.Scope.AssetClasses, p.Scope.WithinScopePct
	if in.Sectors != nil {
		sectors = *in.Sectors
	}
	if in.RiskClasses != nil {
		riskClasses = *in.RiskClasses
	}
	if in.AssetClasses != nil {
		assetClasses = *in.AssetClasses
	}
	if in.WithinScopePct != nil {
		within = *in.WithinScopePct
	}
	scope, err := bot.NewSpecializationScope(sectors, riskClasses, assetClasses, within)
	if err != nil {
		return nil, err
	}

	maxPosition, spread := p.RiskProfile.MaxPositionSizePct, p.RiskProfile.SpreadWidthPct
	if in.MaxPositionSizePct != nil {
		maxPosition = *in.MaxPositionSizePct
	}
	if in.SpreadWidthPct != nil {
		spread = *in.SpreadWidthPct
	}
	risk, err := bot.NewRiskProfile(maxPosition, p.RiskProfile.MarketOrderPreference, spread)
	if err != nil {
		return nil, err
	}

	knowledge := p.KnowledgeLevel
	if in.KnowledgeLevel != nil {
		knowledge = in.KnowledgeLevel
	}
	next, err := bot.NewPersonality(p.Archetype, scope, knowledge, risk)
	if err != nil {
		return nil, err
	}
	next.MaxCoveredAssets = p.MaxCoveredAssets
	return &next, nil
}

func (s *Service) apply(ctx context.Context, current Bot, in UpdateInput, plan coveragePlan, personality *bot.Personality) error {
	id := current.AccountID
	if personality != nil {
		if err := s.writer.UpdatePersonality(ctx, id, *personality); err != nil {
			return fmt.Errorf("alterar a personalidade do bot: %w", err)
		}
	}
	if plan.max != nil {
		if err := s.writer.SetMaxCoveredAssets(ctx, id, *plan.max); err != nil {
			return fmt.Errorf("ajustar o teto de cobertura: %w", err)
		}
	}
	for _, assetID := range plan.added {
		// Shares = 0: só a cobertura, sem posição nem caixa novos (o float do ativo
		// já está distribuído); o Market Maker cota com o que tem.
		if err := s.provisioner.ProvisionCoverage(ctx, coverage.Provision{AssetID: assetID, MMAccountID: id}); err != nil {
			return fmt.Errorf("cobrir o ativo %s: %w", assetID, err)
		}
	}
	for _, assetID := range plan.removed {
		if _, err := s.canceller.CancelBatch(ctx, orderexecution.CancelFilter{AssetID: assetID, UserID: id}); err != nil {
			return fmt.Errorf("cancelar a cotação do ativo %s: %w", assetID, err)
		}
		if err := s.writer.RemoveCoverage(ctx, id, assetID); err != nil {
			return fmt.Errorf("tirar a cobertura do ativo %s: %w", assetID, err)
		}
	}
	if in.IsActive != nil {
		if err := s.writer.SetActive(ctx, id, *in.IsActive); err != nil {
			return fmt.Errorf("alterar o interruptor do bot: %w", err)
		}
	}
	return nil
}

// Fund aporta caixa e/ou posição num bot (ex: Market Maker esgotado). Nunca remove
// caixa nem posição existentes. Cada linha de posição é valorizada pela última cotação
// do ativo e o teto de float é validado na gravação (o float de todo ativo já costuma
// estar distribuído, então o aporte de posição só passa onde houver folga). O aporte
// inteiro é validado antes de gravar e entra por evento imutável, atomicamente.
func (s *Service) Fund(ctx context.Context, accountID string, in FundingInput) (Bot, error) {
	if in.Cash == 0 && len(in.Holdings) == 0 {
		return Bot{}, ErrNothingToFund
	}
	if in.Cash < 0 || in.Cash > MaxInitialCash {
		return Bot{}, ErrInvalidFundingCash
	}
	if _, found, err := s.reader.Find(ctx, accountID); err != nil {
		return Bot{}, err
	} else if !found {
		return Bot{}, ErrBotNotFound
	}

	lines := make([]FundingLine, 0, len(in.Holdings))
	seen := make(map[string]bool, len(in.Holdings))
	for _, h := range in.Holdings {
		if h.Quantity <= 0 || h.Quantity > MaxFundingQuantity {
			return Bot{}, ErrInvalidFundingQuantity
		}
		if seen[h.AssetID] {
			return Bot{}, ErrDuplicateFundingAsset
		}
		seen[h.AssetID] = true
		target, ok, err := s.reader.FundingTarget(ctx, h.AssetID)
		if err != nil {
			return Bot{}, err
		}
		if !ok {
			return Bot{}, ErrAssetNotTradable
		}
		if target.LastPrice <= 0 {
			return Bot{}, ErrNoQuoteToValue
		}
		if target.OutstandingShares <= 0 {
			return Bot{}, ErrNoOutstandingShares
		}
		lines = append(lines, FundingLine{AssetID: h.AssetID, Quantity: h.Quantity, Price: target.LastPrice, OutstandingShares: target.OutstandingShares})
	}

	if err := s.writer.FundBot(ctx, accountID, in.Cash, lines); err != nil {
		if errors.Is(err, position.ErrFloatExceeded) {
			return Bot{}, ErrFloatCeilingExceeded
		}
		return Bot{}, fmt.Errorf("aportar no bot %s: %w", accountID, err)
	}
	funded, found, err := s.reader.Find(ctx, accountID)
	if err != nil {
		return Bot{}, err
	}
	if !found {
		return Bot{}, ErrBotNotFound
	}
	return funded, nil
}
