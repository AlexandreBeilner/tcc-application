package domain

import (
	"context"
	"time"
)

// MarketEventType espelha o enum Postgres market_event_type (migration
// 000001) — mantido aqui como constantes tipadas pra evitar strings soltas
// espalhadas pelo domínio e detectar divergência em tempo de compilação.
type MarketEventType string

const (
	EventInitialDeposit        MarketEventType = "initial_deposit"
	EventBuyOrderExecuted      MarketEventType = "buy_order_executed"
	EventSellOrderExecuted     MarketEventType = "sell_order_executed"
	EventFixedIncomePurchase   MarketEventType = "fixed_income_purchase"
	EventFixedIncomeRedemption MarketEventType = "fixed_income_redemption"
	EventDividendPayment       MarketEventType = "dividend_payment"
	// EventBotInitialAllocation é o float finito de um ativo nascendo
	// distribuído entre bots no seed (tarefa B.2, migration 000013) — não é
	// uma ordem executada (sem contraparte real), por isso não reaproveita
	// EventBuyOrderExecuted.
	EventBotInitialAllocation MarketEventType = "bot_initial_allocation"
	// EventBotInitialCash é o caixa inicial de um bot de liquidez nascendo
	// no seed (tarefa B.2, migration 000014, bot.InitialCash) — não
	// reaproveita EventInitialDeposit porque esse tipo é o depósito humano
	// de RNF06 (sempre R$ 10.000,00, CLAUDE.md); caixa de bot tem valor
	// arbitrário (correlacionado ao papel — Market Maker vs. direcional),
	// então uma leitura futura do extrato que assumisse initial_deposit ==
	// "R$ 10.000,00 de RNF06" veria valores de bot misturados, mesmo
	// raciocínio que já motivou EventBotInitialAllocation pro lado da
	// posição.
	EventBotInitialCash MarketEventType = "bot_initial_cash"
	// EventETFCreation/EventETFRedemption são a criação e o resgate de cotas de
	// ETF (tarefa R.1, migration 000026; usados a partir da R.2): uma linha por
	// constituinte que troca de mãos e uma pelas cotas, gravadas antes de
	// projetar posições e outstanding_shares.
	EventETFCreation   MarketEventType = "etf_creation"
	EventETFRedemption MarketEventType = "etf_redemption"
	// EventETFDividendPayout é o débito do caixa do fundo quando ele paga o provento
	// aos cotistas (tarefa R.8, migration 000030): quantidade = cotas que recebem,
	// unit_value = valor por cota.
	EventETFDividendPayout MarketEventType = "etf_dividend_payout"
	// EventETFExpensePayout é o pagamento da taxa de administração acumulada pelo
	// caixa do fundo (tarefa R.9, migration 000031): quantidade 1, unit_value = valor pago.
	EventETFExpensePayout MarketEventType = "etf_expense_payout"
	// EventETFShareTransfer (R.4, migration 000028) é a cota de ETF passando do
	// Participante Autorizado ao Market Maker, em espécie e com quantidade com
	// sinal (delta da posição da conta).
	EventETFShareTransfer MarketEventType = "etf_share_transfer"
	// EventSalaryPayment (Fase T, tarefa T.2, migration 000036) é o crédito de
	// salário mensal na conta do usuário — caixa livre, nunca capital de
	// risco: ao contrário de EventInitialDeposit/EventDividendPayment, esse
	// crédito nunca incrementa TotalInvested/TotalDisinvested/
	// TotalDividendsReceived (account.Account), decisão da Fase T de manter
	// a rentabilidade (T.1) calculada só sobre capital que já foi de risco em
	// algum momento.
	EventSalaryPayment MarketEventType = "salary_payment"
	// EventAdminCredit (Fase N, tarefa N.17, migration 000047) é o crédito de caixa
	// feito pelo administrador na conta de um usuário (reparar prejuízo causado por
	// bug, preparar conta de demonstração). Caixa livre como o salário: nunca
	// incrementa TotalInvested/TotalDisinvested/TotalDividendsReceived, então não
	// infla a rentabilidade (T.1). Tipo próprio pra o extrato rotular e pra nunca ser
	// confundido com EventSalaryPayment nem com EventInitialDeposit (RNF06).
	EventAdminCredit MarketEventType = "admin_credit"
	// EventAssemblyDecision (MO.6.2, migration 000051) é a decisão de uma Assembleia de
	// Acionistas aprovada, gravada antes de qualquer efeito nos fundamentos da empresa. Não
	// move caixa nem posição: pertence à conta técnica de governança (GovernanceAccountID),
	// ReferenceID é o id da assembleia e Quantity a mudança total decidida, em centésimos,
	// com sinal (0 quando a decisão foi registrada sem efeito, por cooldown ou faixa).
	EventAssemblyDecision MarketEventType = "assembly_decision"
)

// GovernanceAccountID é a conta técnica (is_bot, inativa, sem linha em `users`) dona dos
// eventos de decisão de assembleia (migration 000051).
const GovernanceAccountID = "00000000-0000-4000-8000-00000000a550"

// MarketEvent é um registro imutável de uma operação financeira — a fonte
// da verdade de Event Sourcing (RNF01, spec 3.4, CLAUDE.md). AssetID,
// Quantity e UnitValue são opcionais porque nem todo evento tem os três
// (ex: initial_deposit não tem asset nem quantidade).
type MarketEvent struct {
	UserID    string
	AssetID   *string
	EventType MarketEventType
	Quantity  *int
	UnitValue *float64
	// ReferenceMonth ('YYYY-MM', achado 025) é o mês-calendário real a que o
	// evento se refere — só preenchido em EventSalaryPayment, onde ele pode
	// divergir do dia em que o evento de fato foi gravado (catch-up de meses
	// atrasados, tarefa T.5, todos gravados no mesmo simulated_day). Todo
	// outro tipo de evento deixa nil.
	ReferenceMonth *string
	// ReferenceID (MO.6.2) é o id da entidade externa a que o evento se refere — hoje só a
	// assembleia, em EventAssemblyDecision. Todo outro tipo deixa nil.
	ReferenceID *string
}

// MarketEventRecord é um MarketEvent já persistido — ID e Timestamp só
// existem depois da escrita (mesmo raciocínio de catalog.AssetRecord),
// usado pelo extrato de leitura (GET /accounts/:user_id/events, tarefa 4.7,
// RF05). EventStore.Append nunca precisa desses dois campos, por isso não
// fazem parte de MarketEvent.
type MarketEventRecord struct {
	ID string
	MarketEvent
	Timestamp time.Time
}

// EventStore grava eventos imutáveis em market_events. Toda escrita de
// saldo/posição no motor deve gravar o evento correspondente antes de
// projetar o estado — nunca escrever direto em accounts/positions sem
// passar por aqui (CLAUDE.md).
type EventStore interface {
	Append(ctx context.Context, event MarketEvent) error
}
