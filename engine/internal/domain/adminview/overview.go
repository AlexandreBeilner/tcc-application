// Package adminview reúne os modelos de leitura do painel administrativo (Fase N,
// tarefas N.5 e N.8): visão geral do mercado e monitor de ativos. É só leitura —
// nada aqui grava saldo, posição ou preço. As fórmulas derivadas (spread, ágio,
// indicador por classe) são funções puras; quem busca os dados é o repositório
// em internal/infra/db. overview.go é a visão geral; market.go, o monitor.
package adminview

// Overview é o recorte do mercado que a visão geral do painel mostra.
type Overview struct {
	SimulatedDay       int
	SelicRate          float64
	IPCAMonthly        *float64
	IPCAAccumulated12m *float64
	// PendingMacroEvents são eventos disparados que o próximo tick ainda aplica.
	PendingMacroEvents int
	// UncoveredAssets são ativos negociáveis sem Market Maker ativo cobrindo agora.
	UncoveredAssets int
	TradableAssets  int
	ActiveBots      int
	TotalBots       int
	// Trades e Volume são as execuções do dia simulado corrente (um negócio por
	// ordem de compra executada); RestingOrders são as ordens abertas no book.
	Trades        int
	Volume        float64
	RestingOrders int
}
