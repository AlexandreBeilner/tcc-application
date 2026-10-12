import type { EmailBlock, EmailContent } from './emailContent'
import { EMAIL_DARK, EMAIL_FONT_STACK, EMAIL_LIGHT } from './emailTheme'
import { escapeHtml } from './escapeHtml'

export interface LayoutContext {
  brandName: string
  appUrl: string
  // Presente só em e-mail não transacional (cancelar inscrição, EM.6.1).
  unsubscribeUrl?: string
}

export interface RenderedBody {
  html: string
  text: string
}

// Só http/https chega num `href`: `javascript:` ou `data:` num botão de e-mail seria um vetor
// de ataque se um payload viesse sujo.
export function assertSafeUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`URL inválida no e-mail: ${url}`)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`protocolo não permitido no e-mail: ${parsed.protocol}`)
  }
  return parsed.toString()
}

// Quebra de linha no assunto abriria um novo cabeçalho SMTP (header injection).
export function assertSafeSubject(subject: string): string {
  if (/[\r\n]/.test(subject)) throw new Error('assunto com quebra de linha')
  return subject.trim()
}

const L = EMAIL_LIGHT
const D = EMAIL_DARK

const DARK_MODE_CSS = `
@media (prefers-color-scheme: dark) {
  .bg-page { background: ${D.page} !important; }
  .bg-card { background: ${D.card} !important; border-color: ${D.border} !important; }
  .text-primary { color: ${D.textPrimary} !important; }
  .text-secondary { color: ${D.textSecondary} !important; }
  .text-muted { color: ${D.textMuted} !important; }
  .link { color: ${D.link} !important; }
}`

function renderBlockHtml(block: EmailBlock): string {
  switch (block.type) {
    case 'heading':
      return `<h1 class="text-primary" style="margin:0 0 16px;font-family:${EMAIL_FONT_STACK};font-size:24px;line-height:32px;font-weight:700;color:${L.textPrimary};">${escapeHtml(block.text)}</h1>`
    case 'paragraph':
      return `<p class="text-secondary" style="margin:0 0 16px;font-family:${EMAIL_FONT_STACK};font-size:16px;line-height:24px;color:${L.textSecondary};">${escapeHtml(block.text)}</p>`
    case 'note':
      return `<p class="text-muted" style="margin:0 0 16px;font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:20px;color:${L.textMuted};">${escapeHtml(block.text)}</p>`
    case 'button': {
      const url = escapeHtml(assertSafeUrl(block.url))
      // Botão "à prova de Outlook": a cor de fundo fica na célula, o link só tem o padding.
      return (
        `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 16px;"><tr>` +
        `<td align="center" bgcolor="${L.brand}" style="border-radius:8px;background:${L.brand};">` +
        `<a href="${url}" style="display:inline-block;padding:12px 24px;font-family:${EMAIL_FONT_STACK};font-size:16px;line-height:24px;font-weight:600;color:${L.onBrand};text-decoration:none;border-radius:8px;">${escapeHtml(block.label)}</a>` +
        `</td></tr></table>` +
        `<p class="text-muted" style="margin:0 0 16px;font-family:${EMAIL_FONT_STACK};font-size:12px;line-height:18px;color:${L.textMuted};">Se o botão não abrir, copie e cole este endereço no navegador:<br><a class="link" href="${url}" style="color:${L.link};word-break:break-all;">${url}</a></p>`
      )
    }
  }
}

function renderBlockText(block: EmailBlock): string {
  switch (block.type) {
    case 'heading':
      return block.text.toUpperCase()
    case 'paragraph':
    case 'note':
      return block.text
    case 'button':
      return `${block.label}:\n${assertSafeUrl(block.url)}`
  }
}

export function renderEmailBody(
  content: EmailContent,
  subject: string,
  context: LayoutContext,
): RenderedBody {
  const footerLines = [`${context.brandName} (${context.appUrl})`]
  const unsubscribeUrl = context.unsubscribeUrl ? assertSafeUrl(context.unsubscribeUrl) : undefined

  const unsubscribeHtml = unsubscribeUrl
    ? `<br>Não quer mais receber e-mails como este? <a class="link" href="${escapeHtml(unsubscribeUrl)}" style="color:${L.link};">Cancelar inscrição</a>.`
    : ''

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(subject)}</title>
<style>${DARK_MODE_CSS}</style>
</head>
<body class="bg-page" style="margin:0;padding:0;background:${L.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(content.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="bg-page" style="background:${L.page};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="padding:0 4px 16px;font-family:${EMAIL_FONT_STACK};font-size:18px;line-height:24px;font-weight:700;color:${L.brand};">${escapeHtml(context.brandName)}</td></tr>
<tr><td class="bg-card" style="background:${L.card};border:1px solid ${L.border};border-radius:12px;padding:32px 28px;">
${content.blocks.map(renderBlockHtml).join('\n')}
</td></tr>
<tr><td class="text-muted" style="padding:20px 4px 0;font-family:${EMAIL_FONT_STACK};font-size:12px;line-height:18px;color:${L.textMuted};">${escapeHtml(footerLines[0])}${unsubscribeHtml}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  const text = [
    ...content.blocks.map(renderBlockText),
    '--',
    ...footerLines,
    ...(unsubscribeUrl ? [`Para cancelar a inscrição: ${unsubscribeUrl}`] : []),
  ].join('\n\n')

  return { html, text }
}
