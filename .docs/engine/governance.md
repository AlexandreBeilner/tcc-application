# Governança corporativa (`internal/domain/corporategovernance`)

Lado do motor da **Assembleia de Acionistas** (MO.6.2). O backend (módulo `assemblies`) é dono do ciclo da assembleia, dos votos e da apuração; o motor é dono das **posições** e dos **fundamentos**, então só faz três coisas: tira o snapshot de posições na data de corte, registra a decisão aprovada como evento imutável e aplica o efeito aos poucos. Rotas internas (só o backend as chama, mesmo trust boundary de `POST /admin/tick`); sem `httpserver.WithGovernance` respondem `503`.

Ids de assembleia e de empresa são UUIDs (`400` se não forem).

### `GET /governance/reports`

- **Autenticação:** interna (rede do Compose, via backend)
- **Payload:** query `min_days` e `max_days` (inteiros, `0 <= min_days <= max_days <= 400`).
- **Sucesso:** `200` → `{ simulated_day, reports: [{ company_id, name, sector, tickers, report_day, days_since_report }] }`: o **último balanço já divulgado** de cada empresa com ação negociável no Mercado Ao Vivo, só quando ele saiu entre `min_days` e `max_days` dias antes do dia corrente. `tickers` vêm com a ON antes da PN. Ordem estável por nome.
- **Erros:** `400` parâmetros ausentes, não inteiros ou janela inválida · `503` serviço desligado
- **Regra:** é o gatilho de abertura das assembleias (MO.6.3). O calendário (`GET /market/calendar`) só mostra um `report` global, sem empresa; o dia real de cada balanço depende do atraso próprio (`report_offset_days`) e do dia de corte do escalonamento, então sai de `paymentschedule.DaysSinceReport`. O backend pede "balanço de 2 a 9 dias atrás" (atraso de abertura até o limite de recuperação depois de uma parada) e a idempotência da abertura é dele (`dedupe_key` por empresa e dia de balanço). Empresa só com ativo sandbox fica de fora; antes do primeiro balanço, ou no dia 0, devolve lista vazia.

### `POST /governance/snapshots`

- **Autenticação:** interna (rede do Compose, via backend)
- **Payload:** `{ "assembly_id": uuid, "company_id": uuid }`
- **Sucesso:** `201` na primeira chamada, `200` nas repetições (mesma foto). Corpo: `{ assembly_id, company_id, taken_at, simulated_day, holdings: [{ user_id, quantity }] }`.
- **Erros:** `400` corpo ou UUID inválido · `404` empresa inexistente · `503` serviço desligado
- **Regra:** foto das posições da empresa **no instante da primeira chamada** (o backend chama na abertura da assembleia). Só contas de usuário (`is_bot` fora), ações somadas entre classes (ON e PN), só quantidade positiva. **Idempotente pelo id da assembleia**: vender ou comprar depois do corte não muda a foto, e uma empresa sem acionista de usuário gera um snapshot vazio que também é devolvido igual nas repetições.

### `GET /governance/snapshots/{assembly_id}`

- **Sucesso:** `200` com o mesmo corpo acima. **Erros:** `400` id inválido · `404` sem snapshot.

### `POST /governance/decisions`

