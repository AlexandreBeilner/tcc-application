# Validação do TCC: relatório de execução

Tudo abaixo vem de execução real em 2026-11-02. Nada foi estimado.

## 1. Identificação

| Item | Valor |
|---|---|
| Commit testado (código) | `88e024e4d64ab26e48cd471e19d023264b20c1a3` (branch `validacao-tcc`, base `5724ebf`): último commit de código de produção (Dietz também no perfil público). Sobre ele rodaram as três suítes, o `neg.py` (2 vezes) e as 5 jornadas, todas nesta ordem de preparo: stack recriada do zero, `neg.py` duas vezes, depois as jornadas. A única mudança posterior é de teste: o commit `c531d471d51f8f4d52b389a2032dcacbfaee3384` só acrescenta impressão de evidência e a consulta de integridade à `fixedIncomeRedemptionJourney` (nenhuma asserção existente mudou); as jornadas rodaram com esse arquivo. |
| Commit final | o commit que acrescenta só este arquivo, em cima do testado (o hash dele não pode constar aqui dentro; ver a mensagem de entrega) |
| Data | 2026-11-02 (segunda rodada) |
| Go | 1.27.0 linux/amd64 (o `go.mod` declara `go 1.22`) |
| Node | v22.23.1 |
| Docker | 29.8.1; Compose v5.5.1 |
| golangci-lint | v2.12.2 (mesma versão do CI): 0 issues |
| Stack das jornadas e do `neg.py` | contêineres, projeto Compose `tccsim` (`engine/scripts/e2e-mercado-simulado/compose.e2e.yml`), imagens reconstruídas a partir do commit testado. A stack foi recriada do zero (volumes apagados; catálogo, seeds de lições, conquistas, missões, diário e admin refeitos) e usada, nesta ordem, pelo `neg.py` (2 vezes) e pelas 5 jornadas. A primeira tentativa do `neg.py`, em stack já usada pelas jornadas, está na seção 4 |
| Cobertura (ferramenta) | Go: `go test -coverprofile`; backend e frontend: `@vitest/coverage-v8@4.1.11`, instalado com `--no-save` (o `package.json` não mudou) |

Os testes de integração com banco rodaram contra bancos descartáveis do Postgres da stack `tccsim`
(`TEST_DATABASE_URL`). Sem essa variável, 49 testes Go e 177 testes do backend são pulados e a cobertura cai
(Go: 72,8% com banco). Os números do Quadro 5 abaixo são **com banco**.

## 2. Quadro 5: suítes e cobertura

| Serviço | Arquivos de teste | Testes executados | Aprovados | Falhas | Puladas | Cobertura |
|---|---|---|---|---|---|---|
| Motor (Go) | 173 | 2.591 | 2.591 | 0 | 0 | 72,8% das instruções |
| Backend (Node) | 417 | 4.981 | 4.981 | 0 | 0 | linhas 91,62%; instruções 90,45%; ramos 85,11%; funções 91,23% |
| Frontend (React) | 416 | 2.769 | 2.769 | 0 | 0 | linhas 94,31%; instruções 93,44%; ramos 88,71%; funções 89,88% |

Notas de contagem: no Go, "testes" inclui subtestes (`go test -json`, eventos `pass` com nome de teste). Nos
dois pacotes Node, vem do relatório JSON do Vitest.

Sem banco (só o Go foi reexecutado assim nesta rodada): 2.505 aprovados e 49 pulados. Backend e frontend sem banco não foram repetidos; o frontend não tem testes com banco.

### Cobertura por pacote do motor (com banco)

| Pacote | Cobertura de instruções |
|---|---|
| `domain/orderbook` (livro de ofertas) | 98,8% (81/82) |
| `domain/orderexecution` (execução de ordens) | 99,3% (133/134) |
| `domain/fixedincome` (renda fixa, fórmulas) | 93,5% (72/77) |
| `domain/fixedincomeexecution` (renda fixa, compra e resgate) | 96,9% (188/194) |
| `domain/selic` (série da Selic) | 100,0% (48/48) |

### Cobertura por módulo do backend (com banco)

