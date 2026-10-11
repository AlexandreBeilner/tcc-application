package tick

import (
	"context"
	"errors"
	"log"
	"sort"
	"sync"
	"time"

	"tcc-investimentos/engine/internal/domain/corporategovernance"
	"tcc-investimentos/engine/internal/domain/dividend"
	"tcc-investimentos/engine/internal/domain/ipca"
	"tcc-investimentos/engine/internal/domain/selic"
	"tcc-investimentos/engine/internal/domain/simcalendar"
)

// ErrTickInProgress é devolvido quando outro processo já está rodando um tick
// (trava consultiva do Postgres, tarefa S.3) — um POST /admin/tick nesse
// momento vira 409 em vez de duplicar o dia simulado.
var ErrTickInProgress = errors.New("já existe um tick em andamento")

// ErrInvalidAdvanceDays é devolvido por RunMany quando days está fora de
// 1..MaxAdvanceDays.
var ErrInvalidAdvanceDays = errors.New("dias a avançar fora do intervalo permitido")

// Guard é o colaborador que protege o tick entre processos/instâncias (tarefa
// S.3): uma trava consultiva no Postgres e o instante do último tick gravado
// (market_calendar.updated_at), que a agenda usa pra saber quantos dias
// simulados ficaram pra trás. Implementado por *db.TickRepository; opcional
// (WithGuard) — sem ele só vale o mutex do próprio processo.
type Guard interface {
	// TryLockTick tenta pegar a trava do tick sem bloquear; ok = false se outro
	// processo a detém. release libera a trava.
	TryLockTick(ctx context.Context) (release func(), ok bool, err error)
	// LastTickAt devolve quando o último tick foi gravado; found = false se o
	// Temporizador nunca rodou.
	LastTickAt(ctx context.Context) (at time.Time, found bool, err error)
}

// Service executa um tick completo (ler estado → calcular próximo passo →
// executar as rodadas de negociação de bot (Fase D.2, rounds.go) → persistir),
// tanto pro job diário automático quanto pro disparo manual via POST
// /admin/tick (tarefa 3.11) — os dois caminhos chamam Run, a única diferença
// é quem aciona. mu serializa as duas chamadas dentro do mesmo processo
// (achado do review do PR da Fase D, backlog-motor-mercado-realista): sem
// ela, o job diário (scheduler.RunDaily) e um POST /admin/tick concorrente
// podiam ler o mesmo State.Day, cada um rodar suas próprias rodadas
// intradiárias e os dois chamarem SaveTick, quebrando a invariante de uma
// linha de asset_quotes por ativo por dia. A Fase D.2 tornou essa janela
// bem mais larga (Run passou de poucas queries pra O(rodadas × bots
// elegíveis) round trips síncronos), por isso a proteção passou a valer a
// pena mesmo sem lock distribuído — motor roda como processo único (sem
// múltiplas réplicas), então sync.Mutex já basta.
type Service struct {
	repo           Repository
	bots           BotRoster
	priceHistory   PriceHistoryReader
	tradedVolume   TradedVolumeReader
	orderContext   OrderContextLoader
	orderSubmitter OrderSubmitter
	orderLifecycle OrderLifecycleManager
	selicCfg       selic.Config
	ipcaCfg        ipca.Config
	seed           int64
	// etf (R.3/R.4) fica zerado até WithETF.
	etf        ETFDeps
	guard      Guard
	recorder   RunRecorder
	governance GovernanceStep
	// declarations é o mesmo objeto de governance quando ele cuida da declaração retida.
	declarations DeclarationStep
	mu           sync.Mutex
}

// GovernanceStep aplica, no tick que leva o mercado ao dia `newDay`, o passo da rampa dos
// efeitos de assembleia em andamento (MO.6.2), mexendo só nos fundamentos da empresa
// (corporategovernance.Service.ApplyDue). Roda ANTES de o tick ler as empresas, então o
// passo do dia já entra no cálculo desse tick.
type GovernanceStep interface {
	ApplyDue(ctx context.Context, newDay int) (int, error)
}

