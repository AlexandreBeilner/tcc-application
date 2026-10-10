// A conquista já foi desbloqueada: falha ao enfileirar o aviso por e-mail só é logada e nunca
// desfaz nem derruba o desbloqueio (nem o crédito de XP que o disparou).
export async function notifySafely(label: string, send: () => Promise<void>): Promise<void> {
  try {
    await send()
  } catch (err) {
    console.error(`[email] falha ao enfileirar ${label}`, err)
  }
}
