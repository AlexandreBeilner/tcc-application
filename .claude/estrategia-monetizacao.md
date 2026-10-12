# Proposta — estratégia de monetização

> **Atualização 2026-10-10 — decisões fechadas pelo autor** (backlog em
> `backlog-monetizacao.md`): **B2C puro**; assinatura em **web, Android e iOS** via **RevenueCat** (na web, Stripe conectado a ele, sem Pix);
> **mensal R$ 9,90 e anual R$ 89,90, sem trial** (revisado em 2026-10-11; antes 19,97/199,97) (sujeito às faixas de BRL das lojas). O PRO é
> **guiado por desejo, não por conteúdo**: âncoras são **ligas privadas e duelos**, **identidade
> visível** (cosméticos, molduras, selo) e **retrospectiva compartilhável**, mais a **Assembleia de
> Acionistas** (seção 5, reescrita: só PRO vota, evento público, quem não paga ganha 1 crédito de voto
> por mês, desenho extensível a outros tipos de assembleia). **Fora do plano:** Conselho PRO.
> **Adiados:** cripto/opções, trilhas extras, acesso antecipado, máquina do tempo (cenários),
> múltiplas carteiras e Assembleia dos Investidores. Onde o texto abaixo diz "33 lições", leia "as
> lições centrais" (o currículo hoje passa de 40).
>
> **Status original: proposta, não é decisão fechada.** Nasceu de uma discussão do autor sobre transformar o
> app de protótipo de TCC em produto real com usuários — o que traz custo de infraestrutura e, com
> ele, a pergunta de como gerar retorno. A ideia original era um sistema de energia (ação consome,
> recarrega com o tempo, dá pra comprar recarga ou assinar plano com energia infinita). Essa ideia
> **foi descartada** — ver seção 1. Este documento registra o modelo alternativo discutido no lugar
> dela. Nada aqui foi implementado; é só direção pra quando/se o autor decidir abrir tarefas de
> backlog pra monetização (regra 5 do `CLAUDE.md` — decisão de produto fora dos três documentos
> fechados exige parar e perguntar, o que já foi feito nesta sessão).

## 1. Por que o sistema de energia foi descartado

`.claude/proposta-engajamento-licoes.md` (seção 3, "Limite ético") já fixa uma posição pro produto
inteiro: o mercado financeiro empurra naturalmente pra impulsos *Black Hat* do Octalysis (escassez,
perda, imprevisibilidade), e o design compensa isso de propósito com mecânicas *White Hat*. A regra
prática já registrada é **nunca cronômetro real, nunca perda de XP/nível por inatividade, nunca
"última chance" — só convite.**

Um sistema de energia que bloqueia lição ou compra/venda até recarregar (ou até pagamento) é o
Impulso 6 (escassez e impaciência) em estado puro, com uma camada de venda em cima. Três problemas
específicos, além do conflito com a regra já fechada:

- **Descasa do custo real.** A infraestrutura (motor Go + backend Node + Postgres + Redis, sempre
  em container) custa por usuário/tempo ativo, não por lição ou ordem executada — travar a ação não
  economiza nada, só cria fricção artificial.
- **Briga com o realismo "home broker".** Um investidor real não é limitado por stamina pra operar.
  Capar compra/venda simulada ensina o comportamento errado num produto que existe pra ensinar
  comportamento financeiro saudável.
- **Risco reputacional/regulatório maior que a média.** Um app de educação financeira que usa
  gatilho de escassez pra empurrar pagamento se parece com o padrão que corretoras predatórias usam
  de propósito — exatamente o oposto do posicionamento que o produto quer ocupar.

## 2. Princípio norteador do modelo alternativo

Monetizar por **adição de valor**, nunca por **bloqueio do que já existe**. Na linguagem do
Octalysis: cobrar em cima dos Impulsos 2/4 (desenvolvimento/realização, posse/propriedade) — o
mesmo eixo que `proposta-engajamento-licoes.md` já reforça — nunca em cima dos Impulsos 6/8
(escassez, perda) que o documento pede pra manter moderados.

Regra prática, espelhando a de energia: **nunca esconder progresso já conquistado atrás de
paywall, nunca introduzir atrito (ads, cooldown, limite de ação) que só desaparece pagando.** Se uma
feature paga também faria sentido de graça mas foi reservada só pra criar pressão de compra, ela
não serve.

