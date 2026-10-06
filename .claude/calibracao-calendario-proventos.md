# Calibração do calendário de proventos e balanços: pesquisa (tarefa RC.6.5b)

Pesquisa pedida pela tarefa `RC.6.5b` de `.claude/backlog-revisao-trilhas-e-ux.md` (Fase 6, Trilha A, pacote P8),
antes de codificar o escalonamento por ativo (`RC.6.6` a `RC.6.12`). Contexto e desenho técnico em
`.claude/revisao-trilhas-anexos/analise-calendario.md` (seções 1.2 e 2). Molde: `.claude/calibracao-fundamentos-setor.md`.

Esta tarefa é só pesquisa: a aplicação em código é a `RC.6.6` (pacote puro `paymentschedule`) e a `RC.6.7`
(migrations e seed). Nada aqui muda o motor.

## Método e honestidade sobre as fontes

Cada parâmetro abaixo traz a **fonte** e um selo:

- **[FONTE]**: regra legal ou número publicado por fonte primária (lei, CVM, B3, RI de emissora).
- **[OBSERVADO]**: padrão de mercado descrito por imprensa especializada ou por amostra de calendário, sem estatística
  agregada oficial.
- **[ILUSTRATIVO]**: parâmetro de simulação escolhido pelo autor do motor, coerente com as fontes, **sem estatística
  pública** que o fixe. Não há levantamento público agregado da proporção de empresas listadas por frequência de
  pagamento, nem por setor; as buscas só devolveram casos isolados e estudos acadêmicos sem acesso ao texto. Por isso
  os pesos das seções 3 e 6 são ilustrativos e assim devem ser documentados (como a análise já previa, seção 2.3).

Como na calibração de fundamentos, os valores são **faixas e pesos**, não um número único aplicado a todos: dentro do
mesmo setor há empresa que paga todo trimestre e empresa que paga uma vez por ano.

## 1. Divulgação de balanços (ITR e DFP)

| Fato | Valor | Selo | Fonte |
|---|---|---|---|
| Prazo do ITR (trimestral) | até 45 dias após o fim do trimestre | [FONTE] | Resolução CVM 80/2022, art. 22, V (Empresas.NET) |
| Prazo da DFP (anual) | até 3 meses após o fim do exercício | [FONTE] | Resolução CVM 80/2022, art. 22, IV |
| Cada empresa escolhe a data dentro do prazo e pode alterá-la, comunicando o mercado | sim | [OBSERVADO] | Calendário de resultados da B3 (Bora Investir) |

**Distribuição real das datas (1T25, trimestre encerrado em 31/03/2025, prazo de 45 dias = 15/05):** o calendário da
B3 (Bora Investir) lista **13 empresas em abril** e **281 em maio**, com o pico em **8 de maio (64 empresas)**, ou seja,
38 dias depois do fim do trimestre; as grandes (Itaú em 6/5, Bradesco em 7/5, Petrobras e Banco do Brasil em 12/5)
ficam na semana do prazo. [OBSERVADO] Em números: cerca de 4% das divulgações até o dia 30 e cerca de 96% entre os dias
31 e 45, com a maior parte nas duas últimas semanas.

### Parâmetro para o motor (`companies.report_offset_days`)

O balanço de hoje sai no fim do trimestre do motor (dia 0 do offset). O offset é o **atraso, em dias corridos, depois do
fim do trimestre**, empurrado para o dia útil seguinte se cair em fim de semana.

| Faixa de offset (dias após o fim do trimestre) | Peso | Selo |
|---|---|---|
| 0 a 29 | 5% | [OBSERVADO] (13 de 294 em abril) |
| 30 a 36 | 30% | [ILUSTRATIVO] (entre o início de maio e o pico) |
| 37 a 44 | 65% | [ILUSTRATIVO] (pico em 38 e semana do prazo) |

- **Janela:** `[0, 45)` dias, nunca depois do prazo legal de 45 dias. Para o 4T (DFP, prazo de 3 meses), manter a
  **mesma janela de 45 dias** por simplicidade: a DFP real vai até ~90 dias, mas a maioria das grandes divulga entre
  fevereiro e março (dias 30 a 60); fica como simplificação declarada, revisável.
- **Dia útil:** offset que cair em sábado ou domingo passa para a segunda-feira (a B3 não divulga balanço em fim de
  semana). [OBSERVADO]
