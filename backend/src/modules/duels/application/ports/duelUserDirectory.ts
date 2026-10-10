export interface DuelUser {
  id: string
  username: string
  name: string
  avatarUrl: string | null
}

export interface DuelUserDirectory {
  findByIds(ids: string[]): Promise<DuelUser[]>
}
