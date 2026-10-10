# Varredura: termos proibidos, dados irreais e mecânica exposta

Escopo: backend/src, engine (internal + cmd/seed), frontend/src. Sem testes, .claude/, .docs/. Admin tratado à parte (não é usuário final). Somente leitura.
Observação: o seedLessons.ts tem ~20 comentários de código com "TCC/spec/tarefa", que não são visíveis; só interessam as strings abaixo.

## A. Referências visíveis ao TCC/spec/dev

### A1 CRÍTICO (texto de lição que o aluno lê)
- backend/src/db/seedLessons.ts:145 centralConcept: `'Crescimento linear vs exponencial (TCC cap. 2.1.1)'`
- backend/src/db/seedLessons.ts:854 centralConcept: `'Formação de preço no livro de ofertas (TCC cap. 2.3.3)'`
- backend/src/db/seedLessons.ts:342 revelationText: `'É por isso que a spec do TCC (cap. 3) o trata como o "porto seguro" da renda fixa:'`
- backend/src/db/seedLessons.ts:1056 revelationText: `'(BNDD4), mais sensível a mudanças na Selic (spec 3.2.2), já que juros...'`
- backend/src/db/seedLessons.ts:1145 centralConcept: `'Conecta com Selic afetando fundamentos (3.2.2), defensivo vs cíclico'` (número de seção da spec e texto de autor)
- Rótulos de autoria/dev em centralConcept (se a UI exibir): 2.3 `'final 11 pode ser ETF, FII ou unit'` ok; 1.1 unlocksDescription `'Tesouro Selic'` decorativo ok. Verificar na tela se `centralConcept`/`unlocksDescription` aparecem (provável no Mapa da Trilha).

### A2 ALTO (catálogo/seed do engine exibido em Detalhe de Ativo)
- engine/cmd/seed/main.go:153 metodologia ETF SMLC11: `"...maior crescimento esperado (companies.base_growth_pct) entre os 6 setores fixos — uma por setor."` (nome de coluna de banco, "setores fixos", em dash)
- engine/cmd/seed/main.go:156 (FINX11): `"...ações do setor Bancário/Financeiro do catálogo."` ("do catálogo")
- engine/cmd/seed/main.go:172 (DIVI11): `"...FIIs e ações de setores de fluxo de caixa estável."` com em dash
- engine/cmd/seed/main.go:181 (AMPL11): `"Réplica total (full replication)... em contraste com a amostragem representativa do SINT11."` (compara com outro produto interno)
- engine/cmd/seed/main.go:~493 SINT11: nome `"ETF Índice Sintético"`, índice `"Ibovespa"`, metodologia `"Replicação sintética por amostragem representativa do índice."`. Ver B.
- engine/cmd/seed/main.go:776 nome do ativo sandbox: `"Ação Sandbox — Lição 2.3"`; :799 `"Tesouro Prefixado Sandbox — Lição 1.7"` (número de lição + em dash + jargão "Sandbox").
- frontend/src/components/organisms/EtfCompositionPanel/index.tsx:64 `Composição sintética ainda não cadastrada.` ("sintética"/"cadastrada" são jargão de dev).
- engine/cmd/seed/synthetic.go:129 `"ETF Sintético %02d"`, `"Sintética %03d ON"`: só com flag SEED_ALLOW_SYNTHETIC; garantir que nunca rode em produção.
- Empresas fictícias com nome parecido com reais: "Banco Nordeste Digital" (BNB real), "Mineradora Vale do Rio" (Vale), ticker VALR3. Risco de confusão/jurídico; avaliar sufixo ou disclaimer.

