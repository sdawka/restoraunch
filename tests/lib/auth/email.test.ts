import { describe, it, expect, vi } from 'vitest'
import { sendInvitationEmail, type InviteEmailParams } from '../../../src/lib/auth/email'

describe('sendInvitationEmail', () => {
  it('calls Resend API with correct payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'email_123' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const params: InviteEmailParams = {
      to: 'manager@example.com',
      locationName: 'Main Restaurant',
      inviterName: 'John',
      token: 'abc123',
      baseUrl: 'https://app.example.com',
      apiKey: 're_test_key',
    }

    const result = await sendInvitationEmail(params)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer re_test_key',
          'Content-Type': 'application/json',
        },
      })
    )
    expect(result.id).toBe('email_123')

    vi.unstubAllGlobals()
  })
})
