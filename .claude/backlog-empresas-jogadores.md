# Backlog — Empresas de jogadores (clãs em forma de empresa)

Backlog executável criado em 2026-10-17, a partir da mesma sessão de ideação do `backlog-diario.md`. Ideia do autor: o usuário pode **fundar uma empresa**, que funciona como um clã. Os membros fazem a empresa crescer com a própria atividade no app, e a empresa tem **indicadores reais** (receita, margem, lucro, patrimônio, ROE) calculados a partir dessa atividade. A estrutura nasce pronta para, no futuro, a empresa **pegar dívida** e **abrir capital (IPO)** no mercado simulado.

Não há documento de proposta separado: o "porquê" está na seção 1.

**Como usar este arquivo**

1. Siga a ordem da "Sequência sugerida" no final. Dependências reais estão em cada tarefa.
2. Uma tarefa por sessão. Ao concluir: verificar os critérios de aceite, marcar ✅ no título e acrescentar um bullet **Entregável** (mesmo padrão dos outros backlogs).
3. Tarefa que toca `backend/` passa pelo checklist obrigatório do `CLAUDE.md` inteiro. **Nenhuma tarefa das Fases A a F toca `engine/`**: o motor só entra na Fase H (IPO), que exige documento de decisão próprio antes.
4. Telas novas nascem responsivas nos três breakpoints e seguem `identidade-visual-tokens.md` e `identidade-visual-padroes.md`. Texto mostrado ao usuário nunca usa "—" como pontuação. Tela nova entra no `inventario-telas-plataforma-investimentos.md`.
5. Módulo novo no backend: `backend/src/modules/playerCompanies/` (nome no código escolhido para não confundir com as empresas listadas do mercado, que já são "companies" no motor e aparecem em `/mercado/empresas/:id`). Migrations Drizzle: `when` do journal acima da última aplicada; `drizzle-kit generate` precisa de TTY.
6. Gating de PRO sempre por consulta ao caso de uso de status do `billing` (`GetSubscriptionStatus`), nunca por claim de JWT (regra do `backlog-monetizacao.md`). Cancelar o PRO nunca apaga nada, só pausa capacidade (regra da `estrategia-monetizacao.md`).
7. Nenhum número da empresa expõe o patrimônio de alguém (RNF09): tudo vem de atividade, nunca de carteira.

---

## 1. Por que

- **Pertencimento sem depender de amigos nem de dinheiro.** Num clube de investimento (ideia descartada na mesma sessão), quem tem mais patrimônio pesa mais. Na empresa, cada membro contribui com o que faz: estudar, jogar o Diário, cumprir missões. É justo e não é pay-to-win.
- **Ensina fazendo.** Receita, custo, margem, lucro, patrimônio líquido, ROE e dividendos usam a definição de verdade (seção 3). Quando o membro chega na lição de ROE (2.7.4), já viu o ROE da própria empresa subir e cair.
- **Dinâmica de clã que já se provou** (Clash of Clans, ligas do Duolingo): uma empresa por pessoa, cargos, cobrança entre colegas, competição entre grupos.
- **Recrutar iniciantes vale a pena.** Quem acabou de chegar tem mais lições pela frente e gera mais receita, então as empresas têm interesse em trazer e ensinar gente nova. Isso ajuda quem entra no app sem conhecer ninguém.
- **Caminho para mais dinamismo depois:** dívida com juros pela Selic simulada e IPO no mercado (Fases G e H).

## 2. Decisões

### Fechadas pelo autor (2026-10-17)

| # | Decisão |
|---|---|
| EJ1 | O usuário pode **fundar uma empresa**, que funciona como um clã. |
| EJ2 | **Começar pelos indicadores que crescem com a atividade dos usuários.** Dívida e IPO ficam para depois, mas **a estrutura nasce pronta para eles** (seção 4). |
| EJ3 | **Fundar é grátis.** Empresa grátis tem até **10 membros**; para passar disso é preciso **PRO**. |
| EJ4 | **O balanço fecha a cada mês simulado** (o mês do relógio do mercado; com 5 dias simulados por dia real, cerca de 6 dias reais). |
| EJ5 | **Uma empresa por vez.** Ninguém está em duas ao mesmo tempo. |
| EJ6 | Existe um **menu de empresas** para o usuário procurar e entrar numa. |

### Propostas (padrão sugerido, confirmar ao abrir a tarefa que depende delas)