- **Autenticação:** interna
- **Payload:** `{ "assembly_id": uuid, "company_id": uuid, "option_key": string, "declaration_id": uuid?, "effects": [ { "metric": "base_growth_pct" | "quality_multiplier" | "payout_ratio_pct" | "pn_dividend_premium_pct", "direction": 1 | -1, "intensity": (0, 1] } | { "metric": "dividend_policy", "value": "quarterly" | "semiannual" | "annual" } ] }`. A **política de dividendo** é um efeito discreto: traz só o `value` (valor-alvo), sem sentido nem intensidade. De **1 a 2 efeitos, em métricas diferentes** (MO.6.10); o formato antigo com um `effect` único ainda é aceito e vale como lista de um. Os efeitos vêm do catálogo de pautas do backend e **nunca trazem valor absoluto**: o tamanho máximo da mudança é do motor.
- **Sucesso:** `201` na primeira chamada, `200` nas repetições (devolve a decisão original, **sem novo evento nem novo efeito**). Corpo: `{ assembly_id, company_id, option_key, decided_at, effects: [{ metric, direction, intensity, value?, status, total_delta, ramp_ticks, start_day, applied_ticks, applied_delta }] }`, um item por efeito, na ordem pedida. `total_delta` e `applied_delta` em **centésimos** com sinal (crescimento: 50 = +0,50 p.p.; qualidade: 5 = +0,05; payout: 1000 = +10 p.p.; prêmio da PN: 500 = +5 p.p.; política: 0, o valor-alvo vai em `value`).
- **Erros:** `400` corpo/UUID/efeito inválido (métrica desconhecida, direção fora de ±1, intensidade fora de (0, 1], opção vazia, nenhum efeito, mais de 2 efeitos ou métrica repetida) · `404` empresa inexistente · `503` serviço desligado
- **Regra:** numa transação travada pela assembleia e pela empresa: (1) planeja **cada efeito por conta própria** com o estado real da empresa (um efeito em cooldown ou fora da faixa não impede o outro), (2) **grava primeiro um evento `assembly_decision` em `market_events` por efeito** (conta técnica de governança, `reference_id` = id da assembleia, `quantity` = mudança total em centésimos, `0` se não houve efeito; `governance_decision_effects.event_id` liga cada evento ao seu efeito e à métrica), (3) grava a decisão e os efeitos. O efeito só acontece depois, nos ticks. Status de cada efeito: `scheduled` (rampa em andamento), `completed`, `skipped_cooldown` (a empresa mudou aquele grupo há menos dias que o cooldown: fica registrado, nada muda) `skipped_out_of_range` (o efeito levaria o valor para fora da faixa válida) e `skipped_not_applicable` (não muda nada na empresa: a política já é a escolhida, ou o prêmio da PN numa empresa sem ação PN).

### `GET /governance/decisions/{assembly_id}`

- **Sucesso:** `200` com o corpo acima (acompanha a rampa de cada efeito). **Erros:** `400` id inválido · `404` sem decisão.

### `GET /governance/pending-declarations`

- **Autenticação:** interna (rede do Compose, via backend)
- **Sucesso:** `200` → `{ declarations: [{ id, company_id, name, sector, tickers, cycle_index, report_day, held_day, days_held, safety_deadline_day, decision_assembly_id, release_requested, release_reason? }] }`: as **declarações de dividendo retidas** (ainda sem provento; `days_held` são os dias simulados desde que ficou retida), da mais antiga para a mais nova. É o gatilho da assembleia de **destinação do lucro** (MO.6.13). Não devolve o lucro do pool.
- **Erros:** `503` serviço desligado
- **Regra:** ver "Declaração pendente" abaixo.

### `POST /governance/pending-declarations/{id}/release`

- **Autenticação:** interna
- **Payload:** `{ "reason": "no_decision" | "admin" }`. `no_decision` é a assembleia que fechou sem decisão (sem quórum, empate, sem pauta) ou o recurso desligado ou pausado; `admin` é a liberação manual do painel. Qualquer outro motivo (inclusive `decision`, que só o motor atribui) é `400`.
- **Sucesso:** `200` → `{ id, release_requested: true }`. O dividendo sai **no próximo tick**, com o payout vigente.
- **Erros:** `400` id, corpo ou motivo inválido · `404` declaração inexistente · `503` serviço desligado
- **Regra:** idempotente. Pedir de novo, ou para uma declaração que já saiu, não muda nada, e o primeiro motivo vale.

### `GET /governance/companies/{company_id}/standing?user_id=`

