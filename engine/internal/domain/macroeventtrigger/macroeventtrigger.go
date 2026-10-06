// Package macroeventtrigger orquestra macroevent.NewEvent/NewTarget (4.1),
// o catálogo de templates (macroevent.Templates, 4.3) e o sorteio de
// efeitos por banda (macroevent.magnitude.go, 4.2) contra o dia simulado
// corrente do Temporizador (3.11) e a persistência real — o disparo de um
// evento macro ponta a ponta (tarefa 4.4). Mesma relação que
// orderexecution tem com orderbook, ou fixedincomeexecution com
// fixedincomeposition: o pacote "puro" (macroevent) não sabe de
// persistência nem de dia simulado, este pacote junta os dois.
package macroeventtrigger

import (
	"context"
	"errors"
	"math/rand"
	"sync"
	"time"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/macroevent"
)

var (
	// ErrUnknownTemplate é devolvido quando TemplateKey não bate com
	// nenhum macroevent.Templates conhecido.
	ErrUnknownTemplate = errors.New("template de evento macro desconhecido")
	// ErrMissingFields é devolvido quando TemplateKey não foi informado e
	// algum dos campos obrigatórios do evento avulso também não foi —
	// segunda camada de validação (o backend já valida isso com Zod antes
	// de chamar esta rota; esta checagem não é redundância acidental, é
	// defesa em profundidade documentada no critério de aceite da 4.4).
	ErrMissingFields = errors.New("evento macro avulso exige title, narrative, direction, magnitude_band, affects_price e affects_fundamentals")
	// ErrUnknownSector é devolvido quando um Target de escopo setor não
	// bate com nenhum dos 6 setores fixos da spec 3.3.2.
	ErrUnknownSector = errors.New("setor de alvo de evento macro desconhecido")
	// ErrUnknownTargetAsset é devolvido quando um Target de escopo ativo
	// aponta para um asset_id que não existe no catálogo.
	ErrUnknownTargetAsset = errors.New("ativo de alvo de evento macro não existe")
	// ErrAssetNotTargetable é devolvido quando um Target de escopo ativo
	// aponta para um ativo sem empresa emissora (FII, ETF, renda fixa).
	// Evento macro só tem efeito por empresa (efeito de preço via
	// preço justo da empresa, efeito de fundamentos via ciclo de relatório),
	// então aceitar esse alvo criaria um evento "aplicado" que nunca moveu
	// nada (achado 028 de .claude/pontos-em-aberto-decisao-produto.md). O
	// efeito macro que importa para FII/ETF já chega pela Selic e pelo IPCA.
	ErrAssetNotTargetable = errors.New("evento macro só pode ter como alvo ação (ativo com empresa emissora): FII, ETF e renda fixa não são alvos válidos")
)

// TargetInput é um alvo recebido no payload de disparo, antes de validado
// — mesma forma de macroevent.Target, exatamente um dos três preenchido.
// Direction (E.1) é opcional e só faz sentido num evento "misto" — nil
// significa "este alvo herda a direção do evento" (caso comum, sem UX
// nova), preenchido significa "este alvo tem sinal próprio" (positivo ou
// negativo, nunca misto — macroevent.NewTarget valida isso).
type TargetInput struct {
	Sector    *string
	RiskClass *string
	AssetID   *string
	Direction *macroevent.Direction
}

// Request é o disparo recebido via POST /macro-events (tarefa 4.4). Com
// TemplateKey preenchido, só Targets/CreatedBy vêm do payload — os demais
// campos são resolvidos do catálogo (macroevent.FindTemplate) e qualquer
// valor enviado neles é ignorado. Sem TemplateKey, todos os campos textuais
// e de efeito são obrigatórios (evento avulso, tela 10.2, RF13).
type Request struct {
	TemplateKey         *string
	Title               *string
	Narrative           *string
	Direction           *macroevent.Direction
	MagnitudeBand       *macroevent.Band
	AffectsPrice        *bool
	AffectsFundamentals *bool
	Targets             []TargetInput
	CreatedBy           *string
	// ApplyOnDay (tarefa N.11) agenda o primeiro dia de efeito pra um dia simulado
	// futuro (macroevent.ValidateApplyDay). nil dispara já: o efeito começa no
	// próximo tick (currentDay+1). O evento fica pendente até lá.
	ApplyOnDay *int
	// RevealLeadDays (tarefa N.25) é com quantos dias de antecedência do primeiro dia de
	// efeito o jogador passa a ver o evento (macroevent.ValidateRevealLead). nil usa
	// macroevent.DefaultRevealLeadDays (a véspera), o comportamento de sempre.
	RevealLeadDays *int
}

