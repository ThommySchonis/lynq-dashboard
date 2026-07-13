import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'
import { CANONICAL_SHOPIFY_SCOPES } from '@/lib/shopify-scopes'

const rpcMock = vi.fn()
const createUserMock = vi.fn()
const generateLinkMock = vi.fn()
const listUsersMock = vi.fn()

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    rpc: (...a: unknown[]): unknown => rpcMock(...a),
    auth: {
      admin: {
        createUser: (...a: unknown[]): unknown => createUserMock(...a),
        generateLink: (...a: unknown[]): unknown => generateLinkMock(...a),
        listUsers: (...a: unknown[]): unknown => listUsersMock(...a),
      },
    },
  },
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

// import AFTER mocks
import {
  normalizeShopDomain,
  isValidShopDomain,
  verifyShopifyHmac,
  buildInstallAuthUrl,
  findUserIdByEmail,
  provisionInstallIdentity,
  createInstallSessionLink,
} from '@/lib/services/shopify-install'

beforeEach(() => {
  rpcMock.mockReset()
  createUserMock.mockReset()
  generateLinkMock.mockReset()
  listUsersMock.mockReset()
})

describe('normalizeShopDomain', () => {
  it('appends .myshopify.com when missing', () => {
    expect(normalizeShopDomain('Acme-Store')).toBe('acme-store.myshopify.com')
  })
  it('keeps an already-qualified domain (lowercased, trimmed)', () => {
    expect(normalizeShopDomain('  Acme.myshopify.com ')).toBe('acme.myshopify.com')
  })
})

describe('isValidShopDomain', () => {
  it('accepts a well-formed myshopify domain', () => {
    expect(isValidShopDomain('acme-store.myshopify.com')).toBe(true)
  })
  it('rejects a non-myshopify or injected host', () => {
    expect(isValidShopDomain('evil.com')).toBe(false)
    expect(isValidShopDomain('acme.myshopify.com.evil.com')).toBe(false)
    expect(isValidShopDomain('acme.myshopify.com/../x')).toBe(false)
  })
})

describe('verifyShopifyHmac', () => {
  const secret = 'shhh'
  function sign(params: Record<string, string>): URLSearchParams {
    const message = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&')
    const hmac = crypto.createHmac('sha256', secret).update(message).digest('hex')
    return new URLSearchParams({ ...params, hmac })
  }
  it('returns true for a correctly-signed query', () => {
    const sp = sign({ shop: 'acme.myshopify.com', timestamp: '123', host: 'abc' })
    expect(verifyShopifyHmac(sp, secret)).toBe(true)
  })
  it('returns false when a param is tampered', () => {
    const sp = sign({ shop: 'acme.myshopify.com', timestamp: '123' })
    sp.set('shop', 'evil.myshopify.com')
    expect(verifyShopifyHmac(sp, secret)).toBe(false)
  })
  it('returns false when hmac is missing', () => {
    expect(verifyShopifyHmac(new URLSearchParams({ shop: 'x' }), secret)).toBe(false)
  })
})

describe('buildInstallAuthUrl', () => {
  it('builds the authorize URL with canonical scopes and callback redirect', () => {
    const url = buildInstallAuthUrl({
      shop: 'acme.myshopify.com',
      appUrl: 'https://app.lynqflow.io',
      clientId: 'CID',
      scopes: CANONICAL_SHOPIFY_SCOPES,
      state: 'STATE',
    })
    const u = new URL(url)
    expect(u.origin + u.pathname).toBe('https://acme.myshopify.com/admin/oauth/authorize')
    expect(u.searchParams.get('client_id')).toBe('CID')
    expect(u.searchParams.get('scope')).toBe(CANONICAL_SHOPIFY_SCOPES)
    expect(u.searchParams.get('redirect_uri')).toBe('https://app.lynqflow.io/api/auth/shopify/callback')
    expect(u.searchParams.get('state')).toBe('STATE')
  })
})

