// Envia um e-mail de teste direto pelo transporte configurado, sem passar pelo outbox
// (EM.1.2): serve pra conferir remetente, domínio verificado e chave do Resend.
//   EMAIL_PROVIDER=resend RESEND_API_KEY=... EMAIL_FROM="Nome <no-reply@mail.dominio>" \
//     npm run email:test -- voce@exemplo.com
import { createEmailSender } from '../modules/notifications/composition'
import { loadEmailConfig } from '../modules/notifications/infrastructure/config/emailConfig'

async function main() {
  const to = process.argv[2]
  if (!to) {
    console.error('uso: npm run email:test -- <destinatario@exemplo.com>')
    process.exit(1)
  }
  const config = loadEmailConfig(process.env)
  const sender = createEmailSender(config)
  const result = await sender.send({
    to,
    subject: 'Teste do gateway de e-mail',
    html: '<p>Se você leu isto, o envio está funcionando.</p>',
    text: 'Se você leu isto, o envio está funcionando.',
    idempotencyKey: `email-test-${Date.now()}`,
  })
  console.log(`e-mail de teste enviado via ${config.provider}: ${result.providerMessageId}`)
}

main().catch((err) => {
  console.error('falha ao enviar o e-mail de teste:', err)
  process.exit(1)
})