## 3. Modelo proposto — freemium por camada

### Sempre grátis e ilimitado (o core loop avaliado pela TCC)

- Trilha completa de lições, simulação de Renda Fixa e Renda Variável, capital inicial R$ 10.000.
- XP, nível, streak, missões diárias, conquistas.
- Ranking (Global e Amigos, janela semana/mês) e sistema social (amizade bilateral, feed).
- Qualquer ação de compra/venda no mercado simulado, sem limite de quantidade por dia.

### Descartado: analytics avançado de carteira

Cogitado numa iteração anterior desta proposta (comparação com benchmark, atribuição de
performance, relatório de risco). O autor apontou o problema certo: como o dinheiro é fictício,
não há aderência real em vender análise de risco sobre um patrimônio que não existe — ninguém paga
por isso. Registrado aqui só pra não ser recogitado do zero numa sessão futura.

### Descartado: certificado de conclusão exportável

Cogitado na mesma iteração (certificado verificável por trilha concluída, modelo Coursera/Alura).
Descartado porque esse modelo depende de a marca emissora já ter peso/credibilidade no mercado —
uma plataforma nova e desconhecida não empresta valor de currículo a quem exibe o certificado,
diferente de uma Coursera/Alura já estabelecida. Só voltaria a fazer sentido se a plataforma
ganhar reconhecimento de mercado depois de lançada, não como estratégia de lançamento.

### Assinatura PRO (mensal ou anual) — tudo incluso, sem item avulso

**Planos e plataformas (decidido em 2026-10-10):** mensal R$ 9,90 e anual R$ 89,90 (equivale a
~R$ 7,49/mês, ~24% de desconto; revisado em 2026-10-11, antes 19,97/199,97), sem período de teste gratuito. Valem igual na web, no Android
e no iOS; a cobrança passa pela loja de cada plataforma (as lojas exigem isso dentro de apps e
ficam com comissão), mas o usuário vê **um** plano PRO só, reconhecido em qualquer lugar onde
entrar com a mesma conta. Sem trial, a conversão depende de o grátis já mostrar valor e de o
convite aparecer no ponto certo (portão de trilha, ligas, troféus), sempre como convite. Ver
`analise-tecnica-monetizacao.md` (revisão de 2026-10-10) para o desenho técnico.

Decisão do autor: uma assinatura recorrente só, não um cardápio de compras avulsas (nada de comprar
pacote por pacote separadamente). Mais simples de vender ("PRO por R$X/mês, ponto") e mais simples
de construir — uma flag de plano, não N SKUs diferentes pra cobrar e liberar. Isso também resolve
sozinho o problema de dar motivo recorrente pra manter a assinatura: se novo conteúdo (trilha,
cenário) continuar entrando na PRO ao longo do tempo, o motivo de renovar já vem embutido, sem
precisar de uma estrutura à parte tipo passe de temporada.

Critério usado pra filtrar as ideias abaixo (igual antes): precisam ser computadas automaticamente
a partir de dados/infraestrutura que já existem, sem curadoria humana recorrente nem serviço externo
por usuário — a monetização não pode depender de operação manual, só do que a aplicação já faz
sozinha.

**Princípio da seleção (2026-10-10):** com dinheiro fictício ninguém paga por *utilidade*, paga por
**identidade, competição e orgulho**. Conteúdo textual avulso é fácil de achar de graça e vende mal;
o que não se acha fora é praticar sem risco com amigos. Por isso o PRO é montado em volta de desejo.

**Âncoras — o que sozinho já justificaria assinar:**

- **Ligas privadas e duelos com amigos**: hoje o ranking é só Global e Amigos, com regra fixa.
  Assinante cria liga própria (nome, regra de pontuação, janela de tempo) ou desafia um amigo num
  duelo de duração fixa. Quem é convidado **não precisa ser PRO** para participar. Forte gatilho
  social (Impulso 5), sem tocar no ranking oficial.
- **Identidade visível**: molduras, títulos, temas e o selo PRO, **visíveis para os outros** no
  ranking, no feed e no perfil. Cosmético que só o dono vê não vende. Nunca representa conquista
  real de aprendizado (essas ficam grátis).
