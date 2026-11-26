import { chromium } from '@playwright/test'

const appUrl = process.env.PERF_APP_URL || 'http://127.0.0.1:5173'
const apiUrl = process.env.PERF_API_URL || 'http://127.0.0.1:8000'
const email = process.env.LOCUST_EMAIL
const password = process.env.LOCUST_PASSWORD
const iterations = Number(process.env.DASHBOARD_ITERATIONS || 10)

if (!email || !password) throw new Error('Définir LOCUST_EMAIL et LOCUST_PASSWORD pour le compte ADMIN de recette.')
if (!Number.isInteger(iterations) || iterations < 1 || iterations > 100) {
  throw new Error('DASHBOARD_ITERATIONS doit être compris entre 1 et 100.')
}

const auth = await fetch(`${apiUrl}/api/auth/login/`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
if (!auth.ok) throw new Error(`Connexion de recette refusée (HTTP ${auth.status}).`)
const tokens = await auth.json()

const browser = await chromium.launch({ headless: true })
const results = []
try {
  for (let i = 0; i < iterations; i += 1) {
    const context = await browser.newContext()
    await context.addInitScript(({ access, refresh }) => {
      localStorage.setItem('sf_access', access)
      localStorage.setItem('sf_refresh', refresh)
    }, { access: tokens.access, refresh: tokens.refresh })
    const page = await context.newPage()
    const started = performance.now()
    const response = await page.goto(`${appUrl}/admin/dashboard`, { waitUntil: 'domcontentloaded' })
    if (!response?.ok()) throw new Error(`Dashboard HTTP ${response?.status() ?? 'sans réponse'}.`)
    await page.getByRole('heading', { name: 'État des équipements' }).waitFor({ state: 'visible', timeout: 30_000 })
    results.push(performance.now() - started)
    await context.close()
  }
} finally {
  await browser.close()
}

const sorted = [...results].sort((a, b) => a - b)
const percentile = (p) => sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)]
console.log(JSON.stringify({
  browser: 'Chromium headless',
  iterations,
  criterion_ms: 3000,
  measured_ms: {
    min: Math.round(sorted[0]),
    median: Math.round((sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2),
    p95: Math.round(percentile(95)),
    max: Math.round(sorted.at(-1)),
  },
}, null, 2))