| # | Proposta | Onde pesa |
|---|---|---|
| EP1 | **O PRO que expande é o do fundador.** Com o PRO ativo, o teto de membros passa a ser o do porte (seção 3.3, até 30). Se o PRO acabar, **ninguém é removido**: a empresa só não aceita membro novo enquanto estiver acima de 10. Se o fundador sair, o cargo passa para o diretor mais antigo (e a empresa segue o PRO de quem herdou). | EJ.2.1, EJ.4.1 |
| EP2 | **Valores em R$ simulado**, convertidos da atividade por uma taxa fixa (ex: 1 XP de atividade = R$ 100 de receita). O balanço fica com cara de balanço ("receita R$ 48 mil") e já está na unidade que o IPO vai precisar. Não é patrimônio de ninguém, então não fere a RNF09. | EJ.1.1 |
| EP3 | **Dividendo = bônus de XP para os membros, com teto por período.** A empresa define uma política de distribuição (% do lucro), que muda por votação. | EJ.4.2 |
| EP4 | **Entrar numa empresa:** convite, pedido aprovado pela Diretoria, ou entrada direta se a empresa estiver marcada como "aberta". | EJ.2.1 |
| EP5 | **Pré-requisito para fundar:** ter concluído a Trilha 0 (evita empresa fantasma e nome criado só para testar). | EJ.2.1 |
| EP6 | **Sair tem carência:** quem sai só pode entrar em outra empresa depois de 24 horas, e só recebe dividendo do período em que foi membro do começo ao fim. Impede pular de empresa para pegar dividendo. | EJ.2.1, EJ.4.2 |
| EP7 | **Licença automática:** membro sem atividade há 7 dias reais entra em licença. Não conta como custo nem vota, e volta sozinho ao ter atividade. O fundador ainda pode remover alguém, mas a empresa não é punida por quem viajou. | EJ.3.2 |

### Em aberto

| # | Pergunta | Bloqueia |
|---|---|---|
| EA1 | **Nome na interface.** "Empresa" é o mais natural, mas o app já chama de "empresas" as listadas do mercado (`/mercado/empresas/:id`). Usar "Empresa" mesmo (e, no IPO, a empresa do jogador vira literalmente uma delas) ou outro nome ("Firma", "Sociedade", "Companhia")? | EJ.2.2 |
| EA2 | **Onde fica o menu** na navegação (aba própria na `TabBar` ou dentro de outra área, como Amigos/Classificação). | EJ.2.2 |

## 3. Como a empresa funciona

### 3.1 O balanço (mesmos campos do motor)

A demonstração de cada período usa **os mesmos campos do `FundamentalsRecord` do motor** (`engine/internal/domain/tick/tick.go`): receita líquida, EBIT, lucro líquido, patrimônio líquido, dívida bruta e caixa. Assim, quando houver IPO, o motor lê o balanço que a empresa já tem.

| Campo | Na empresa de jogadores (Fases A a F) | O que ensina |
|---|---|---|
| **Receita líquida** | Soma da atividade dos membros no período, convertida em R$ (EP2). Só contam os motivos de XP de uma lista fechada (seção 3.2). | Receita é o que a operação produz |
| **Custo** | Uma meta mínima por membro ativo no período (membro em licença não conta, EP7) | Contratar aumenta o custo. Membro parado pesa. |
| **EBIT** | Receita − custo (sem dívida, igual ao lucro) | A diferença entre EBIT e lucro aparece quando houver juros (Fase G) |
| **Lucro líquido** | EBIT − juros (zero até a Fase G) | |
| **Patrimônio líquido** | Lucro acumulado não distribuído | Reinvestir faz a empresa crescer |
| **Dívida bruta** | Zero até a Fase G | A tela já mostra "sem dívida" |
| **Caixa** | Igual ao patrimônio até a Fase G | |

Indicadores mostrados: **margem** (lucro ÷ receita), **ROE** (lucro ÷ patrimônio), **crescimento da receita** contra o período anterior e, depois da Fase G, **dívida líquida ÷ EBIT**. Mesmas fórmulas das lições 2.7.x.

Prejuízo é possível (receita abaixo do custo): o lucro negativo reduz o patrimônio. Patrimônio nunca fica negativo nas Fases A a F (o piso é zero).

### 3.2 De onde vem a receita

