package db

import (
	"database/sql"
	"errors"

	"tcc-investimentos/engine/internal/domain/sandbox"
)

// ErrSandboxScriptNotFound é devolvido quando um ativo `is_sandbox = true`
// não tem roteiro correspondente cadastrado em internal/domain/sandbox pro
// seu ticker — erro de cadastro (ver doc de PriceScriptForTicker/
// RateScriptForTicker). Nunca mascarado com o fallback do Mercado Ao Vivo:
// um ativo sandbox sem roteiro não tem cotação real nenhuma (o Temporizador
// nunca alimenta asset_quotes/market_calendar pra sandbox), então cair no
// fallback só serviria tick.DefaultInitialPrice fixo, sem nenhum sinal de
// que o cadastro está errado.
var ErrSandboxScriptNotFound = errors.New("ativo sandbox sem roteiro cadastrado pro ticker")

// sandboxDayIndex resolve o índice de dia do roteiro sandbox a partir da
// posição atual do usuário nesse ativo: dias SIMULADOS desde o dia da
// primeira operação (created_day, tarefa S.1), nunca relógio de parede.
// Reinicia em dia 0 sempre que não existe posição alguma
// (positionCreatedDay inválido) OU a posição existe
// mas está zerada (quantity == 0). Renda variável nunca apaga a linha de
// `positions` numa venda total (tick_repository.go filtra `quantity > 0`
// em outro lugar exatamente por isso — a linha zerada permanece), então
// sem essa checagem de quantity uma recompra depois de vender tudo leria o
// created_at da primeira operação, muito antiga, e nunca reiniciaria o
// roteiro — diferente de renda fixa, que apaga fixed_income_positions
// inteira no resgate (PersistRedeem) e por isso nunca teve esse problema.
func sandboxDayIndex(positionCreatedDay sql.NullInt64, quantity float64, currentDay int) int {
	if !positionCreatedDay.Valid || quantity == 0 {
		return 0
	}
	return sandbox.DaysSince(int(positionCreatedDay.Int64), currentDay)
}
