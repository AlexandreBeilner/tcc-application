package fixedincome

// OfferedRate soma um spread contratual (fixed_income_assets.interest_rate,
// reinterpretado pela tarefa L.4 como spread sobre um benchmark de mercado
// pra Prefixado/IPCA+ — mesmo raciocínio de reinterpretação já aplicado
// pela L.1 aos 6 tipos pós-fixados, "% do CDI" em vez de "% a.a.") a um
// benchmark de mercado corrente, os dois em decimal — a taxa efetivamente
// ofertada HOJE pra quem for comprar agora, em vez de uma taxa travada no
// seed pra sempre (achado da L.4: sem isso, um título comprado no dia 1 da
// simulação e outro comprado bem depois — com a Selic simulada já tendo se
// movido — travariam exatamente a mesma taxa contratada). O spread em si
// continua estático desde o catálogo (não reprecificado por esta função) —
// é o prêmio de risco/prazo que o produto oferece sobre a referência de
// mercado, não a referência em si.
func OfferedRate(spread, benchmark float64) float64 {
	return spread + benchmark
}

// FisherRealRate converte uma taxa NOMINAL simulada (decimal — Selic,
// mesma convenção de selic.Config) numa taxa REAL de mercado pela equação
// exata de Fisher: (1+nominal)/(1+inflação) - 1. Substitui, pra Tesouro
// IPCA+, a simplificação documentada desde a L.2/L.3 (reaproveitar a Selic
// nominal diretamente como proxy de taxa real, sem correção) — resolvida
// pela tarefa L.4 depois que o histórico real de IPCA (M.1) passou a estar
// disponível pra alimentar inflationRate. Não se aplica a Tesouro
// Prefixado (cuja taxa contratada já é nominal, sem componente de
// inflação a descontar).
func FisherRealRate(nominalRate, inflationRate float64) float64 {
	return (1+nominalRate)/(1+inflationRate) - 1
}
