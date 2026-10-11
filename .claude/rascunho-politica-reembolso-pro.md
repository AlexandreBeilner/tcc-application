# Rascunho — Política de Reembolso do Selucra PRO

> **RASCUNHO PARA REVISÃO DO CONTADOR/ADVOGADO (MO.1.2, LW.4.2). Não publicar no app.**
> Escrito em 2026-10-11. `[PREENCHER ...]` marca o que depende do autor.
> Escopo: só a **web** (lançamento só web, 2026-10-10). Reembolso por loja (Apple/Google) fica fora até o app voltar.

## Política de Reembolso

**Última atualização:** `[PREENCHER: data de vigência]`

### 1. Direito de arrependimento (7 dias)

Como a assinatura é contratada pela internet, você pode desistir em até **7 dias corridos** contados da
**contratação** (do primeiro pagamento), sem precisar dar motivo, conforme o art. 49 do Código de Defesa do
Consumidor. Você recebe de volta **o valor integral** pago na contratação.

- Vale para **a primeira contratação** de cada plano (mensal ou anual).
- `[PREENCHER: decidir se o prazo de 7 dias reinicia a cada renovação. Recomendação: não reinicia; a renovação
  é coberta pelo cancelamento do item 3.]`
- Se você usou capacidades PRO nesse período, o reembolso continua integral. `[PREENCHER: confirmar com
  advogado, o art. 49 não prevê desconto por uso.]`

### 2. Como pedir

Envie um e-mail para `[PREENCHER: e-mail de suporte]` informando o e-mail da sua conta e que deseja desistir.
Responderemos em até `[PREENCHER: prazo, sugestão 3 dias úteis]`.
`[PREENCHER: decidir se haverá botão de pedido dentro de "Gerenciar assinatura". Hoje não existe.]`

### 3. Depois dos 7 dias

Passado o prazo, não há reembolso do período já pago, mas você pode **cancelar a qualquer momento** e manter o
PRO até o fim do período pago, sem nova cobrança. O cancelamento é feito em "Gerenciar assinatura".

`[PREENCHER: avaliar se haverá reembolso proporcional do plano anual em casos específicos, como cobrança em
duplicidade ou falha do serviço.]`

### 4. Cobrança indevida ou duplicada

Se você foi cobrado por engano (duplicidade, cobrança após cancelamento dentro do prazo), devolvemos o valor
indevido integralmente.

### 5. Como e quando o dinheiro volta

O reembolso é feito pelo Stripe, **no mesmo cartão** usado na compra. O prazo para aparecer na fatura depende da
operadora do cartão, normalmente `[PREENCHER: confirmar prazo praticado, em geral 5 a 10 dias úteis]`.

### 6. O que acontece com a conta

Com o reembolso, o PRO é encerrado. **Seu progresso não é apagado** (ver Termos de Assinatura, item 9).

### 7. Pagamentos feitos por loja de aplicativos

Não se aplica ao lançamento atual, que é somente web. `[PREENCHER: texto quando o app voltar; reembolso é
decidido por Apple ou Google.]`

---

## Operação interna (não vai para o app)

- No RevenueCat/Stripe, o reembolso deve ser feito pelo painel do Stripe; o webhook do RevenueCat encerra o
  entitlement e o backend sincroniza o status (`billing`). **Conferir na hora** o comportamento real.
- Registrar no controle fiscal o estorno junto da nota (item pendente do contador).