| Módulo | Linhas | Instruções | Ramos | Funções |
|---|---|---|---|---|
| `lessons` | 94,7% | 94,6% | 92,0% | 95,6% |
| `ranking` | 93,8% | 93,6% | 89,3% | 93,2% |
| `assemblies` | 97,7% | 95,4% | 90,4% | 92,6% |
| `duels` | 94,3% | 92,5% | 88,6% | 92,8% |
| `profile` | 74,7% | 74,0% | 71,8% | 74,2% |

## 3. Quadro 6: cálculos, entradas e valores

Os valores obtidos foram impressos por execução das próprias funções (arquivos temporários, apagados em
seguida). O Quadro 6 do texto do TCC não está no repositório; esta tabela cobre os casos desta validação.
Se o Quadro 6 tiver outras linhas, é preciso informar quais são.

| Cálculo | Entrada | Valor esperado | Valor obtido | Teste (arquivo:nome) |
|---|---|---|---|---|
| Preço do Tesouro Prefixado | VN R$ 1.000; 14,50% a.a.; 504 DU | 762,76 | 762,761961 | `engine/internal/domain/fixedincome/exemplos_capitulo2_test.go:TestPrefixedPrice_ExemploSecao221` |
| Cotação do Tesouro IPCA+ | 7,5% a.a. real; 1.260 DU | 0,696559 (69,6559 na escala do Tesouro) | 0,696559 | `.../fixedincome/exemplos_capitulo2_test.go:TestIPCAQuote_ExemploSecao222` |
| Preço do Tesouro IPCA+ | VNA projetado 4.455,33 × cotação 0,696559 | 3.103,40 | 3.103,398571 | `.../fixedincome/exemplos_capitulo2_test.go:TestIPCAPrice_ExemploSecao222` |
| VNA projetado | VNA 4.450,00; IPCA do mês 0,40%; 9 de 30 dias | 4.455,33 | 4.455,332541 | `.../fixedincome/exemplos_capitulo2_test.go:TestVNAProjected_ExemploSecao222` |
| IR regressivo | 180 / 360 / 720 / 721 dias | 22,5% / 20% / 17,5% / 15% | 22,5% / 20% / 17,5% / 15% | `.../fixedincome/incometax_test.go:TestRegressiveIncomeTaxRate` |
| Alíquota de LCI, LCA, CRI e CRA | resgate com lucro, produto classificado por `NewFixedIncomeProduct` | 0% e líquido = bruto (CDB de controle: > 0%) | 0% nos quatro; CDB tributado | `.../fixedincomeexecution/fixedincomeexecution_test.go:TestRedeem_AliquotaZeroParaLCI_LCA_CRI_CRA` |
| Juros compostos | R$ 10.000; 1% a.m.; 12 meses; sem aporte | 11.268,25 | 11.268,250301 | `frontend/src/features/calculator/computeGrowthProjection/index.test.ts:valores exatos: R$10.000 a 1% a.m. ...` |
| Juros simples | R$ 10.000; 1% a.m.; 12 meses; sem aporte | 11.200,00 | 11.200,000000 | idem |
| Diferença composto − simples | os dois acima | 68,25 | 68,250301 | idem |
| Taxa equivalente | 12% a.a. efetivo, composto, 12 meses | 11.200,00 | 11.200,000000 | `.../index.test.ts:conversão de taxa equivalente ...` |
| Rentabilidade do ranking (Dietz), sem fluxos | V_início 10.200; G_início 200; G_atual 950 | 750 / 10.200 = 7,35% | 7,352941% | `backend/src/modules/ranking/domain/profitability.test.ts:investmentDietzReturnPct > sem fluxos na janela ...` |
| Rentabilidade do ranking (Dietz), aporte no fim | janela de 30 dias; V_início 1.000; +10% (+100); aporte de 9.000 no dia 29 | 100 / (1.000 + 9.000 × 1/30) = 7,69% (fórmula antiga: 1,00%) | 7,692308% (antiga: 1,000000%) | `.../profitability.test.ts:investmentDietzReturnPct > aporte no fim da janela ...` e `...:o aporte no fim da janela dá 7,69% ...` |
| Rentabilidade do ranking (Dietz), compra e venda do mesmo valor | V_início 1.000; compra 500 no dia 10; venda 500 no dia 20; T = 30 | denominador 1.000 + 500 × 20/30 − 500 × 10/30 | coberto, passou | `.../profitability.test.ts:investmentDietzReturnPct > compra e venda do mesmo valor ...` |
| Rentabilidade do ranking (Dietz), denominador ≤ 0 | vendeu mais do que tinha em risco | geral: 0%; por classe: fora do ranking (`null`) | passou | `.../profitability.test.ts:investmentDietzReturnPct` e `classDietzReturnPct` |
| Dietz no `RankingScorer`, aporte 1 h antes do fim | amostra de 24/08 01:00; aporte de 9.000 em 26/08 11:00; agora 26/08 12:00 | 100 / (1.000 + 9.000 / 59) | passou | `backend/src/modules/ranking/application/rankingScorer.test.ts:aporte pouco antes do fim da janela ...` |
| Duelo (Dietz), aporte no fim | janela de 7 dias (168 h); lado A: R$ 1.000, +5%, sem aporte; lado B: R$ 1.000, +10% (+100), aporte de 9.000 uma hora antes do fim | B: 100 / (1.000 + 9.000/168) = 9,4915%; A: 5%; vence B | A 5,000000%; B 9,491526% (valor da expressão do teste, conferido a 6 casas); `{outcome: 'opponent', reason: 'profitability'}` | `backend/src/modules/duels/infrastructure/ranking/duelWinnerDietz.test.ts:com Dietz, vence quem rendeu mais ...` |
| Duelo, contraste com a fórmula antiga | mesmos dados | B = 1,00% (custo bruto no fim 10.000), A vence | B 1,000000%; `{outcome: 'challenger', reason: 'profitability'}` | `.../duelWinnerDietz.test.ts:contraste: pela fórmula antiga ...` |
| Duelo, sem aporte | mesmos rendimentos, sem aporte | vencedor igual nas duas fórmulas | `opponent` nas duas; rentabilidade de B igual a 6 casas | `.../duelWinnerDietz.test.ts:sem aporte, o vencedor é o mesmo nas duas fórmulas ...` |
| Perfil público (Dietz), aporte no fim | janela do mês (01/10 a 31/10 12:00 UTC, T = 732 h); V_início 1.000; +10% (+100); aporte de 9.000 uma hora antes do fim | 100 / (1.000 + 9.000/732) = 9,8785% | confere a 6 casas (expressão do teste); fórmula antiga: 1,000000% | `backend/src/modules/profile/infrastructure/ranking/inProcessProfitabilityReader.test.ts:aporte no fim da janela não dilui o retorno ...` e `...:contraste: sem o leitor de eventos ...` |
| Perfil público (Dietz), demais casos | sem fluxos; compra de ativo sandbox; conta criada no meio da janela | 10%; 10%; T e base partem da criação | passou | `.../inProcessProfitabilityReader.test.ts` (3 testes restantes) |
| Marcação a mercado, alta da taxa | título a 10% a.a. comprado com 252 DU; resgate com 126 DU restantes; taxa de mercado sobe para 15% | preço < PU de compra e retorno realizado menor que o contratado | preço 932,504808; retorno realizado 2,575529%; retorno contratado −20,957781% | `engine/internal/domain/fixedincome/markingtomarket_test.go:TestEarlyRedemption_ValoresExatos/taxa subiu pra 15%` (valores impressos por execução neste commit) |
| Marcação a mercado, queda da taxa | mesmo título; taxa de mercado cai para 6% | preço > PU contratado | preço 971,285862; retorno realizado 6,841445%; retorno contratado +17,823273% | `.../markingtomarket_test.go:TestEarlyRedemption_ValoresExatos/taxa caiu pra 6%` |
| Marcação a mercado, taxa inalterada | mesmo título; taxa de mercado 10% | preço no PU da curva | preço 953,4626; retorno 4,8809%; diferença 0 | `.../markingtomarket_test.go:TestEarlyRedemption_TaxaInalterada_SemDesvioDoContratado` |
| PU na compra, apoio da marcação a mercado | 10% a.a.; 252 DU | 1.000 / 1,10 | 909,090909 | `PrefixedPrice` (mesma função dos casos acima) |
| VNA mensal | VNA 1.000; IPCA do mês 1% e depois 2% | 1.010 e 1.030,20 | [1.010; 1.030,2] | `engine/internal/domain/fixedincome/ipcaplus_test.go:TestVNAMonthlySeries_Composicao` |
| Preço do IPCA+ como produto | VNA 1.050; cotação 0,9 | 945,00 | 945,000000 | `.../ipcaplus_test.go:TestIPCAPrice_ProdutoDeVnaEQuote` |
| Série da Selic sem ruído | inicial 20; neutra 10; velocidade 0,5; volatilidade 0; 4 reuniões | 15; 12,5; 11,25; 10,625 | [15; 12,5; 11,25; 10,625] | `engine/internal/domain/selic/selic_test.go:TestSeries_ReversaoAMediaSemRuido` |
| Determinismo da Selic | `Series(DefaultConfig(10.75, 42), 100)` chamada duas vezes com o mesmo `Config` e a mesma semente | séries idênticas | idênticas nos 100 índices; primeiro valor 10,945545; último 10,031142 | `.../selic_test.go:TestSeries_DeterministicaPorSeed` |