// DeclarationStep é a parte da governança que cuida da declaração de dividendo retida
// (MO.6.11): a política de retenção do dia e as declarações que saem hoje. Opcional dentro do
// GovernanceStep: quem não a implementa nunca retém nada.
type DeclarationStep interface {
	HoldPolicy(ctx context.Context) (corporategovernance.HoldPolicy, error)
	ReleaseDue(ctx context.Context, newDay int) ([]corporategovernance.ReleaseOrder, error)
}

// WithGovernance liga a aplicação gradual dos efeitos de assembleia (MO.6.2) e, se `g` também
// implementa DeclarationStep, a retenção e a liberação da declaração de dividendo (MO.6.11).
// Opcional: sem ela o tick não conhece assembleias.
func (s *Service) WithGovernance(g GovernanceStep) *Service {
	s.governance = g
	s.declarations, _ = g.(DeclarationStep)
	return s
}

// WithGuard liga a trava entre processos e a leitura do último tick (S.3).
func (s *Service) WithGuard(g Guard) *Service {
	s.guard = g
	return s
}

// WithRunRecorder liga o histórico de ticks (N.6): cada tick executado, com
// sucesso ou falha, vira uma linha em tick_runs.
func (s *Service) WithRunRecorder(r RunRecorder) *Service {
	s.recorder = r
	return s
}

// NewService monta o orquestrador do Temporizador. selicCfg.Initial é
// ignorado (Advance usa o estado persistido); os demais campos (Neutral,
// ReversionSpeed, Volatility) calibram a reversão à média da Selic
// simulada, mesma calibração de selic.DefaultConfig. ipcaCfg (tarefa M.1)
// calibra o IPCA mensal sintético (ipca.DefaultConfig) — diferente de
// selicCfg, não tem um campo "Initial" (IPCA não tem estado/memória entre
// meses, ver doc do pacote ipca). seed é a seed base da
// simulação (RNF08) — fixa entre reinícios, configurada uma vez na
// composição (cmd/api/main.go). bots/priceHistory/tradedVolume/orderContext/
// orderSubmitter/orderLifecycle (Fase D.2/achado 005, rounds.go) alimentam
// runIntradayRounds/Run — concretamente *db.BotRepository, *db.TickRepository
// (repassado duas vezes: PriceHistoryReader e TradedVolumeReader),
// *db.OrderExecutionRepository (repassado duas vezes: OrderContextLoader e
// OrderLifecycleManager) e *orderexecution.Service (submissão — o mesmo já
// usado por POST /orders, sem caminho paralelo pra ordem de bot).
func NewService(repo Repository, bots BotRoster, priceHistory PriceHistoryReader, tradedVolume TradedVolumeReader, orderContext OrderContextLoader, orderSubmitter OrderSubmitter, orderLifecycle OrderLifecycleManager, selicCfg selic.Config, ipcaCfg ipca.Config, seed int64) *Service {
	return &Service{
		repo:           repo,
		bots:           bots,
		priceHistory:   priceHistory,
		tradedVolume:   tradedVolume,
		orderContext:   orderContext,
		orderSubmitter: orderSubmitter,
		orderLifecycle: orderLifecycle,
		selicCfg:       selicCfg,
		ipcaCfg:        ipcaCfg,
		seed:           seed,
	}
}

// Run lê o último estado persistido, calcula o próximo tick (Advance) e
// grava o resultado. Se o Temporizador nunca rodou (motor recém-subido,
// sem linha em market_calendar), começa do dia 0 com a Selic neutra de
// selicCfg como taxa inicial.
func (s *Service) Run(ctx context.Context) (Result, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	release, err := s.lockTick(ctx)
	if err != nil {
		return Result{}, err
	}
	defer release()

	return s.runOne(ctx, TriggerManual, 0)
}