// Repository é o colaborador que Service precisa pra ler o dia simulado
// corrente (Temporizador, 3.11) e persistir o evento disparado —
// implementado por *db.MacroEventRepository, injetado em NewService.
type Repository interface {
	// LoadCurrentDay lê market_calendar.current_day — erro (tipicamente
	// db.ErrMarketCalendarNotInitialized) se o Temporizador nunca rodou.
	LoadCurrentDay(ctx context.Context) (int, error)
	// Persist grava o evento + seus alvos numa única transação e devolve
	// o id gerado pelo banco.
	Persist(ctx context.Context, event macroevent.Event) (string, error)
	// AssetsWithCompany recebe os asset_id dos alvos de escopo ativo e
	// devolve, para cada id que existe no catálogo, se o ativo tem empresa
	// emissora. Id ausente do mapa significa ativo inexistente.
	AssetsWithCompany(ctx context.Context, assetIDs []string) (map[string]bool, error)
}

// Service dispara um evento macro ponta a ponta (tarefa 4.4). rngMu guarda
// rng — *rand.Rand não é seguro pra uso concorrente (diferente das funções
// top-level de math/rand, que usam uma fonte com lock própria), e POST
// /macro-events roda num handler HTTP comum: duas requisições concorrentes
// (dois admins, ou um duplo clique) chamam Trigger em goroutines diferentes,
// cada uma sorteando o efeito do próprio evento a partir do mesmo rng
// (achado de review: Trigger/sampleTargetEffects chamam s.rng várias vezes
// por disparo, sem essa trava seria uma data race real, detectável com
// `go test -race`).
type Service struct {
	repo  Repository
	rng   *rand.Rand
	rngMu sync.Mutex
}

// NewService monta o Service. Diferente do padrão SIMULATION_SEED usado
// pelo resto do motor (Selic/preço/fundamentos do Mercado Ao Vivo, cuja
// reprodutibilidade dia a dia é decisão de engenharia, não RNF08 — que é
// sobre a trilha sandbox de lições, não o Mercado Ao Vivo, spec seção 8),
// o sorteio do efeito de um evento macro disparado pelo admin não tem um
// índice determinístico natural (não é "o N-ésimo dia" nem "o N-ésimo
// ciclo") — é uma ação humana pontual, não um passo de uma série simulada.
// Por isso o rng usado aqui deriva do relógio real (time.Now().UnixNano())
// em vez de SIMULATION_SEED, mesmo raciocínio de "rolar um dado" a cada
// disparo em vez de reproduzir uma série.
func NewService(repo Repository) *Service {
	return &Service{repo: repo, rng: rand.New(rand.NewSource(time.Now().UnixNano()))}
}