- **Autenticação:** interna (rede do Compose, via backend)
- **Payload:** `company_id` (path) e `user_id` (query), ambos UUID.
- **Sucesso:** `200` → `{ company_id, name, sector, holds_shares, cooldown_days_left }`. `holds_shares` é a posição **de agora** da pessoa na empresa (conta de usuário, ON e PN somadas, quantidade positiva), não a foto de nenhum snapshot. `cooldown_days_left` são os dias simulados que faltam para a empresa poder mudar de novo (`0` = livre), calculados com `governance_cooldown_days` e o início do último efeito de **fundamentos** que valeu (`scheduled` ou `completed`; `skipped_*` não conta; o payout tem cooldown próprio e ainda não entra aqui, vem na MO.6.13).
- **Erros:** `400` UUID inválido ou ausente · `404` empresa inexistente · `503` serviço desligado
- **Regra:** é o que o backend consulta antes de aceitar uma **proposta de pauta ou um apoio** (MO.6.5): só acionista de hoje propõe e apoia, e uma empresa em período de espera não recebe pauta nova na fila. Não devolve quantidade de ações nem dado de outra pessoa.

## O efeito

- **Fundamentos nunca mexem no preço.** Dois botões que toda empresa já tem: `companies.base_growth_pct` (crescimento base, em pontos percentuais) e `companies.quality_multiplier` (margem e alavancagem). O preço continua vindo da negociação dos bots reagindo aos fundamentos. Nenhuma cotação é escrita por esta rota ou pelo passo do tick.
- **Payout por empresa (MO.6.10).** O terceiro botão, `companies.payout_ratio_pct` (padrão 50, o valor da constante global que valia antes, então empresa sem decisão paga igual a hoje), é a fração do lucro distribuída em cada balanço. Entra no valor por ação do provento (`dividend.EquityValuePerShare`) e no efeito de preço do provento (`dividend.EquityPriceEffectPct`), ambos por empresa; valor não positivo vale o padrão. O payout **não tem rampa**: vale inteiro no tick seguinte à decisão (um passo de 1 tick pelo mesmo mecanismo dos demais). Mexe só no **próximo** provento; o já declarado segue como estava.
- **Política de dividendo e prêmio da PN (MO.6.12).** Mais duas alavancas de destinação do lucro: `companies.dividend_policy` (trimestral, semestral ou anual) é **discreta**, troca para o valor-alvo da pauta; `companies.pn_dividend_premium_pct` (a vantagem da PN sobre a ON) anda em degraus de 5 p.p. (`governance_premium_step_centipp`), com o **piso legal de 10%** e teto de 30% (`governance_premium_min_pct` e `_max_pct`; o mínimo nunca desce de 10). Valem inteiras no tick seguinte à decisão, sem rampa. Payout, política e prêmio **dividem o mesmo cooldown** (grupo "destinação do lucro", `governance_payout_cooldown_days`). O evento imutável da política guarda em `quantity` quantos ciclos de lucro cada pagamento passa a ter (1, 2 ou 4), ou 0 se a troca não se aplicou; o do prêmio, a mudança em centésimos de p.p.
- **Faixa máxima por decisão** (em centésimos): `governance_growth_step_centipp` (padrão 50 = 0,50 p.p.), `governance_quality_step_centi` (padrão 5 = 0,05) e `governance_payout_step_centipp` (padrão 1000 = 10 p.p.). A mudança total é `direction × faixa × intensity`, arredondada, e nunca passa da faixa. O payout resultante precisa ficar entre `governance_payout_min_pct` (20) e `governance_payout_max_pct` (90); senão o efeito fica `skipped_out_of_range`.
- **Aplicação gradual (crescimento e qualidade):** linear em `governance_ramp_ticks` ticks (padrão 30), começando no tick seguinte à decisão (`start_day = dia corrente + 1`). Toda a conta é em centésimos inteiros, então a soma dos passos fecha **exatamente** no total, e recuperar ticks em lote depois de uma parada dá o mesmo resultado de um por vez. Determinístico (RNF08): nenhum sorteio.
- **Efeito composto:** uma opção tem de 1 a 2 efeitos, em métricas diferentes, planejados e aplicados cada um por conta própria (cada um com o seu status, rampa e andamento).
- **Cooldown por grupo, por empresa:** crescimento e qualidade dividem o cooldown de **fundamentos** (`governance_cooldown_days`, padrão 90, "uma mudança por trimestre"); o payout tem o **seu** (`governance_payout_cooldown_days`, padrão 90), independente. `0` desliga a trava do grupo.
- **Quem aplica:** `tick.Service` chama `ApplyDue(novoDia)` ANTES de ler as empresas do tick (opcional, `WithGovernance`). Cada passo é transacional com a mudança na empresa e idempotente (`applied_ticks` confere o estado anterior), então repetir um tick não aplica duas vezes. **Uma falha na governança é logada e nunca derruba o tick do mercado**; o passo é recuperado no seguinte. Se alguém editar a empresa no meio da rampa e o próximo passo sair da faixa válida, o efeito é encerrado como `skipped_out_of_range` e nada muda.

