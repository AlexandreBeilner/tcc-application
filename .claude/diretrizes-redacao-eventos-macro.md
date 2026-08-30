# Diretrizes de redação — catálogo de eventos macro

Guia pra quem (humano ou uma sessão do Claude Code) for **expandir o catálogo estático** de templates de evento macro (`engine/internal/domain/macroevent/templates.go`). Não cobre o fluxo de evento avulso digitado pelo admin na tela 10.2 — só o catálogo pré-cadastrado. Nasceu da tarefa 6.6.3 (backlog): sem uma diretriz escrita, cada sessão reinventa o tom e o formato, e o objetivo pedagógico do RF16 ("preço reage à expectativa, resultado confirma depois") se perde template a template.

## 1. Onde isso se encaixa

- `Templates` é um catálogo estático em código Go — não existe (nem está previsto) nenhuma geração de narrativa por IA em runtime. Este documento orienta redação humana/assistida, não um prompt de produção.
- O catálogo espelha, linha a linha, a tabela da spec `especificacao-plataforma-investimentos.md` §3.3.2 (hoje 10 templates). **Adicionar um template novo em `templates.go` exige também adicionar a linha correspondente na spec** — o código não é a fonte da verdade sozinho, os dois têm que bater (é o que `TestTemplates_DezTemplatesBatemComATabelaDaSpec` verifica; o nome do teste vai ficar desatualizado ao passar de 10 templates, renomear junto).
- `Template` **nunca** carrega setor/`risk_class`/ativo — esse alvo é sempre escolhido pelo admin no disparo (`macroeventtrigger.TargetInput`, tela 10.2), mesmo pra um evento nascido de template. Este guia sugere, como comentário de autoria (não como campo do schema), que setores combinam com cada template — ver seção 7.

## 2. Regra de ouro: a narrativa nunca entrega o veredito

Da tarefa 6.6.3: enquanto o evento está `pendente`, o Feed de Notícias mostra só título + narrativa — o badge de direção (Alta/Baixa/Misto), a magnitude e o efeito numérico ficam escondidos até o evento virar `aplicado`. Isso só cumpre o objetivo pedagógico se o texto, sozinho, não disser a resposta.

**Teste rápido antes de aprovar um título/narrativa:** dá pra apagar o verbo de veredito (beneficia/prejudica/eleva lucro/reduz receita/melhora/piora/anima o mercado) e ainda sobrar uma frase que descreve um fato concreto (o quê aconteceu, o mecanismo)? Se a frase inteira *é* o veredito ("Isso é positivo pro setor"), reescreva contando a causa (o que mudou) e deixe a conclusão pro leitor.

> ⚠️ **Nota de retrabalho conhecida:** vários dos 10 templates atuais já quebram essa regra no próprio **título**, não só na narrativa — "Alta internacional do minério de ferro **beneficia** exportadoras", "beneficia exportadoras, **prejudica** importadoras". O título aparece sempre no resumo do evento (`NewsEventList`), mesmo com o evento `pendente` — esconder só o badge estruturado não resolve nada se o título já entrega a resposta. Revisar esses títulos é escopo da tarefa 6.6.3 (implementação), não deste documento (que vale pra templates novos daqui pra frente).

## 3. Variedade de formato — não repita sempre a mesma estrutura de frase

Os 10 templates atuais já cobrem uma boa variedade de categoria, mas tendem a uma estrutura parecida ("[mudança X] eleva/reduz [métrica Y] de [setor Z]"). Pra evitar que todo evento novo leia igual, seguem arquétipos de narrativa — cada um com uma "forma" de frase diferente. Use como ponto de partida, não como fórmula rígida:

| Arquétipo | Estrutura típica | Exemplo (genérico, sem entregar veredito) | Combinação sugerida |
|---|---|---|---|
| Regulatório/legal | Uma norma muda uma regra do jogo pro setor | "Uma nova norma [muda requisito X] pras empresas do setor, com prazo de adequação de [Y meses]." | `AffectsFundamentals=true`, banda conforme o alcance da norma |
| Commodity/preço internacional | Preço de uma commodity varia lá fora, ecoa aqui | "O preço de [commodity] no mercado internacional [sobe/cai] N dias seguidos, reagindo a [fator externo]." | `AffectsPrice=true` + `AffectsFundamentals=true` (efeito imediato e estrutural) |
| Resultado corporativo/contábil | Um evento pontual de uma empresa (sem nomear qual) | "Uma auditoria [interna/externa] identifica [inconsistência/oportunidade] nos números do último ciclo." | Direction depende do achado; banda Severo se for confiança/contábil |
| Cambial | Câmbio se move, efeito bifurca por exposição | ver seção 4 (sempre Misto) | `Direction=Misto` |
| Geopolítico/comércio | Tensão externa mexe em cadeia de suprimento/logística | "Uma disputa entre [blocos/países] atrasa o fluxo de [insumo/produto] usado pela cadeia produtiva do setor." | Geralmente só `AffectsPrice` (reação imediata, sem dado contábil novo ainda) |
| Clima/produção (agro/energia) | Evento físico muda oferta, efeito varia por quem já tinha estoque | ver seção 4 (Misto) | `Direction=Misto` |
| Tecnológico/ruptura | Uma nova tecnologia/concorrente muda a demanda do setor | "Um novo entrante com [modelo de negócio/tecnologia] começa a disputar a base de clientes do setor." | `AffectsFundamentals=true`, efeito só aparece no próximo ciclo |
| Crédito/juros | Custo de capital muda, aperta ou libera investimento | "O custo de captação do setor [sobe/cai] depois de uma mudança nas condições de crédito disponíveis." | `AffectsFundamentals=true` |
| Trabalhista | Greve/negociação coletiva afeta operação | "Uma paralisação [de categoria] reduz a capacidade operacional das empresas do setor por [duração]." | `AffectsPrice=true`, banda Leve/Moderado conforme duração |
| Fusão/parceria/expansão | Anúncio estratégico, sem resultado concreto ainda | "A empresa anuncia [parceria/expansão] com expectativa de resultado só nos próximos ciclos." | `AffectsPrice=true` apenas (mercado precifica expectativa, fundamentos ainda não mudaram) |

