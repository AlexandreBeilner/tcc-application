# Rascunho — Seção de operadores (RevenueCat e Stripe) da Política de Privacidade

> **RASCUNHO PARA REVISÃO DO CONTADOR/ADVOGADO (MO.1.2, LW.4.2). Não publicar no app ainda.**
> Escrito em 2026-10-11 no molde da EM.8.2 (parágrafo do Resend em `frontend/src/pages/PrivacidadeLgpd`).
> Destino quando aprovado: seção **5. Compartilhamento** de `frontend/src/pages/PoliticaPrivacidade/index.tsx`
> e linhas novas na tabela da seção 3 (dados) e na seção 7 (retenção). `[PREENCHER ...]` depende do autor.
> **Confirmar nas páginas oficiais antes de publicar:** sede e local de tratamento de cada operador, contrato
> de tratamento de dados (DPA) e o que cada um de fato recebe. Não afirmado aqui como fato verificado.

## Texto proposto

### Em "3. Dados que coletamos" (linhas novas da tabela)

| Dado | Para quê | Base legal |
|---|---|---|
| Plano contratado, datas de início e renovação, situação da assinatura e identificador da assinatura | Liberar e encerrar as capacidades PRO e cobrar corretamente | Execução de contrato (art. 7, V) |
| Valor e data de cada cobrança, final do cartão e bandeira (não o número completo) | Mostrar o histórico e atender pedidos de reembolso | Execução de contrato (art. 7, V) |
| Dados fiscais necessários à nota fiscal `[PREENCHER: o que o contador exigir, ex. CPF]` | Cumprir obrigação fiscal | Obrigação legal (art. 7, II) |

### Em "5. Compartilhamento" (parágrafos novos)

**Pagamento (Stripe).** Quando você assina o PRO, o pagamento é processado pelo Stripe, empresa de meios de
pagamento com sede nos Estados Unidos, que atua como operador dos dados do pagamento. O número do seu cartão é
informado direto ao Stripe e **nunca passa pelos nossos servidores**. O Stripe também pode atuar como
controlador independente dos dados que trata para prevenção a fraudes e cumprimento de suas obrigações
legais, conforme a política de privacidade dele. `[PREENCHER: link da política do Stripe]`

**Gestão da assinatura (RevenueCat).** Usamos o RevenueCat, com sede nos Estados Unidos, para saber se sua
assinatura está ativa. Ele recebe um identificador da sua conta no Selucra (não o seu nome nem o seu e-mail),
os dados do plano e os eventos da assinatura enviados pelo Stripe. `[PREENCHER: confirmar se o e-mail é enviado
ao RevenueCat no fluxo atual; hoje o app_user_id é o id da conta.]` Ele atua como operador seguindo nossas
instruções.

**Transferência internacional.** Como Stripe e RevenueCat tratam dados nos Estados Unidos, seus dados podem ser
transferidos para fora do Brasil, nos termos do art. 33 da LGPD, com base em `[PREENCHER: mecanismo, ex.
cláusulas contratuais padrão ou decisão de adequação, a confirmar com o advogado e com os contratos de
tratamento de dados de cada empresa]`.

### Em "7. Por quanto tempo guardamos"

Dados da assinatura e das cobranças ficam guardados pelo prazo exigido pela lei fiscal e contábil
`[PREENCHER: prazo, em geral 5 anos; confirmar com o contador]`. Ao excluir a conta, o que não precisamos
manter por obrigação legal é apagado ou anonimizado. Os eventos de medição de uso dos convites ao PRO já são
apagados após 12 meses.

### Em "9. Seus direitos"

Sobre dados de pagamento, também atendemos pelo canal `[PREENCHER: e-mail do encarregado]`; parte dos dados
está com o Stripe e o RevenueCat, e encaminhamos o pedido a eles quando for o caso.

---

## Pendências do autor (não invento)

1. Razão social, CNPJ e e-mail do encarregado (mesmos `[PREENCHER]` já existentes em `policyConfig.ts`).
2. Confirmar contratos (DPA) e local de tratamento do Stripe e do RevenueCat.
3. Mecanismo jurídico da transferência internacional (art. 33) e prazo fiscal de guarda.
4. Se o e-mail da conta vai ao RevenueCat ou só o identificador (afeta o texto).
