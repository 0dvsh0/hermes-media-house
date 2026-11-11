/**
 * Related Ideas Detection and Clustered Layout
 */

const STOP_EN = new Set(
  'a an and are as at be but by can do for from how i if in into is it its me my of on or our so that the this to was we what when why with you your'.split(
    ' '
  )
)

export function terms(text) {
  const out = new Map()
  const add = (term, weight) => {
    if (!out.has(term) || out.get(term) < weight) out.set(term, weight)
  }
  for (const word of (text || '').toLowerCase().match(/[a-z0-9][a-z0-9+#.-]*/g) ?? []) {
    const clean = word.replace(/[.-]+$/, '')
    if (clean.length >= 2 && !STOP_EN.has(clean)) add(clean, 1)
  }
  return [...out].map(([term, weight]) => ({ term, weight }))
}

function has(haystack, term) {
  if (!haystack) return false
  if (/^[a-z0-9]/.test(term)) {
    return new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(
      haystack
    )
  }
  return haystack.includes(term)
}

export function relatedIdeas(items, query, limit = 6) {
  const list = terms(query)
  if (!list.length) return []
  const scored = []
  for (const item of items) {
    const title = `${item.title ?? ''} ${item.production?.title ?? ''}`.toLowerCase()
    const tags = (item.tags ?? []).join(' ').toLowerCase()
    const body = `${item.body ?? ''} ${item.production?.article ?? ''} ${item.source ?? ''}`.toLowerCase()
    let score = 0
    let strong = false
    for (const { term, weight } of list) {
      if (has(title, term)) {
        score += 3 * weight
        strong = strong || weight >= 1
      } else if (has(tags, term)) {
        score += 2 * weight
        strong = strong || weight >= 1
      } else if (has(body, term)) {
        score += weight
        strong = strong || weight >= 1
      }
    }
    if (strong || score >= 3) {
      scored.push({ id: item.id, score, at: Date.parse(item.createdAt || 0) || 0 })
    }
  }
  return scored
    .sort((a, b) => b.score - a.score || b.at - a.at)
    .slice(0, limit)
    .map(row => row.id)
}

export function relatedLayout(cards) {
  const MAX_H = 640
  const GAP = 20
  const sides = { [-1]: [[]], [1]: [[]] }
  cards.forEach((card, index) => {
    const side = sides[index % 2 === 0 ? -1 : 1]
    let column = side[side.length - 1]
    const used = column.reduce((sum, c) => sum + c.h + GAP, 0)
    if (column.length && used + card.h > MAX_H) side.push((column = []))
    column.push(card)
  })
  const out = {}
  for (const sign of [-1, 1]) {
    sides[sign].forEach((column, k) => {
      const total = column.reduce((sum, c) => sum + c.h, 0) + GAP * (column.length - 1)
      let y = -total / 2
      for (const card of column) {
        out[card.id] = { x: sign * (430 + k * 300), y: Math.round(y + card.h / 2) }
        y += card.h + GAP
      }
    })
  }
  return out
}