Não é obrigatório usar todos — é banco de ideias pra não convergir sempre pro mesmo "nova lei eleva custo".

## 4. Direção "Misto" precisa das duas pontas na própria narrativa

O motor sorteia **um único sinal** pro evento inteiro (limitação documentada em `macroevent/magnitude.go`, `sampleMagnitudeAndSign`) — não existe "metade positiva, metade negativa" calculada separadamente por alvo. Então quando `Direction = Misto`, a narrativa **precisa** descrever as duas pontas do mercado explicitamente (quem ganha, quem perde, e por quê), porque é a única explicação do "misto" — o número aplicado depois vai ser só um sinal, cabendo ao admin decidir, ao escolher o alvo no disparo, de que lado do evento ele está mirando. Sem as duas pontas na narrativa, "Misto" não faz sentido pro leitor.

## 5. Escolhendo Direction/Band/AffectsPrice/AffectsFundamentals

- **Banda** (`especificacao-plataforma-investimentos.md` §3.3.2): Leve (±3–5% preço / ±5–10% fundamentos), Moderado (±8–12% / ±10–20%), Severo (±15–25% / ±20–35%). Escolha pelo alcance do fato narrado (uma nova lei setorial tende a Moderado; um escândalo contábil tende a Severo; um ajuste regulatório pontual tende a Leve) — não pelo "quão dramático" o texto soa.
- **AffectsPrice** (efeito imediato, alguns dias) vs. **AffectsFundamentals** (só aparece no próximo relatório trimestral): eventos com reação imediata clara do mercado (rumor, expectativa, anúncio) tendem a `AffectsPrice`; eventos que mudam estrutura de custo/receita real tendem a `AffectsFundamentals`; muitos fazem sentido nos dois ao mesmo tempo (mercado reage na hora *e* o resultado confirma depois — é literalmente o RF16). Não marque os dois por padrão só pra "cobrir tudo" — o template `expansao-parceria-corporativa` é `AffectsPrice`-only de propósito (expectativa pura, sem fundamento novo ainda).

## 6. Tom e tamanho

- **Título:** uma linha, nomeia o fato, evita verbo de veredito quando der (ver seção 2).
- **Narrativa:** 1–2 frases, pt-BR, descreve o mecanismo concreto (o que mudou, por que isso mexe com custo/receita/demanda), sem jargão não explicado.
- **Nunca cita empresa/ativo específico do catálogo real** — o template é genérico por design (o alvo concreto é escolhido no disparo, seção 1). Nomear uma empresa fictícia no texto do template criaria uma referência que não existe em `companies`.

## 7. Sugestão de setor (comentário de autoria, não campo do schema)

Já que `Template` não carrega alvo, deixe uma sugestão de setor como comentário Go acima da entrada no catálogo, pra quem for disparar saber que setor combina — mesmo espírito da tabela abaixo (baseada nos 6 setores fixos, `catalog.Sector`):

| Categoria | Setor(es) que fazem mais sentido como alvo sugerido |
|---|---|
| Regulatório | Depende da norma — nomear no comentário caso a caso |
| Commodities | Mineração, Agronegócio, Energia |
| Setorial (Tecnologia) | Tecnologia |
| Setorial (Bancário) | Bancário/Financeiro |
| Corporativo | Qualquer um — é sobre uma empresa específica, não o setor inteiro (ver nota do pacote `macroevent`: "empresa específica" como alvo sempre vira um `asset_id`, nunca um campo próprio) |
| Cambial | Depende da narrativa (exportador vs. importador) — nomear os dois lados no comentário |
| Geopolítico | Setores expostos a comércio internacional (tipicamente Mineração, Agronegócio, Energia) |
| Agronegócio | Agronegócio |

## 8. Checklist antes de adicionar um template

- [ ] Título passa no teste da seção 2 (não entrega o veredito sozinho).
- [ ] Narrativa passa no mesmo teste.
- [ ] Se `Direction = Misto`, a narrativa cobre as duas pontas (seção 4).
- [ ] `Band`/`AffectsPrice`/`AffectsFundamentals` condizem com a natureza do fato (seção 5), não escolhidos por "soar mais dramático".
- [ ] `Category` reaproveita uma das existentes quando fizer sentido; nova categoria só se nenhuma das atuais couber.
- [ ] `Key` é kebab-case e único (`TestTemplates_ChavesUnicas` cobre isso, mas confira antes).
- [ ] Comentário de sugestão de setor adicionado (seção 7), mesmo não sendo campo do schema.
- [ ] Linha nova adicionada em `especificacao-plataforma-investimentos.md` §3.3.2 (tabela do catálogo).
- [ ] `TestTemplates_DezTemplatesBatemComATabelaDaSpec` atualizado com a entrada nova (e renomeado se "dez" não bater mais).
- [ ] `go test ./...` e `golangci-lint run` (via Docker, ver memória de sessão) verdes.
