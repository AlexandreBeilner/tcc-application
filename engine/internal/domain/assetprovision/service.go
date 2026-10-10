package assetprovision

import (
	"context"
	"fmt"
	"strings"

	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/botpool"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/coverage"
	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/domain/fii"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/selic"
	"tcc-investimentos/engine/internal/domain/tick"
)

// FIIOutstandingShares são as cotas de um FII novo, o mesmo valor ilustrativo do seed.
const FIIOutstandingShares = int64(1_000_000)

// Plan é o que o cadastro grava no catálogo, já validado e sem ids: quem grava (numa
// transação só) liga empresa, ativo e detalhes.
type Plan struct {
	Asset             catalog.Asset
	Company           *catalog.Company
	ShareClass        *string
	OutstandingShares *int64
	Fundamentals      *fundamentals.Financials
	FII               *fii.Details
	ETF               *etf.Details
}

// ResolvedAsset é um ativo já cadastrado, achado por ticker.
type ResolvedAsset struct {
	ID   string
	Name string
	Type catalog.AssetType
}

// AssetFloat é o float de um ativo negociável (ação ou FII) e o que humanos já detêm.
type AssetFloat struct {
	Outstanding int64
	HumanHeld   int64
}

// PoolState é o estado do pool de bots direcionais e do float do catálogo.
type PoolState struct {
	// DirectionalBots é quantos bots direcionais existem (índices 0..n-1 de botpool.UserID).
	DirectionalBots int
	Floats          []AssetFloat
}

// Store é a leitura e a escrita do catálogo. Create grava tudo numa transação e devolve o id do ativo.
type Store interface {
	TickerExists(ctx context.Context, ticker string) (bool, error)
	CNPJExists(ctx context.Context, cnpj string) (bool, error)
	ResolveTickers(ctx context.Context, tickers []string) (map[string]ResolvedAsset, error)
	Create(ctx context.Context, plan Plan) (assetID string, err error)
}

// NewBot é um bot direcional criado pelo crescimento do pool.
type NewBot struct {
	Index       int
	Cash        float64
	Personality bot.Personality
}

// Distribution é o que o cadastro grava do lado dos bots: contas e personalidades dos bots novos
// e as posições iniciais do ativo novo (nunca de um ativo antigo, então nenhuma posição existente muda).
type Distribution struct {
	AssetID           string
	OutstandingShares int64
	Price             float64
	NewBots           []NewBot
	// Positions é a quantidade do ativo novo de cada bot direcional, por índice.
	Positions []int64
}

// Liquidity lê o estado do pool e grava a distribuição. Idempotente (conta, personalidade e posição
// que já existem são puladas).
type Liquidity interface {
	PoolState(ctx context.Context) (PoolState, error)
	Distribute(ctx context.Context, d Distribution) error
}

// Service é o cadastro de ativo novo pelo painel (N.13): o mesmo caminho do seed (catálogo,
// bot.PoolSize, coverage.Ensurer), sem redistribuir o float de nenhum ativo antigo.
type Service struct {
	store     Store
	liquidity Liquidity
	lister    coverage.MarketMakerLister
	ensurer   *coverage.Ensurer
}

func NewService(store Store, liquidity Liquidity, lister coverage.MarketMakerLister, ensurer *coverage.Ensurer) *Service {
	return &Service{store: store, liquidity: liquidity, lister: lister, ensurer: ensurer}
}

// PoolPreview é o que o cadastro de uma ação ou FII faz do lado dos bots.
type PoolPreview struct {
	PoolBefore int
	PoolAfter  int
	NewBots    int
	// Distribuídos entre o pool inteiro (os bots novos e os antigos), só do ativo novo.
	MarketMakerShares int64
	BotShares         int64
	MarketMakerID     string
	// CreatesMarketMaker é true quando nenhum Market Maker tem folga e um novo é criado.
	CreatesMarketMaker bool
}

// Preview é o que será criado, sem gravar nada. Pool é nil num ETF: ele não tem float de bots
// nem cobertura de Market Maker (a liquidez vem da criação de cotas pelo Participante Autorizado).
type Preview struct {
	Kind              Kind
	Ticker            string
	Name              string
	OutstandingShares *int64
	Pool              *PoolPreview
}

// Result é o ativo criado e o que foi provisionado.
type Result struct {
	AssetID string
	Preview Preview
}