// Trigger resolve o evento (template ou avulso), valida a definição
// (macroevent.NewEvent/NewTarget), lê o dia simulado corrente, deriva a
// duração e sorteia os efeitos habilitados (macroevent magnitude.go/
// lag.go, tarefa 4.2), calcula o dia de relatório de fundamentos quando
// aplicável e persiste tudo numa transação. Devolve o id gerado e o Event
// completo (já com os campos de disparo preenchidos).
func (s *Service) Trigger(ctx context.Context, req Request) (string, macroevent.Event, error) {
	title, narrative := req.Title, req.Narrative
	direction, band := req.Direction, req.MagnitudeBand
	affectsPrice, affectsFundamentals := req.AffectsPrice, req.AffectsFundamentals

	if req.TemplateKey != nil {
		tpl, found := macroevent.FindTemplate(*req.TemplateKey)
		if !found {
			return "", macroevent.Event{}, ErrUnknownTemplate
		}
		title, narrative = &tpl.Title, &tpl.Narrative
		direction, band = &tpl.Direction, &tpl.Band
		affectsPrice, affectsFundamentals = &tpl.AffectsPrice, &tpl.AffectsFundamentals
	}

	if title == nil || narrative == nil || direction == nil || band == nil || affectsPrice == nil || affectsFundamentals == nil {
		return "", macroevent.Event{}, ErrMissingFields
	}

	targets := make([]macroevent.Target, 0, len(req.Targets))
	for _, t := range req.Targets {
		var sector *catalog.Sector
		if t.Sector != nil {
			s := catalog.Sector(*t.Sector)
			if !catalog.IsValidSector(s) {
				return "", macroevent.Event{}, ErrUnknownSector
			}
			sector = &s
		}

		target, err := macroevent.NewTarget(sector, t.RiskClass, t.AssetID, targetMetric(*affectsPrice, *affectsFundamentals), t.Direction)
		if err != nil {
			return "", macroevent.Event{}, err
		}
		targets = append(targets, target)
	}

	if err := s.validateAssetTargets(ctx, targets); err != nil {
		return "", macroevent.Event{}, err
	}

	event, err := macroevent.NewEvent(req.TemplateKey, *title, *narrative, *direction, *band, *affectsPrice, *affectsFundamentals, targets, req.CreatedBy)
	if err != nil {
		return "", macroevent.Event{}, err
	}

	currentDay, err := s.repo.LoadCurrentDay(ctx)
	if err != nil {
		return "", macroevent.Event{}, err
	}
	// market_calendar.current_day é o último dia já simulado (tick.Advance
	// grava newDay ali ao final de cada tick) — o próximo Advance a rodar
	// computa newDay = currentDay+1, e nenhum tick futuro volta a avaliar
	// currentDay. TriggeredOnDay precisa ser currentDay+1 (o primeiro dia
	// que um tick futuro de fato avalia), não currentDay: gravar o dia já
	// fechado faz macroevent.IsPriceEffectActive contar um dia de duração
	// que nenhum tick nunca observa — achado de review do PR de eventos
	// macro por alvo (E), zerava por completo o efeito de preço de todo
	// evento BandLeve (duração 1) e cortava 1 dia do efeito de Moderado/
	// Severo.
	event.TriggeredOnDay = currentDay + 1
	if req.ApplyOnDay != nil {
		if err := macroevent.ValidateApplyDay(*req.ApplyOnDay, currentDay); err != nil {
			return "", macroevent.Event{}, err
		}
		event.TriggeredOnDay = *req.ApplyOnDay
	}
	if req.RevealLeadDays != nil {
		if err := macroevent.ValidateRevealLead(*req.RevealLeadDays, event.TriggeredOnDay, currentDay); err != nil {
			return "", macroevent.Event{}, err
		}
		event.RevealLeadDays = *req.RevealLeadDays
	}

	durationDays, err := macroevent.DurationDays(event.MagnitudeBand)
	if err != nil {
		return "", macroevent.Event{}, err
	}
	event.DurationDays = durationDays

	// O dia de referência do relatório de fundamentos é o último dia antes do
	// efeito começar: o dia corrente num disparo imediato, a véspera do dia
	// agendado num evento agendado (a janela de corte de 2 dias conta a partir
	// do início real do efeito, não de quando o admin cadastrou).
	if err := s.sampleEffects(&event, event.TriggeredOnDay-1); err != nil {
		return "", macroevent.Event{}, err
	}

	id, err := s.repo.Persist(ctx, event)
	if err != nil {
		return "", macroevent.Event{}, err
	}
	return id, event, nil
}

// validateAssetTargets recusa alvo de escopo ativo que não existe ou que não
// é uma ação com empresa (achado 028) — uma consulta só, independente do
// número de alvos.
func (s *Service) validateAssetTargets(ctx context.Context, targets []macroevent.Target) error {
	var ids []string
	for _, t := range targets {
		if t.AssetID != nil {
			ids = append(ids, *t.AssetID)
		}
	}
	if len(ids) == 0 {
		return nil
	}

	withCompany, err := s.repo.AssetsWithCompany(ctx, ids)
	if err != nil {
		return err
	}
	for _, id := range ids {
		hasCompany, exists := withCompany[id]
		if !exists {
			return ErrUnknownTargetAsset
		}
		if !hasCompany {
			return ErrAssetNotTargetable
		}
	}
	return nil
}