## 4. Concorrência: `neg.py`, bloco "double spend"

12 ordens de compra a mercado de 90 ações de VALR3, disparadas ao mesmo tempo pelo mesmo usuário, com saldo
inicial de R$ 10.000. O `neg.py` inteiro rodou duas vezes, uma depois da outra, no commit
`88e024e4d64ab26e48cd471e19d023264b20c1a3`, numa stack recriada do zero, **antes** das jornadas (preço de VALR3 ainda no início).

**Primeira tentativa (stack que já tinha rodado as jornadas): 74 de 75 em cada execução.** A verificação
"alguma compra executou" falhou nas duas. Causa: as jornadas haviam avançado muitos dias simulados e o
`best_ask` de VALR3 estava em 117,17; uma ordem de 90 ações custava R$ 10.545,30, mais que o saldo, e as 12
foram recusadas (`422/insufficient_balance`). As verificações de segurança do saldo (custo ≤ saldo inicial e
saldo final ≥ 0) passaram, mas a disputa não foi exercitada, então essa tentativa não vale como evidência.
Não houve mudança de código. A stack foi recriada do zero (volumes apagados; `engine/cmd/seed` com
`SEED_ALLOW_SYNTHETIC=true --synthetic-assets 12 --synthetic-etfs 2`; seeds de lições, conquistas, missões,
diário e admin do backend) e o `neg.py` rodou duas vezes. A tabela abaixo é dessa segunda tentativa.