### A3 ALTO: mensagens de erro do engine que chegam à UI (backend repassa 1:1, OrderConfirmationDialog.tsx:121 mostra err.message)
- engine/internal/domain/fixedincomeexecution/fixedincomeexecution.go:193 `"temporizador ainda não rodou nenhum tick — sem taxa de mercado simulada pra este produto"`
- engine/internal/infra/db/fixed_income_execution_repository.go:29 `"temporizador ainda não rodou nenhum tick — sem taxa Selic simulada pra marcar a mercado o resgate"`
- engine/internal/infra/httpserver/fixedincome.go:290 idem ("projetar produto pós-fixado"); :217 `"serviço de simulação de renda fixa indisponível"`; :251 `"simulação só é suportada pra ativo de renda fixa"`; :261 `"dado de catálogo de renda fixa incompleto"`; :267 `"erro ao buscar dia simulado corrente"`; :286 `"erro ao buscar Selic simulada corrente"`
- engine/internal/domain/fixedincomeexecution/fixedincomeexecution.go:181 `"dias de permanência simulados devem ser maior que zero"`
- engine/internal/domain/position/position.go:31 `"soma das posições excede outstanding_shares do ativo"` (nome de coluna)
- engine/internal/infra/httpserver/orders.go:88 `"user_id e asset_id são obrigatórios e devem ser UUIDs válidos"`, :103 `"quantity deve ser maior que zero"`, :107 `"price é obrigatório..."`, :121 `"execução de ordem só é suportada pra ativo de renda variável (ação, ETF, FII)"`; fixedincome.go:107/111/125/164/178 (`amount`, `user_id`); account.go:169/173 (`reference_month ... AAAA-MM`); book.go:66 `"serviço de book indisponível"`; positions/calendar/macroevents `"serviço ... indisponível"`, `"limit inválido"`, `"from inválido, use AAAA-MM-DD"`.
- backend: `'falha ao ... no motor de simulação'` (engineHttp.ts:17 `'erro do motor de simulação'`; engineAccountProvisioner.ts:15, engineSalaryCrediter.ts:15, engineAssetPriceHistoryReader.ts:28, engineSandboxAssetReader.ts:13, engineAccountEventsReader.ts:29, engineCurrentAccountStateReader.ts:34). Viram 500 "erro interno" (ok), exceto o repasse de EngineRequestError em marketRouter.ts:73, que repassa o texto cru do engine.
- Backend com termos técnicos: marketRouter.ts:342 `'parâmetros de simulação inválidos'`; authRouter.ts:121 `'code ausente'`; authMiddleware.ts `'token ausente'`, `'token inválido'`, `'reauth_required'`, `'account_suspended'` (códigos usados como mensagem: frontend Login/index.tsx:71 compara; verificar que a UI mapeia para texto amigável); uuidParam.ts:13 `'id deve ser um UUID válido'`; `'payload inválido'`, `'dados de ordem inválidos'` (ok, mas details traz nomes de campo em inglês).
- Recomendação: o frontend deve mapear erros por `code` estável para texto em português; nunca exibir `err.message` cru (Onboarding:154, Login:74, Configuracoes:91/118/147, PrivacidadeLgpd:55/69, OrderConfirmationDialog:121).

### A4 MÉDIO (telas do usuário com jargão)
- frontend/src/components/organisms/IndicatorSummaryCards/index.tsx:27,37,47 `'Aguardando primeiro tick'` ("tick" = jargão). Sugestão: "Aguardando a primeira atualização do mercado".
- IndicatorSummaryCards:55 `Próximo Copom simulado` + `Dia {nextCopomSimulatedDay}` (expõe número de dia da simulação; ver C).
- frontend/src/components/molecules/MarketClockChip/index.tsx:94 `próximo dia em ...`; features/market/marketClosedReason/index.ts:50 `Mercado fechado: fim de semana simulado.` (aceitável como explicação, mas ver C).
- frontend/src/components/organisms/MarketCalendarPanel/index.tsx:261 `Cada dia real equivale a 5 dias de mercado. Sábado e domingo o mercado fica fechado.` (mecânica; deve virar contraste com mercado real).
- frontend/src/components/organisms/NetWorthCards/index.tsx:58 `Sandbox`; pages/Classificacao/index.tsx:106 `O Sandbox não entra.`; pages/Market/index.tsx:39 `Selic e IPCA simulados`. Inconsistência "Sandbox" vs "Modo Aprendizado": padronizar.
- frontend/src/components/organisms/OrdersList/index.tsx:34 `requoted: 'Recotada pelo motor'` ("motor" é jargão; confirmar se aparece p/ usuário comum, ou só no admin).
- frontend/src/components/organisms/OrderConfirmationDialog/index.tsx:254,262 (em dash, ver D).
- Chaves de storage visíveis em DevTools: frontend features/auth/AuthContext/index.tsx:12 `'tcc.auth.token'`, features/theme/ThemeContext/index.tsx:12 `'tcc.theme'`, features/shell/unreadNews/index.ts:22 `'tcc.news.lastSeenId'`. Renomear para `investimenta.*` (com migração de leitura). Também docker-compose.yml container_name/POSTGRES_USER `tcc-*` e import path Go `tcc-investimentos/engine/...` (não visíveis ao usuário, só prefixo interno).
- frontend/src/components/organisms/MacroEventTriggerForm/index.tsx:182 `"...este texto aparece pro jogador no Feed de Notícias."` ("jogador") é admin, mas troque por "usuário".

