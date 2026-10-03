// Package botadmin é a gestão de bots pelo painel admin (tarefa N.1): listar,
// criar e alterar (ativar/desativar, teto de cobertura, reatribuir cobertura).
// Nenhuma regra de personalidade é reescrita aqui: a criação reaproveita
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
)

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
}

// Update valida o estado final por inteiro antes de gravar qualquer coisa, então
// só falha de infraestrutura deixa a alteração pela metade. Ordem de aplicação:
// teto, ativos novos, ativos removidos (cancelando as ordens em repouso do Market
// Maker neles: a cotação de Market Maker ativo não expira por dia, P.5), e por
// último o interruptor.
func (s *Service) Update(ctx context.Context, accountID string, in UpdateInput) (Bot, error) {
	if in.IsActive == nil && in.MaxCoveredAssets == nil && in.CoveredAssetIDs == nil {
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
	if err := s.apply(ctx, current, in, plan); err != nil {
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

func (s *Service) apply(ctx context.Context, current Bot, in UpdateInput, plan coveragePlan) error {
	id := current.AccountID
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