// RunMany roda `days` ticks manuais em sequência sob uma única trava (N.6,
// "avançar N dias"): o agendador não se intercala no meio. Devolve os resultados
// dos ticks concluídos; na primeira falha para e devolve o que já rodou junto do
// erro. days fora de 1..MaxAdvanceDays é erro de chamada, nada roda.
func (s *Service) RunMany(ctx context.Context, days int) ([]Result, error) {
	if days < 1 || days > MaxAdvanceDays {
		return nil, ErrInvalidAdvanceDays
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	release, err := s.lockTick(ctx)
	if err != nil {
		return nil, err
	}
	defer release()

	results := make([]Result, 0, days)
	for i := 0; i < days; i++ {
		result, err := s.runOne(ctx, TriggerManual, 0)
		if err != nil {
			return results, err
		}
		results = append(results, result)
	}
	return results, nil
}

// runOne executa um tick e grava o histórico. Falha ao gravar o histórico é logada
// e nunca troca o desfecho de um tick que já foi persistido.
func (s *Service) runOne(ctx context.Context, trigger Trigger, discarded int) (Result, error) {
	started := time.Now()
	result, err := s.execute(ctx)
	if s.recorder != nil {
		record := RunRecord{Trigger: trigger, StartedAt: started, Duration: time.Since(started), CatchUpDiscarded: discarded}
		if err != nil {
			record.Status = RunFailed
			record.ErrorMessage = err.Error()
		} else {
			record.Status = RunSuccess
			record.Day = result.State.Day
			record.Counters = countersOf(result)
		}
		if recErr := s.recorder.RecordRun(ctx, record); recErr != nil {
			log.Printf("tick: falha ao gravar o histórico do tick: %v", recErr)
		}
	}
	return result, err
}

// RunScheduled é o caminho do agendador (tarefa S.3): sob a mesma trava do Run,
// pergunta a plan quantos ticks devem rodar agora (e quantos atrasados foram
// descartados, pro histórico) dado o instante do último
// tick gravado (found = false se nunca rodou) e roda essa quantidade em
// sequência. Decidir dentro da trava é o que impede duas instâncias (ou um
// deploy repetido) de duplicar o mesmo dia. Devolve quantos ticks rodaram;
// trava ocupada por outro processo não é erro (0, nil), o outro já está
// cuidando desse dia.
func (s *Service) RunScheduled(ctx context.Context, plan func(lastTickAt time.Time, found bool) (run, discarded int)) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	release, err := s.lockTick(ctx)
	if errors.Is(err, ErrTickInProgress) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	defer release()

	count, discarded := 1, 0
	if s.guard != nil {
		last, found, err := s.guard.LastTickAt(ctx)
		if err != nil {
			return 0, err
		}
		count, discarded = plan(last, found)
	}
	for i := 0; i < count; i++ {
		// Mais de um tick devido: os primeiros são recuperação de slots perdidos
		// e só o último é o slot de agora. O descarte do MaxCatchUp fica na
		// primeira linha da recuperação.
		trigger := TriggerScheduled
		if i < count-1 {
			trigger = TriggerCatchUp
		}
		recorded := 0
		if i == 0 {
			recorded = discarded
		}
		if _, err := s.runOne(ctx, trigger, recorded); err != nil {
			return i, err
		}
	}
	return count, nil
}

// lockTick pega a trava entre processos (no-op sem Guard).
func (s *Service) lockTick(ctx context.Context) (release func(), err error) {
	if s.guard == nil {
		return func() {}, nil
	}
	release, ok, err := s.guard.TryLockTick(ctx)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrTickInProgress
	}
	return release, nil
}

