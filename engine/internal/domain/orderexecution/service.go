package orderexecution

import (
	"context"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

// incomingOrderID é um ID de placeholder pra ordem recebida durante o
// matching em memória (Execute) — nunca persistido nem usado como chave de
// busca de contraparte (só ordens *pendentes* têm ID real, vindo do banco;
// a ordem recebida ainda não tem linha em order_book quando é processada).
const incomingOrderID = "incoming"

// Request é a ordem recebida via HTTP, antes de qualquer persistência.
type Request struct {
	UserID   string
	AssetID  string
	Side     orderbook.Side
	Type     orderbook.Type
	Price    float64 // ignorado por ordens a mercado
	Quantity int
	// SimulatedDay é preenchido por SubmitWithContext a partir de
	// Context.SimulatedDay (achado 005 parte A) — quem monta um Request não
	// precisa saber o dia simulado corrente, só Persist precisa dele pra
	// gravar order_book.simulated_day.
	SimulatedDay int
}

// Repository é o colaborador que Service precisa pra ler o contexto de
// execução (liquidez real pendente pro ativo, preço de referência
// corrente, saldo/posição do usuário da ordem recebida) e persistir o
// resultado atomicamente — implementado por *db.OrderExecutionRepository,
// injetado em NewService.
type Repository interface {
	// LoadContext lê tudo que Execute precisa pra processar uma ordem de
	// userID no ativo assetID: ordens reais pendentes desse ativo (em
	// ordem de chegada), o preço de referência corrente (asset_quotes,
	// tarefa 3.11) e o saldo/posição atuais do usuário.
	LoadContext(ctx context.Context, assetID, userID string) (Context, error)
	// Persist grava o resultado de Execute atomicamente: o evento
	// imutável em market_events de cada Fill (real e sintético) **antes**
	// de projetar em accounts/positions/order_book — Event Sourcing é a
	// fonte da verdade financeira (CLAUDE.md). Nunca chamado se Execute
	// devolveu erro (nada é persistido de uma ordem rejeitada).
	Persist(ctx context.Context, req Request, outcome Outcome) error
	// CancelOrder marca como cancelled a ordem orderID de userID (tarefa
	// O.1), validando dono e status antes de mudar o estado: devolve
	// ErrOrderNotFound se a ordem não existe ou pertence a outro usuário,
	// ErrOrderNotCancellable se já está filled/cancelled. filled_quantity
	// não é revertido — cancelar não passa por Event Sourcing, mesma
	// decisão de escopo de ExpireStaleOrders/CancelUserRestingOrders
	// (nenhuma ordem pendurada reserva saldo/posição na submissão).
	CancelOrder(ctx context.Context, orderID, userID string) error
}

// Service orquestra a execução de uma ordem ponta a ponta (tarefa 3.12):
// carrega o contexto real do book + saldo/posição, roda o matching puro
// (Execute) e persiste o resultado, na mesma ordem que tick.Service.Run já
// estabelece (ler → calcular → persistir).
type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Submit processa uma ordem recebida. Se Execute rejeitar (saldo/posição
// insuficiente, quantidade/preço inválidos), nada é persistido — o erro
// devolvido identifica o motivo pro handler HTTP mapear pro status certo.
func (s *Service) Submit(ctx context.Context, req Request) (Outcome, error) {
	execCtx, err := s.repo.LoadContext(ctx, req.AssetID, req.UserID)
	if err != nil {
		return Outcome{}, err
	}
	return s.SubmitWithContext(ctx, req, execCtx)
}

// SubmitWithContext é Submit pulando o LoadContext, pro chamador que já leu
// um Context válido pra esse mesmo assetID/userID e sabe que nada mudou
// desde então (Context é um snapshot imutável, passado por valor — Execute
// nunca o muta). Único chamador hoje: tick.runIntradayRounds (rounds.go),
// que já chama OrderContextLoader.LoadContext pra montar a decisão do bot
// antes de decidir a ordem — reler o mesmo contexto de novo aqui seria um
// round trip ao banco puramente redundante pro caso comum (achado de
// review: 1 decisão por bot/rodada, só ArchetypeMarketMaker decide mais de
// uma). Só serve pra ESSA primeira ordem: uma segunda ordem do mesmo bot na
// mesma rodada pode ter saldo/posição diferentes por causa do fill da
// primeira, e precisa voltar a usar Submit (recarrega fresco).
func (s *Service) SubmitWithContext(ctx context.Context, req Request, execCtx Context) (Outcome, error) {
	// SimulatedDay sempre vem do Context recém-carregado, nunca do que o
	// chamador já tinha em req (achado 005 parte A) — LoadContext é a única
	// fonte confiável do dia simulado corrente (market_calendar), tanto pra
	// ordem humana (POST /orders, via Submit) quanto pra ordem de bot
	// (rounds.go, que já leu esse mesmo Context antes de decidir).
	req.SimulatedDay = execCtx.SimulatedDay

	incoming := orderbook.Order{
		ID:       incomingOrderID,
		UserID:   req.UserID,
		Side:     req.Side,
		Type:     req.Type,
		Price:    req.Price,
		Quantity: req.Quantity,
	}

	outcome, err := Execute(incoming, execCtx)
	if err != nil {
		return Outcome{}, err
	}

	if err := s.repo.Persist(ctx, req, outcome); err != nil {
		return Outcome{}, err
	}
	return outcome, nil
}

// Cancel marca como cancelled uma ordem pendente/parcial de userID (tarefa
// O.1) — sem regra de domínio própria (nenhum recálculo de book/saldo/
// posição envolvido, só uma transição de status), repassa direto pro
// repositório, que decide dono/status.
func (s *Service) Cancel(ctx context.Context, orderID, userID string) error {
	return s.repo.CancelOrder(ctx, orderID, userID)
}