| | Execução 1 | Execução 2 |
|---|---|---|
| Saldo inicial | R$ 10.000,00 | R$ 10.000,00 |
| `best_ask` de VALR3 | 99,96 | 99,96 |
| Custo de uma ordem de 90 ações no `best_ask` | R$ 8.996,40 | R$ 8.996,40 |
| Ordens executadas | 1 | 1 |
| Recusadas por validação de saldo (422 `insufficient_balance`) | 11 | 11 |
| Recusadas por outro status ou código | 0 | 0 |
| Custo total executado | R$ 8.996,40 | R$ 8.996,40 |
| Saldo final | R$ 1.003,60 | R$ 1.003,60 |
| Verificações do `neg.py` | 75 de 75 ok, 0 falhas | 75 de 75 ok, 0 falhas |

Conta de conferência: 10.000 − 8.996,40 = 1.003,60. O custo executado (8.996,40) é menor que o saldo inicial
(10.000). Observação: o `best_ask` inicial muda um pouco a cada stack nova (99,96 aqui; 99,99 e 102,70 em stacks anteriores); o que importa para o cenário é que uma ordem caiba uma vez no saldo e duas não.

**Limite da evidência:** a recusa pela validação de saldo (snapshot lido sem lock) e a barrada pela restrição
do banco (`accounts_balance_non_negative_chk`, migration 000025) saem do motor como a mesma rejeição de
negócio (`orderexecution.ErrInsufficientBalance`, `mapFundsViolation`), então chegam ao cliente com o mesmo
status e código (`422 insufficient_balance`). Pelo HTTP não dá para separar as duas causas. Nenhuma ordem
voltou com outro status ou código. Para atribuir cada recusa a uma das duas, seria preciso ler os logs do
motor ou instrumentar o caminho do banco. O cenário também depende do preço: o `neg.py` fixa 90 ações, então
só exerce a disputa enquanto o `best_ask` ficar abaixo de 111,11.