- Ponto único: **todo XP do app passa por `AwardXpUseCase`**, sempre com um `reason`. Uma port opcional chamada depois do XP gravado avisa o módulo de empresas, que converte em receita **só os motivos de uma lista fechada** (lição concluída, Diário, missão diária, revisão de lição antiga). Um tipo de XP novo só gera receita quando entrar na lista.
- **Dividendo da empresa nunca gera receita** (senão o XP do dividendo viraria receita, que viraria mais dividendo).
- **Teto diário de contribuição por membro**: uma pessoa não carrega a empresa sozinha. Isso incentiva ter mais gente ativa, não um só membro jogando muito.
- A atividade entra no **mês simulado do momento em que aconteceu**, lido do relógio do mercado pela mesma via do salário mensal (`PayrollCalendarReader`).

### 3.3 Porte

O patrimônio acumulado define o porte, e o porte define o teto de membros **com PRO** (sem PRO o teto é sempre 10, EJ3):

| Porte | Teto com PRO | Desbloqueia também |
|---|---|---|
| Startup | 10 | Brasão básico |
| Pequena | 15 | Cargo de Diretoria |
| Média | 20 | Mais opções de brasão e cor |
| Grande | 25 | Desafios entre empresas |
| Blue chip | 30 | Selo no ranking; no futuro, candidata a IPO |

Os valores de patrimônio de cada porte são calibrados na EJ.4.1 com dados reais de atividade (nunca chutados só pelo número de usuários de hoje).

### 3.4 Distribuir ou reinvestir

A cada fechamento, a política de distribuição da empresa (% do lucro) é aplicada sozinha: a parte distribuída vira dividendo (EP3) e o resto vira patrimônio. **Mudar a política é por votação dos membros**, reaproveitando o módulo `assemblies` (que já é genérico por `kind`, com política de voto e efeito plugáveis): um `kind` novo, voto de peso igual por membro ativo, efeito = nova política a partir do próximo período.

### 3.5 Competição

- **Ranking de empresas por ROE e por crescimento da receita, nunca por tamanho.** Uma Startup engajada pode passar uma Blue chip.
- **Desafio entre empresas** (a partir do porte Grande): duas empresas do mesmo setor, quem cresce mais a receita no período.

## 4. A estrutura pronta para dívida e IPO (EJ2)

O que precisa nascer certo agora, para dívida e IPO serem só tipos novos e não uma reescrita:

1. **Razão (livro) da empresa, só de inclusão.** Todo valor da empresa é uma linha imutável num razão (`player_company_ledger`): `revenue`, `cost`, `dividend`, `retained`. As demonstrações e os indicadores são calculados a partir do razão, nunca guardados como saldo editável. Dívida acrescenta `loan_draw`, `interest`, `loan_repayment`; IPO acrescenta `capital_raise`. Mesma filosofia de Event Sourcing do mercado, sem depender do motor.
2. **Demonstração por período com os campos do motor** (seção 3.1), já com dívida bruta e caixa, mesmo valendo zero.
3. **Período = mês simulado do relógio do mercado.** O motor fecha balanço por trimestre (91 dias, `engine/internal/domain/fundamentals/reportcycle.go`); três períodos da empresa somados formam o trimestre que o IPO vai precisar.
4. **Juros sempre de uma taxa lida por port.** Quando a Fase G chegar, a taxa vem da Selic simulada pela mesma porta de leitura do mercado; nada de taxa fixa no código.
5. **Capital social reservado no modelo, sem uso agora.** A tabela da empresa já tem o campo de número de ações (nulo até o IPO), para a Fase H decidir como as ações são divididas entre os membros sem migração destrutiva.

---

## Fase A, fundação (backend)

### EJ.1.1 · Domínio da empresa
- **Descrição:** módulo `backend/src/modules/playerCompanies/` (DDD lite). `domain/`: empresa (nome, sigla, setor, brasão, política de distribuição, campo de ações reservado), membro e cargos (Fundador, Diretoria, Sócio), razão com os tipos da seção 4, cálculo da demonstração por período a partir do razão (seção 3.1), indicadores (margem, ROE, crescimento), porte por patrimônio, teto de membros (porte + PRO, EJ3/EP1), conversão de atividade em R$ (EP2), teto diário por membro.
- **Dependências:** confirmar EP1 e EP2.
- **Aceite:** testes table-driven das fórmulas (iguais às das lições 2.7.x), do prejuízo (patrimônio com piso zero), do teto de membros (com e sem PRO, em cada porte) e de que a demonstração é a mesma recalculada do zero a partir do razão.

