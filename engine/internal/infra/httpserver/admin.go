package httpserver

import (
	"context"
	"errors"
	"net/http"
	"time"

	"tcc-investimentos/engine/internal/domain/tick"
)

// ticker é o colaborador que POST /admin/tick precisa pra forçar um tick
// fora do agendamento normal — implementado por *tick.Service, injetado em
// New (tarefa 3.11).
//
// Sem checagem de role = admin aqui: o motor nunca é exposto ao host (só o
// backend gamificado o chama, na rede interna do Compose — mesmo trust
// boundary de POST /accounts, GET /assets etc.) e não tem acesso ao
// Postgres de usuários/roles (banco "gamification" é do backend). A
// restrição "só role = admin" (RNF07, critério de aceite da 3.11) fica a
// cargo de quem expuser esta rota publicamente — decisão confirmada com o
// usuário em 2026-08-22: o backend valida role = admin (authMiddleware já
// existe desde a tarefa 1.4) antes de repassar a chamada pra cá, quando o
// painel admin (tarefa 4.5) existir. Até lá, POST /admin/tick só é
// alcançável de dentro da rede do Compose.
type ticker interface {
	Run(ctx context.Context) (tick.Result, error)
}

type tickResponse struct {
	Day               int     `json:"day"`
	SelicRate         float64 `json:"selic_rate"`
	QuotesCount       int     `json:"quotes_count"`
	FundamentalsCount int     `json:"fundamentals_count"`
	IsCopomDay        bool    `json:"is_copom_day"`
	IsReportDay       bool    `json:"is_report_day"`
	// DividendsGeneratedCount/DividendsPaidCount (tarefa 4.9) são quantos
	// dividend_events foram gerados (dia de relatório de um ativo pagador)
	// e quantos venceram e foram pagos (payment_day == day) neste tick.
	DividendsGeneratedCount int `json:"dividends_generated_count"`
	DividendsPaidCount      int `json:"dividends_paid_count"`
	// BotFillsCount (Fase D.2) é quantos fills reais aconteceram nas rodadas
	// de negociação de bot deste tick, somando todas as rodadas sorteadas
	// (tick.IntradayRounds, Fase D.1) — só observabilidade; os fills em si
	// já estão em order_book/market_events (Event Sourcing), reconstituíveis
	// sem depender deste contador. 0 quando o catálogo ainda não tem nenhuma
	// Ação (Fases G/H vão estender o mesmo mecanismo pra FII/ETF).
	BotFillsCount int `json:"bot_fills_count"`
	// ExpiredOrdersCount (achado 005 parte A.3) é quantas ordens
	// pendentes/parciais de um dia simulado anterior foram canceladas antes
	// das rodadas deste tick rodarem — só observabilidade, mesma natureza
	// de BotFillsCount.
	ExpiredOrdersCount int `json:"expired_orders_count"`
	// UncoveredAssetsCount (tarefa P.3) é quantos ativos negociáveis ficaram
	// sem Market Maker ativo cobrindo neste tick, só observabilidade.
	UncoveredAssetsCount int `json:"uncovered_assets_count"`
	// IntradayRoundsCount (tarefa P.7) é quantas rodadas de negociação
	// (1 a 4, tick.IntradayRounds) o tick sorteou, só observabilidade: o
	// benchmark de cobertura precisa dela pra calcular o custo por
	// ativo-rodada do Market Maker.
	IntradayRoundsCount int `json:"intraday_rounds_count"`
}

// adminTickWriteTimeout é o prazo de escrita da resposta de POST /admin/tick
// (tarefa P.10). O WriteTimeout global do servidor (5 s) cobre as rotas de
// leitura, mas o tick roda síncrono dentro da requisição e cresce com o
// catálogo (proposta-cobertura-market-maker.md, seção 6.1): com ~2 ms por
// comando de banco, o disparo manual estouraria os 5 s com pouco mais de 20
// ativos cotados. O tick automático diário (scheduler) não passa por HTTP e
// não tem esse limite.
const adminTickWriteTimeout = 2 * time.Minute

// extendWriteDeadline levanta o prazo de escrita só da requisição atual.
// http.ErrNotSupported (ResponseWriter sem suporte, como o httptest.Recorder)
// é ignorado: nesse caso não existe prazo de servidor a estourar.
func extendWriteDeadline(w http.ResponseWriter, d time.Duration) {
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(d))
}

// handleAdminTick serve POST /admin/tick — força um tick fora do
// agendamento diário automático (tarefa 3.11), tanto pra testar sem esperar
// um dia real quanto como recurso de demonstração ao vivo pra banca.
func handleAdminTick(t ticker) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if t == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "temporizador indisponível")
			return
		}

		extendWriteDeadline(w, adminTickWriteTimeout)

		result, err := t.Run(r.Context())
		if errors.Is(err, tick.ErrTickInProgress) {
			writeCatalogError(w, http.StatusConflict, "já existe um tick em andamento")
			return
		}
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao executar tick")
			return
		}

		writeJSON(w, http.StatusOK, tickResponse{
			Day:                     result.State.Day,
			SelicRate:               result.State.SelicRate,
			QuotesCount:             len(result.Quotes),
			FundamentalsCount:       len(result.Fundamentals),
			IsCopomDay:              result.IsCopomDay,
			IsReportDay:             result.IsReportDay,
			DividendsGeneratedCount: len(result.NewDividends),
			DividendsPaidCount:      len(result.DuePayments),
			BotFillsCount:           result.IntradayFillsCount,
			ExpiredOrdersCount:      result.ExpiredOrdersCount,
			UncoveredAssetsCount:    result.UncoveredAssetsCount,
			IntradayRoundsCount:     len(result.IntradayRounds),
		})
	}
}
