import { expect, test } from '@playwright/test'

const roles = [
  { role: 'ADMIN', path: '/admin/dashboard' },
  { role: 'TECHNICIEN', path: '/technician/dashboard' },
  { role: 'OPERATEUR', path: '/operator/dashboard' },
]

async function stubApi(page, role) {
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url())
    if (pathname.endsWith('/auth/login/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access: 'e2e-access-token', refresh: 'e2e-refresh-token' }),
      })
      return
    }
    if (pathname.endsWith('/auth/me/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 42, email: 'e2e@example.test', role, prenom: 'Test', nom: role }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 0, results: [] }),
    })
  })
}

for (const { role, path } of roles) {
  test(`connexion ${role} ouvre sa page d’accueil`, async ({ page }) => {
    await stubApi(page, role)
    await page.goto('/login')
    await page.getByPlaceholder('Saisissez votre adresse e-mail').fill('e2e@example.test')
    await page.getByPlaceholder('••••••••').fill('MotDePasse-E2E-123!')
    await page.getByRole('button', { name: /se connecter/i }).click()
    await expect(page).toHaveURL(new RegExp(`${path.replaceAll('/', '\\/')}$`))
  })
}

test('une route protégée renvoie un visiteur non connecté vers la connexion', async ({ page }) => {
  await page.goto('/admin/users')
  await expect(page).toHaveURL(/\/login$/)
})