// sampleEffects amostra o efeito de preço/fundamentos do evento inteiro
// (magnitude.go) e, em seguida, o efeito próprio de cada Target que
// declarou direção própria (sampleTargetEffects, E.1) — muta event in-place.
// Todas as chamadas de rng deste disparo ficam sob rngMu (ver doc de
// Service), única seção de Trigger que toca s.rng.
func (s *Service) sampleEffects(event *macroevent.Event, currentDay int) error {
	s.rngMu.Lock()
	defer s.rngMu.Unlock()

	if event.AffectsPrice {
		pct, err := macroevent.SamplePriceEffectPct(event.MagnitudeBand, event.Direction, s.rng)
		if err != nil {
			return err
		}
		event.PriceEffectPct = &pct
	}

	if event.AffectsFundamentals {
		pct, err := macroevent.SampleFundamentalsEffectPct(event.MagnitudeBand, event.Direction, s.rng)
		if err != nil {
			return err
		}
		event.FundamentalsEffectPct = &pct

		reportDay := macroevent.AssignReportDay(currentDay, fundamentals.DefaultReportFrequencyDays, nextGlobalReportDay(currentDay))
		event.FundamentalsReportDay = &reportDay
	}

	return sampleTargetEffects(event.Targets, *event, s.rng)
}

// sampleTargetEffects amostra PriceEffectPct/FundamentalsEffectPct
// próprios (E.1) só dos alvos que declararam uma direção própria
// (Target.Direction != nil) — os demais continuam sem nenhum dado por
// alvo, lendo o efeito do evento (Event.PriceEffectPct/
// FundamentalsEffectPct) normalmente, mesmo comportamento de antes da
// E.1 (critério de aceite: evento "não-misto" não precisa declarar nada
// por alvo). Muta targets em memória — mesma fatia que event.Targets já
// aponta, então o efeito amostrado chega em event.Targets sem precisar
// reatribuir o slice.
func sampleTargetEffects(targets []macroevent.Target, event macroevent.Event, rng *rand.Rand) error {
	for i := range targets {
		t := &targets[i]
		if t.Direction == nil {
			continue
		}

		if event.AffectsPrice {
			pct, err := macroevent.SamplePriceEffectPct(event.MagnitudeBand, *t.Direction, rng)
			if err != nil {
				return err
			}
			t.PriceEffectPct = &pct
		}

		if event.AffectsFundamentals {
			pct, err := macroevent.SampleFundamentalsEffectPct(event.MagnitudeBand, *t.Direction, rng)
			if err != nil {
				return err
			}
			t.FundamentalsEffectPct = &pct
		}
	}
	return nil
}

// targetMetric deriva o Metric obrigatório de um Target (coluna NOT NULL
// affected_metric, herdada do DER original) a partir dos efeitos
// habilitados no evento — não é escolhido pelo admin (o payload de target
// só tem sector/risk_class/asset_id, spec da tarefa 4.4). Decisão de
// implementação: nossa aplicação nunca lê esse campo de volta pra decidir
// comportamento (o efeito de fundamentos vai inteiro pra net_revenue via
// fundamentals.ActualGrowthWithMacroEffect, tarefa 4.2, não é dividido por
// indicador contábil) — price quando o evento afeta preço (ainda que
// também afete fundamentos, é o efeito mais imediato/visível), senão
// net_income como rótulo genérico de fundamentos.
func targetMetric(affectsPrice, affectsFundamentals bool) macroevent.Metric {
	if affectsPrice {
		return macroevent.MetricPrice
	}
	if affectsFundamentals {
		return macroevent.MetricNetIncome
	}
	return macroevent.MetricPrice
}

// nextGlobalReportDay devolve o próximo dia simulado (1-based, podendo ser
// o próprio currentDay se ele já for um dia de relatório) em que o ciclo
// de relatório global fecha — spec 3.3.1: todas as empresas compartilham o
// mesmo ciclo, disparado de uma vez pelo Temporizador, por isso não é
// necessário resolver a agenda de relatório por empresa/setor individual
// pra calcular macro_events.fundamentals_report_day (um único valor por
// evento, não por alvo).
func nextGlobalReportDay(currentDay int) int {
	freq := fundamentals.DefaultReportFrequencyDays
	if currentDay%freq == 0 {
		return currentDay
	}
	return (currentDay/freq + 1) * freq
}
