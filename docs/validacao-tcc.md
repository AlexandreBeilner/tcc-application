# Validação do TCC: relatório de execução

Tudo abaixo vem de execução real em 2026-11-02. Nada foi estimado.

## 1. Identificação

| Item | Valor |
|---|---|
| Commit testado (código) | `8a0812afb2331ca6713d0c8424b06762fd3e634c` (branch `validacao-tcc`, base `5724ebf`) |
| Commit final | o commit que acrescenta só este arquivo, em cima do testado (o hash dele não pode constar aqui dentro; ver a mensagem de entrega) |
| Data | 2026-11-02 |
| Go | 1.27.0 linux/amd64 (o `go.mod` declara `go 1.22`) |
| Node | v22.23.1 |
| Docker | 29.8.1; Compose v5.5.1 |
| golangci-lint | v2.12.2 (mesma versão do CI): 0 issues |
| Stack das jornadas e do `neg.py` | contêineres, projeto Compose `tccsim` (`engine/scripts/e2e-mercado-simulado/compose.e2e.yml`), imagens reconstruídas a partir do commit testado |
| Cobertura (ferramenta) | Go: `go test -coverprofile`; backend e frontend: `@vitest/coverage-v8@4.1.11`, instalado com `--no-save` (o `package.json` não mudou) |

Os testes de integração com banco rodaram contra bancos descartáveis do Postgres da stack `tccsim`
(`TEST_DATABASE_URL`). Sem essa variável, 49 testes Go e 177 testes do backend são pulados e a cobertura cai
(Go: 57,9% sem banco, 72,8% com banco). Os números do Quadro 5 abaixo são **com banco**.

## 2. Quadro 5: suítes e cobertura

| Serviço | Arquivos de teste | Testes executados | Aprovados | Falhas | Puladas | Cobertura |
|---|---|---|---|---|---|---|
| Motor (Go) | 173 | 2.591 | 2.591 | 0 | 0 | 72,8% das instruções |
| Backend (Node) | 415 | 4.973 | 4.973 | 0 | 0 | linhas 91,57%; instruções 90,40%; ramos 85,08%; funções 91,21% |
| Frontend (React) | 416 | 2.769 | 2.769 | 0 | 0 | linhas 94,31%; instruções 93,44%; ramos 88,71%; funções 89,88% |

Notas de contagem: no Go, "testes" inclui subtestes (`go test -json`, eventos `pass` com nome de teste). Nos
dois pacotes Node, vem do relatório JSON do Vitest.

Sem banco, as mesmas suítes dão: Go 2.505 aprovados e 49 pulados; backend 4.796 aprovados e 177 pulados;
frontend igual (não tem testes com banco).

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

## 4. Concorrência: `neg.py`, bloco "double spend"

12 ordens de compra a mercado de 90 ações de VALR3, disparadas ao mesmo tempo pelo mesmo usuário, com saldo
inicial de R$ 10.000. Duas execuções completas, uma depois da outra, na stack final.

| | Execução 1 | Execução 2 |
|---|---|---|
| Saldo inicial | R$ 10.000,00 | R$ 10.000,00 |
| `best_ask` de VALR3 | 102,70 | 102,70 |
| Custo de uma ordem de 90 ações no `best_ask` | R$ 9.243,00 | R$ 9.243,00 |
| Ordens executadas | 1 | 1 |
| Recusadas por validação de saldo (422 `insufficient_balance`) | 11 | 11 |
| Recusadas por outro status ou código | 0 | 0 |
| Custo total executado | R$ 9.243,00 | R$ 9.243,00 |
| Saldo final | R$ 757,00 | R$ 757,00 |
| Verificações do `neg.py` | 75 de 75 ok, 0 falhas | 75 de 75 ok, 0 falhas |

Conta de conferência: 10.000 − 9.243 = 757. O custo executado (9.243) é menor que o saldo inicial (10.000).

**Limite da evidência:** a recusa pela validação de saldo (snapshot lido sem lock) e a barrada pela restrição
do banco (`accounts_balance_non_negative_chk`, migration 000025) saem do motor como a mesma rejeição de
negócio (`orderexecution.ErrInsufficientBalance`, `mapFundsViolation`), então chegam ao cliente com o mesmo
status e código (`422 insufficient_balance`). Pelo HTTP não dá para separar as duas causas. Nenhuma ordem
voltou com outro status ou código. Para atribuir cada recusa a uma das duas, seria preciso ler os logs do
motor ou instrumentar o caminho do banco.

Os JSON completos por ordem (status, código, mensagem, quantidade e custo executados) estão em
`neg_concorrencia.json`, gerado a cada execução do `neg.py` na pasta do script.

## 5. Jornadas ponta a ponta (backend/test/e2e)

Contra o gateway da stack `tccsim` (`E2E_BASE_URL=http://localhost:8100`), execução sequencial.

| Jornada | Resultado | Duração |
|---|---|---|
| `lessonJourney` | passou | 1 s |
| `equityOrderJourney` | passou | 17 s |
| `companyQualityJourney` | passou | 63 s |
| `fixedIncomeRedemptionJourney` | passou | 150 s |
| `macroEventJourney` | passou | 156 s |

5 de 5 aprovadas. Na primeira tentativa, as 4 jornadas que exigem o admin falharam com 401 porque o usuário
admin da stack não tinha sido criado (erro do meu preparo do ambiente, não do código). Depois de criar o
admin com `npm run db:seed:admin`, as 5 foram reexecutadas e passaram; a tabela acima é da segunda execução.

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
4. Backend: o ranking Global/Amigos e as ligas usam o Dietz modificado no denominador. Duelos, retrospectiva
   mensal e perfil continuam com `investmentReturnPct`. Fora do critério geral, quem fica com denominador ≤ 0
   segue com 0%; nos critérios por classe, sai do ranking da classe.
