import { describe, it, expect } from 'vitest'
import { generateInviteToken, isTokenExpired } from '../../../src/lib/auth/tokens'

describe('generateInviteToken', () => {
  it('generates a 64-character hex token', () => {
    const token = generateInviteToken()
    expect(token).toHaveLength(64)
    expect(token).toMatch(/^[a-f0-9]+$/)
  })

  it('generates unique tokens', () => {
    const token1 = generateInviteToken()
    const token2 = generateInviteToken()
    expect(token1).not.toBe(token2)
  })
})

describe('isTokenExpired', () => {
  it('returns false for future date', () => {
    const future = new Date(Date.now() + 60000).toISOString()
    expect(isTokenExpired(future)).toBe(false)
  })

  it('returns true for past date', () => {
    const past = new Date(Date.now() - 60000).toISOString()
    expect(isTokenExpired(past)).toBe(true)
  })
})
