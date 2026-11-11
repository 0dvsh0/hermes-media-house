/**
 * Shared utility functions: truncation, asset normalization, dates, streaks, math
 */

export function truncateTitle(title, maxChars = 40) {
  if (!title) return ''
  const str = String(title)
  if (str.length <= maxChars) return str
  return str.slice(0, maxChars) + '...'
}

export function normalizeAssetSrc(src) {
  if (!src || typeof src !== 'string') return ''
  if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) return src
  let clean = src.replace(/^\/+/, '')
  if (clean.startsWith('api/plugins/hermes-media-desk/')) {
    clean = clean.replace(/^api\/plugins\/hermes-media-desk\//, '')
  }
  if (clean.startsWith('files/')) {
    return `media-desk/${clean}`
  }
  if (clean.startsWith('assets/')) {
    return `media-desk/${clean}`
  }
  return clean
}

export function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0
  }
  return h
}

export function hashPos(id) {
  const h = hash(String(id || ''))
  const angle = (h % 360) * (Math.PI / 180)
  const distance = 160 + (h % 280)
  const x = Math.round(Math.cos(angle) * distance)
  const y = Math.round(Math.sin(angle) * distance * 0.72)
  const rotation = ((h % 15) - 7)
  return { x, y, rotation }
}

export function seeded(seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function dayKey(val) {
  if (!val) return ''
  const d = typeof val === 'string' ? new Date(val) : val
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export function todayLocal() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDateLabel(isoString, locTag = 'en-US') {
  if (!isoString) return ''
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locTag, {
    month: 'short',
    day: 'numeric',
  }).format(d)
}

export function formatCompact(n) {
  const num = Number(n) || 0
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return String(num)
}

export function formatClock(isoString, locTag = 'en-US') {
  if (!isoString) return ''
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locTag, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

export function engagementsOf(item) {
  if (!item) return 0
  if (typeof item.engagements === 'number') return item.engagements
  const m = item.metrics || item
  return (
    Number(m.likes || 0) +
    Number(m.comments || 0) +
    Number(m.shares || 0) +
    Number(m.saves || 0)
  )
}

export function computeStreak(items) {
  if (!items || !items.length) return 0
  const daySet = new Set()
  for (const it of items) {
    if (it.createdAt) {
      const k = dayKey(it.createdAt)
      if (k) daySet.add(k)
    }
  }
  let streak = 0
  const cur = new Date()
  while (true) {
    const k = dayKey(cur)
    if (daySet.has(k)) {
      streak += 1
      cur.setDate(cur.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

export function relativeDay(isoString) {
  if (!isoString) return ''
  const target = new Date(isoString)
  if (isNaN(target.getTime())) return ''
  const now = new Date()
  const diffDays = Math.round((target - now) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 1 && diffDays <= 7) return `in ${diffDays} days`
  if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`
  return target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function displayItem(raw) {
  if (!raw) return { id: '', title: '' }
  const prod = raw.production
  const done = prod && prod.status === 'done'
  return {
    ...raw,
    title: (done && prod.title) || raw.title || 'Untitled',
    body: (done && prod.article) || raw.body || '',
  }
}

export function getItemThumbnailSrc(item) {
  if (!item) return null
  if (item.media) {
    if (item.media.poster) return item.media.poster
    if (item.media.src) {
      if (item.media.src.endsWith('.mp4')) {
        return item.media.src.replace(/\.mp4$/i, '-poster.jpg')
      }
      return item.media.src
    }
  }
  if (item.production && item.production.cover && item.production.cover.src) {
    return item.production.cover.src
  }
  return null
}

export function posterOf(item) {
  const thumb = getItemThumbnailSrc(item)
  return thumb ? normalizeAssetSrc(thumb) : null
}

export function isIdea(item) {
  return !item.parentId
}

export const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function springEasing(stiffness = 170, damping = 20, mass = 1) {
  const w0 = Math.sqrt(stiffness / mass)
  const zeta = damping / (2 * Math.sqrt(stiffness * mass))
  const wd = w0 * Math.sqrt(Math.max(1 - zeta * zeta, 1e-4))
  const at = t =>
    1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t))
  let duration = 0.1
  while (
    duration < 4 &&
    (Math.abs(at(duration) - 1) > 0.002 || Math.abs(at(duration + 0.05) - 1) > 0.002)
  )
    duration += 0.05
  const points = []
  const N = 36
  for (let i = 0; i <= N; i += 1) points.push(Number(at((i / N) * duration).toFixed(4)))
  points[N] = 1
  return {
    easing: `linear(${points.join(',')})`,
    duration: Math.round(duration * 1000),
    stiffness,
    damping,
  }
}

export const SPRING_SOFT = springEasing(120, 16)
export const SPRING_SNAP = springEasing(260, 24)
