export interface LocationMetadata {
  id: number
  name: string
  role: 'admin' | 'manager'
}

export interface UpdateMetadataParams {
  userId: string
  locations: LocationMetadata[]
  secretKey: string
}

export async function updateUserMetadata(params: UpdateMetadataParams): Promise<void> {
  const { userId, locations, secretKey } = params

  const response = await fetch(
    `https://api.clerk.com/v1/users/${userId}/metadata`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        public_metadata: { locations },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Clerk API error: ${JSON.stringify(error)}`)
  }
}

export async function getUserLocationsFromClerk(
  userId: string,
  secretKey: string
): Promise<LocationMetadata[]> {
  const response = await fetch(
    `https://api.clerk.com/v1/users/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Clerk API error: ${response.status}`)
  }

  const user = await response.json()
  return user.public_metadata?.locations || []
}
