// templates.go implementa o "pool de templates curados, com narrativa
// pedagógica pronta" da spec 3.3 (linha 111) — o catálogo inicial de 10
// eventos macro pré-definidos da spec 3.3.2 (tabela, linhas 132–143).
// Dado estático em código Go, não linhas pré-populadas em macro_events: a
// tabela representa só eventos de fato disparados/pendentes
// (macro_events.triggered_on_day, tarefa 4.1, não faz sentido pra um
// template nunca disparado). template_key (coluna já existente desde a
// migration 000001) serve só de rastro de proveniência no evento real,
// criado a partir de um Template pela tarefa 4.4 — nenhum template já vem
// com ativo/empresa específica embutido, o admin sempre escolhe o alvo
// concreto no disparo, mesmo pra evento de template.
package macroevent

// Category é a coluna "Categoria" da tabela de templates da spec 3.3.2 —
// texto livre por template (diferente de company_sector, não é uma lista
// fechada exigida por nenhum outro documento), só pra agrupar/exibir no
// painel admin (tela 10.1/10.2).
type Category string

const (
	CategoryRegulatorio        Category = "Regulatório"
	CategoryCommodities        Category = "Commodities"
	CategorySetorialTecnologia Category = "Setorial (Tecnologia)"
	CategorySetorialBancario   Category = "Setorial (Bancário)"
	CategoryCorporativo        Category = "Corporativo"
	CategoryCambial            Category = "Cambial"
	CategoryGeopolitico        Category = "Geopolítico"
	CategoryAgronegocio        Category = "Agronegócio"
)

// Template é um evento macro pré-definido do catálogo — narrativa
// pedagógica pronta pra uso direto no disparo manual (tela 10.2) ou por um
// sorteio periódico do Temporizador (spec 3.3, fora do escopo desta
// tarefa). Title/Narrative não têm uma "resposta fechada" da spec: a
// tabela 3.3.2 só dá uma descrição de uma linha por template (coluna
// "Template"), sem o texto pedagógico completo mencionado na spec —
// Narrative é conteúdo autoral desta tarefa (não uma fórmula numérica
// sujeita à calibração da 8.1, mas texto), escrito pra ser didático o
// bastante pra uso direto na tela 4.9 ("clique num evento → expande a
// narrativa completa").
type Template struct {
	Key                 string
	Title               string
	Narrative           string
	Category            Category
	Direction           Direction
	Band                Band
	AffectsPrice        bool
	AffectsFundamentals bool
}

