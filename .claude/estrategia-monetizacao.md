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

### Camada paga — itens aditivos, sem gente nos bastidores

Critério usado pra filtrar as ideias abaixo: precisam ser computadas automaticamente a partir de
dados/infraestrutura que já existem, sem curadoria humana recorrente nem serviço externo por
usuário — a monetização não pode depender de operação manual, só do que a aplicação já faz sozinha.

- **Pacote de trilhas/lições extras** (modelo "DLC"): as 33 lições centrais continuam grátis pra
  sempre — é o corpo avaliado pela TCC. Trilhas adicionais (temas mais avançados ou de nicho)
  viram pacotes pagos, escritos uma vez, sem custo recorrente por usuário. Reaproveita 100% da
  infraestrutura de trilha/lição já existente.
- **Múltiplas carteiras simultâneas ("sandboxes")**: hoje o usuário tem uma carteira só. Plano
  pago libera rodar 2-3 em paralelo (comparar estratégias, ou resetar uma carteira nova sem perder
  XP/streak/histórico da principal). Funcional, não bloqueia quem tem uma carteira só de graça.
- **Certificado de conclusão exportável**: trilha e emblema continuam grátis dentro do app; um
  certificado verificável (PDF/link público, ex: pra LinkedIn) por trilha concluída é pago. O valor
  não depende do saldo simulado — depende do aprendizado real, que é genuíno mesmo com dinheiro
  fictício.
- **Cenários extras de simulação**: o motor já tem um catálogo de templates de evento macro
  (`engine/internal/domain/macroevent/templates.go`). Um "modo cenário" pago deixa o usuário rodar
  a própria carteira contra um cenário pré-fabricado (ex: simular uma crise, um boom de commodities)
  sob demanda, em vez de esperar o evento sortear naturalmente.
- **Cosméticos exclusivos**: temas, moldura/avatar de perfil, emblemas visuais extras — nunca
  emblemas que representem conquista real de aprendizado (esses ficam grátis, são o Impulso 4 já
  planejado pra sala de troféus).

Ideias registradas mas não aprofundadas (baixa prioridade, ficam só como nota): personalização de
ranking (liga privada custom com amigos) e remoção de anúncios, caso anúncio venha a ser introduzido
como fonte de receita adicional no futuro — hoje nenhuma das duas é parte ativa da proposta.

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

## 5. O que nunca vira paywall

Conteúdo educacional (as 33 lições centrais e o que vier depois de graça), XP/nível/streak/
conquistas, a ação de comprar/vender, o valor de rentabilidade percentual/nível exposto no ranking
(RNF09 já proíbe expor patrimônio absoluto — isso vale independente de plano), e o resultado de
qualquer evento de mercado — a Assembleia (seção 4) decide o quê acontece, nunca vende vantagem
privada sobre o resultado.

## 6. O que falta pra essa proposta virar decisão fechada

- **Preço e nome dos planos** — não dá pra decidir sem usuários reais e sem saber o custo de infra
  em produção; a plataforma hoje não instrumenta telemetria de uso (mesma ressalva já registrada em
  `proposta-engajamento-licoes.md`).
- **Se a TCC comporta esse escopo** — implementar gateway de pagamento, planos e feature-gating é
  trabalho de engenharia real que compete com o roadmap de 8 semanas. Decisão do autor: por ora fica
  só documentado, sem tarefa de backlog aberta.
- **Validação de mercado** — a motivação (custo com usuários reais) ainda é hipotética; faz sentido
  reavaliar esse documento quando/se houver usuários de fato, não antes.
