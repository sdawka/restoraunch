import { clerkSetup } from '@clerk/testing/playwright'
import { readFileSync } from 'fs'
import { resolve } from 'path'

export default async function globalSetup() {
  // Load .dev.vars and set env vars for Clerk testing
  const devVarsPath = resolve(process.cwd(), '.dev.vars')
  try {
    const content = readFileSync(devVarsPath, 'utf-8')
    for (const line of content.split('\n')) {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length) {
        const value = valueParts.join('=').trim()
        process.env[key.trim()] = value
        // Map PUBLIC_CLERK_PUBLISHABLE_KEY to CLERK_PUBLISHABLE_KEY for Clerk testing
        if (key.trim() === 'PUBLIC_CLERK_PUBLISHABLE_KEY') {
          process.env.CLERK_PUBLISHABLE_KEY = value
        }
      }
    }
  } catch (e) {
    console.warn('Could not load .dev.vars:', e)
  }

  await clerkSetup()
}
