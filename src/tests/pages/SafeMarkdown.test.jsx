import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import SafeMarkdown from '../../pages/vocal/SafeMarkdown'

describe('SafeMarkdown', () => {
  it('affiche du HTML hostile comme texte sans créer de nœuds actifs', () => {
    const content = '<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n[x](javascript:alert(1))'
    const { container } = render(<SafeMarkdown>{content}</SafeMarkdown>)
    expect(container.querySelector('script')).not.toBeInTheDocument()
    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(container.querySelector('a[href^="javascript:"]')).not.toBeInTheDocument()
    expect(container.textContent).toContain('<script>alert(1)</script>')
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
  })

  it('affiche des listes, tableaux et liens HTTPS sans HTML brut', () => {
    const { container } = render(<SafeMarkdown>{'**Machines**\n- Pompe\n- Presse\n\n| Nom | Statut |\n| --- | --- |\n| CNC | active |\n\n[Documentation](https://example.com)'}</SafeMarkdown>)
    expect(container.querySelector('strong')).toHaveTextContent('Machines')
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(container.querySelector('table')).toBeInTheDocument()
    expect(container.querySelector('a[href="https://example.com/"]')).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
