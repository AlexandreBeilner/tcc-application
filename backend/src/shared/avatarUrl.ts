// Convenção de URL de avatar (tarefa 6.10.8) compartilhada por
// `modules/auth` (dono do upload), `modules/profile` e `modules/friendships`
// (cada um com seu próprio `UserDirectory`, mesmo raciocínio de porta
// própria por módulo já usado por eles) — mesmo precedente de
// `shared/pagination.ts`: função pura, sem I/O, sem regra de negócio.
// `avatarPath` é só o nome do arquivo salvo em disco
// (`infrastructure/storage/diskAvatarStorage.ts`); a rota estática que serve
// esses arquivos (`app.use('/avatars', express.static(...))`, composição em
// `app.ts`) é montada na raiz do gateway, então o caminho relativo abaixo já
// é o suficiente pro frontend consumir via `<img src>`.
export function buildAvatarUrl(avatarPath: string | null): string | null {
  return avatarPath ? `/avatars/${avatarPath}` : null
}