describe('findUserIdByEmail', () => {
  function makeUser(id: string, email: string): { id: string; email: string } {
    return { id, email }
  }

  it('finds a user on page 1', async () => {
    listUsersMock.mockResolvedValueOnce({
      data: { users: [makeUser('u1', 'owner@acme.com'), makeUser('u2', 'other@acme.com')] },
      error: null,
    })

    const id = await findUserIdByEmail('OWNER@acme.com')

    expect(id).toBe('u1')
    expect(listUsersMock).toHaveBeenCalledTimes(1)
    expect(listUsersMock).toHaveBeenCalledWith({ page: 1, perPage: 200 })
  })

  it('paginates and finds the user on page 2', async () => {
    const fullPage = Array.from({ length: 200 }, (_, i) => makeUser(`p1-${i}`, `user${i}@acme.com`))
    listUsersMock
      .mockResolvedValueOnce({ data: { users: fullPage }, error: null })
      .mockResolvedValueOnce({ data: { users: [makeUser('u2', 'owner@acme.com')] }, error: null })

    const id = await findUserIdByEmail('owner@acme.com')

    expect(id).toBe('u2')
    expect(listUsersMock).toHaveBeenCalledTimes(2)
    expect(listUsersMock).toHaveBeenNthCalledWith(1, { page: 1, perPage: 200 })
    expect(listUsersMock).toHaveBeenNthCalledWith(2, { page: 2, perPage: 200 })
  })

  it('returns undefined when the email is not found across all pages', async () => {
    const fullPage = Array.from({ length: 200 }, (_, i) => makeUser(`p1-${i}`, `user${i}@acme.com`))
    const shortPage = [makeUser('p2-0', 'someone-else@acme.com')]
    listUsersMock
      .mockResolvedValueOnce({ data: { users: fullPage }, error: null })
      .mockResolvedValueOnce({ data: { users: shortPage }, error: null })

    const id = await findUserIdByEmail('missing@acme.com')

    expect(id).toBeUndefined()
    expect(listUsersMock).toHaveBeenCalledTimes(2)
  })

  it('throws when listUsers returns an error', async () => {
    listUsersMock.mockResolvedValueOnce({ data: null, error: { message: 'rate limited' } })

    await expect(findUserIdByEmail('owner@acme.com')).rejects.toThrow('listUsers failed: rate limited')
  })
})

describe('provisionInstallIdentity', () => {
  it('creates a user and provisions a workspace for a new merchant', async () => {
    createUserMock.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    rpcMock.mockResolvedValue({ data: { workspace_id: 'w1', member_id: 'm1' }, error: null })

    const out = await provisionInstallIdentity({ email: 'owner@acme.com', shopName: 'Acme' })

    expect(createUserMock).toHaveBeenCalledWith(expect.objectContaining({
      email: 'owner@acme.com', email_confirm: true,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining is typed 'any' by vitest
      user_metadata: expect.objectContaining({ company_name: 'Acme' }),
    }))
    expect(rpcMock).toHaveBeenCalledWith('provision_workspace', { p_user_id: 'u1', p_workspace_name: 'Acme' })
    expect(out).toEqual({ userId: 'u1', workspaceId: 'w1', memberId: 'm1' })
  })

  it('reuses the existing user when the email is already registered', async () => {
    // If the function wrongly ignored existingUserId and called createUser, this
    // mocked error would make the whole call throw and fail the test.
    createUserMock.mockResolvedValue({ data: { user: null }, error: { message: 'email address already registered', code: 'email_exists' } })
    rpcMock.mockResolvedValue({ data: { workspace_id: 'w9', member_id: 'm9' }, error: null })

    const out = await provisionInstallIdentity({ email: 'dupe@acme.com', shopName: 'Acme', existingUserId: 'uX' })

    // existingUserId is provided → createUser must be skipped entirely.
    expect(createUserMock).not.toHaveBeenCalled()
    expect(rpcMock).toHaveBeenCalledWith('provision_workspace', { p_user_id: 'uX', p_workspace_name: 'Acme' })
    expect(out.workspaceId).toBe('w9')
  })
})

describe('createInstallSessionLink', () => {
  it('returns the magic-link action_link', async () => {
    generateLinkMock.mockResolvedValue({ data: { properties: { action_link: 'https://sb/verify?x=1' } }, error: null })
    const link = await createInstallSessionLink({ email: 'owner@acme.com', redirectTo: 'https://app/x' })
    expect(generateLinkMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'magiclink', email: 'owner@acme.com',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining is typed 'any' by vitest
      options: expect.objectContaining({ redirectTo: 'https://app/x' }),
    }))
    expect(link).toBe('https://sb/verify?x=1')
  })
})
