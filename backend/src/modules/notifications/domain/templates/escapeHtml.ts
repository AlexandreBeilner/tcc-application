const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

// Toda variável que entra no HTML do e-mail passa por aqui: nome de usuário e outros textos
// vêm do usuário, e HTML injetado num e-mail da plataforma é phishing com a nossa assinatura.
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char])
}