Os JSON completos por ordem (status, código, mensagem, quantidade e custo executados) estão em
`neg_concorrencia.json`, gerado a cada execução do `neg.py` na pasta do script.

## 5. Jornadas ponta a ponta (backend/test/e2e)

Contra o gateway da stack `tccsim` recriada (`E2E_BASE_URL=http://localhost:8100`), execução sequencial, depois do `neg.py`.

| Jornada | Resultado | Duração |
|---|---|---|
| `lessonJourney` | passou | 1 s |
| `equityOrderJourney` | passou | 17 s |
| `companyQualityJourney` | passou | 107 s |
| `fixedIncomeRedemptionJourney` | passou | 236 s |
| `macroEventJourney` | passou | 247 s |

5 de 5 aprovadas.

### 5.1 `fixedIncomeRedemptionJourney`: valores impressos

Um usuário novo compra R$ 1.000 de cada produto (CDB2027, LCI2026, LCA2026, CRI2028, CRA2028) no mesmo dia simulado,
o relógio avança até 190 dias simulados e ele resgata tudo. Saldo antes das compras: R$ 10.000,00; antes dos
resgates: R$ 5.000,00. Valores impressos pela própria jornada (linhas `EVIDENCIA`):

**CDB2027 (tributado)**

| Item | Valor |
|---|---|
| Valor aplicado | R$ 1.000,00 |
| Dias simulados até o resgate | 190 |
| Valor bruto | R$ 1.057,2608 |
| Ganho | R$ 57,2608 |
| Alíquota | 20% (faixa de 181 a 360 dias) |
| Imposto | R$ 11,4522 |
| Valor líquido | R$ 1.045,8087 |
| Saldo antes do resgate / depois | R$ 5.000,00 / R$ 6.045,81 |
| Variação do saldo no resgate | + R$ 1.045,81 (o líquido, arredondado a centavos) |

**Isentos de IR**

| Produto | Valor bruto | Alíquota | Valor creditado | Variação do saldo |
|---|---|---|---|---|
| LCI2026 | R$ 1.047,0489 | 0% | R$ 1.047,0489 | + R$ 1.047,05 |
| LCA2026 | R$ 1.047,0489 | 0% | R$ 1.047,0489 | + R$ 1.047,05 |
| CRI2028 | R$ 1.059,8007 | 0% | R$ 1.059,8007 | + R$ 1.059,80 |
| CRA2028 | R$ 1.058,2774 | 0% | R$ 1.058,2774 | + R$ 1.058,28 |

A jornada confere, para cada um, alíquota 0, líquido igual ao bruto e variação do saldo igual ao valor creditado.

**Serviço de integridade** (`POST/GET /admin/integrity/check`, rodado depois dos resgates): status `done`;
verificou 49.665 eventos, 110 contas, 3.860 posições, 49 ativos e 154 ordens em repouso; **0 divergências** em
todas as categorias (`balance_mismatch`, `position_mismatch`, `negative_balance`, `negative_position`,
`float_mismatch`, `resting_order_unfunded`, `unknown_event_type`). A verificação é de toda a base da stack, não só
do usuário da jornada.

## 6. Outras verificações

- `golangci-lint run ./...` (v2.12.2): 0 issues. `go build ./...`: ok.
- Backend: `npm run lint` e `npm run build`: sem erros.
- Frontend: `prettier --check`: ok; `npm run build`: ok; `oxlint` só com 2 avisos de
  `only-export-components` já existentes em `HeadlineTriageWidget`.

## 7. Mudanças de código desta validação

1. Motor: testes dos exemplos numéricos do Capítulo 2 e da alíquota 0% de LCI, LCA, CRI e CRA.
2. Frontend: teste de juros compostos × simples com entrada que distingue os regimes.
3. `neg.py`: o cenário de concorrência registra saldo inicial, `best_ask`, e status, código, quantidade e
   custo de cada ordem.
