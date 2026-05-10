import { chromium } from '@playwright/test'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const TEST_USER_EMAIL = 'e2e+clerk_test@restoraunch.com'
const TEST_USER_PASSWORD = 'Restoraunch2026E2E!'
const TEST_VERIFICATION_CODE = '424242'
const AUTH_STATE_PATH = resolve(process.cwd(), 'playwright/.clerk/auth-state.json')

export default async function globalSetup() {
  // Load .dev.vars for env vars
  const devVarsPath = resolve(process.cwd(), '.dev.vars')
  try {
    const content = readFileSync(devVarsPath, 'utf-8')
    for (const line of content.split('\n')) {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length) {
        process.env[key.trim()] = valueParts.join('=').trim()
      }
    }
  } catch (e) {
    console.warn('Could not load .dev.vars:', e)
  }

  // Ensure auth state directory exists
  const authDir = resolve(process.cwd(), 'playwright/.clerk')
  if (!existsSync(authDir)) {
    mkdirSync(authDir, { recursive: true })
  }

  // Skip auth if state file already exists
  if (existsSync(AUTH_STATE_PATH)) {
    console.log('Using existing auth state')
    return
  }

  // Create authenticated session and save state
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Try to sign in - Clerk uses a two-step flow
    await page.goto('http://localhost:4321/sign-in')
    await page.waitForLoadState('networkidle')

    // Step 1: Enter email
    await page.getByLabel('Email address').fill(TEST_USER_EMAIL)
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 2: Wait for password page and enter password
    await page.locator('input[type="password"]').waitFor({ timeout: 5000 })
    await page.locator('input[type="password"]').fill(TEST_USER_PASSWORD)
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 3: Handle device verification if prompted (uses 6 separate inputs)
    // Look for the "Check your email" text which indicates OTP is needed
    const checkEmailText = page.locator('text=Check your email')
    if (await checkEmailText.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Entering device verification code...')
      // Clerk OTP inputs auto-advance when typing - just type the code
      await page.locator('input').first().click()
      await page.keyboard.press('Tab') // Ensure focus is on an input
      for (const digit of TEST_VERIFICATION_CODE) {
        await page.keyboard.press(digit)
        await page.waitForTimeout(50)
      }
      await page.waitForTimeout(1000)
      // Code may auto-submit, or we need to click Continue
      const continueBtn = page.getByRole('button', { name: 'Continue' })
      if (await continueBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await continueBtn.click()
      }
    }

    // Wait for redirect to app (sign-in success)
    try {
      await page.waitForURL(/localhost:4321\/(?!sign)/, { timeout: 10000 })
      console.log('Signed in with test user')
    } catch {
      // Check for error message
      const errorText = await page.locator('.cl-formFieldErrorText, [data-error]').textContent().catch(() => null)
      if (errorText) {
        console.error('Sign-in error:', errorText)
      }
      await page.screenshot({ path: 'playwright/.clerk/signin-debug.png' })
      console.error('Sign-in failed. Screenshot saved to playwright/.clerk/signin-debug.png')
      throw new Error('Sign-in redirect timeout')
    }

    // Save auth state
    await context.storageState({ path: AUTH_STATE_PATH })
  } catch (e) {
    console.error('Auth setup failed. Please create the test user manually:')
    console.error(`  Email: ${TEST_USER_EMAIL}`)
    console.error(`  Password: ${TEST_USER_PASSWORD}`)
    console.error('  Verification code: 424242')
    console.error('')
    console.error('Then re-run the tests.')

    // Create empty auth state to prevent file-not-found errors
    writeFileSync(AUTH_STATE_PATH, JSON.stringify({ cookies: [], origins: [] }))
  } finally {
    await browser.close()
  }
}