## Declaração pendente (MO.6.11)

Para a assembleia decidir o destino do lucro **antes** de o dividendo sair, o motor adia a declaração do dividendo do balanço:

1. **Retenção (no tick do balanço):** a empresa que paga provento naquele balanço (a política trimestral, semestral ou anual decide quais pagam) **não declara**. O motor grava em `governance_pending_declarations` o lucro do pool e o dia do balanço, atomicamente com o resto do tick. O balanço (fundamentos) sai normalmente. Só retém quando **todas** estas condições valem: `governance_hold_declarations` ligado, a empresa tem **acionista de usuário** (bot não conta; sem acionista ninguém vota), o payout está **fora de cooldown** (`governance_payout_cooldown_days`) e a empresa **não tem outra retida**. Nos demais balanços o dividendo sai como sempre, com o payout vigente. Dividendo já declarado antes continua no calendário dele.
2. **Liberação:** a declaração sai num tick por um destes motivos, nesta ordem de prioridade: **pedido** (`POST .../release`, motivo `no_decision` ou `admin`); **decisão** (`declaration_id` na decisão, depois que o efeito de payout dela foi aplicado, então o dividendo sai com o payout novo); **prazo de segurança** (`governance_declaration_safety_days`, padrão 60, máximo 80, sempre abaixo do ciclo de 91 dias; `expired`, payout vigente). O motivo fica gravado em `release_reason`.
3. **O provento:** vira `dividend_events` pelo caminho de sempre (snapshot de elegíveis na data-ex, pagamento no dia de pagamento), com as **datas contadas a partir do dia da liberação**: empresa com agenda, data-com, data-ex e pagamento em dia útil depois dela; sem agenda (legado), ex na liberação e pagamento 5 dias corridos depois. O valor por ação é o lucro do pool vezes o payout **da empresa na liberação** e o prêmio da PN **da liberação**, repartido entre ON e PN como sempre. O pool é recalculado **com a política vigente na liberação** (a assembleia pode tê-la trocado): os lucros dos últimos 1, 2 ou 4 balanços persistidos, o do balanço retido sendo o mais recente. Se a política nova **não paga aquele balanço**, nada sai agora (a declaração sai do estado retido sem data-ex) e o lucro entra no pool do próximo balanço que pagar, como em qualquer empresa dessa política.
4. **Preço:** o efeito de preço do provento (a queda do preço justo na data-ex) segue a data-ex **real**: o ciclo retido não tem efeito algum, e o liberado com atraso conta a banda a partir da data-ex dele.