- **Atenção ao acoplamento (análise 2.5):** `MaxWindowDays = 92` deixa de depender da frequência de relatório; o
  balanço escalonado de uma empresa nunca cai depois do início do trimestre seguinte (45 < 91).

## 2. Ciclo do provento de ação: declaração, data-com, data-ex e pagamento

| Fato | Valor | Selo | Fonte |
|---|---|---|---|
| Data-com: último dia de negociação com direito ao provento | sim | [FONTE] | B3, glossário Bora Investir ("Data EX") e Formulário de Proventos |
| Data-ex: primeiro dia útil seguinte à data-com, quando o ativo passa a ser negociado sem direito | sim | [FONTE] | B3 (mesma fonte) |
| Prazo legal para pagar o dividendo: até 60 dias da declaração e, em qualquer caso, dentro do exercício, salvo deliberação em contrário da assembleia | 60 dias | [FONTE] | Lei 6.404/76, art. 205, § 3º |
| Dividendo mínimo obrigatório: 25% do lucro líquido ajustado, se o estatuto for omisso | 25% | [FONTE] | Lei 6.404/76, art. 202 |
| Exemplo de política: pagamento no 7º dia útil depois da data-base | 7 dias úteis | [OBSERVADO] | Política de dividendos do Banestes (RI) |
| Exemplo de política mensal: pagamento no 1º dia útil do mês seguinte ao de referência | 1º dia útil | [OBSERVADO] | Banestes (RI); Bradesco e Itaú pagam mensalmente |

### Parâmetros para o motor

- **Declaração** no dia do balanço (a empresa declara junto do resultado). **Data-com** = dia do balanço mais 0 a 3 dias
  úteis ([ILUSTRATIVO], sorteio determinístico por ticker); **data-ex** = próximo dia útil depois da data-com
  ([FONTE]); **pagamento** = data-ex mais 5 a 30 dias úteis ([ILUSTRATIVO], dentro do teto legal de 60 dias corridos,
  e sempre em dia útil). O legado do motor é ex no dia da geração e pagamento em 5 dias corridos
  (`DefaultPaymentLagDays`), que podia cair em fim de semana: o novo ciclo corrige isso.
- **Snapshot dos elegíveis:** posição ao fechamento da data-com, tirado na data-ex (decisão D10, 2026-10-03). Quem
  compra na data-ex não recebe. [FONTE: regra da B3 acima]

## 3. Periodicidade do provento de ação por setor (`companies.dividend_policy`)

Política: `quarterly` (todo balanço paga), `semiannual` (os balanços do 2º e do 4º trimestre pagam, com o pool dos
dois ciclos) ou `annual` (só o balanço do 4º trimestre paga).

### Casos reais que ancoram as faixas

| Empresa (setor no motor) | Frequência real | Selo | Fonte |
|---|---|---|---|
| Vale (Mineração) | semestral: 1º semestre pago em setembro, 2º em março | [FONTE] | Política de remuneração aos acionistas da Vale (POL-0038) |
| Petrobras (Energia/óleo) | trimestral, com remuneração mínima | [OBSERVADO] | Fato relevante e imprensa (Trademap, Mais Retorno) |
| Ambev (Varejo/consumo) | passou a trimestral; pagamentos em janeiro, abril, julho e outubro | [OBSERVADO] | Acionista, Euqueroinvestir |
| WEG (Tecnologia/indústria) | semestral, mais JCP trimestral | [OBSERVADO] | Money Times, Suno |
| Itaú e Bradesco (Bancário) | mensal (JCP e dividendos), mais complementos | [OBSERVADO] | Bora Investir (B3), Mais Retorno |
| JHSF | mensal (R$ 250 milhões em 12 parcelas em 2024) | [OBSERVADO] | Bora Investir (B3) |
| Elétricas (Energia) | maduras e previsíveis, majoritariamente trimestral ou semestral | [OBSERVADO] | Suno, Acionista |
| Varejo | o setor que paga menos e mais devagar (alto endividamento, margem baixa) | [OBSERVADO] | Monitor Mercantil, Acionista |

Frequência **mensal existe** (bancos, JHSF), mas fica **fora do motor** nesta entrega: o ciclo do motor é o balanço
trimestral, e o pagamento mensal a partir dele é uma extensão (registrar como candidata se o autor quiser).