func (s *Service) checkFree(ctx context.Context, spec Spec) error {
	if exists, err := s.store.TickerExists(ctx, spec.Ticker); err != nil {
		return fmt.Errorf("checar ticker: %w", err)
	} else if exists {
		return &ConflictError{Message: fmt.Sprintf("o ticker %s já existe no catálogo", spec.Ticker)}
	}
	if spec.Kind == KindAcao {
		if exists, err := s.store.CNPJExists(ctx, spec.CNPJ); err != nil {
			return fmt.Errorf("checar CNPJ: %w", err)
		} else if exists {
			return &ConflictError{Message: fmt.Sprintf("já existe uma empresa com o CNPJ %s", spec.CNPJ)}
		}
	}
	return nil
}

// BuildPlan monta o que vai pro catálogo. Para ETF resolve os tickers da cesta contra o catálogo.
func (s *Service) BuildPlan(ctx context.Context, spec Spec) (Plan, error) {
	name := strings.TrimSpace(spec.Name)
	switch spec.Kind {
	case KindAcao:
		return planEquity(spec, name)
	case KindFIITijolo, KindFIIPapel:
		return planFII(spec, name)
	default:
		return s.planETF(ctx, spec, name)
	}
}

func planEquity(spec Spec, name string) (Plan, error) {
	company, err := catalog.NewCompany(strings.TrimSpace(spec.CompanyName), spec.CNPJ, spec.Sector, spec.BaseGrowthPct, spec.QualityMultiplier)
	if err != nil {
		return Plan{}, invalid("company", "%s", err.Error())
	}
	risk := RiskClassFor(spec.Sector)
	asset, err := catalog.NewAsset(spec.Ticker, name, catalog.AssetAcao, &risk, false)
	if err != nil {
		return Plan{}, invalid("name", "%s", err.Error())
	}
	// Sem fundamentos iniciais a empresa cairia no fallback genérico e o preço justo do
	// Fundamentalista sairia microscópico (achado 003): o mesmo bootstrap do seed faz o preço
	// justo nascer em tick.DefaultInitialPrice.
	financials, err := fundamentals.BootstrapFinancialsForTargetPrice(
		spec.Sector, spec.QualityMultiplier, tick.DefaultInitialPrice, spec.OutstandingShares, spec.BaseGrowthPct/100, selic.DefaultNeutralRate/100)
	if err != nil {
		return Plan{}, invalid("company", "fundamentos iniciais inválidos: %s", err.Error())
	}
	class, shares := "ON", spec.OutstandingShares
	return Plan{Asset: asset, Company: &company, ShareClass: &class, OutstandingShares: &shares, Fundamentals: &financials}, nil
}

func planFII(spec Spec, name string) (Plan, error) {
	asset, err := catalog.NewAsset(spec.Ticker, name, catalog.AssetFII, nil, false)
	if err != nil {
		return Plan{}, invalid("name", "%s", err.Error())
	}
	var details fii.Details
	if spec.Kind == KindFIITijolo {
		base, err := initialBaseValue(fii.TypeTijolo, spec.Segment)
		if err != nil {
			return Plan{}, err
		}
		segment, vacancy := strings.TrimSpace(spec.Segment), spec.VacancyRate
		details, err = fii.NewDetails(fii.TypeTijolo, &segment, &base, &vacancy, nil, nil)
		if err != nil {
			return Plan{}, invalid("segment", "%s", err.Error())
		}
	} else {
		base, err := initialBaseValue(fii.TypePapel, "")
		if err != nil {
			return Plan{}, err
		}
		indexador := spec.Indexador
		details, err = fii.NewDetails(fii.TypePapel, nil, nil, nil, &indexador, &base)
		if err != nil {
			return Plan{}, invalid("indexador", "%s", err.Error())
		}
	}
	shares := FIIOutstandingShares
	return Plan{Asset: asset, OutstandingShares: &shares, FII: &details}, nil
}

// initialBaseValue é o patrimônio (tijolo) ou a carteira (papel) que faz o preço justo do
// Fundamentalista nascer em tick.DefaultInitialPrice (U.5, achado 024), pra Selic neutra.
func initialBaseValue(fiiType fii.Type, segment string) (float64, error) {
	targetPriceToBook, err := fii.TargetPriceToBook(fiiType, strings.TrimSpace(segment), selic.DefaultNeutralRate, selic.DefaultNeutralRate)
	if err != nil {
		return 0, invalid("segment", "segmento sem P/VP-alvo conhecido: %s", err.Error())
	}
	base, ok := fii.BootstrapBaseValueForTargetPrice(tick.DefaultInitialPrice, FIIOutstandingShares, targetPriceToBook)
	if !ok {
		return 0, invalid("segment", "valor-base inicial inválido")
	}
	return base, nil
}