### EJ.1.2 · Tabelas e repositórios
- **Descrição:** migration com `player_companies`, `player_company_members` (UNIQUE por usuário: EJ5 garantido pelo banco, não só pelo código), `player_company_ledger` (só inclusão; sem UPDATE/DELETE pelo adapter), `player_company_statements` (demonstração fechada por período, para leitura rápida; recalculável do razão), `player_company_join_requests`. Nome e sigla únicos (sigla sem número no fim, para não parecer ticker do mercado).
- **Dependências:** EJ.1.1.
- **Aceite:** integração em banco descartável; tentar entrar em duas empresas falha pela restrição do banco; `when` do journal acima da última migration.

## Fase B, entrar, sair e o menu

### EJ.2.1 · Casos de uso de participação
- **Descrição:** fundar (EP5, nome e sigla passam por filtro de palavras), convidar, pedir para entrar, aprovar/recusar, entrar direto em empresa aberta (EP4), sair (com carência, EP6), remover membro (só Fundador/Diretoria), promover e rebaixar cargo, transferir fundação (EP1). Teto de membros conferido no servidor consultando `GetSubscriptionStatus` do fundador. Rotas com Zod; `.docs/backend/playerCompanies.md`.
- **Dependências:** EJ.1.2.
- **Aceite:** teste de cada regra (teto sem PRO, PRO vencido sem remover ninguém, carência, uma empresa por pessoa, permissões por cargo).

### EJ.2.2 · Menu de empresas (frontend)
- **Descrição:** área "Empresas" (EA2): **Minha empresa** (resumo, membros, convites), **Explorar** (lista com busca, filtro por setor e porte, empresas abertas primeiro, ordenação por ROE/crescimento), **Fundar** (formulário com prévia do brasão) e detalhe público de qualquer empresa. Mockup antes de implementar (padrão das telas-âncora). Selo da empresa no perfil público e no ranking.
- **Dependências:** EJ.2.1; EA1 e EA2 decididas.
- **Aceite:** responsivo nos três breakpoints (desktop com composição própria); telas no inventário; texto sem "—".

## Fase C, atividade vira receita e o balanço

### EJ.3.1 · Receita a partir do XP
- **Descrição:** port opcional depois do XP gravado em `AwardXpUseCase` (mesmo padrão de composição do `xpAwarder`/`streakTracker`), implementada pelo módulo de empresas: lista fechada de motivos (seção 3.2), conversão em R$, teto diário por membro, período pelo mês simulado (port no formato do `PayrollCalendarReader`). Falha ao registrar receita nunca derruba a concessão do XP (best-effort com log, como o registro de dia de atividade).
- **Dependências:** EJ.1.2.
- **Aceite:** XP de dividendo nunca vira receita; motivo fora da lista não vira receita; teto diário respeitado; teste de que o XP do usuário é concedido mesmo se o registro de receita falhar.

### EJ.3.2 · Fechamento do período
- **Descrição:** scheduler idempotente (formato do `runPayrollCheck`) que, quando o mês simulado vira, fecha o período de cada empresa: lança o custo (só membros ativos, EP7), calcula lucro, aplica a política de distribuição (dividendo + patrimônio), grava a demonstração, atualiza o porte. Licença automática de membros (EP7) avaliada no mesmo passo.
- **Dependências:** EJ.3.1.
- **Aceite:** fechar duas vezes o mesmo período não duplica nada; relógio do mercado parado = período não fecha (e fecha certo quando o relógio voltar, mesmo pulando mais de um mês); licença entra e sai sozinha.

### EJ.3.3 · Tela do balanço
- **Descrição:** na página da empresa: demonstração do último período, histórico (gráfico com altos e baixos, seguindo a regra de linha de progressão de `identidade-visual-padroes.md`), indicadores com "o que é isto" ligando ao Glossário/lição, contribuição de cada membro em % da receita (nunca patrimônio). Publicação do balanço no feed social ("BRAVO divulgou o balanço: receita +12%, margem 41%").
- **Dependências:** EJ.3.2, EJ.2.2.
- **Aceite:** valores batem com o razão; link de lição respeita o bloqueio da trilha; responsivo.

## Fase D, porte, PRO e dividendos