// Templates é o catálogo estático dos 10 templates da spec 3.3.2, um por
// linha da tabela, na mesma ordem. Duas linhas da tabela têm banda dupla
// ("Leve/Moderado" — Queda do petróleo, Tensão comercial internacional):
// a spec não dá nenhum critério pra escolher entre as duas nem sustenta
// duas bandas simultâneas no schema (macro_events.magnitude_band é um
// enum único); decisão de implementação desta tarefa, não perguntada:
// fica sempre a primeira banda listada (a mais branda das duas) — o admin
// que disparar o template pode reavaliar a banda manualmente no payload
// de 4.4 se achar pouco.
var Templates = []Template{
	{
		Key:                 "legislacao-ambiental-mineracao",
		Title:               "Nova legislação ambiental restringe atividade de mineração",
		Narrative:           "Um novo marco regulatório ambiental impõe restrições operacionais às mineradoras, elevando custos de conformidade e reduzindo a capacidade produtiva do setor no curto prazo.",
		Category:            CategoryRegulatorio,
		Direction:           DirectionNegativo,
		Band:                BandModerado,
		AffectsPrice:        true,
		AffectsFundamentals: true,
	},
	{
		Key:                 "alta-minerio-ferro",
		Title:               "Minério de ferro dispara no mercado internacional",
		Narrative:           "O preço do minério de ferro sobe de forma acentuada no mercado internacional após sinais de aumento na demanda global, com mineradoras exportadoras negociando o mesmo volume por um valor mais alto em moeda forte.",
		Category:            CategoryCommodities,
		Direction:           DirectionPositivo,
		Band:                BandModerado,
		AffectsPrice:        true,
		AffectsFundamentals: true,
	},
	{
		Key:                 "queda-petroleo",
		Title:               "Queda do petróleo no mercado internacional",
		Narrative:           "O preço do petróleo recua no mercado internacional, pressionando a receita de empresas do setor de energia ligadas à exploração e produção.",
		Category:            CategoryCommodities,
		Direction:           DirectionNegativo,
		Band:                BandLeve,
		AffectsPrice:        true,
		AffectsFundamentals: true,
	},
	{
		Key:                 "regulacao-dados-tecnologia",
		Title:               "Nova regulamentação de dados eleva custos do setor de tecnologia",
		Narrative:           "Uma nova lei de proteção de dados exige investimentos em conformidade e segurança da informação, elevando os custos operacionais das empresas de tecnologia.",
		Category:            CategorySetorialTecnologia,
		Direction:           DirectionNegativo,
		Band:                BandLeve,
		AffectsFundamentals: true,
	},
	{
		Key:                 "inadimplencia-bancos",
		Title:               "Aumento da inadimplência pressiona resultado dos bancos",
		Narrative:           "A inadimplência de crédito sobe acima do esperado, obrigando os bancos a provisionar mais recursos pra cobrir perdas, com pressão direta sobre o resultado do próximo trimestre.",
		Category:            CategorySetorialBancario,
		Direction:           DirectionNegativo,
		Band:                BandModerado,
		AffectsFundamentals: true,
	},
	{
		Key:                 "escandalo-contabil-varejo",
		Title:               "Escândalo contábil identificado em empresa do varejo",
		Narrative:           "Uma investigação revela irregularidades contábeis numa grande empresa do varejo, abalando a confiança do mercado e exigindo reformulação de balanços anteriores.",
		Category:            CategoryCorporativo,
		Direction:           DirectionNegativo,
		Band:                BandSevero,
		AffectsPrice:        true,
		AffectsFundamentals: true,
	},
	{
		Key:          "expansao-parceria-corporativa",
		Title:        "Empresa anuncia expansão/parceria estratégica",
		Narrative:    "A empresa anuncia uma parceria estratégica ou plano de expansão, com expectativa de resultado concentrada nos próximos ciclos, antes de qualquer número novo aparecer no balanço.",
		Category:     CategoryCorporativo,
		Direction:    DirectionPositivo,
		Band:         BandModerado,
		AffectsPrice: true,
	},
	{
		Key:                 "desvalorizacao-real",
		Title:               "Forte desvalorização do real frente ao dólar",
		Narrative:           "O real se desvaloriza fortemente frente ao dólar: exportadoras ganham competitividade e receita em moeda forte, enquanto importadoras enfrentam custos mais altos: o mesmo evento move setores em direções opostas.",
		Category:            CategoryCambial,
		Direction:           DirectionMisto,
		Band:                BandModerado,
		AffectsPrice:        true,
		AffectsFundamentals: true,
	},
	{
		Key:          "tensao-comercial-internacional",
		Title:        "Tensão comercial internacional afeta cadeias de suprimento",
		Narrative:    "O agravamento de uma disputa comercial entre grandes economias interrompe cadeias de suprimento globais, gerando incerteza que se reflete de imediato na precificação de ativos expostos ao comércio internacional.",
		Category:     CategoryGeopolitico,
		Direction:    DirectionNegativo,
		Band:         BandLeve,
		AffectsPrice: true,
	},
	{
		Key:                 "quebra-safra-agronegocio",
		Title:               "Quebra de safra por evento climático reduz oferta agrícola",
		Narrative:           "Um evento climático severo reduz a safra agrícola: quem já tinha estoque formado se beneficia do preço mais alto, enquanto quem depende da nova colheita sofre com a oferta menor. O efeito é misto dentro do próprio setor.",
		Category:            CategoryAgronegocio,
		Direction:           DirectionMisto,
		Band:                BandModerado,
		AffectsPrice:        true,
		AffectsFundamentals: true,
	},
}

// FindTemplate busca um Template do catálogo pela chave (macro_events.
// template_key) — usado pela tarefa 4.4 no disparo a partir de template.
func FindTemplate(key string) (Template, bool) {
	for _, tpl := range Templates {
		if tpl.Key == key {
			return tpl, true
		}
	}
	return Template{}, false
}
