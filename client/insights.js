/**
 * Analytics and Data Insights Page
 * Performance totals, charts, CSV export, rule learning, and Monid account import.
 */

import { jsx, jsxs } from 'react/jsx-runtime'
import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useCallback,
} from 'react'
import { AppContext } from './app.js'
import { GHOST_BTN, PRIMARY_PILL, SECONDARY_PILL, SELECT_STYLE, SELECT_OPTION_STYLE } from './constants.js'
import { MediaImage, resolveMediaUrl } from './card.js'
import { formatCompact, formatDateLabel, engagementsOf, truncateTitle } from './util.js'

// 7b. Insights CSV export (Requirement 18.8)
// ---------------------------------------------------------------------------

export function exportInsightsToCsv(items) {
  if (!items || items.length === 0) return ''
  const headers = ['Title', 'Platform', 'Status', 'Views', 'Likes', 'Comments', 'Shares', 'Saves']
  const escapeCell = val => {
    const s = String(val ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  const lines = [headers.join(',')]
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    lines.push(
      [
        escapeCell(it.title || it.itemId || ''),
        escapeCell(it.platform || ''),
        escapeCell(it.status || ''),
        it.views || 0,
        it.likes || 0,
        it.comments || 0,
        it.shares || 0,
        it.saves || 0,
      ].join(',')
    )
  }
  const csvContent = lines.join('\n')
  if (typeof Blob !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'media-desk-insights.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
  return csvContent
}

// ---------------------------------------------------------------------------
// 8. Insights Page (Requirements 18.1-18.9, 21.4)
// ---------------------------------------------------------------------------

const INSIGHT_PALETTE = [
  'var(--ui-blue)',
  'var(--ui-purple)',
  'var(--ui-green)',
  'var(--ui-orange)',
  'var(--ui-cyan)',
  'var(--ui-yellow)',
]

export function InsightsPage() {
  const { state, dispatch, rest, t, localeTag } = useContext(AppContext)
  const items = (state.serverState && state.serverState.items) || []
  const metrics = (state.serverState && state.serverState.metrics) || []

  const [data, setData] = useState(null)
  const [chartMode, setChartMode] = useState('chart')
  const [showAddStats, setShowAddStats] = useState(false)
  const [showPasteCsv, setShowPasteCsv] = useState(false)
  const [showMonid, setShowMonid] = useState(false)
  const [statItemId, setStatItemId] = useState('')
  const [statForm, setStatForm] = useState({
    views: '',
    likes: '',
    comments: '',
    shares: '',
    saves: '',
  })
  const [csvText, setCsvText] = useState('')
  const [statMsg, setStatMsg] = useState('')
  const [suggestions, setSuggestions] = useState(null)
  const [learning, setLearning] = useState(false)
  const [learnMsg, setLearnMsg] = useState('')
  const [learnError, setLearnError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportOk, setExportOk] = useState('')

  const metricsCount = metrics.length
  useEffect(() => {
    let cancelled = false
    rest('/insights')
      .then(res => {
        if (!cancelled) setData(res || { items: [], totals: {} })
      })
      .catch(() => {
        if (!cancelled) setData({ items: [], totals: {} })
      })
    return () => {
      cancelled = true
    }
  }, [rest, metricsCount])

  const totals = (data && data.totals) || {}
  const rows = (data && data.items) || []
  const topList = rows.slice().sort((a, b) => (b.engagements || 0) - (a.engagements || 0))
  const itemById = useMemo(() => {
    const map = {}
    for (let i = 0; i < items.length; i++) map[items[i].id] = items[i]
    return map
  }, [items])

  const clientTotal = metrics.reduce((acc, m) => acc + engagementsOf(m), 0)
  const totalEngagements = Number(totals.engagements) || clientTotal
  const publishedCount = items.filter(i => i.status === 'published').length
  const leadPiece = topList[0]

  // Last-14-day daily engagement series, computed client-side from metrics.
  const dailySeries = useMemo(() => {
    const out = []
    const now = new Date()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      let value = 0
      for (let j = 0; j < metrics.length; j++) {
        const mDate = metrics[j].date ? String(metrics[j].date).slice(0, 10) : ''
        if (mDate === key) value += engagementsOf(metrics[j])
      }
      out.push({ date: key, value })
    }
    return out
  }, [metrics])
  const seriesTotal = dailySeries.reduce((acc, p) => acc + p.value, 0)

  const byPlatform = useMemo(() => {
    const map = {}
    for (let i = 0; i < metrics.length; i++) {
      const it = itemById[metrics[i].itemId]
      const plat = (it && it.platform) || ''
      if (!plat) continue
      if (!map[plat]) map[plat] = 0
      map[plat] += engagementsOf(metrics[i])
    }
    return Object.keys(map)
      .map(k => ({ platform: k, value: map[k] }))
      .sort((a, b) => b.value - a.value)
  }, [metrics, itemById])

  // --- Actions -------------------------------------------------------------
  const num = v => Math.max(0, parseInt(v, 10) || 0)

  const submitStat = () => {
    if (!statItemId) return
    const op = {
      op: 'add_metric',
      id: `metric-${Date.now().toString(36)}`,
      itemId: statItemId,
      date: todayLocal(),
      views: num(statForm.views),
      likes: num(statForm.likes),
      comments: num(statForm.comments),
      shares: num(statForm.shares),
      saves: num(statForm.saves),
      sample: false,
    }
    rest('/ops', { method: 'POST', body: JSON.stringify({ ops: [op] }) })
      .then(res => {
        if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
        setStatMsg(t('insights.statSaved'))
        setShowAddStats(false)
        setStatForm({ views: '', likes: '', comments: '', shares: '', saves: '' })
      })
      .catch(err => {
        setStatMsg((err && err.message) || String(err))
      })
  }

  const submitCsv = () => {
    const text = csvText.trim()
    if (!text) return
    const titleMap = {}
    for (let i = 0; i < items.length; i++) {
      if (items[i].title) titleMap[items[i].title.trim()] = items[i]
    }
    const ops = []
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(',').map(s => s.trim())
      if (parts.length < 6) continue
      const title = parts[0]
      if (!title || title.toLowerCase() === 'title') continue
      const it = titleMap[title]
      if (!it) continue
      const nums = parts.slice(1, 6).map(v => Math.max(0, parseInt(v, 10) || 0))
      ops.push({
        op: 'add_metric',
        id: `metric-${Date.now().toString(36)}-${ops.length}`,
        itemId: it.id,
        date: todayLocal(),
        views: nums[0],
        likes: nums[1],
        comments: nums[2],
        shares: nums[3],
        saves: nums[4],
        sample: false,
      })
    }
    if (ops.length === 0) {
      setStatMsg(t('insights.empty'))
      return
    }
    rest('/ops', { method: 'POST', body: JSON.stringify({ ops }) })
      .then(res => {
        if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
        setStatMsg(`${t('insights.statSaved')} (${ops.length})`)
        setCsvText('')
        setShowPasteCsv(false)
      })
      .catch(err => {
        setStatMsg((err && err.message) || String(err))
      })
  }

  const runLearn = () => {
    setLearning(true)
    setLearnError('')
    setLearnMsg('')
    rest('/skills/learn', { method: 'POST', body: JSON.stringify({}) })
      .then(res => {
        setLearning(false)
        const proposed = (res && res.proposed) || []
        setSuggestions(proposed.map(s => s.text).filter(Boolean))
        if (res && res.count != null) {
          setLearnMsg(t('insights.learnSuccess').replace('{count}', String(res.count)))
        }
        if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
      })
      .catch(err => {
        setLearning(false)
        setLearnError(`${t('insights.learnFailed')} ${err.message || String(err)}`)
      })
  }

  const runExportSkill = () => {
    setExporting(true)
    rest('/skills/export', { method: 'POST', body: JSON.stringify({}) })
      .then(res => {
        setExporting(false)
        setExportOk(res && res.exported ? t('insights.exportSuccess') : t('insights.exportFailed'))
        if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
      })
      .catch(() => {
        setExporting(false)
        setExportOk(t('insights.exportFailed'))
      })
  }

  // --- Chart geometry ------------------------------------------------------
  const svgW = 640
  const svgH = 190
  const padL = 42
  const padR = 18
  const padT = 14
  const padB = 26
  const innerW = svgW - padL - padR
  const innerH = svgH - padT - padB
  const maxY = Math.max(1, ...dailySeries.map(p => p.value))
  const pts = dailySeries.map((p, idx) => ({
    x: padL + (idx / Math.max(1, dailySeries.length - 1)) * innerW,
    y: padT + innerH - (p.value / maxY) * innerH,
  }))
  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
  const areaPath =
    pts.length > 0
      ? `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`
      : ''
  const xLabelIdx = [0, 4, 8, 11, 13]
  const yLabels = [
    { y: padT, text: formatCompact(Math.round(maxY), localeTag) },
    { y: padT + innerH / 2, text: formatCompact(Math.round(maxY / 2), localeTag) },
    { y: padT + innerH, text: '0' },
  ]

  // Headline: split the localized template on placeholders and bold numbers.
  const headlineParts = t('insights.headline')
    .split(/(\{count\}|\{total\})/)
    .map(part => {
      if (part === '{count}') return { bold: true, text: formatCompact(topList.length, localeTag) }
      if (part === '{total}') {
        return { bold: true, text: formatCompact(totalEngagements, localeTag) }
      }
      return { bold: false, text: part }
    })
    .filter(p => p.text !== '')

  const segBtn = active => ({
    padding: '4px 10px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '11.5px',
    fontWeight: 500,
    transition: 'background-color 250ms ease, color 250ms ease',
    backgroundColor: active ? 'var(--color-card)' : 'transparent',
    color: active ? 'var(--color-foreground)' : 'var(--ui-text-tertiary)',
    boxShadow: active ? 'var(--shadow-sm)' : 'none',
  })
  const panelStyle = {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-xl)',
    padding: '20px',
    boxShadow: 'var(--shadow-sm)',
  }
  const leadThumb = leadPiece && itemById[leadPiece.itemId]
  const leadThumbSrc = leadThumb
    ? resolveMediaUrl(
        (leadThumb.media && leadThumb.media.src) ||
          (leadThumb.production && leadThumb.production.cover && leadThumb.production.cover.src)
      )
    : null

  return jsxs('div', {
    className: 'md-board-page',
    style: {
      flex: 1,
      height: '100%',
      overflowY: 'auto',
      padding: '8px 20px 32px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      backgroundColor: 'var(--ui-bg-chrome, var(--color-background))',
    },
    children: [
      // Hero summary banner.
      jsxs('div', {
        style: {
          ...HERO_GRADIENT,
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px',
        },
        children: [
          jsxs('div', {
            style: { maxWidth: '640px', minWidth: 0 },
            children: [
              jsx('div', {
                style: {
                  fontSize: '28px',
                  lineHeight: 1.3,
                  letterSpacing: '-0.02em',
                  color: 'var(--ui-text-quaternary)',
                },
                children: headlineParts.map((part, i) =>
                  jsx(
                    'span',
                    {
                      key: `hp-${i}`,
                      style: part.bold
                        ? {
                            color: 'var(--color-foreground)',
                            fontWeight: 400,
                            fontVariantNumeric: 'tabular-nums',
                          }
                        : { color: 'var(--ui-text-quaternary)' },
                      children: part.text,
                    },
                    `hp-${i}`
                  )
                ),
              }),
              jsxs('div', {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '27px',
                  lineHeight: 1.35,
                  letterSpacing: '-0.02em',
                  color: 'var(--ui-text-quaternary)',
                  marginTop: '2px',
                },
                children: [
                  jsx('span', { style: { flexShrink: 0 }, children: t('insights.ledBy') }),
                  leadThumb
                    ? jsx(MediaImage, {
                        src:
                          (leadThumb.media && leadThumb.media.src) ||
                          (leadThumb.production &&
                            leadThumb.production.cover &&
                            leadThumb.production.cover.src),
                        alt: '',
                        draggable: false,
                        style: {
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '1px solid var(--color-border)',
                          flexShrink: 0,
                        },
                      })
                    : jsx('span', {
                        style: {
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: THUMB_FALLBACK_GRADIENT,
                          flexShrink: 0,
                        },
                      }),
                  jsx('span', {
                    style: {
                      color: 'var(--color-foreground)',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      minWidth: 0,
                    },
                    children: leadPiece
                      ? leadPiece.title || t('item.untitled')
                      : t('insights.empty'),
                  }),
                ],
              }),
              // Action pills.
              jsxs('div', {
                style: {
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '20px',
                },
                children: [
                  jsx('button', {
                    type: 'button',
                    onClick: () => setShowMonid(true),
                    style: PRIMARY_PILL,
                    children: t('insights.importAccount'),
                  }),
                  jsx('button', {
                    type: 'button',
                    onClick: () => setShowAddStats(v => !v),
                    style: SECONDARY_PILL,
                    children: t('insights.addStats'),
                  }),
                  jsx('button', {
                    type: 'button',
                    onClick: () => setShowPasteCsv(v => !v),
                    style: SECONDARY_PILL,
                    children: t('insights.pasteCsv'),
                  }),
                ],
              }),
              // Add-stats inline form: item picker + five counters.
              showAddStats
                ? jsxs('div', {
                    style: {
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '12px',
                      backgroundColor: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '10px',
                    },
                    children: [
                      jsx('select', {
                        value: statItemId,
                        onChange: e => setStatItemId(e.target.value),
                        style: { ...SELECT_STYLE, maxWidth: '240px' },
                        children: [
                          jsx('option', { value: '', style: SELECT_OPTION_STYLE, children: t('insights.statItem') }),
                          items.map(it =>
                            jsx('option', {
                              key: it.id,
                              value: it.id,
                              style: SELECT_OPTION_STYLE,
                              children: truncateTitle(it.title || t('item.untitled'), 30),
                            })
                          ),
                        ],
                      }),
                      ['views', 'likes', 'comments', 'shares', 'saves'].map(field =>
                        jsx('input', {
                          key: `sf-${field}`,
                          type: 'number',
                          min: 0,
                          placeholder: t(`insights.${field}`),
                          value: statForm[field],
                          onChange: e => setStatForm({ ...statForm, [field]: e.target.value }),
                          style: { ...INPUT_STYLE, width: '84px' },
                        })
                      ),
                      jsx('button', {
                        type: 'button',
                        onClick: submitStat,
                        style: PRIMARY_PILL,
                        children: t('common.save'),
                      }),
                    ],
                  })
                : null,
              // Paste-CSV inline form: title,views,likes,comments,shares,saves.
              showPasteCsv
                ? jsxs('div', {
                    style: {
                      marginTop: '12px',
                      backgroundColor: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      maxWidth: '480px',
                    },
                    children: [
                      jsx('textarea', {
                        rows: 4,
                        value: csvText,
                        onChange: e => setCsvText(e.target.value),
                        placeholder: 'title,views,likes,comments,shares,saves',
                        style: {
                          ...INPUT_STYLE,
                          width: '100%',
                          resize: 'vertical',
                          fontFamily: 'inherit',
                        },
                      }),
                      jsx('button', {
                        type: 'button',
                        onClick: submitCsv,
                        style: { ...PRIMARY_PILL, alignSelf: 'flex-start' },
                        children: t('common.save'),
                      }),
                    ],
                  })
                : null,
            ],
          }),
          // Right hero metrics.
          jsxs('div', {
            style: { display: 'flex', alignItems: 'center', gap: '32px', paddingRight: '16px' },
            children: [
              jsx(
                'div',
                {
                  children: [
                    jsx('div', {
                      style: {
                        fontSize: '11.5px',
                        color: 'var(--ui-text-quaternary)',
                        marginBottom: '4px',
                      },
                      children: t('insights.totalEngagements'),
                    }),
                    jsx('div', {
                      style: {
                        fontFamily: SERIF_FONT,
                        fontSize: '36px',
                        lineHeight: 1,
                        color: 'var(--color-foreground)',
                        fontVariantNumeric: 'tabular-nums',
                      },
                      children: formatCompact(totalEngagements, localeTag),
                    }),
                  ],
                },
                'm-total'
              ),
              jsx(
                'div',
                {
                  children: [
                    jsx('div', {
                      style: {
                        fontSize: '11.5px',
                        color: 'var(--ui-text-quaternary)',
                        marginBottom: '4px',
                      },
                      children: t('insights.publishedPieces'),
                    }),
                    jsx('div', {
                      style: {
                        fontFamily: SERIF_FONT,
                        fontSize: '36px',
                        lineHeight: 1,
                        color: 'var(--color-foreground)',
                        fontVariantNumeric: 'tabular-nums',
                      },
                      children: publishedCount,
                    }),
                  ],
                },
                'm-published'
              ),
            ],
          }),
        ],
      }),
      statMsg
        ? jsx('div', {
            style: {
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'color-mix(in srgb, var(--ui-green) 10%, var(--color-background))',
              color: 'var(--ui-green)',
              fontSize: '12px',
            },
            children: statMsg,
          })
        : null,
      // Middle row: daily chart (7/12) + by platform (5/12).
      jsxs('div', {
        style: { display: 'grid', gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)', gap: '14px' },
        children: [
          jsxs('div', { style: panelStyle, children: [
            jsxs('div', {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              },
              children: [
                jsx('h2', {
                  style: { fontSize: '13.5px', fontWeight: 600, color: 'var(--color-foreground)', margin: 0 },
                  children: t('insights.dailyChart'),
                }),
                jsxs('div', {
                  style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor:
                      'color-mix(in srgb, var(--color-foreground) 8%, var(--color-background))',
                  },
                  children: [
                    jsx('button', {
                      type: 'button',
                      onClick: () => setChartMode('chart'),
                      style: segBtn(chartMode === 'chart'),
                      children: t('insights.chart'),
                    }),
                    jsx('button', {
                      type: 'button',
                      onClick: () => setChartMode('table'),
                      style: segBtn(chartMode === 'table'),
                      children: t('insights.table'),
                    }),
                  ],
                }),
              ],
            }),
            seriesTotal === 0
              ? jsx('div', {
                  style: {
                    height: '190px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12.5px',
                    color: 'var(--ui-text-quaternary)',
                    textAlign: 'center',
                  },
                  children: t('insights.noSeries'),
                })
              : chartMode === 'chart'
                ? jsxs('div', {
                    style: { width: '100%', overflow: 'hidden' },
                    children: [
                      jsxs(
                        'svg',
                        {
                          viewBox: `0 0 ${svgW} ${svgH}`,
                          role: 'img',
                          'aria-label': t('insights.dailyChart'),
                          style: {
                            width: '100%',
                            height: '200px',
                            display: 'block',
                            overflow: 'visible',
                          },
                          children: [
                            jsxs(
                              'defs',
                              {
                                children: [
                                  jsxs(
                                    'linearGradient',
                                    {
                                      id: 'mdEngGradient',
                                      x1: 0,
                                      y1: 0,
                                      x2: 0,
                                      y2: 1,
                                      children: [
                                        jsx('stop', {
                                          offset: '0%',
                                          stopColor: 'var(--ui-blue)',
                                          stopOpacity: 0.24,
                                        }),
                                        jsx('stop', {
                                          offset: '100%',
                                          stopColor: 'var(--ui-blue)',
                                          stopOpacity: 0,
                                        }),
                                      ],
                                    },
                                    'grad'
                                  ),
                                ],
                              },
                              'defs'
                            ),
                            yLabels.map((yl, i) =>
                              jsxs(
                                'g',
                                {
                                  children: [
                                    jsx('line', {
                                      x1: padL,
                                      y1: yl.y,
                                      x2: svgW - padR,
                                      y2: yl.y,
                                      stroke: 'var(--ui-stroke-tertiary)',
                                      strokeWidth: 1,
                                    }),
                                    jsx('text', {
                                      x: padL - 8,
                                      y: yl.y + 4,
                                      textAnchor: 'end',
                                      fill: 'var(--ui-text-quaternary)',
                                      fontSize: 10,
                                      children: yl.text,
                                    }),
                                  ],
                                },
                                `yl-${i}`
                              )
                            ),
                            jsx('path', { d: areaPath, fill: 'url(#mdEngGradient)' }),
                            jsx('path', {
                              d: linePath,
                              fill: 'none',
                              stroke: 'var(--ui-blue)',
                              strokeWidth: 1.75,
                              strokeLinecap: 'round',
                              strokeLinejoin: 'round',
                            }),
                            xLabelIdx.map(idx =>
                              jsx(
                                'text',
                                {
                                  x: pts[idx] ? pts[idx].x : padL,
                                  y: svgH - 6,
                                  textAnchor: 'middle',
                                  fill: 'var(--ui-text-quaternary)',
                                  fontSize: 10,
                                  children: dailySeries[idx]
                                    ? dailySeries[idx].date.slice(5).replace('-', '/')
                                    : '',
                                },
                                `xl-${idx}`
                              )
                            ),
                          ],
                        },
                        'chart'
                      ),
                    ],
                  })
                : jsx('div', {
                    style: { maxHeight: '200px', overflowY: 'auto', fontSize: '12px' },
                    children: jsxs('table', {
                      style: { width: '100%', textAlign: 'left', borderCollapse: 'collapse' },
                      children: [
                        jsx('thead', {
                          children: jsxs('tr', {
                            style: {
                              borderBottom: '1px solid var(--ui-stroke-tertiary)',
                              color: 'var(--ui-text-quaternary)',
                            },
                            children: [
                              jsx('th', { style: { padding: '6px 4px' }, children: t('insights.date') }),
                              jsx('th', {
                                style: { padding: '6px 4px', textAlign: 'right' },
                                children: t('insights.totalEngagements'),
                              }),
                            ],
                          }),
                        }),
                        jsx('tbody', {
                          children: dailySeries.map(row =>
                            jsxs(
                              'tr',
                              {
                                style: {
                                  borderBottom:
                                    '1px solid color-mix(in srgb, var(--ui-stroke-tertiary) 50%, transparent)',
                                },
                                children: [
                                  jsx('td', {
                                    style: { padding: '6px 4px', color: 'var(--ui-text-tertiary)' },
                                    children: row.date,
                                  }),
                                  jsx('td', {
                                    style: {
                                      padding: '6px 4px',
                                      textAlign: 'right',
                                      fontWeight: 500,
                                      fontVariantNumeric: 'tabular-nums',
                                    },
                                    children: row.value.toLocaleString(localeTag === 'zh' ? 'zh-CN' : 'en-US'),
                                  }),
                                ],
                              },
                              row.date
                            )
                          ),
                        }),
                      ],
                    }),
                  }),
          ]}),
          // By platform card with token-palette bars.
          jsxs('div', { style: panelStyle, children: [
            jsx('h2', {
              style: { fontSize: '13.5px', fontWeight: 600, color: 'var(--color-foreground)', margin: 0 },
              children: t('insights.byPlatform'),
            }),
            byPlatform.length === 0
              ? jsx('div', {
                  style: {
                    padding: '24px 0',
                    fontSize: '12.5px',
                    color: 'var(--ui-text-quaternary)',
                  },
                  children: t('insights.empty'),
                })
              : jsx('div', {
                  style: { display: 'flex', flexDirection: 'column', gap: '14px', padding: '12px 0' },
                  children: byPlatform.slice(0, 6).map((row, i) => {
                    const maxVal = byPlatform[0].value || 1
                    const pct = Math.max(4, Math.round((row.value / maxVal) * 100))
                    return jsx(
                      'div',
                      {
                        children: [
                          jsxs('div', {
                            style: {
                              display: 'flex',
                              alignItems: 'baseline',
                              justifyContent: 'space-between',
                              marginBottom: '6px',
                            },
                            children: [
                              jsx('span', {
                                style: {
                                  fontSize: '12.5px',
                                  color: 'var(--ui-text-tertiary)',
                                },
                                children: row.platform,
                              }),
                              jsx('span', {
                                style: {
                                  fontFamily: SERIF_FONT,
                                  fontSize: '20px',
                                  color: 'var(--color-foreground)',
                                  fontVariantNumeric: 'tabular-nums',
                                },
                                children: formatCompact(row.value, localeTag),
                              }),
                            ],
                          }),
                          jsx('div', {
                            style: {
                              width: '100%',
                              height: '8px',
                              borderRadius: '999px',
                              backgroundColor:
                                'color-mix(in srgb, var(--color-foreground) 6%, var(--color-background))',
                              overflow: 'hidden',
                            },
                            children: jsx('div', {
                              style: {
                                width: `${pct}%`,
                                height: '100%',
                                borderRadius: '999px',
                                backgroundColor: INSIGHT_PALETTE[i % INSIGHT_PALETTE.length],
                              },
                            }),
                          }),
                        ],
                      },
                      `plat-${row.platform}`
                    )
                  }),
                }),
          ]}),
        ],
      }),
      // Bottom row: top pieces (7/12) + suggestions (5/12).
      jsxs('div', {
        style: { display: 'grid', gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)', gap: '14px' },
        children: [
          jsxs('div', { style: panelStyle, children: [
            jsx('h2', {
              style: {
                fontSize: '13.5px',
                fontWeight: 600,
                color: 'var(--color-foreground)',
                margin: 0,
                marginBottom: '14px',
              },
              children: t('insights.topPieces'),
            }),
            topList.length === 0
              ? jsx('div', {
                  style: { fontSize: '12.5px', color: 'var(--ui-text-quaternary)' },
                  children: t('insights.empty'),
                })
              : jsx('div', {
                  style: { display: 'flex', flexDirection: 'column', gap: '14px' },
                  children: topList.slice(0, 6).map((piece, i) => {
                    const src = itemById[piece.itemId]
                    const thumb = src
                      ? resolveMediaUrl(
                          (src.media && src.media.src) ||
                            (src.production &&
                              src.production.cover &&
                              src.production.cover.src)
                        )
                      : null
                    return jsxs('div', {
                      key: piece.itemId || `piece-${i}`,
                      onClick: () =>
                        piece.itemId && dispatch({ type: 'OPEN_ITEM', payload: piece.itemId }),
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        cursor: piece.itemId ? 'pointer' : 'default',
                      },
                      children: [
                        jsxs('div', {
                          style: { display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 },
                          children: [
                            jsx('span', {
                              style: {
                                fontFamily: SERIF_FONT,
                                fontSize: '15px',
                                color: 'var(--ui-text-quaternary)',
                                width: '12px',
                                textAlign: 'center',
                                flexShrink: 0,
                                fontVariantNumeric: 'tabular-nums',
                              },
                              children: i + 1,
                            }),
                            thumb
                              ? jsx(MediaImage, {
                                  src:
                                    (src.media && src.media.src) ||
                                    (src.production &&
                                      src.production.cover &&
                                      src.production.cover.src),
                                  alt: '',
                                  draggable: false,
                                  style: {
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: 'var(--radius-md)',
                                    objectFit: 'cover',
                                    border: '1px solid color-mix(in srgb, var(--color-border) 70%, transparent)',
                                    flexShrink: 0,
                                  },
                                })
                              : jsx('span', {
                                  style: {
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: 'var(--radius-md)',
                                    background: THUMB_FALLBACK_GRADIENT,
                                    flexShrink: 0,
                                  },
                                }),
                            jsx('div', {
                              style: { minWidth: 0 },
                              children: [
                                jsx('div', {
                                  style: {
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: 'var(--color-foreground)',
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                    textOverflow: 'ellipsis',
                                  },
                                  children: piece.title || t('item.untitled'),
                                }),
                                jsx('div', {
                                  style: {
                                    fontSize: '11.5px',
                                    color: 'var(--ui-text-quaternary)',
                                    fontVariantNumeric: 'tabular-nums',
                                  },
                                  children: [
                                    piece.platform || '—',
                                    ' · ',
                                    `${t('insights.likes')} ${formatCompact(piece.likes || 0, localeTag)}`,
                                    ' · ',
                                    `${t('insights.saves')} ${formatCompact(piece.saves || 0, localeTag)}`,
                                  ],
                                }),
                              ],
                            }),
                          ],
                        }),
                        jsx('span', {
                          style: {
                            fontFamily: SERIF_FONT,
                            fontSize: '17px',
                            color: 'var(--ui-text-secondary)',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            fontVariantNumeric: 'tabular-nums',
                          },
                          children: formatCompact(piece.engagements || 0, localeTag),
                        }),
                      ],
                    })
                  }),
                }),
          ]}),
          // Suggestions card: /skills/learn + exports.
          jsxs('div', { style: { ...panelStyle, display: 'flex', flexDirection: 'column' }, children: [
            jsxs('div', {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              },
              children: [
                jsx('h2', {
                  style: { fontSize: '13.5px', fontWeight: 600, color: 'var(--color-foreground)', margin: 0 },
                  children: t('insights.suggestions'),
                }),
                jsx('button', {
                  type: 'button',
                  onClick: runLearn,
                  disabled: learning,
                  style: { ...SECONDARY_PILL, opacity: learning ? 0.6 : 1 },
                  children: learning ? t('insights.analyzing') : t('insights.analyzeAgain'),
                }),
              ],
            }),
            learnMsg
              ? jsx('div', {
                  style: {
                    fontSize: '12px',
                    color: 'var(--ui-green)',
                    marginBottom: '8px',
                  },
                  children: learnMsg,
                })
              : null,
            learnError
              ? jsx('div', {
                  style: {
                    fontSize: '12px',
                    color: 'var(--ui-red)',
                    marginBottom: '8px',
                  },
                  children: learnError,
                })
              : null,
            !suggestions || suggestions.length === 0
              ? jsx('p', {
                  style: {
                    fontSize: '12.5px',
                    color: 'var(--ui-text-quaternary)',
                    lineHeight: 1.5,
                    margin: 0,
                  },
                  children: t('insights.suggestionsEmpty'),
                })
              : jsx('ul', {
                  style: {
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    fontSize: '12.5px',
                    color: 'var(--ui-text-secondary)',
                    lineHeight: 1.55,
                  },
                  children: suggestions.map((s, i) =>
                    jsx(
                      'li',
                      {
                        key: `sug-${i}`,
                        style: {
                          padding: '10px',
                          borderRadius: 'var(--radius-lg)',
                          backgroundColor:
                            'color-mix(in srgb, var(--color-foreground) 3%, var(--color-background))',
                          border: '1px solid color-mix(in srgb, var(--color-border) 60%, transparent)',
                        },
                        children: s,
                      },
                      `sug-${i}`
                    )
                  ),
                }),
            jsxs('div', {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: 'auto',
                paddingTop: '14px',
                flexWrap: 'wrap',
              },
              children: [
                jsx('button', {
                  type: 'button',
                  onClick: () => exportInsightsToCsv(rows),
                  style: GHOST_BTN,
                  children: t('insights.csvExport'),
                }),
                jsx('button', {
                  type: 'button',
                  onClick: runExportSkill,
                  disabled: exporting,
                  style: { ...GHOST_BTN, opacity: exporting ? 0.6 : 1 },
                  children: exporting ? t('insights.exporting') : t('insights.exportSkillBtn'),
                }),
                exportOk
                  ? jsx('span', {
                      style: { fontSize: '11.5px', color: 'var(--ui-green)' },
                      children: exportOk,
                    })
                  : null,
              ],
            }),
          ]}),
        ],
      }),
      showMonid
        ? jsx(MonidPanel, { rest, t, localeTag, dispatch, onClose: () => setShowMonid(false) })
        : null,
    ],
  })
}

