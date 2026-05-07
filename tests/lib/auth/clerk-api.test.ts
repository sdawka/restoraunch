import { describe, it, expect, vi } from 'vitest'
import { updateUserMetadata, type LocationMetadata } from '../../../src/lib/auth/clerk-api'

describe('updateUserMetadata', () => {
  it('calls Clerk API with correct payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'user_123' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const locations: LocationMetadata[] = [
      { id: 1, name: 'Main Restaurant', role: 'admin' },
    ]

    await updateUserMetadata({
      userId: 'user_123',
      locations,
      secretKey: 'sk_test_xxx',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.clerk.com/v1/users/user_123/metadata',
      expect.objectContaining({
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer sk_test_xxx',
          'Content-Type': 'application/json',
        },
      })
    )

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.public_metadata.locations).toEqual(locations)

    vi.unstubAllGlobals()
  })
})
