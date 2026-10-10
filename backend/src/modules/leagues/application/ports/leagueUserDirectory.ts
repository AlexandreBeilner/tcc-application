export interface LeagueUser {
  id: string
  username: string
  name: string
  // URL pública já resolvida, `null` até o primeiro upload.
  avatarUrl: string | null
}

export interface LeagueUserDirectory {
  findByIds(ids: string[]): Promise<LeagueUser[]>
}