### Pesos propostos por setor (todos [ILUSTRATIVO], sorteio por hash estável do ticker)

| Setor | `quarterly` | `semiannual` | `annual` | Justificativa |
|---|---|---|---|---|
| Mineração | 20% | 60% | 20% | Vale semestral; commodity com resultado volátil |
| Agronegócio | 20% | 40% | 40% | Ciclo de safra, resultado sazonal |
| Bancário/Financeiro | 70% | 20% | 10% | Bancos distribuem com muita frequência (os mensais caem em `quarterly`, o mais próximo) |
| Varejo | 15% | 25% | 60% | Setor que menos distribui e mais demora |
| Energia | 40% | 45% | 15% | Elétricas e óleo, trimestral ou semestral |
| Tecnologia | 10% | 30% | 60% | Reinveste mais; WEG semestral |

- **Total do catálogo semente** fica perto de 30% trimestral, 40% semestral e 30% anual, mais conservador que a análise
  inicial (60/30/10), porque a evidência por setor aponta menos pagadores trimestrais fora dos bancos. Se o autor
  preferir a distribuição inicial, é só trocar os pesos: nenhum código depende dos números, só de `SectorPolicyWeights`.
- **Pool semestral e anual:** acumula o lucro líquido dos ciclos que não pagaram (`EquityValuePerShare` com o
  `netIncome` somado), mantendo o payout atual de 50% sobre o acumulado.
- **Payout de 25% como piso legal** ([FONTE], art. 202): o payout do motor (50%) já o respeita; nada a mudar.

## 4. FIIs: data-com, data-ex e pagamento

| Fato | Valor | Selo | Fonte |
|---|---|---|---|
| Distribuir no mínimo 95% do lucro apurado em regime de caixa, com base em balanços ou balancetes de 30/06 e 31/12 (semestral) | 95% | [FONTE] | Lei 8.668/93, art. 10 (redação da Lei 9.779/99); Ofícios-Circulares CVM/SIN |
| Distribuição mensal é prática e opcional, desde que o semestre feche com os 95% | mensal | [FONTE] | CVM (orientações sobre distribuição de resultados dos FIIs) |
| A maioria dos fundos distribui todo mês, cada um com a sua política de datas | sim | [OBSERVADO] | Euqueroinvestir, Money Times (centenas de FIIs pagando por semana) |
| Dia de pagamento: início ou meio do mês, com a maior concentração perto do **10º dia útil** (que cai por volta do dia 13 a 15 do mês corrido) | 10º dia útil | [OBSERVADO] | Euqueroinvestir, Suno, Money Times |
| Dias úteis usados pelos fundos: 1º, 2º, 5º a 10º, 12º e último dia útil (varia por fundo) | 1º a 12º | [OBSERVADO] | Euqueroinvestir (lista por fundo) |

A fonte que lista os fundos por dia útil mistura, na redação, data-com e pagamento; por isso o desenho usa as duas
âncoras explicitamente (abaixo) em vez de depender de uma delas.

### Parâmetros para o motor (`fii_details.payout_*`)

- **Mês-calendário real**, não mais "a cada 30 dias" (hoje `FIIPayoutIntervalDays = 30`, que não casa com o mês nem
  com `simcalendar`). 12 pagamentos por ano, o DY anual-alvo de `fii/payout.go` preservado.
- **Data-com** = último dia útil do mês de referência ([ILUSTRATIVO], a âncora mais comum entre os fundos citados);
  **data-ex** = próximo dia útil ([FONTE], regra B3); **pagamento** = N-ésimo dia útil do mês seguinte, com N sorteado
  de forma determinística por ticker:

| N (dia útil de pagamento) | Peso | Selo |
|---|---|---|
| 5 a 8 | 25% | [ILUSTRATIVO] |
| 9 a 11 (pico no 10) | 55% | [OBSERVADO] (concentração no 10º dia útil) |
| 12 a 15 | 20% | [ILUSTRATIVO] |

## 5. ETFs e o que fica de fora

- **ETFs** distribuem hoje no relógio global do balanço (`tick/etf.go`); o offset por fundo é a `RC.6.12`
  (opcional). Sem pesquisa nova nesta tarefa.
- **JCP e imposto sobre dividendos** (Lei 15.270/2025): decisão D9, só nas lições; achado 036 em
  `pontos-em-aberto-decisao-produto.md`.