- **Retrospectiva compartilhável**: resumo mensal (e anual depois) da jornada, em cartões com imagem
  para compartilhar. Só percentual, nível e conquistas, nunca patrimônio absoluto (RNF09). Versão
  simples para todos, completa e personalizada no PRO.
- **Assembleia de Acionistas** (seção 5): o PRO vota decisões que mudam os fundamentos das
  empresas, para todo o mercado. É a âncora de "estou influenciando o app", mas só funciona com base
  de assinantes, por isso entra depois das três acima.

**Complementares:** selo e cartão de investidor compartilhável (o básico grátis, a personalização PRO).

**Adiados (ver Fase H do backlog):** trilhas de conteúdo extras e acesso antecipado (voltam só se vierem
junto de um mercado avançado, lição mais simulação), cripto e opções como mercado jogável (exigem
trabalho grande no motor e cuidado de tom com alavancagem gamificada), máquina do tempo (cenários
sob demanda), múltiplas carteiras e Assembleia dos Investidores.

Ideia registrada mas não aprofundada (baixa prioridade, fica só como nota): remoção de anúncios,
caso anúncio venha a ser introduzido como fonte de receita adicional no futuro — hoje não é parte
ativa da proposta.

### O que acontece quando o assinante cancela

Segue o princípio da seção 2 — **nunca esconder progresso já conquistado**. Cancelar não apaga
nada: ligas e duelos criados, cosméticos e retrospectivas ficam arquivados/inativos, não deletados: se a
pessoa assinar de novo, tudo volta. Só as *capacidades* que dependem de assinatura ativa (criar liga
ou duelo, equipar cosmético, propor pauta, votar sem crédito) pausam — o que já foi conquistado
(XP, badges, lições concluídas mesmo as de pacote extra) nunca some.

## 4. Mecânica colaborativa — "Assembleia dos Investidores" (Impulso 5)

A spec (`especificacao-plataforma-investimentos.md`, linha 298) já aponta o Impulso 5 (Influência
Social) do Octalysis como o mais subexplorado do produto inteiro. A ideia discutida: pagantes votam
periodicamente numa decisão que afeta o mercado simulado de verdade pra **todo mundo**, pago ou não
— não é uma funcionalidade nova sendo criada, é um evento que já ia acontecer (o motor já sorteia
eventos macro) só que decidido por votação em vez de aleatoriedade pura.

Exemplos concretos levantados: manutenção/alteração da Selic (o motor já modela Selic como
parâmetro — ver `equity-selic-decoupling`), ou taxação extra sobre um setor (mineração é um dos
setores fixos já padronizados na spec, linha 145). Isso tem um bônus pedagógico real: Selic no
Brasil é decidida por votação do COPOM — simular essa dinâmica ensina como política monetária/fiscal
funciona na vida real, reforçando o objetivo educacional em vez de brigar com ele.

### Por que isso não é pay-to-win

A primeira versão discutida tinha um problema: se só quem vota sabe o resultado antes de todo mundo,
vira informação privilegiada — vantagem de mercado real disfarçada de "governança". A correção que
resolve isso:

- **Opções e apuração em tempo real são públicas pra todo mundo**, pagante ou não — quem não vota
  vê a votação acontecendo e pode se posicionar igual a quem vota. A diferença do plano pago é
  **poder de decisão (voz)**, nunca vantagem de informação.
- **O resultado se aplica igualmente a todos os usuários** — o mesmo efeito de mercado pra pagante
  e não-pagante, sem privilégio privado no resultado.
- **Um voto por conta paga, sem compra de voto extra, sem peso por tamanho de carteira.** Se isso
  vazar pra "quanto mais eu pago ou mais eu tenho investido, mais peso meu voto tem", vira comprar
  vantagem de mercado disfarçada de voto — a mesma armadilha do sistema de energia descartado na
  seção 1, só que por outra porta.