func (s *Service) planETF(ctx context.Context, spec Spec, name string) (Plan, error) {
	asset, err := catalog.NewAsset(spec.Ticker, name, catalog.AssetETF, nil, false)
	if err != nil {
		return Plan{}, invalid("name", "%s", err.Error())
	}
	tickers := make([]string, 0, len(spec.Holdings))
	for _, h := range spec.Holdings {
		tickers = append(tickers, h.Ticker)
	}
	resolved, err := s.store.ResolveTickers(ctx, tickers)
	if err != nil {
		return Plan{}, fmt.Errorf("resolver a cesta: %w", err)
	}
	holdings := make([]etf.Holding, 0, len(spec.Holdings))
	for _, h := range spec.Holdings {
		found, ok := resolved[h.Ticker]
		if !ok {
			return Plan{}, invalid("holdings", "o ticker %s da cesta não existe no catálogo", h.Ticker)
		}
		var class etf.HoldingClass
		switch found.Type {
		case catalog.AssetAcao:
			class = etf.HoldingClassEquity
		case catalog.AssetFII:
			class = etf.HoldingClassFII
		default:
			return Plan{}, invalid("holdings", "%s não pode compor um ETF: a cesta aceita só ações e FIIs", h.Ticker)
		}
		id := found.ID
		holdings = append(holdings, etf.Holding{ConstituentName: fmt.Sprintf("%s (%s)", found.Name, h.Ticker), AssetID: &id, Class: class, WeightPct: h.WeightPct})
	}
	details, err := etf.NewDetails(strings.TrimSpace(spec.BenchmarkIndex), strings.TrimSpace(spec.Methodology), holdings)
	if err != nil {
		return Plan{}, invalid("holdings", "%s", err.Error())
	}
	return Plan{Asset: asset, ETF: &details}, nil
}

// distribution calcula, sem gravar, o que o ativo novo faz no pool: tamanho novo do pool,
// bots novos com caixa e a alocação do float. assetID vazio no preview (a alocação por bot só
// existe depois, porque o sorteio é semeado pelo id do ativo; os totais não dependem dele).
func (s *Service) distribution(ctx context.Context, assetID string, outstanding int64) (Distribution, PoolPreview, error) {
	state, err := s.liquidity.PoolState(ctx)
	if err != nil {
		return Distribution{}, PoolPreview{}, fmt.Errorf("ler o pool de bots: %w", err)
	}
	// No preview o ativo ainda não existe no catálogo e entra na conta; depois do cadastro o
	// PoolState já o traz, então não se soma de novo.
	floats := append([]AssetFloat{}, state.Floats...)
	if assetID == "" {
		floats = append(floats, AssetFloat{Outstanding: outstanding})
	}
	poolAfter := bot.PoolSize(len(floats))
	if poolAfter < state.DirectionalBots {
		// O pool nunca encolhe: bot que já existe fica.
		poolAfter = state.DirectionalBots
	}

	allocation, err := bot.InitialAllocation(assetID, outstanding, botpool.MarketMakerSharePct, poolAfter, botpool.Seed)
	if err != nil {
		return Distribution{}, PoolPreview{}, invalid("outstanding_shares", "não foi possível distribuir o float: %s", err.Error())
	}

	// Caixa de um bot novo: o do seed. Quem recebe posição no ativo novo vale o que recebeu;
	// quem ficou sem, o valor médio de posição de um bot sobre o catálogo.
	var meanBotValue float64
	for _, f := range floats {
		available := f.Outstanding - f.HumanHeld
		if available > 0 {
			meanBotValue += float64(available) * (1 - botpool.MarketMakerSharePct) / float64(poolAfter) * tick.DefaultInitialPrice
		}
	}
	minimumCash := tick.DefaultInitialPrice * botpool.MinimumOrderShares
	var newBots []NewBot
	if poolAfter > state.DirectionalBots {
		personalities, err := botpool.Personalities(poolAfter)
		if err != nil {
			return Distribution{}, PoolPreview{}, err
		}
		for i := state.DirectionalBots; i < poolAfter; i++ {
			value := meanBotValue
			if allocation.Others[i] > 0 {
				value = float64(allocation.Others[i]) * tick.DefaultInitialPrice
			}
			newBots = append(newBots, NewBot{Index: i, Cash: bot.InitialCash(value, minimumCash, false), Personality: personalities[i]})
		}
	}

	var botShares int64
	for _, q := range allocation.Others {
		botShares += q
	}
	preview := PoolPreview{
		PoolBefore: state.DirectionalBots, PoolAfter: poolAfter, NewBots: len(newBots),
		MarketMakerShares: allocation.MarketMaker, BotShares: botShares,
	}
	mms, err := s.lister.ListMarketMakers(ctx)
	if err != nil {
		return Distribution{}, PoolPreview{}, fmt.Errorf("listar Market Makers: %w", err)
	}
	if id, ok := coverage.Assign("", mms); ok {
		preview.MarketMakerID = id
	} else {
		preview.MarketMakerID, preview.CreatesMarketMaker = coverage.NewMarketMakerID(len(mms)), true
	}
	return Distribution{AssetID: assetID, OutstandingShares: outstanding, Price: tick.DefaultInitialPrice, NewBots: newBots, Positions: allocation.Others}, preview, nil
}

