import { describe, expect, it } from 'vitest'
import { buildAvatarUrl } from './avatarUrl'

describe('buildAvatarUrl', () => {
  it('monta a URL pública a partir do nome do arquivo salvo', () => {
    expect(buildAvatarUrl('u1-abc123.jpg')).toBe('/avatars/u1-abc123.jpg')
  })

  it('devolve null quando o usuário nunca fez upload', () => {
    expect(buildAvatarUrl(null)).toBeNull()
  })
})
