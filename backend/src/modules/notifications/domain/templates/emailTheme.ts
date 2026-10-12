// Cores literais de `.claude/identidade-visual-tokens.md`: cliente de e-mail não resolve
// variável CSS. O claro é o padrão inline (vale em todo cliente); o escuro entra por
// `prefers-color-scheme` onde o cliente suporta.
export const EMAIL_LIGHT = {
  page: '#F7F7F9',
  card: '#FFFFFF',
  border: '#E4E5EA',
  textPrimary: '#14161B',
  textSecondary: '#5B6270',
  textMuted: '#8A8F9A',
  brand: '#2F6FED',
  onBrand: '#FFFFFF',
  link: '#1D4FC4',
} as const

export const EMAIL_DARK = {
  page: '#0E0F13',
  card: '#16181D',
  border: '#2A2E38',
  textPrimary: '#F5F6F8',
  textSecondary: '#9BA1AE',
  textMuted: '#6B7280',
  brand: '#2F6FED',
  onBrand: '#FFFFFF',
  link: '#93B4FF',
} as const

// Inter não é garantida em cliente de e-mail; a pilha cai pra fonte do sistema.
export const EMAIL_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