// Preview valida e mostra o que o cadastro criaria, sem gravar nada.
func (s *Service) Preview(ctx context.Context, spec Spec) (Preview, error) {
	if err := spec.Validate(); err != nil {
		return Preview{}, err
	}
	if err := s.checkFree(ctx, spec); err != nil {
		return Preview{}, err
	}
	plan, err := s.BuildPlan(ctx, spec)
	if err != nil {
		return Preview{}, err
	}
	return s.previewFor(ctx, spec, plan)
}

func (s *Service) previewFor(ctx context.Context, spec Spec, plan Plan) (Preview, error) {
	p := Preview{Kind: spec.Kind, Ticker: spec.Ticker, Name: plan.Asset.Name, OutstandingShares: plan.OutstandingShares}
	if plan.OutstandingShares != nil {
		_, pool, err := s.distribution(ctx, "", *plan.OutstandingShares)
		if err != nil {
			return Preview{}, err
		}
		p.Pool = &pool
	}
	return p, nil
}

// Create cadastra o ativo. O catálogo vai numa transação só; depois vêm os bots novos, as
// posições do ativo novo e, por último, a cobertura (se o processo cair no meio, o ativo fica
// sem cobertura e aparece como tal no painel de bots, em vez de coberto e sem bots, a mesma
// ordem do seed). Nenhuma posição de ativo antigo é tocada.
func (s *Service) Create(ctx context.Context, spec Spec) (Result, error) {
	if err := spec.Validate(); err != nil {
		return Result{}, err
	}
	if err := s.checkFree(ctx, spec); err != nil {
		return Result{}, err
	}
	plan, err := s.BuildPlan(ctx, spec)
	if err != nil {
		return Result{}, err
	}
	preview, err := s.previewFor(ctx, spec, plan)
	if err != nil {
		return Result{}, err
	}
	assetID, err := s.store.Create(ctx, plan)
	if err != nil {
		return Result{}, fmt.Errorf("gravar o catálogo: %w", err)
	}
	if plan.OutstandingShares == nil {
		return Result{AssetID: assetID, Preview: preview}, nil
	}

	dist, _, err := s.distribution(ctx, assetID, *plan.OutstandingShares)
	if err != nil {
		return Result{AssetID: assetID}, fmt.Errorf("ativo %s criado, mas a distribuição entre os bots falhou: %w", spec.Ticker, err)
	}
	if err := s.liquidity.Distribute(ctx, dist); err != nil {
		return Result{AssetID: assetID}, fmt.Errorf("ativo %s criado, mas a distribuição entre os bots falhou: %w", spec.Ticker, err)
	}
	if _, err := s.ensurer.EnsureCoverage(ctx, coverage.Input{
		AssetID: assetID, OutstandingShares: *plan.OutstandingShares, MarketMakerShares: preview.Pool.MarketMakerShares, Price: tick.DefaultInitialPrice,
	}); err != nil {
		return Result{AssetID: assetID}, fmt.Errorf("ativo %s criado, mas a cobertura de Market Maker falhou: %w", spec.Ticker, err)
	}
	return Result{AssetID: assetID, Preview: preview}, nil
}