// ---------------------------------------------------------------------------


// 10c. Monid import modal (Requirements 18.5-18.7)
// ---------------------------------------------------------------------------

export function MonidPanel({ rest, t, onClose, dispatch }) {
  const [monidStatus, setMonidStatus] = useState(null)
  const [monidUrl, setMonidUrl] = useState('')
  const [monidPlatform, setMonidPlatform] = useState('X')
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')
  const [importReceipt, setImportReceipt] = useState(null)

  useEffect(() => {
    rest('/monid/status')
      .then(res => setMonidStatus(res))
      .catch(err => setMonidStatus({ state: 'error', message: (err && err.message) || String(err) }))
  }, [rest])

  const handleMonidImport = () => {
    const cleanUrl = monidUrl.trim()
    if (!cleanUrl || importLoading) return
    setImportLoading(true)
    setImportError('')
    setImportReceipt(null)
    rest('/monid/import', {
      method: 'POST',
      body: JSON.stringify({ url: cleanUrl, platform: monidPlatform, count: 20 }),
    })
      .then(res => {
        setImportLoading(false)
        if (res && res.state && dispatch) dispatch({ type: 'SET_STATE', payload: res.state })
        setImportReceipt(res || {})
      })
      .catch(err => {
        setImportLoading(false)
        setImportError((err && err.message) || String(err))
      })
  }

  const modalCard = {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-lg)',
    padding: '20px',
    width: '480px',
    maxWidth: '92%',
    maxHeight: '84%',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  }
  const modalInput = {
    flex: 1,
    minWidth: '200px',
    padding: '7px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    backgroundColor: 'color-mix(in srgb, var(--color-foreground) 4%, var(--color-background))',
    color: 'var(--color-foreground)',
    fontSize: '12.5px',
    outline: 'none',
  }
  const isReady = monidStatus && monidStatus.state === 'ready'

  return jsx('div', {
    onClick: onClose,
    style: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'color-mix(in srgb, black 40%, transparent)',
      zIndex: 220,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    children: jsxs('div', {
      onClick: e => e.stopPropagation(),
      style: modalCard,
      children: [
        jsxs('div', {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
          },
          children: [
            jsx('h4', {
              style: { margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--color-foreground)' },
              children: t('monid.wizardTitle'),
            }),
            jsx('button', {
              type: 'button',
              onClick: onClose,
              'aria-label': t('common.cancel'),
              style: {
                border: 'none',
                background: 'none',
                color: 'var(--ui-text-quaternary)',
                cursor: 'pointer',
                fontSize: '14px',
              },
              children: '✕',
            }),
          ],
        }),
        jsx('span', {
          style: {
            alignSelf: 'flex-start',
            fontSize: '11px',
            padding: '3px 10px',
            borderRadius: '999px',
            backgroundColor: isReady
              ? 'color-mix(in srgb, var(--ui-green) 14%, var(--color-background))'
              : 'color-mix(in srgb, var(--color-foreground) 6%, var(--color-background))',
            color: isReady ? 'var(--ui-green)' : 'var(--ui-text-tertiary)',
            fontWeight: 600,
          },
          children: monidStatus
            ? `${t('monid.status')}: ${t(`monid.status.${monidStatus.state}`)}${
                monidStatus.balance !== undefined ? ` (${monidStatus.balance})` : ''
              }`
            : t('loading'),
        }),
        jsxs('div', {
          style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
          children: [
            jsx('select', {
              value: monidPlatform,
              onChange: e => setMonidPlatform(e.target.value),
              'aria-label': t('monid.platform'),
              style: { ...SELECT_STYLE, flex: '0 0 auto', width: '130px' },
              children: ['X', 'YouTube', 'LinkedIn', 'Substack', 'TikTok', 'Instagram'].map(p =>
                jsx('option', { key: p, value: p, style: SELECT_OPTION_STYLE, children: p })
              ),
            }),
            jsx('input', {
              type: 'text',
              placeholder: t('monid.urlPlaceholder'),
              value: monidUrl,
              onChange: e => setMonidUrl(e.target.value),
              style: modalInput,
            }),
          ],
        }),
        jsx('button', {
          type: 'button',
          onClick: handleMonidImport,
          disabled: importLoading || !monidUrl.trim(),
          style: {
            ...PRIMARY_PILL,
            alignSelf: 'flex-start',
            opacity: importLoading || !monidUrl.trim() ? 0.55 : 1,
          },
          children: importLoading ? t('monid.importing') : t('monid.importBtn'),
        }),
        importError
          ? jsx('div', {
              style: { color: 'var(--ui-red)', fontSize: '12px' },
              children: importError,
            })
          : null,
        importReceipt
          ? jsxs('div', {
              style: {
                padding: '12px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'color-mix(in srgb, var(--color-foreground) 3%, var(--color-background))',
                fontSize: '12.5px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                color: 'var(--color-foreground)',
              },
              children: [
                jsx('div', { style: { fontWeight: 600 }, children: t('monid.receiptTitle') }),
                jsx('div', {
                  children: `${t('monid.receiptNickname')}: ${importReceipt.nickname || '-'}; ${t('monid.receiptCount')}: ${importReceipt.count || 0}; ${t('monid.receiptAdded')}: ${importReceipt.added || 0}; ${t('monid.receiptCost')}: ${importReceipt.cost != null ? importReceipt.cost : 0}`,
                }),
                importReceipt.styleError
                  ? jsx('div', {
                      style: { color: 'var(--ui-orange)' },
                      children: `${t('monid.styleError')}: ${importReceipt.styleError}`,
                    })
                  : null,
              ],
            })
          : null,
      ],
    }),
  })
}

// ---------------------------------------------------------------------------