4. Backend: o ranking Global/Amigos, as ligas e os duelos usam o Dietz modificado no denominador
   (`MeasurePeriodReturnUseCase`, que decide a rentabilidade de cada lado do duelo, recebe o leitor de
   eventos). Fora do critério geral, quem fica com denominador ≤ 0 segue com 0%; nos critérios por classe,
   sai do ranking da classe. Teste de duelo: `duelWinnerDietz.test.ts` (seção 3).
5. Backend: o perfil público (`inProcessProfitabilityReader`) usa o mesmo Dietz modificado na rentabilidade da
   janela atual (semana ou mês), com teste novo (seção 3). Sem o leitor de eventos, cai na fórmula antiga.
6. O que continua com a fórmula antiga (`investmentReturnPct`, rentabilidade sobre o custo investido, sem
   ponderar os fluxos): só a retrospectiva mensal, que mostra a rentabilidade do mês do próprio usuário.

## 8. Restrições do banco, refeitas na stack `tccsim` (Postgres 16, banco `market`)

Cada comando rodou dentro de `BEGIN ... ROLLBACK` sobre uma linha real; a conferência final mostra que nada
mudou (saldo 10000.00, quantidade 352234, o evento continua existindo). A posição escolhida pertence a uma
conta de bot (`00000000-0000-0000-0000-000000000002`); a restrição vale para qualquer conta.

| Comando | Erro retornado pelo Postgres |
|---|---|
| `UPDATE accounts SET current_balance = -0.01 WHERE user_id = 'aa08fad0-3ee6-45d4-aff8-b8dd93372dc3'` | `ERROR: 23514: new row for relation "accounts" violates check constraint "accounts_balance_non_negative_chk"` (CHECK `current_balance >= 0`) |
| `UPDATE positions SET quantity = -1 WHERE id = '4f8b118d-456d-4855-9340-0f730955a3cc'` | `ERROR: 23514: new row for relation "positions" violates check constraint "positions_quantity_non_negative_chk"` (CHECK `quantity >= 0`) |
| `UPDATE market_events SET quantity = 999 WHERE id = '8cae6cb9-acb6-4521-b890-91d9735bf6cc'` | `ERROR: P0001: market_events é append-only: UPDATE não é permitido (id=8cae6cb9-...)`, de `prevent_market_events_mutation()` |
| `DELETE FROM market_events WHERE id = '8cae6cb9-acb6-4521-b890-91d9735bf6cc'` | `ERROR: P0001: market_events é append-only: DELETE não é permitido (id=8cae6cb9-...)`, idem |

O trigger é `market_events_append_only BEFORE DELETE OR UPDATE ... FOR EACH ROW`. A saída completa (com
`DETAIL` e `LOCATION`) foi gravada na sessão; o roteiro usa `\set VERBOSITY verbose`.

## 9. Determinismo com a mesma semente

Há teste que roda duas vezes com a mesma semente e compara, mas só em escala pequena:

- `engine/internal/domain/tick/tick_test.go:TestAdvance_Deterministica`: chama `Advance` duas vezes com
  o mesmo estado (`State{Day: 20, SelicRate: 11}`), os mesmos ativos, a mesma configuração da Selic (semente 5) e a mesma
  semente do passo (99). Compara o `State` inteiro (dia e Selic) e o preço da primeira cotação, por igualdade exata.
- `engine/internal/domain/tick/rounds_test.go:TestRunIntradayRounds_Deterministico`: roda as rodadas
  intradiárias duas vezes com bots e book iguais e compara, ordem a ordem, as ordens submetidas.
- As séries (Selic, IPCA, GBM, fundamentos, FII) têm um teste de igualdade exata para a mesma semente, por exemplo
  `selic_test.go:TestSeries_DeterministicaPorSeed` (seção 3).

**O que não existe:** teste que simule vários dias com a mesma semente em duas execuções completas e compare o
estado persistido (saldos, posições) e a série de preços de todos os ativos. Os testes acima cobrem um passo ou
uma série isolada, não a simulação inteira.
