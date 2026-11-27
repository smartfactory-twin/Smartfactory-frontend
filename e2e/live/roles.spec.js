import { expect, test } from '@playwright/test'

const accounts = [
  { role: 'ADMIN', home: '/admin/dashboard', email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD },
  { role: 'TECHNICIEN', home: '/technician/dashboard', email: process.env.E2E_TECHNICIAN_EMAIL, password: process.env.E2E_TECHNICIAN_PASSWORD },
  { role: 'OPERATEUR', home: '/operator/dashboard', email: process.env.E2E_OPERATOR_EMAIL, password: process.env.E2E_OPERATOR_PASSWORD },
]

for (const account of accounts) {
  test(`API réelle : connexion ${account.role}`, async ({ page }) => {
    test.skip(!account.email || !account.password, `Renseigner les variables E2E pour ${account.role}.`)

    await page.goto('/login')
    await page.getByLabel('Adresse e-mail').fill(account.email)
    await page.getByLabel('Mot de passe', { exact: true }).fill(account.password)
    await page.getByRole('button', { name: /se connecter/i }).click()
    await expect(page).toHaveURL(new RegExp(`${account.home.replaceAll('/', '\\/')}$`))
  })
}

for (const account of accounts.filter(({ role }) => role !== 'ADMIN')) {
  test(`API réelle : ${account.role} ne peut pas ouvrir l’administration`, async ({ page }) => {
    test.skip(!account.email || !account.password, `Renseigner les variables E2E pour ${account.role}.`)

    await page.goto('/login')
    await page.getByLabel('Adresse e-mail').fill(account.email)
    await page.getByLabel('Mot de passe', { exact: true }).fill(account.password)
    await page.getByRole('button', { name: /se connecter/i }).click()
    await expect(page).toHaveURL(new RegExp(`${account.home.replaceAll('/', '\\/')}$`))
    await page.goto('/admin/users')
    await expect(page).toHaveURL(/\/unauthorized$/)
  })
}
