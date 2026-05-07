export function generateInviteToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date()
}

export function getInviteExpiry(days: number = 7): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}