- **Pagamento mensal de ação:** fora do motor, ver seção 3.

## 6. Resumo dos parâmetros que a RC.6.6 e a RC.6.7 devem usar

| Parâmetro | Valor | Selo |
|---|---|---|
| Janela do offset de balanço | `[0, 45)` dias após o fim do trimestre, dia útil | [FONTE] (prazo) + [ILUSTRATIVO] (pesos 5/30/65) |
| Data-ex | próximo dia útil depois da data-com | [FONTE] |
| Pagamento de ação | ex + 5 a 30 dias úteis (teto legal de 60 dias) | [FONTE] (teto) + [ILUSTRATIVO] |
| Periodicidade de ação | pesos por setor da seção 3 | [ILUSTRATIVO] |
| Pagamento mensal de ação | fora do escopo | decisão |
| FII: data-com | último dia útil do mês | [ILUSTRATIVO] |
| FII: pagamento | N-ésimo dia útil do mês seguinte, N em 5..15, pico no 10 | [OBSERVADO] |
| Chave do sorteio | hash FNV-1a do **ticker** (nunca do UUID) | desenho, análise 2.1 |

### Pontos a revisar com o autor (não bloqueiam a RC.6.6)

1. Os pesos de periodicidade da seção 3 são ilustrativos e mais conservadores que a análise inicial; confirmar ou trocar.
2. A janela de 45 dias para o 4T simplifica a DFP (prazo real de 3 meses).
3. Dividendo mensal de bancos mapeado em `quarterly`; se o autor quiser mensal, é uma política nova (`monthly`).

## Fontes

- Resolução CVM 80/2022 (prazos de ITR e DFP): <https://dados.cvm.gov.br/dataset/cia_aberta-doc-itr> e <https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp>
- Calendário de resultados 1T25, B3 Bora Investir: <https://borainvestir.b3.com.br/noticias/empresas/calendario-de-resultados-1t25-veja-as-datas-dos-balancos-das-empresas-da-b3/>
- Data-ex e data-com, B3 Bora Investir: <https://borainvestir.b3.com.br/glossario/data-ex/>
- Lei 6.404/76, arts. 202 e 205: <https://www.juruadocs.com/legislacao/art/lei_00064041976-205> e <https://www.legjur.com/legislacao/nivel/lei_00064041976/-secao-iii-dividendos>
- Lei 8.668/93 e orientações da CVM sobre distribuição de FIIs: <https://conteudo.cvm.gov.br/cvm_institucional/export/sites/cvm/legislacao/oficios-circulares/sin-snc/anexos/oc-sin-snc-0115-1.pdf> e <https://www.compliasset.com/?p=10994>
- Política de remuneração da Vale (POL-0038): <https://saladeimprensa.vale.com/documents/d/guest/pol-0038-g-politica-de-remuneracao-acionistas>
- Política de dividendos do Banestes (RI): <https://ri.banestes.com.br/docs/Politica-de-Dividendos-banestes-2026-06-29-rzr7D7qH.pdf>
- Dividendos mensais (JHSF, Itaú, Bradesco), B3 Bora Investir: <https://borainvestir.b3.com.br/tipos-de-investimentos/renda-variavel/acoes/conheca-as-acoes-de-3-empresas-que-vao-pagar-dividendos-mensais-em-2024/>
- Petrobras trimestral: <https://trademap.com.br/agencia/empresa/petrobras-altera-politica-e-pagara-dividendo-trimestral>
- Ambev trimestral: <https://euqueroinvestir.com/acoes/ambev-anuncia-10-bi-proventos-pagamento-dividendos-trimestral>
- WEG semestral e JCP trimestral: <https://www.moneytimes.com.br/weg-pagara-r-861-milhoes-em-dividendos/>
- Quando os FIIs pagam dividendos: <https://euqueroinvestir.com/fundos-imobiliarios/quando-os-fiis-pagam-dividendos>
- Calendário semanal de dividendos de FIIs, Money Times: <https://www.moneytimes.com.br/dividendos-211-fiis-pagam-nesta-semana-ifix-acumula-queda-em-outubro-igdl/>
- Varejo e prazo de dividendos: <https://monitormercantil.com.br/varejo-e-setor-que-mais-demora-no-pagamento-de-dividendos/>
