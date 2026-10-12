// Envia um e-mail de teste direto pelo transporte configurado, sem passar pelo outbox
// (EM.1.2): serve pra conferir remetente, domínio verificado e chave do Resend.
//   EMAIL_PROVIDER=resend RESEND_API_KEY_TRANSACTIONAL=... RESEND_API_KEY_NEWS=... \
//     EMAIL_FROM_TRANSACTIONAL="Nome <no-reply@send.dominio>" EMAIL_FROM_NEWS="Nome <no-reply@news.dominio>" \
//     npm run email:test -- voce@exemplo.com [transactional|news]
// O segundo argumento escolhe o fluxo a testar (padrão: transactional).
import { createEmailSender, EMAIL_BRAND_NAME } from '../modules/notifications/composition'
import { loadEmailConfig } from '../modules/notifications/infrastructure/config/emailConfig'
import { createHtmlEmailRenderer } from '../modules/notifications/infrastructure/templates/htmlEmailRenderer'

async function main() {
  const to = process.argv[2]
  if (!to) {
    console.error('uso: npm run email:test -- <destinatario@exemplo.com>')
    process.exit(1)
  }
  const stream = process.argv[3] === 'news' ? 'news' : 'transactional'
  const config = loadEmailConfig(process.env)
  const sender = createEmailSender(config)
  // Renderiza o template `system_test` de verdade: o e-mail de teste mostra o layout real.
  const rendered = createHtmlEmailRenderer({
    brandName: EMAIL_BRAND_NAME,
    appUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  }).render('system_test', {})
  const result = await sender.send({
    stream,
    to,
    ...rendered,
    idempotencyKey: `email-test-${Date.now()}`,
  })
  console.log(
    `e-mail de teste (${stream}) enviado via ${config.provider}: ${result.providerMessageId}`,
  )
}

main().catch((err) => {
  console.error('falha ao enviar o e-mail de teste:', err)
  process.exit(1)
})
