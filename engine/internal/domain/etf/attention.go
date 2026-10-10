package etf

// DerivedAttention é a atenção que um ETF ganha quando a cesta está em evento
// (tarefa R.10): a média dos multiplicadores de atenção dos constituintes,
// ponderada pelos pesos-alvo. attention traz o multiplicador de cada constituinte
// no universo negociável do dia (0 ou ausente conta como 1, sem evento); pesos de
// constituinte fora do universo ficam de fora da média. Sem nenhum constituinte no
// universo devolve 1. O ETF nunca recebe efeito de preço direto: a atenção só faz
// ele ganhar turnos e volume, e o preço continua nascendo da negociação.
func DerivedAttention(targets []TargetWeight, attention map[string]float64) float64 {
	var weighted, total float64
	for _, t := range targets {
		a, ok := attention[t.AssetID]
		if !ok {
			continue
		}
		if a <= 0 {
			a = 1
		}
		weighted += t.WeightPct * a
		total += t.WeightPct
	}
	if total <= 0 {
		return 1
	}
	return weighted / total
}
