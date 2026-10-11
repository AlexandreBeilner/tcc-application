// Package corporategovernance é o lado do motor da Assembleia de Acionistas (MO.6.2): tira o
// snapshot de posições na data de corte, grava a decisão da assembleia como evento imutável
// em market_events ANTES de qualquer efeito (Event Sourcing, CLAUDE.md) e aplica o efeito aos
// poucos nos fundamentos da empresa.
//
// O que uma assembleia pode mudar é só um dos dois botões de fundamento que cada empresa já
// tem (crescimento base e multiplicador de qualidade, companies.base_growth_pct e
// quality_multiplier). Nunca o preço: o preço continua vindo da negociação dos bots reagindo
// aos fundamentos (proposta do motor de mercado realista).
//
// Toda conta aqui é em centésimos inteiros (1 = 0,01 p.p. de crescimento ou 0,01 de
// multiplicador), a mesma precisão das colunas, então a soma dos passos da rampa fecha
// exatamente no total decidido, sem acumular erro de ponto flutuante, e o resultado é
// determinístico (RNF08).
package corporategovernance
