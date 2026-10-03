import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { createFakeTokenIssuer } from '../../modules/auth/test/fakes/fakeTokenIssuer'
import { createAuthMiddleware } from './authMiddleware'

function mockRes() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }
  return res as unknown as Response
}

describe('authMiddleware.authenticate', () => {
  it('retorna 401 quando não há cabeçalho Authorization', () => {
    const { authenticate } = createAuthMiddleware(createFakeTokenIssuer())
    const req = { headers: {} } as Request
    const res = mockRes()
    const next = vi.fn()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('retorna 401 quando o token é inválido', () => {
    const { authenticate } = createAuthMiddleware(createFakeTokenIssuer())
    const req = { headers: { authorization: 'Bearer token-invalido-sem-formato' } } as Request
    const res = mockRes()
    const next = vi.fn()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('popula req.auth e chama next quando o token é válido', () => {
    const tokenIssuer = createFakeTokenIssuer()
    const { authenticate } = createAuthMiddleware(tokenIssuer)
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'admin' })
    const req = { headers: { authorization: `Bearer ${token}` } } as Request
    const res = mockRes()
    const next = vi.fn()

    authenticate(req, res, next)

    expect(req.auth).toMatchObject({ userId: 'user-1', role: 'admin' })
    expect(next).toHaveBeenCalledOnce()
  })
})

describe('authMiddleware.requireRole', () => {
  it('retorna 403 quando o papel não bate', () => {
    const { requireRole } = createAuthMiddleware(createFakeTokenIssuer())
    const req = { auth: { userId: 'user-1', role: 'user' } } as Request
    const res = mockRes()
    const next = vi.fn()

    requireRole('admin')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('chama next quando o papel bate', () => {
    const { requireRole } = createAuthMiddleware(createFakeTokenIssuer())
    const req = { auth: { userId: 'admin-1', role: 'admin' } } as Request
    const res = mockRes()
    const next = vi.fn()

    requireRole('admin')(req, res, next)

    expect(next).toHaveBeenCalledOnce()
  })
})

describe('authMiddleware.requireRecentAuth', () => {
  const nowSeconds = () => Math.floor(Date.now() / 1000)

  it('chama next quando a senha foi conferida dentro da janela', () => {
    const { requireRecentAuth } = createAuthMiddleware(createFakeTokenIssuer())
    const req = { auth: { userId: 'a', role: 'admin', authTime: nowSeconds() - 60 } } as Request
    const res = mockRes()
    const next = vi.fn()

    requireRecentAuth()(req, res, next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('devolve 401 reauth_required quando a conferência é antiga', () => {
    const { requireRecentAuth } = createAuthMiddleware(createFakeTokenIssuer())
    const req = { auth: { userId: 'a', role: 'admin', authTime: nowSeconds() - 6 * 60 } } as Request
    const res = mockRes()
    const next = vi.fn()

    requireRecentAuth()(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'reauth_required' })
    expect(next).not.toHaveBeenCalled()
  })

  it('respeita a janela customizada', () => {
    const { requireRecentAuth } = createAuthMiddleware(createFakeTokenIssuer())
    const req = { auth: { userId: 'a', role: 'admin', authTime: nowSeconds() - 30 } } as Request
    const res = mockRes()
    const next = vi.fn()

    requireRecentAuth(10)(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
  })
})
