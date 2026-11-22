import React from 'react'

function safeHref(value) {
  try {
    const url = new URL(value, window.location.origin)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

function renderInline(text) {
  const tokens = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  const parts = String(text).split(tokens).filter(Boolean)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="rounded bg-slate-100 px-1 py-0.5">{part.slice(1, -1)}</code>
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      const href = safeHref(link[2])
      if (!href) return <React.Fragment key={index}>{part}</React.Fragment>
      return <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">{link[1]}</a>
    }
    return <React.Fragment key={index}>{part}</React.Fragment>
  })
}

function tableCells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
}

function isTableDivider(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

export default function SafeMarkdown({ children }) {
  const lines = String(children || '').split(/\r?\n/)
  const blocks = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) { index += 1; continue }

    if (line.includes('|') && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const headers = tableCells(line)
      index += 2
      const rows = []
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(tableCells(lines[index]))
        index += 1
      }
      blocks.push(
        <div key={`table-${index}`} className="my-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead><tr>{headers.map((cell, cellIndex) => <th key={cellIndex} className="border border-slate-300 px-3 py-2 text-left">{renderInline(cell)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, cellIndex) => <td key={cellIndex} className="border border-slate-300 px-3 py-2">{renderInline(row[cellIndex] || '')}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      const Tag = `h${Math.min(heading[1].length + 1, 5)}`
      blocks.push(<Tag key={`heading-${index}`} className="my-2 font-semibold">{renderInline(heading[2])}</Tag>)
      index += 1
      continue
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/)
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/)
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered)
      const items = []
      while (index < lines.length) {
        const match = lines[index].match(isOrdered ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/)
        if (!match) break
        items.push(match[1])
        index += 1
      }
      const Tag = isOrdered ? 'ol' : 'ul'
      blocks.push(<Tag key={`list-${index}`} className={`${isOrdered ? 'list-decimal' : 'list-disc'} my-2 pl-6`}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</Tag>)
      continue
    }

    const paragraph = [line]
    index += 1
    while (index < lines.length && lines[index].trim() && !/^(#{1,4})\s/.test(lines[index])
      && !/^\s*[-*+]\s+/.test(lines[index]) && !/^\s*\d+[.)]\s+/.test(lines[index])) {
      paragraph.push(lines[index])
      index += 1
    }
    blocks.push(<p key={`paragraph-${index}`} className="my-2 whitespace-pre-wrap">{paragraph.map((part, partIndex) => <React.Fragment key={partIndex}>{partIndex > 0 && <br />}{renderInline(part)}</React.Fragment>)}</p>)
  }
  return <div className="voice-safe-markdown break-words">{blocks}</div>
}
