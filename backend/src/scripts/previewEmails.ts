// Gera uma pré-visualização HTML de todo template registrado em `tmp/email-preview/` (pasta
// ignorada pelo git), pra revisar a aparência sem enviar nada. Para cada template sai o arquivo
// claro e um `.dark.html` com o modo escuro forçado (no e-mail real ele depende do cliente).
//   npm run email:preview
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { EMAIL_TEMPLATES } from '../modules/notifications/domain/templates/registry'
import { createHtmlEmailRenderer } from '../modules/notifications/infrastructure/templates/htmlEmailRenderer'
import { EMAIL_BRAND_NAME } from '../modules/notifications/composition'

const outDir = path.resolve(__dirname, '../../../tmp/email-preview')
mkdirSync(outDir, { recursive: true })

const renderer = createHtmlEmailRenderer({
  brandName: EMAIL_BRAND_NAME,
  appUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
})

const links: string[] = []
for (const [key, template] of Object.entries(EMAIL_TEMPLATES)) {
  const email = renderer.render(key, {
    ...template.sample,
    unsubscribeUrl: 'http://localhost:5173/email/cancelar?token=exemplo',
  })
  writeFileSync(path.join(outDir, `${key}.html`), email.html)
  writeFileSync(
    path.join(outDir, `${key}.dark.html`),
    email.html.replace('@media (prefers-color-scheme: dark)', '@media all'),
  )
  writeFileSync(path.join(outDir, `${key}.txt`), email.text)
  links.push(
    `<li><strong>${key}</strong> (${template.category}): <a href="${key}.html">claro</a> · <a href="${key}.dark.html">escuro</a> · <a href="${key}.txt">texto</a><br><small>${email.subject}</small></li>`,
  )
}
writeFileSync(
  path.join(outDir, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Pré-visualização de e-mails</title><ul>${links.join('')}</ul>`,
)
console.log(`pré-visualização gerada em ${outDir} (${links.length} template(s))`)
