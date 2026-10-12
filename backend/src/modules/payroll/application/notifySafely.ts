// O salário já foi creditado e o mês gravado: falha ao enfileirar o aviso por e-mail só é
// logada e nunca desfaz nem derruba o pagamento (nem os demais usuários da rodada).
export async function notifySafely(label: string, send: () => Promise<void>): Promise<void> {
  try {
    await send()
  } catch (err) {
    console.error(`[email] falha ao enfileirar ${label}`, err)
  }
}
