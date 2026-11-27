import { expect, test } from '@playwright/test'

test('parcours réel : connexion, création, lecture et rejet du doublon en base', async ({ page, browserName }) => {
  const email = process.env.E2E_ADMIN_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD
  test.skip(!email || !password, 'Lancer scripts/run-real-e2e.ps1 pour utiliser la base isolée.')

  await page.goto('/login')
  await page.getByLabel('Adresse e-mail').fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await page.getByRole('button', { name: /se connecter/i }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard$/)

  const identifier = `E2E-${browserName.toUpperCase()}`
  const rejectedResult = await page.evaluate(async ({ machineIdentifier }) => {
    const token = localStorage.getItem('sf_access')
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    const invalidBody = JSON.stringify({
      nom: '',
      identifiant_interne: machineIdentifier,
      type_equipement: 'POMPE',
      statut: 'NORMAL',
    })
    const rejected = await fetch('/api/equipements/machines/', { method: 'POST', headers, body: invalidBody })
    const afterRejected = await fetch('/api/equipements/machines/', { headers })
    const afterRejectedData = await afterRejected.json()
    const absentAfterRejected = !(afterRejectedData.results || []).some((machine) => machine.identifiant_interne === machineIdentifier)
    return { rejectedStatus: rejected.status, absentAfterRejected }
  }, { machineIdentifier: identifier })

  // La création suit le vrai formulaire React ; ses requêtes vont vers l’API et la base isolée.
  await page.goto('/machines/new')
  await page.getByPlaceholder('Ex: Presse hydraulique A1').fill(`Machine de recette ${identifier}`)
  await page.getByPlaceholder('Ex: MCH-A01').fill(identifier)
  await page.getByRole('button', { name: 'Créer la machine' }).click()
  await expect(page).toHaveURL(/\/machines$/)

  const result = await page.evaluate(async ({ machineIdentifier }) => {
    const token = localStorage.getItem('sf_access')
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    const listed = await fetch('/api/equipements/machines/', { headers })
    const listData = await listed.json()
    const matches = (listData.results || []).filter((machine) => machine.identifiant_interne === machineIdentifier)
    const body = JSON.stringify({
      nom: `Machine de recette ${machineIdentifier}`,
      identifiant_interne: machineIdentifier,
      type_equipement: 'POMPE',
      statut: 'NORMAL',
    })
    const repeated = await fetch('/api/equipements/machines/', { method: 'POST', headers, body })
    const auditResponse = await fetch('/api/auth/audit-logs/?limit=200', { headers })
    const auditData = await auditResponse.json()
    const createWasAudited = (auditData.results || []).some((event) =>
      event.acteur_email === 'admin.e2e@example.test'
      && event.methode === 'POST'
      && event.chemin === '/api/equipements/machines/'
      && event.code_http === 201,
    )
    return {
      listStatus: listed.status,
      persistedCount: matches.length,
      duplicateStatus: repeated.status,
      auditStatus: auditResponse.status,
      createWasAudited,
    }
  }, { machineIdentifier: identifier })

  expect(result).toEqual({
    listStatus: 200,
    persistedCount: 1,
    duplicateStatus: 400,
    auditStatus: 200,
    createWasAudited: true,
  })
  expect(rejectedResult).toEqual({ rejectedStatus: 400, absentAfterRejected: true })
})

test('recette a11y de base : libellés, tabulation, focus et contraste du formulaire de connexion', async ({ page }) => {
  await page.goto('/login')
  const email = page.getByLabel('Adresse e-mail')
  const password = page.getByLabel('Mot de passe', { exact: true })
  await expect(email).toBeVisible()
  await expect(password).toBeVisible()

  await email.focus()
  await page.keyboard.press('Tab')
  await expect(password).toBeFocused()
  const checks = await page.evaluate(() => {
    const label = document.querySelector('label[for="' + document.activeElement.id + '"]')
    const color = getComputedStyle(label).color.match(/[\d.]+/g).map(Number)
    const input = getComputedStyle(document.activeElement)
    const background = input.backgroundColor.match(/[\d.]+/g).map(Number)
    const luminance = (rgb) => rgb.slice(0, 3).map((channel) => {
      const value = channel / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
    const pair = [luminance(color), luminance(background)].sort((a, b) => b - a)
    return {
      labelAssociated: Boolean(label),
      focusIndicator: input.outlineStyle !== 'none' || input.boxShadow !== 'none',
      contrast: (pair[0] + 0.05) / (pair[1] + 0.05),
    }
  })
  expect(checks.labelAssociated).toBe(true)
  expect(checks.focusIndicator).toBe(true)
  expect(checks.contrast).toBeGreaterThanOrEqual(4.5)
})