### A5 Conquistas e missões (backend/src/db)
- seedMissions.ts:37,45 completionCriteria `'Reportado pelo cliente — sem verificação cruzada nesta fase'` (jargão dev + em dash); :30 `'Concluir o step de desbloqueio de qualquer lição no dia'`; :75 `'Reabrir e revisar hoje uma lição com completedAt mais antigo que 14 dias'` (nome de campo). Nenhuma página do frontend consome `completionCriteria` hoje (grep vazio), mas o campo está na API: remover do payload público ou reescrever.
- seedMissions.ts:51 título "Revise uma lição concluída há mais de 14 dias" ok. Campo "Micro-decisão" é termo do produto ok.
- seedAchievements.ts: nomes/descrições limpos. Atenção: `'Complete todas as 35 lições da trilha.'` acopla número do currículo (quebra se mudar). Sem TCC/spec visível.

### A6 Notícias / eventos macro
- engine/internal/domain/macroevent/templates.go e cópia em frontend/src/features/admin/macroEventTemplates/index.ts: títulos/narrativas sem TCC/spec. Problemas: em dash (D) e duplicação do catálogo (risco de divergência).
- Nenhum e-mail transacional encontrado (sem nodemailer/SMTP).
- frontend/index.html `<title>Investimenta</title>` ok.

## B. Dados factualmente errados, irreais ou desatualizados

