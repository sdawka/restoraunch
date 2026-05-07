# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: user-journey.spec.ts >> User Journey >> Insights Flow >> insights page loads variance section
- Location: tests/e2e-browser/user-journey.spec.ts:225:5

# Error details

```
TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('.variance-container') to be visible

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e6]:
    - generic [ref=e7]:
      - generic [ref=e9]:
        - heading "Sign in to Restoraunch" [level=1] [ref=e10]
        - paragraph [ref=e11]: Welcome back! Please sign in to continue
      - generic [ref=e12]:
        - generic [ref=e14]:
          - button "Sign in with Apple Apple" [ref=e15] [cursor=pointer]:
            - generic [ref=e16]:
              - generic "Sign in with Apple" [ref=e18]
              - generic [ref=e19]: Apple
          - button "Sign in with Google Google" [ref=e20] [cursor=pointer]:
            - generic [ref=e21]:
              - generic "Sign in with Google" [ref=e23]
              - generic [ref=e24]: Google
        - paragraph [ref=e27]: or
        - generic [ref=e29]:
          - generic [ref=e30]:
            - generic [ref=e33]:
              - generic [ref=e35]: Email address
              - textbox "Email address" [ref=e36]:
                - /placeholder: Enter your email address
            - generic:
              - generic:
                - generic:
                  - generic:
                    - generic: Password
                  - generic:
                    - textbox "Password":
                      - /placeholder: Enter your password
                    - button "Show password":
                      - img
          - button "Continue" [ref=e39] [cursor=pointer]:
            - generic [ref=e40]:
              - text: Continue
              - img [ref=e41]
    - generic [ref=e43]:
      - generic [ref=e44]:
        - generic [ref=e45]: Don’t have an account?
        - link "Sign up" [ref=e46] [cursor=pointer]:
          - /url: https://many-sunbird-48.accounts.dev/sign-up#/?redirect_url=http%3A%2F%2Flocalhost%3A4321%2Finsights
      - generic [ref=e48]:
        - generic [ref=e50]:
          - paragraph [ref=e51]: Secured by
          - link "Clerk logo" [ref=e52] [cursor=pointer]:
            - /url: https://go.clerk.com/components
            - img [ref=e53]
        - paragraph [ref=e58]: Development mode
  - alert [ref=e59]
```

# Test source

```ts
  1  | import { Page, Locator } from '@playwright/test';
  2  | import { BasePage } from './base.page';
  3  | 
  4  | export class InsightsPage extends BasePage {
  5  |   readonly pageTitle: Locator;
  6  |   readonly varianceSection: Locator;
  7  |   readonly varianceList: Locator;
  8  |   readonly calculateButton: Locator;
  9  | 
  10 |   constructor(page: Page) {
  11 |     super(page);
  12 |     this.pageTitle = page.locator('h1.header-title, h1:has-text("Variance")');
  13 |     this.varianceSection = page.locator('section:has-text("Variance"), .variance-section');
  14 |     this.varianceList = page.locator('.variance-container, .variance-list');
  15 |     this.calculateButton = page.locator('button:has-text("Calculate"), button:has-text("Analyze")');
  16 |   }
  17 | 
  18 |   async goto(): Promise<void> {
  19 |     await this.navigateTo('/insights');
  20 |     await this.page.waitForLoadState('networkidle');
  21 |   }
  22 |   async waitForInsightsLoad(): Promise<void> {
> 23 |     await this.page.waitForSelector('.variance-container', { state: 'visible', timeout: 15000 });
     |                     ^ TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
  24 |   }
  25 |   async hasVarianceResults(): Promise<boolean> {
  26 |     await this.varianceList.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  27 |     return this.varianceList.isVisible().catch(() => false);
  28 |   }
  29 | }
  30 | 
```