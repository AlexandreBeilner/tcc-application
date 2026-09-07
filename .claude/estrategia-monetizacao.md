# Proposta — estratégia de monetização

> **Status: proposta, não é decisão fechada.** Nasceu de uma discussão do autor sobre transformar o
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

### Assinatura PRO (cobrança mensal) — tudo incluso, sem item avulso

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

**Âncoras — o que sozinho já justificaria assinar** (o resto da lista é o que deixa o plano mais
redondo, não o que vende ele):

- **Ligas privadas customizadas com amigos**: hoje o ranking é só Global e Amigos, com regra fixa.
  Assinante cria liga própria (nome, regra de pontuação, janela de tempo) pra competir só com um
  grupo específico — forte gatilho social (Impulso 5), sem tocar no ranking oficial, que continua
  igual pra todo mundo.
- **Pacote de trilhas/lições extras**: as 33 lições centrais continuam grátis pra sempre — é o
  corpo avaliado pela TCC. Trilhas adicionais (temas mais avançados ou de nicho) ficam disponíveis
  enquanto a assinatura estiver ativa, reaproveitando 100% da infraestrutura de trilha/lição já
  existente.

**Complementares — tornam o plano mais completo**:

- **Múltiplas carteiras simultâneas ("sandboxes")**: hoje o usuário tem uma carteira só. Assinatura
  libera rodar 2-3 em paralelo (comparar estratégias, ou resetar uma carteira nova sem perder
  XP/streak/histórico da principal). Funcional, não bloqueia quem tem uma carteira só de graça.
- **Cenários extras de simulação**: o motor já tem um catálogo de templates de evento macro
  (`engine/internal/domain/macroevent/templates.go`). Um "modo cenário" deixa o assinante rodar a
  própria carteira contra um cenário pré-fabricado (ex: simular uma crise, um boom de commodities)
  sob demanda, em vez de esperar o evento sortear naturalmente.
- **Acesso antecipado a conteúdo novo**: quando uma trilha extra ou cenário novo é lançado,
  assinante joga alguns dias antes de virar disponível pra todo mundo. Não é exclusividade
  permanente — o conteúdo eventualmente chega a todos, só a ordem de acesso muda.
- **Cosméticos exclusivos**: temas, moldura/avatar de perfil, emblemas visuais extras — nunca
  emblemas que representem conquista real de aprendizado (esses ficam grátis, são o Impulso 4 já
  planejado pra sala de troféus).
- **Poder de agenda nas Assembleias** (seções 4 e 5): propor pauta na Assembleia dos Investidores e
  na Assembleia de Acionistas. Nunca poder de resultado — quem decide continua sendo o voto de
  todos (flat na seção 4, proporcional a ações na seção 5).

Ideia registrada mas não aprofundada (baixa prioridade, fica só como nota): remoção de anúncios,
caso anúncio venha a ser introduzido como fonte de receita adicional no futuro — hoje não é parte
ativa da proposta.

### O que acontece quando o assinante cancela

Segue o princípio da seção 2 — **nunca esconder progresso já conquistado**. Cancelar não apaga
nada: ligas criadas, carteiras extras e cosméticos ficam arquivados/inativos, não deletados: se a
pessoa assinar de novo, tudo volta. Só as *capacidades* que dependem de assinatura ativa (criar liga
nova, ter carteira extra ativa, propor pauta, acesso antecipado) pausam — o que já foi conquistado
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

## 5. Mecânica colaborativa — "Assembleia de Acionistas" (por empresa)

Irmã da Assembleia dos Investidores (seção 4), mas em outra granularidade: em vez de uma decisão
macro pra plataforma inteira, é uma assembleia por empresa específica da Renda Variável, espelhando
assembleia de acionistas do mundo real (RF21 já separa indicador por classe de ativo — essa mecânica
vive dentro desse mesmo recorte, só ações).

A primeira versão discutida era peso de voto 5x pra quem tem plano pago. Descartada: diferente da
Assembleia dos Investidores (efeito igual pra todo mundo, sem posição individual em jogo), aqui um
usuário PRO que segura a ação da empresa X ganharia 5x de poder pra votar decisões que podem
beneficiar a própria posição dele — pay-to-win direto sobre um ativo específico, a mesma armadilha
do sistema de energia (seção 1) e do voto ponderado por conta (seção 4), só que mais grave por ser
por ativo.

Modelo adotado no lugar:

- **Voto ponderado por ações que o usuário possui daquela empresa, não por plano** — todo acionista
  vota (pago ou não), peso proporcional à posição real, exatamente como assembleia de acionista
  funciona no mundo real (skin in the game, não assinatura). Reforça a mecânica de governança
  corporativa como conteúdo educacional, não só como monetização.
- **Plano PRO ganha poder de agenda, não poder de resultado**: pode propor, dentre um catálogo
  pré-definido (sem curadoria humana por proposta), qual pauta entra na próxima assembleia daquela
  empresa. Quem decide se a pauta passa continua sendo o voto proporcional de todos os acionistas.
- Resultado da votação altera fundamentos da empresa (ex: política de dividendos, recompra) **pra
  todo acionista igual**, pago ou não — mesma regra de "nunca vender vantagem privada sobre o
  resultado" da seção 4.

## 6. O que nunca vira paywall

Conteúdo educacional (as 33 lições centrais e o que vier depois de graça), XP/nível/streak/
conquistas, a ação de comprar/vender, o valor de rentabilidade percentual/nível exposto no ranking
(RNF09 já proíbe expor patrimônio absoluto — isso vale independente de plano), e o resultado de
qualquer evento de mercado ou assembleia — quem decide o quê acontece é o voto (flat na seção 4,
proporcional a ações na seção 5), nunca uma vantagem privada comprada sobre o resultado.

## 7. O que falta pra essa proposta virar decisão fechada

- **Preço e nome dos planos** — não dá pra decidir sem usuários reais e sem saber o custo de infra
  em produção; a plataforma hoje não instrumenta telemetria de uso (mesma ressalva já registrada em
  `proposta-engajamento-licoes.md`).
- **Se a TCC comporta esse escopo** — implementar gateway de pagamento, planos e feature-gating é
  trabalho de engenharia real que compete com o roadmap de 8 semanas. Decisão do autor: por ora fica
  só documentado, sem tarefa de backlog aberta.
- **Validação de mercado** — a motivação (custo com usuários reais) ainda é hipotética; faz sentido
  reavaliar esse documento quando/se houver usuários de fato, não antes.
