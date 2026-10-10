import type { EmailRenderer } from '../../application/ports/emailRenderer'
import { isOptionalCategory } from '../../domain/emailMessage'
import type { EmailTemplate } from '../../domain/templates/emailContent'
import { assertSafeSubject, assertSafeUrl, renderEmailBody } from '../../domain/templates/layout'
import { EMAIL_TEMPLATES } from '../../domain/templates/registry'

export interface HtmlEmailRendererOptions {
  brandName: string
  // URL pública do frontend (`FRONTEND_URL`).
  appUrl: string
  templates?: Record<string, EmailTemplate>
}

// Implementa a port `EmailRenderer` com o catálogo de funções puras de `domain/templates`.
// E-mail de categoria opcional (social, engajamento) exige `unsubscribeUrl` no payload e sai
// com `List-Unsubscribe` + `List-Unsubscribe-Post` (one-click, exigência de Gmail/Yahoo para
// remetentes em volume); o transacional/segurança nunca leva o link de cancelar. Quem grava o
// payload no outbox (EM.6.1) é que injeta `unsubscribeUrl`. Falta dele é erro de render: a
// linha vai pra `failed` com motivo visível, em vez de sair sem como cancelar.
export function createHtmlEmailRenderer(options: HtmlEmailRendererOptions): EmailRenderer {
  const templates = options.templates ?? EMAIL_TEMPLATES
  const appUrl = options.appUrl.replace(/\/+$/, '')

  return {
    render(templateKey, payload) {
      const template = templates[templateKey]
      if (!template) throw new Error(`template "${templateKey}" não existe`)

      const content = template.build(payload, { appUrl })
      const subject = assertSafeSubject(content.subject)

      const optional = isOptionalCategory(template.category)
      let unsubscribeUrl: string | undefined
      if (optional) {
        const raw = payload.unsubscribeUrl
        if (typeof raw !== 'string' || raw.length === 0) {
          throw new Error(
            `template "${templateKey}" é opcional e exige "unsubscribeUrl" no payload`,
          )
        }
        unsubscribeUrl = assertSafeUrl(raw)
      }

      const { html, text } = renderEmailBody(content, subject, {
        brandName: options.brandName,
        appUrl,
        unsubscribeUrl,
      })

      return {
        subject,
        html,
        text,
        ...(unsubscribeUrl
          ? {
              headers: {
                'List-Unsubscribe': `<${unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              },
            }
          : {}),
      }
    },
  }
}
