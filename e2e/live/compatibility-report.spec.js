import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { expect, test } from '@playwright/test'

test('archive le navigateur et sa version utilisés pour cette exécution', async ({ browser, browserName, page }) => {
  const record = {
    testedAt: new Date().toISOString(),
    browser: browserName,
    version: browser.version(),
    platform: process.platform,
    url: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173',
  }
  const reportPath = process.env.COMPATIBILITY_RESULTS_FILE
  if (reportPath) {
    await mkdir(dirname(reportPath), { recursive: true })
    await appendFile(reportPath, `${JSON.stringify(record)}\n`, 'utf8')
  }
  console.log(`[compatibility] ${JSON.stringify(record)}`)
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Bienvenue' })).toBeVisible()
})