- **Enquadrar narrativamente como parte do universo fictício do app** (ex: "Assembleia dos
  Investidores"), não literalmente "vocês são o Banco Central" — mantém o clima gamificado sem
  forçar um realismo estranho.

## 5. Assembleia de Acionistas (por empresa) — revisada em 2026-10-10

Irmã da Assembleia dos Investidores (seção 4, **adiada**), mas por empresa da Renda Variável,
espelhando assembleia de acionistas real (RF21 já separa indicador por classe; vive só em ações).

**Mudança em relação à versão anterior.** A versão de setembro descartava voto com poder por plano
(pay-to-win). O autor reabriu a decisão: **só o PRO vota**, o evento é visível para todos, e o
resultado afeta todos igualmente, o que ele considera aceitável. Em troca, o desenho adota proteções
para a mecânica não virar vantagem de mercado nem prejudicar o app:

- **Peso pelas ações, só entre quem votou.** Peso do voto é a quantidade de ações do usuário **na
  data de corte** (posição na abertura, como a data-ex dos proventos), nunca por plano nem por
  quanto se pagou. **Bots não votam** (quase todo o float é deles); por isso o peso é proporcional
  entre os votantes, não ao total de ações, senão nunca haveria quórum.
- **Mínimo de votantes distintos** (configurável, ponto de partida 3). Abaixo disso a pauta não
  passa e nada muda; empate mantém o status quo. Evita uma pessoa decidir sozinha uma empresa.
- **Resultado público antes de valer.** Fecha, aparece para todos, e o efeito só se aplica no
  próximo ciclo; quem não vota pode se posicionar igual a quem votou.
- **Pautas de dois lados, de um catálogo fechado** (ex.: distribuir mais dividendos contra reinvestir
  para crescer), cada opção com ganho e perda, sem texto livre e sem curadoria humana.
- **Efeito só nos fundamentos, nunca no preço direto.** O preço continua vindo da negociação dos
  bots reagindo. Efeito limitado em faixa, **gradual**, no máximo uma mudança por empresa por
  trimestre. Protege o mercado e o ranking de choques.
- **Sem recompensa por vencer.** XP e conquista só por participar.
- **Dinâmica:** abre alguns dias depois do balanço, aparece no Calendário, placar público ao vivo,
  voto mutável até fechar, ficha da pauta com o ganho e a perda de cada opção, pauta proposta pelo PRO
  e escolhida por apoio, resultado vira notícia e item no feed.

**Crédito de voto para quem não paga.** Quem não é PRO recebe **1 voto por mês**, usado numa
assembleia de empresa que possui (precisa de posição na data de corte, e-mail verificado e nível
mínimo). É funcionalidade a mais, **não é o centro do PRO** e não bloqueia nada do app; o PRO tem
assento permanente. Cuidado de enquadramento: nunca texto do tipo "você ficou sem votos, assine", que
seria a escassez que já descartamos.

**Extensível.** O desenho trata a assembleia como um `kind` (hoje só `shareholder`), com política de
elegibilidade, de peso e de efeito próprias, para plugar depois a Assembleia dos Investidores sem
mexer no núcleo. Detalhe técnico em `analise-tecnica-monetizacao.md` (seção 0.1).

## 6. O que nunca vira paywall

Conteúdo educacional (as lições centrais, a Trilha F de finanças do dia a dia e o que vier depois de graça), XP/nível/streak/
conquistas, a ação de comprar/vender, o valor de rentabilidade percentual/nível exposto no ranking
(RNF09 já proíbe expor patrimônio absoluto — isso vale independente de plano), e o resultado de
qualquer evento de mercado ou assembleia — quem decide o quê acontece é o voto (peso pelas ações
na data de corte, seção 5), o resultado é público antes de valer e vale igual para todos, nunca uma
vantagem privada comprada sobre o resultado.

## 7. O que falta pra essa proposta virar decisão fechada

Resolvido em 2026-10-10:

- **Preço e planos**: mensal R$ 9,90 e anual R$ 89,90, sem trial (revisado em 2026-10-11; confirmar o valor exato nas
  faixas de BRL das lojas, tarefa MO.1.1). O custo de infra em produção continua sem medição, então
  o preço é ponto de partida a validar (MO.6.3), não valor definitivo.
- **Escopo**: o autor decidiu avançar; o trabalho está quebrado em `backlog-monetizacao.md`, em
  fases que não competem com o roadmap original da TCC.
- **Público**: B2C.

Ainda em aberto:

- **Validação de mercado**: a conversão real só se mede com usuários (MO.1.3 e MO.6.1).
- **Limites das ligas e duelos, parâmetros da assembleia e catálogo de cosméticos**: ponto 046 em
  `pontos-em-aberto-decisao-produto.md`.
- **Pré-requisitos legais e fiscais** antes de cobrar (MO.1.2).