1. seedLessons.ts:361 `'reunido a cada 21 dias simulados nesta plataforma'` e :556 `'o Copom (simulado nesta plataforma a cada 21 dias reais)'` (também inconsistente: "simulados" vs "reais"). Real: 8 reuniões por ano (calendário público do BCB, 2 dias cada, ~45 dias entre elas). Corrigir texto ensinando o real e, se o motor usa 21 dias, avaliar alinhar o intervalo do motor a ~8/ano (a cada ~32 dias de mercado).
2. seedLessons.ts:380 `'(o mesmo passo do Copom real, nunca uma casa decimal solta)'`: o Copom real usa múltiplos de 0,25 p.p. mas também mexe 0,50/0,75/1,00; "mesmo passo" é impreciso. Reescrever: "o Copom costuma mover em múltiplos de 0,25 p.p.".
3. seedLessons.ts:357-364,373-378: Copom reage a expectativas de inflação e atividade, não só ao IPCA acumulado vs meta; meta atual: 3,0% com tolerância de 1,5 p.p. (meta contínua desde 2025). Informar isso como mundo real e rotular a regra de Taylor como simplificação do motor.
4. seedLessons.ts:1110-1133 (lição 2.7) data ex vs data com: o texto define "data ex" como o dia em que se registra quem tem direito; no Brasil o corte é a **data com** (último dia com direito); a **data ex** é o dia seguinte, em que quem compra já não recebe. Quem vende na/depois da data ex mantém o direito se tinha na data com. Também "ciclo de relatório a cada 14 dias simulados" e "defasagem fixa de 5 dias simulados" são mecânica interna. Real: dividendos trimestrais/anuais, pagamento depois de dias ou semanas.
5. Dividendos: nenhuma lição fala de IR. Desde 01/01/2026 (Lei 15.270/2025) há retenção de 10% na fonte quando a mesma PJ paga mais de R$ 50 mil/mês a uma pessoa física (e IR mínimo para alta renda). Dividendos de ações e FIIs para o investidor comum seguem sem retenção; não afirmar "isento de IR" sem essa ressalva. Fonte: Lei 15.270/2025 (PwC/Jornal Contábil).
6. IR LCI/LCA/CRI/CRA: afirmação "isentos" (seedLessons 1.5/1.6/1.11 e FixedIncomeDetail "Isento de IR") está correta para pessoa física: a MP 1.303/2025 que previa 5% caducou em out/2025; segue valendo a Lei 11.033/2004. Confirmado, sem erro. Recomendado indicar "para pessoa física, conforme a lei vigente" (risco de mudança legislativa).
7. Tabela regressiva (22,5/20/17,5/15%; Lei 11.033/2004) correta. Falta mencionar IOF regressivo nos primeiros 30 dias (96% do rendimento no dia 1 até 0% no dia 30) quando a lição fala de resgate curto (1.5, 1.6, 3.3 com 60/90/180 dias não são afetadas, mas qualquer exemplo < 30 dias é). Verificar se o motor aplica IOF; se não, a lição deve avisar.
8. FGC (lição 1.4, glossário frontend/src/features/lessons/glossary/index.ts:7, seedLessons 1.6/1.11): R$250 mil por CPF por instituição está correto, mas falta o teto global de R$1 milhão por CPF a cada 4 anos e a lista (também cobre poupança, LC, RDB, LH). Frase "praticamente tão seguro quanto o Tesouro Direto" (seedLessons.ts:418) é opinião questionável; trocar por "protegido até o limite do FGC, mas o risco do emissor continua existindo acima dele".
9. LCI/LCA prazo mínimo (seedLessons 1.6 usa resgate em 60 dias): confirmar prazo mínimo regulatório (CMN, depende do indexador, 60 dias a 12 meses) e carência; resgatar LCI/LCA em 60 dias dito sem ressalva pode ser irreal. A conferir antes de manter o exemplo.
10. Poupança (0.5): regra 0,5% a.m. + TR com Selic > 8,5% e 70% da Selic + TR abaixo disso está correta. "Com a Selic simulada nesta plataforma rodando acima de 8,5%" mistura. Também falta dizer que poupança é isenta de IR e coberta pelo FGC (justiça comparativa).
11. Valores do catálogo hardcoded nas lições e desatualizados vs seed: lições citam CDB2027 `12,00% ao ano` (1.4/1.6), LCI2026 `9,50%`, LTN2027 `11,75%`, NTNB2035 `6,00%`, CRI `11,00%`/CRA `10,50%`. O seed atual (engine/cmd/seed/main.go:~790) usa CDB 110% do CDI, LCI/LCA 90%, CRI 115%, CRA 112%, LTN spread 1,75 p.p., NTNB2035 spread 0,50 p.p. sobre real implícito (~6,75%). As taxas dependem da Selic simulada; textos ficam errados. Usar exemplos genéricos ("um CDB que paga 110% do CDI") e deixar números vivos via widget.
12. Lição 2.9 (seedLessons.ts:1187-1193) diz composição "Mineradora 40%, Banco Nordeste Digital 35%, outras 25%"; seed real do SINT11: VALR3 40, BNDD3 20, TJLO11 25, PAPL11 15. Banco é 20%, não 35%. Erro de dado.
13. SINT11 apresentado com índice de referência `"Ibovespa"` (engine/cmd/seed/main.go ~493) mas a cesta é de 4 ativos fictícios (incluindo 2 FIIs): afirma que replica um índice real. Trocar por índice fictício nomeado ("Índice Investimenta 4") ou remover. Também o Ibovespa real não tem FIIs.
14. Lição 2.9: "O fundo também recebe os dividendos ... e os distribui aos cotistas": nos ETFs de ações brasileiros a prática predominante (ex.: BOVA11) é reinvestir os proventos, sem distribuir; também falta que ETF de renda variável paga 15% de IR sobre ganho de capital, sem a isenção de R$20 mil das ações. Ajustar.
15. Lição 2.4: `'Uma notícia dizendo "quebra de safra afeta o Agronegócio"'` é correto, mas seedLessons.ts:1285 `testar essa estratégia contra um evento de mercado real` e unlocksDescription `'testada contra um evento real'` (3.4): o evento é simulado. Corrigir.
16. Lição 2.3: ON/PN e units corretos. Observação: "Esta plataforma não tem unit negociável" (C). PN com voto: PN "sem voto" correto no geral; "prioridade em dividendos" correto (mínimo de dividendo).
17. Lição 0.1 (seedLessons.ts:132) `Completar esta lição libera seu Portfólio de verdade, com R$10.000 de capital inicial`: "de verdade" confunde (dinheiro é simulado; Onboarding diz "simulados"). Usar sempre "simulado".
18. Lição 1.2: `LFT2029` e "Tesouro Selic 2029" existem no mundo real (título real); ok, mas dizer que a taxa é "100% da Selic" é simplificação (real: Selic + ágio/deságio). OK em lição introdutória.
19. Lição 1.10 (NTNB): VNA corrigido "mês a mês" (real: diariamente pro rata pelo IPCA projetado) e cupom semestral não mencionado. Baixa prioridade.
20. Onboarding (pages/Onboarding/index.tsx:59): "5 dias a cada dia real", "fecha no sábado e no domingo" (a B3 também fecha em feriados); `Ele cai sozinho ... 5º dia útil` ok como mecânica da plataforma. Sem erro factual, mas ver C.
21. Estudo de IR em sandbox/lições cita "alíquota ... Lei 11.033/2004" correta.