// execute é o tick em si, sempre sob s.mu e a trava de lockTick.
func (s *Service) execute(ctx context.Context) (Result, error) {
	current, found, err := s.repo.LoadState(ctx)
	if err != nil {
		return Result{}, err
	}
	if !found {
		current = State{Day: 0, SelicRate: s.selicCfg.Neutral}
	}

	// Efeito de assembleia em rampa (MO.6.2): falha aqui nunca derruba o tick do mercado, o
	// passo que não rodou é recuperado no tick seguinte (a conta usa o dia, não a contagem).
	if s.governance != nil {
		if applied, err := s.governance.ApplyDue(ctx, current.Day+1); err != nil {
			log.Printf("governança: erro ao aplicar efeitos de assembleia no dia %d: %v", current.Day+1, err)
		} else if applied > 0 {
			log.Printf("governança: %d efeito(s) de assembleia aplicado(s) no dia %d", applied, current.Day+1)
		}
	}

	assets, err := s.repo.ListPricingAssets(ctx)
	if err != nil {
		return Result{}, err
	}

	companies, err := s.repo.ListCompaniesForFundamentals(ctx)
	if err != nil {
		return Result{}, err
	}
	s.applyDeclarationPolicy(ctx, companies, current.Day+1)

	macroEvents, err := s.repo.ListPendingMacroEvents(ctx)
	if err != nil {
		return Result{}, err
	}

	dividendPayers, err := s.repo.ListDividendPayerAssets(ctx)
	if err != nil {
		return Result{}, err
	}

	pendingDividends, err := s.repo.ListPendingDividendPayments(ctx, current.Day+1)
	if err != nil {
		return Result{}, err
	}

	result := Advance(current, assets, companies, macroEvents, dividendPayers, pendingDividends, s.selicCfg, s.ipcaCfg, s.seed)

	if err := s.fillDividendRecipients(ctx, &result); err != nil {
		return Result{}, err
	}

	dayIndex := result.State.Day - 1 // 0-based, mesma convenção de Advance

	// Achado 005 parte A.3: expira ordens obsoletas (pending/partially_filled
	// de um dia simulado anterior) antes de rodar as rodadas do dia novo —
	// nenhuma ordem de um dia anterior chega a competir pela liquidez de
	// hoje. currentSimulatedDay = dayIndex porque market_calendar.current_day
	// ainda não foi atualizado por SaveTick neste ponto: seu valor de agora
	// é exatamente current.Day, que é igual a dayIndex por construção
	// (dayIndex = result.State.Day - 1 = (current.Day+1) - 1 = current.Day)
	// — o mesmo dia que toda ordem nova (humana ou de bot) submetida durante
	// este tick carimba via orderexecution.Context.SimulatedDay.
	expiredOrdersCount, err := s.orderLifecycle.ExpireStaleOrders(ctx, dayIndex)
	if err != nil {
		return Result{}, err
	}

	// Fim de semana simulado (tarefa S.3): o calendário avança, mas o mercado
	// está fechado, então os bots não negociam nem cotam (sem rodadas, nenhuma
	// cotação nova; o preço segue o último fechamento).
	rounds := result.IntradayRounds
	if !simcalendar.IsBusinessDay(result.State.Day) {
		rounds = nil
		result.IntradayRounds = nil
	}

	closingPrices, volumeByAssetID, fillsExecuted, uncoveredAssets, err := s.runIntradayRounds(ctx, dayIndex, rounds, assets, RoundContext{Company: result.CompanyContext, FII: result.FIIContext}, result.State.SelicRate, s.selicCfg.Neutral)
	if err != nil {
		return Result{}, err
	}
	// Ordenado por AssetID (não a ordem de iteração do map, não-determinística
	// em Go) — RNF08 exige que a mesma seed produza o mesmo Result inteiro,
	// Quotes incluso, não só os mesmos preços.
	closingAssetIDs := make([]string, 0, len(closingPrices))
	for assetID := range closingPrices {
		closingAssetIDs = append(closingAssetIDs, assetID)
	}
	sort.Strings(closingAssetIDs)
	for _, assetID := range closingAssetIDs {
		result.Quotes = append(result.Quotes, Quote{AssetID: assetID, Price: closingPrices[assetID], Quantity: volumeByAssetID[assetID]})
	}
	etfPrices := make(map[string]float64)
	for _, q := range result.Quotes {
		etfPrices[q.AssetID] = q.Price
	}
	previousPrices := make(map[string]float64, len(assets))
	for _, a := range assets {
		if a.LastPrice != nil {
			previousPrices[a.AssetID] = *a.LastPrice
		}
	}
	etfNAVs, etfDividends, err := s.closingETFNAVs(ctx, closingPrices, etfPrices, previousPrices, result.IsReportDay, result.State.Day, result.State.Day+dividend.DefaultPaymentLagDays)
	if err != nil {
		return Result{}, err
	}
	result.ETFNAVs = etfNAVs
	result.NewDividends = append(result.NewDividends, etfDividends...)
	result.IntradayFillsCount = fillsExecuted
	result.ExpiredOrdersCount = expiredOrdersCount
	result.UncoveredAssetsCount = uncoveredAssets
	if uncoveredAssets > 0 {
		log.Printf("tick dia %d: %d ativo(s) negociável(is) sem Market Maker ativo cobrindo", result.State.Day, uncoveredAssets)
	}

	if err := s.repo.SaveTick(ctx, result); err != nil {
		return Result{}, err
	}
	return result, nil
}

