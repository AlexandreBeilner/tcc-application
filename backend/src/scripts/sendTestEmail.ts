// Envia um e-mail de teste direto pelo transporte configurado, sem passar pelo outbox
// (EM.1.2): serve pra conferir remetente, domínio verificado e chave do Resend.
//   EMAIL_PROVIDER=resend RESEND_API_KEY=... EMAIL_FROM="Nome <no-reply@mail.dominio>" \
//     npm run email:test -- voce@exemplo.com
import { createEmailSender, EMAIL_BRAND_NAME } from '../modules/notifications/composition'
import { loadEmailConfig } from '../modules/notifications/infrastructure/config/emailConfig'
import { createHtmlEmailRenderer } from '../modules/notifications/infrastructure/templates/htmlEmailRenderer'

async function main() {
  const to = process.argv[2]
  if (!to) {
    console.error('uso: npm run email:test -- <destinatario@exemplo.com>')
    process.exit(1)
  }
  const config = loadEmailConfig(process.env)
  const sender = createEmailSender(config)
  // Renderiza o template `system_test` de verdade: o e-mail de teste mostra o layout real.
  const rendered = createHtmlEmailRenderer({
    brandName: EMAIL_BRAND_NAME,
    appUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  }).render('system_test', {})
  const result = await sender.send({
    to,
    ...rendered,
    idempotencyKey: `email-test-${Date.now()}`,
  })
  console.log(`e-mail de teste enviado via ${config.provider}: ${result.providerMessageId}`)
}

main().catch((err) => {
  console.error('falha ao enviar o e-mail de teste:', err)
  process.exit(1)
})