### EJ.4.1 · Porte e teto de membros com PRO
- **Descrição:** calibrar os limites de patrimônio de cada porte (seção 3.3) com a atividade real medida; desbloqueios de cada porte; convite ao PRO no ponto certo (Fundador tentando aceitar o 11º membro), sempre como convite. Ligar na página `/planos` (lista de vantagens do PRO).
- **Dependências:** EJ.3.2.
- **Aceite:** calibragem registrada aqui com os números usados; PRO vencido não remove ninguém; texto do convite sem pressão (regra de `estrategia-monetizacao.md`).

### EJ.4.2 · Política de distribuição por votação
- **Descrição:** `kind` novo no módulo `assemblies` (política de voto: um voto por membro ativo; efeito: nova política a partir do próximo período). Dividendo em XP com teto (EP3), só para quem foi membro o período inteiro (EP6).
- **Dependências:** EJ.3.2.
- **Aceite:** teste da política de voto e do efeito; dividendo respeita teto e elegibilidade.

## Fase E, competição e visibilidade

### EJ.5.1 · Ranking de empresas
- **Descrição:** ranking por ROE e por crescimento da receita (nunca por tamanho), mesma janela do ranking de usuários (RF17); entrada na tela de Classificação ou no menu de Empresas.
- **Dependências:** EJ.3.2.
- **Aceite:** empresa com 1 período só não entra (amostra mínima); teste do desempate.

### EJ.5.2 · Desafio entre empresas
- **Descrição:** a partir do porte Grande, duas empresas do mesmo setor, um período, vence quem cresce mais a receita. Resultado no feed.
- **Dependências:** EJ.5.1, EJ.4.1.
- **Aceite:** uma empresa num desafio por vez; desafio atravessa corretamente um fechamento de período.

## Fase F, moderação

### EJ.6.1 · Moderação e painel admin
- **Descrição:** filtro de palavras em nome e sigla (lista versionada); admin pode renomear, suspender e encerrar empresa (ações auditadas, padrão do painel); denúncia não entra nesta fase (fora do lançamento, mesma regra de bloqueio/denúncia entre usuários).
- **Dependências:** EJ.2.1.
- **Aceite:** toda ação gera auditoria; empresa suspensa some do Explorar e do ranking, membros são avisados.

## Fase G, dívida (precisa de documento de decisão antes)

- Empréstimo com juros pela **Selic simulada** (port de leitura do mercado), para chegar antes ao próximo porte. Lança `loan_draw`, `interest` e `loan_repayment` no razão; o EBIT passa a ser diferente do lucro; aparece dívida líquida ÷ EBIT.
- Perguntas para o documento: quem decide pegar dívida (votação?), limite de endividamento, o que acontece se o lucro não cobrir os juros (perda de porte?), se o prejuízo pode deixar o patrimônio negativo.

## Fase H, IPO (precisa de documento de decisão antes; toca o motor)

- Empresa Blue chip vira ativo negociável no mercado simulado; o motor lê os balanços da empresa (três períodos somados = um trimestre) como os de qualquer empresa listada.
- Perguntas para o documento: como as ações se dividem entre os membros (campo de capital já reservado), float, cobertura de Market Maker (teto atual de 10 ativos por Market Maker), regra de insider (os membros conhecem o balanço antes: período de vedação antes da divulgação, como na regra real da CVM), manipulação por compra combinada, e o que acontece com a empresa listada se os membros pararem.

---

## Sequência sugerida

1. **EJ.1.1 → EJ.1.2** (fundação).
2. **EJ.2.1 → EJ.2.2**: já dá para fundar, entrar e explorar. Decidir **EA1 e EA2** antes da EJ.2.2.
3. **EJ.3.1 → EJ.3.2 → EJ.3.3**: a empresa ganha vida (receita, balanço, feed).
4. **EJ.4.1, EJ.4.2**, depois **EJ.5.1, EJ.5.2** e **EJ.6.1**. A EJ.6.1 precisa estar pronta **antes de publicar** a funcionalidade para usuários reais (nomes livres).
5. Fases G e H só depois de as empresas se provarem, cada uma com o próprio documento.

**Relação com o Diário (`backlog-diario.md`):** o Diário concluído no app é um dos motivos de XP que geram receita (seção 3.2). As duas frentes são independentes; se o Diário vier primeiro, a lista de motivos da EJ.3.1 já o inclui.