// fillDividendRecipients tira os snapshots de elegíveis do dia (RC.6.11), antes das
// rodadas de negociação: a posição que vale é a do fechamento da data-com, ou seja,
// a de antes de qualquer ordem da data-ex. Cobre (a) os proventos gerados hoje já
// com data-ex hoje (legado e FII) e (b) os declarados antes cuja data-ex chegou.
// Só lê a posição dos ativos envolvidos, nunca do catálogo inteiro.
func (s *Service) fillDividendRecipients(ctx context.Context, result *Result) error {
	awaiting, err := s.repo.ListDividendsAwaitingSnapshot(ctx, result.State.Day)
	if err != nil {
		return err
	}

	need := make(map[string]struct{})
	for _, rec := range result.NewDividends {
		if !rec.SnapshotPending && len(rec.Recipients) == 0 {
			need[rec.AssetID] = struct{}{}
		}
	}
	for _, a := range awaiting {
		need[a.AssetID] = struct{}{}
	}
	if len(need) == 0 {
		return nil
	}

	assetIDs := make([]string, 0, len(need))
	for id := range need {
		assetIDs = append(assetIDs, id)
	}
	sort.Strings(assetIDs)
	holders, err := s.repo.ListDividendHolders(ctx, assetIDs)
	if err != nil {
		return err
	}

	for i := range result.NewDividends {
		rec := &result.NewDividends[i]
		if !rec.SnapshotPending && len(rec.Recipients) == 0 {
			rec.Recipients = holders[rec.AssetID]
		}
	}
	for _, a := range awaiting {
		result.Snapshots = append(result.Snapshots, DividendSnapshot{EventID: a.EventID, Recipients: holders[a.AssetID]})
	}
	return nil
}

// applyDeclarationPolicy marca, em cada empresa, se o dividendo do balanço de hoje fica retido
// e qual declaração retida sai hoje (MO.6.11). Falha aqui nunca derruba o tick: sem política,
// nada é retido nem liberado e o dividendo sai como sempre (a declaração que já estava retida
// espera o tick seguinte, ou o prazo de segurança).
func (s *Service) applyDeclarationPolicy(ctx context.Context, companies []CompanyForFundamentals, newDay int) {
	if s.declarations == nil {
		return
	}
	policy, err := s.declarations.HoldPolicy(ctx)
	if err != nil {
		log.Printf("governança: política de retenção indisponível no dia %d: %v", newDay, err)
		return
	}
	orders, err := s.declarations.ReleaseDue(ctx, newDay)
	if err != nil {
		log.Printf("governança: erro ao ler declarações a liberar no dia %d: %v", newDay, err)
		orders = nil
	}
	releaseByCompany := make(map[string]corporategovernance.ReleaseOrder, len(orders))
	for _, o := range orders {
		releaseByCompany[o.CompanyID] = o
	}
	for i := range companies {
		c := &companies[i]
		c.HoldDeclaration = corporategovernance.ShouldHold(policy, corporategovernance.HoldCompany{
			HasUserShareholders: c.UserShareholders, LastPayoutStartDay: c.LastPayoutStartDay,
			HasHeld: c.HasHeldDeclaration, Today: newDay,
		})
		if o, ok := releaseByCompany[c.CompanyID]; ok {
			c.Release = &DeclarationRelease{ID: o.ID, CycleIndex: o.CycleIndex, PoolNetIncome: o.PoolNetIncome, Reason: string(o.Reason)}
		}
	}
}