## C. Mecânica da plataforma onde deveria haver explicação do mundo real
Padrão recomendado: "No Brasil, [fato real]. Na plataforma, [o que mantemos / o que simplificamos / o que é diferente]."
- seedLessons.ts:128,132 (0.1 revelação): "Nesta plataforma, cada trilha que você completa desbloqueia..."
- :226 (0.4): `Todo indicador de investimento nesta plataforma é nominal`
- :246 (0.5): `Com a Selic simulada nesta plataforma`
- :361, :556 (Copom 21 dias): ver B1
- :598 (1.9): `Nesta plataforma, o IPCA mensal simulado varia pouco em torno de uma meta, mês a mês, sem depender do valor do mês anterior.` Real: IPCA tem sazonalidade e autocorrelação, divulgado pelo IBGE ~dia 10 do mês seguinte.
- :615, :618 (1.9): `alimenta duas coisas nesta plataforma`, `IPCA mensal e o acumulado em 12 meses simulados até agora`
- :639 (1.10): `Se a inflação simulada nesta plataforma rodar mais alta`
- :580 (1.8): `ativo de prática (Sandbox) disponível no Mercado`
- :761-762 (2.2): `é esse mercado secundário que o Mercado ao vivo desta plataforma simula`
- :802-803 (2.3): `Esta plataforma não tem unit negociável no catálogo`
- :877-878 (2.5): `forma o preço em tempo real de toda ação, ETF e FII desta plataforma`; :869 "motor de pareamento" (jargão). Real: B3 usa leilões de abertura/fechamento e prioridade preço-tempo.
- :896 (2.6.1): `o motor de simulação gera um relatório financeiro dela a cada ciclo`. Real: balanços trimestrais (ITR) e anuais (DFP) divulgados na CVM.
- :1110-1127 (2.7): `a cada 14 dias simulados`, `a plataforma registra quem tem direito`, `defasagem fixa de 5 dias simulados`
- :1147 (2.8): `ela também entra na simulação dos fundamentos de toda empresa listada`; :1150-1169 "perfil Conservador/Sofisticado" aplicado a ações é rótulo da plataforma, não conceito real (B3 não classifica ações assim). Explicar como classificação interna.
- :1190-1193, :1212-1215 (2.9): `Hoje replicado por amostragem representativa...`, "participante autorizado" bot interno.
- :1263 / :1438-1442 (3.4): `trilha guiada concluída, mundo aberto liberado`, `todo o Mercado ... sandbox e ao vivo`.
- :1407-1409 (3.4): `evento macro de alta da Selic é disparado`, `choque especulativo do evento`.
- :289 (1.1): `o mesmo tipo de bônus da lição 0.1` ok.
- Frontend: IndicatorSummaryCards.tsx:55 `Próximo Copom simulado ... Dia N` (mostrar data/relativo + "No Brasil o Copom se reúne 8 vezes por ano"); MarketCalendarPanel:261; marketClosedReason/index.ts:50; Onboarding SLIDES 1, 3, 4; pages/Classificacao:106.
- Sugestão estrutural: criar bloco "Na vida real vs na plataforma" no passo Revelação de cada lição (campo `realWorldNote`) em vez de frases soltas.

## D. Em dash (—) como pontuação em texto visível (autor não quer)
Backend/engine (strings que viram texto de usuário):
- backend/src/db/seedLessons.ts:363 `ela reage principalmente a uma pergunta — a inflação`
- engine/internal/domain/macroevent/templates.go:104 (inadimplência: `perdas — pressão direta`), :123 (expansão: `ciclos — antes de qualquer número`), :132 (desvalorização: `oposta — o mesmo evento`; fala "setores em direções opostas —"), :151 (quebra de safra: `setor — efeito misto`); cópias idênticas em frontend/src/features/admin/macroEventTemplates/index.ts:63, 85, 96, 118
- engine/cmd/seed/main.go:153, :172 (metodologia ETF), :776 `"Ação Sandbox — Lição 2.3"`, :799 `"Tesouro Prefixado Sandbox — Lição 1.7"`
- engine: domain/fixedincomeexecution/fixedincomeexecution.go:193; infra/db/fixed_income_execution_repository.go:29; infra/httpserver/fixedincome.go:290; domain/bot/chartist.go:35; domain/bot/fundamentalist.go:79 (esses dois só admin/log)
- backend/src/db/seedMissions.ts:37,45 `'Reportado pelo cliente — sem verificação cruzada nesta fase'`
- backend/src/modules/lessons/application/useCases/reviewLesson.ts:44 `'lição ainda não concluída — não há o que revisar'`
Frontend usuário:
- frontend/src/components/organisms/OrderConfirmationDialog/index.tsx:254 `agora — nenhuma unidade foi ...`; :262 `... ${priceSuffix} — o restante não achou liquidez ...`
Exceções (placeholder de dado `'—'`, permitidas): FixedIncomeList:40, EquityList:20,46, StatementList:62, EquityOrderTicket:75,76,105,112, resolveTargets:28, TickRunList:81, MarketMonitorTable:12, OrdersList:114, admin diversos.
Comentários/console.log com "—" são ignoráveis.