Retenção desligada (o padrão) ou nenhuma decisão ligada: o motor paga exatamente como antes da MO.6.11. Tudo é idempotente: reter de novo o mesmo ciclo é ignorado e liberar de novo não duplica o provento. Uma falha na leitura da política ou das ordens é logada e nunca derruba o tick (nada é retido nem liberado naquele tick; o seguinte recupera). A retenção só deve ficar ligada **junto da Assembleia no backend** (`ASSEMBLIES_ENABLED=on`), senão o dividendo espera o prazo de segurança sem motivo.

## Parâmetros (`enginesetting`)

Treze chaves, editáveis em runtime pelo mesmo mecanismo do ritmo do Temporizador (`GET/PUT/DELETE /admin/settings`, ver `admin.md`): `governance_growth_step_centipp` (1 a 500), `governance_quality_step_centi` (1 a 50), `governance_ramp_ticks` (1 a 365), `governance_cooldown_days` (0 a 720) e, da MO.6.10, `governance_payout_step_centipp` (1 a 5000, padrão 1000), `governance_payout_min_pct` (0 a 100, padrão 20), `governance_payout_max_pct` (0 a 100, padrão 90), `governance_payout_cooldown_days` (0 a 720, padrão 90) e, da MO.6.11, `governance_hold_declarations` (0 ou 1, padrão **0**) e `governance_declaration_safety_days` (1 a 80, padrão 60); da MO.6.12, `governance_premium_step_centipp` (1 a 2000, padrão 500), `governance_premium_min_pct` (10 a 100, padrão 10) e `governance_premium_max_pct` (10 a 100, padrão 30). Mínimo maior que máximo faz todo efeito de payout ser ignorado por fora da faixa.

## Tabelas (migrations `000051` a `000054`)

`governance_snapshot_runs` (uma por assembleia, mesmo vazia) e `governance_snapshot_holdings` (uma por usuário com posição); `governance_decisions` (uma por assembleia, `assembly_id` único: empresa e opção); `governance_decision_effects` (de 1 a 2 por decisão, `position` 0 ou 1, métrica, sentido, intensidade, status e andamento da rampa, `event_id` do evento imutável; migração `000052`, que também move para cá as decisões antigas como o efeito de posição 0); `companies.payout_ratio_pct` (numeric(5,2), padrão 50); em `governance_decision_effects`, `target_value` (política) e `direction`/`intensity` anuláveis (migração `000054`); `governance_pending_declarations` (uma por empresa e ciclo, `status` `held` ou `released`, lucro do pool, assembleia ligada, pedido de liberação, motivo, dia e data-ex da liberação; migração `000053`); `market_events.reference_id` (uuid, id da assembleia) e o valor `assembly_decision` do enum `market_event_type`. A **conta técnica de governança** (`00000000-0000-4000-8000-00000000a550`, `is_bot`, inativa, sem linha em `users`) é criada na primeira decisão, não na migração, e não conta como bot de liquidez no painel nem entra em ranking ou social.

## Valores de lançamento aprovados (MO.6.9, 2026-10-11)

O autor aprovou como **padrão de lançamento** (não calibração final): degrau de crescimento 50 (0,50 p.p.), degrau de qualidade 5 (0,05), rampa de 30 ticks e cooldown de 90 dias simulados. Base: ensaio de 12 meses simulados com 84 empresas e 200 usuários (`tmp/relatorio-calibracao-assembleia.md`). Os valores de crescimento, qualidade, rampa e cooldown já são os padrões do código (`DefaultGovernance*` em `enginesetting`) e agora há um teste com os números literais. Revisar com dado de eleitorado real.


## Valores do payout (decisão do autor, 2026-10-11, MO.6.10)

Degrau de 10 p.p. por decisão (vezes a intensidade), faixa válida por empresa de 20% a 90%, sem rampa e cooldown próprio de 90 dias simulados, compartilhado com a política de dividendo e o prêmio da PN (degrau de 5 p.p., de 10% a 30%). Ainda **não calibrados em escala**: a recalibração de 12 meses roda depois da MO.6.15.