## E. Prevenção

1. Teste automatizado de conteúdo (vitest, backend): `backend/src/content/visibleContent.test.ts` importa `LESSON_SEEDS` (exportar), `ACHIEVEMENT_SEEDS`, `MISSION_SEEDS`, e varre todo campo string. Regex proibidos: `/\b(TCC|spec|especifica[cç][aã]o|monografia|banca|prot[óo]tipo|cap\.\s?\d|tarefa\s\d|RNF?\s?\d|RF\s?\d|backlog|MVP|Fase [A-Z]\b)/i`, `/nesta plataforma|desta plataforma|a plataforma registra/i` (exige revisão), `/—/`, `/\b(tick|temporizador|motor|endpoint|payload|outstanding_shares|[a-z]+_[a-z]+)\b/` (snake_case), `/\blição \d/` (citar lição por `{{ref:x.y}}`). Falha com arquivo/campo/trecho.
2. Engine (Go): teste em `macroevent/templates_test.go` e em `cmd/seed` (extrair catálogo para pacote testável) com as mesmas regex sobre Title/Narrative/nomes de ativo/metodologia; teste que percorre as `errors.New` de domínios expostos ao usuário (orderexecution, fixedincomeexecution, position, account) e exige código estável + mensagem sem snake_case/jargão.
3. Frontend: regra de lint customizada (oxlint não suporta fácil) ou teste vitest que lê `src/**/*.tsx` (exceto *.test, pages/Admin*, comentários) e procura literais JSX com os mesmos termos; mais `no-restricted-syntax` para `err.message` direto em JSX: obrigar `getUserMessage(err)` mapeando `code` para PT-BR.
4. API: padronizar resposta `{ error: { code, message } }`; `message` só para usuário; detalhes técnicos só em log. Remover `completionCriteria` do payload público.
5. CI (hook pre-commit e job): `git grep -nE "TCC|spec do|cap\. [0-9]" -- backend/src/db frontend/src engine/cmd engine/internal ':!*_test.go' ':!*.test.*'` limitado a literais; mais teste de snapshot do conteúdo de lições revisado por humano quando muda.
6. Guia de redação (`.claude/guia-redacao-conteudo-usuario.md`): (a) o usuário nunca vê processo de desenvolvimento; (b) ensine o Brasil real primeiro, depois "Na plataforma, simulamos X assim"; (c) proibido em dash, usar vírgula/ponto/dois-pontos; (d) nunca "dinheiro de verdade" ao falar do saldo, sempre "simulado"; (e) números do mundo real com fonte e data (BCB, Receita, FGC, B3) e revisão semestral; (f) não cravar taxas do catálogo no texto, usar widget ou "% do CDI"; (g) referenciar lições por `{{ref}}`, nunca por número; (h) tom e termos de glossário; (i) checklist de PR de conteúdo.
7. Revisão periódica de dados regulatórios: lista versionada (tabela IR, FGC, poupança, calendário Copom, meta de inflação, tributação de dividendos) em um único módulo `regulatoryFacts` usado por lições, glossário e motor, com data de verificação.

## Fontes consultadas
- Lei 15.270/2025 (dividendos, retenção 10% acima de R$ 50 mil/mês): PwC Brasil Tax Intelligence ed. 48; Jornal Contábil.
- MP 1.303/2025 caducou em out/2025; LCI/LCA seguem isentas (B3 Bora Investir; Nord Investimentos).
- Conhecimento de apoio (não rebuscado agora): calendário Copom (8 reuniões/ano), meta de inflação 3% com tolerância 1,5 p.p., regra da poupança (Lei 12.703/2012), FGC R$250 mil/CPF/instituição e R$1 mi/4 anos, tabela regressiva (Lei 11.033/2004). Prazo mínimo regulatório de LCI/LCA a confirmar.
