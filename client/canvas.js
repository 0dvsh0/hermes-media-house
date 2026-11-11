/**
 * Ideas Spatial Canvas View
 * Strictly spatial canvas: Spring camera, inertia panning, focal wheel zoom,
 * draggable cards with physics/easing, SVG relationship lines, and category chips.
 * NO wall/masonry/feed mode.
 */

import { jsx, jsxs } from 'react/jsx-runtime'
import {
  useState,
  useReducer,
  useEffect,
  useContext,
  useRef,
  useMemo,
  useCallback,
  useLayoutEffect,
} from 'react'
import { AppContext } from './app.js'
import { MAX_FILE_SIZE, ACCEPTED_FILE_TYPES, KIND_FILTERS } from './constants.js'
import {
  truncateTitle,
  computeStreak,
  displayItem,
  posterOf,
  isIdea,
  SERIF_FONT,
  DOT_GRID,
  GHOST_BTN,
  SPRING_SOFT,
  reducedMotion,
  hash,
} from './util.js'
import { cardSize, scatterLayout } from './layout.js'
import { relatedIdeas, relatedLayout } from './related.js'
import { useCamera } from './camera.js'
import { ItemCard, MediaImage } from './card.js'
import { MiniStamps } from './stamps.js'
import { Icon, IconButton } from './ui.js'

function Node({ item, pos, index, entered, onOpen, t, localeTag, tone }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    if (entered.current.has(item.id)) return
    entered.current.add(item.id)
    const el = ref.current?.firstElementChild
    if (!el || reducedMotion()) return
    const k = 0.25
    el.animate(
      [
        {
          transform: `translate(${-pos.x * k}px, ${-pos.y * k}px) scale(.8) rotate(${
            (hash(item.id) % 20) - 10
          }deg)`,
          opacity: 0,
        },
        { transform: 'none', opacity: 1 },
      ],
      {
        duration: (SPRING_SOFT.duration || 600) + 200,
        easing: SPRING_SOFT.easing || 'ease-out',
        delay: Math.min(index * 32, 620),
        fill: 'backwards',
      }
    )
  }, [entered, index, item.id, pos.x, pos.y])
  const size = cardSize(item)
  return jsx(
    'div',
    {
      ref,
      className: `md-node${tone ? ` is-${tone}` : ''}`,
      'data-node': item.id,
      style: {
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${size.w}px`,
        '--r': `${pos.r ?? 0}deg`,
        '--d': pos.d ?? 0,
      },
      children: jsx('div', {
        className: 'md-pop',
        children: jsx(ItemCard, {
          item,
          onOpen,
          t,
          localeTag,
        }),
      }),
    },
    item.id
  )
}

export function HomePage() {
  const { state, dispatch, rest, t, localeTag } = useContext(AppContext)
  const items = (state.serverState && state.serverState.items) || []

  const [kindFilter, setKindFilter] = useState('all')
  const [inputText, setInputText] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState(null)
  const [related, setRelated] = useState(null)
  const [, forceUpdate] = useReducer(v => v + 1, 0)

  const stageRef = useRef(null)
  const worldRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const toastTimerRef = useRef(null)
  const dragPosRef = useRef({})
  const suppressClickRef = useRef(false)
  const entered = useRef(new Set())

  const { cam, flyTo, halt, zoomAt } = useCamera(stageRef, worldRef)

  const roots = useMemo(() => items.filter(isIdea), [items])
  const filtered = useMemo(() => {
    return roots.filter(it => {
      if (kindFilter !== 'all' && it.kind !== kindFilter) return false
      return true
    })
  }, [roots, kindFilter])

  const rootKey = roots
    .map(i => `${i.id}:${i.pos ? `${i.pos.x},${i.pos.y}` : ''}:${i.production?.cover?.src || ''}`)
    .join('|')
  const layout = useMemo(() => scatterLayout(roots), [rootKey])

  const relatedSpots = useMemo(() => {
    if (!related) return {}
    const byId = new Map(roots.map(i => [i.id, i]))
    return relatedLayout(
      related.ids
        .filter(id => byId.has(id))
        .map(id => ({ id, ...cardSize(byId.get(id)) }))
    )
  }, [related, roots])

  const posOf = useCallback(
    item => {
      if (!item) return { x: 0, y: 0, r: 0, d: 0 }
      if (dragPosRef.current[item.id]) return { ...dragPosRef.current[item.id], d: 0 }
      if (related) {
        if (item.id === related.newId) {
          return { x: 0, y: -220 - cardSize(item).h / 2, r: 0, d: 0 }
        }
        const spot = relatedSpots[item.id]
        if (spot) return { ...spot, r: 0, d: 0 }
      }
      if (item.pos && typeof item.pos.x === 'number') {
        return { x: item.pos.x, y: item.pos.y, r: item.pos.r || 0, d: 0 }
      }
      return layout[item.id] || { x: 0, y: 0, r: 0, d: 0 }
    },
    [layout, related, relatedSpots]
  )

  const stageBox = useCallback(() => {
    const el = stageRef.current
    const w = el && el.clientWidth > 100 ? el.clientWidth : (typeof window !== 'undefined' && window.innerWidth ? Math.max(800, window.innerWidth - 300) : 1000)
    const h = el && el.clientHeight > 100 ? el.clientHeight : (typeof window !== 'undefined' && window.innerHeight ? Math.max(600, window.innerHeight - 80) : 700)
    return { w, h }
  }, [])

  const frameHome = useCallback(() => {
    const { w, h } = stageBox()
    return {
      x: w / 2,
      y: h / 2 + 10,
      s: w < 760 ? 0.72 : w < 1040 ? 0.85 : w < 1400 ? 0.95 : 1,
    }
  }, [stageBox])

  useLayoutEffect(() => {
    flyTo(frameHome(), { instant: true })
  }, [flyTo, frameHome])

  // Center camera when window resizes
  useEffect(() => {
    const el = stageRef.current
    if (!el) return undefined
    let last = el.clientWidth
    const observer = new ResizeObserver(() => {
      const delta = el.clientWidth - last
      last = el.clientWidth
      if (!delta) return
      const c = cam.current
      flyTo({ x: c.tx + delta / 2, y: c.ty, s: c.ts }, { stiffness: 140, damping: 24 })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [cam, flyTo])

  // Wheel zoom / pan
  useEffect(() => {
    const el = stageRef.current
    if (!el) return undefined
    const onWheel = e => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top)
      } else {
        const c = cam.current
        flyTo({ x: c.tx - e.deltaX, y: c.ty - e.deltaY, s: c.ts }, { instant: true })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [cam, flyTo, zoomAt])

  const showToast = (msg, undoable) => {
    setToast({ msg, undoable: Boolean(undoable) })
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 3600)
  }

  const handleUndo = () => {
    setToast(null)
    rest('/undo', { method: 'POST' })
      .then(res => {
        if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
      })
      .catch(() => {})
  }

  const handleCapture = () => {
    const text = inputText.trim()
    if (!text || capturing) return
    setCapturing(true)
    const clientId = `item-${Date.now().toString(36)}`
    const isUrl = /^https?:\/\//i.test(text) || text.indexOf('.com') !== -1

    const fail = err => {
      setCapturing(false)
      showToast((err && err.message) || String(err), false)
    }

    if (isUrl) {
      rest('/capture-url', { method: 'POST', body: JSON.stringify({ url: text }) })
        .then(meta => {
          const title = (meta && meta.title) || text
          const op = {
            op: 'add_item',
            id: clientId,
            title,
            body: (meta && (meta.body || meta.description)) || '',
            kind: 'web',
            source: (meta && (meta.source || meta.site_name)) || text,
            media:
              meta && meta.media && meta.media.src
                ? { src: meta.media.src }
                : meta && meta['og:image']
                ? { src: meta['og:image'] }
                : null,
          }
          return rest('/ops', { method: 'POST', body: JSON.stringify({ ops: [op] }) }).then(
            res => {
              setCapturing(false)
              setInputText('')
              if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
              showToast(
                (t('ideas.savedToast') || 'Saved inspiration: {title}').replace(
                  '{title}',
                  truncateTitle(title, 24)
                ),
                true
              )
            }
          )
        })
        .catch(fail)
    } else {
      const matchIds = relatedIdeas(roots, text)
      setRelated(matchIds.length ? { query: text, ids: matchIds, newId: clientId } : null)
      rest('/ops', {
        method: 'POST',
        body: JSON.stringify({
          ops: [
            {
              op: 'add_item',
              id: clientId,
              title: text.split(/[.\n!?]/)[0].slice(0, 60),
              body: text.length > 60 ? text : '',
              kind: 'note',
            },
          ],
        }),
      })
        .then(res => {
          setCapturing(false)
          setInputText('')
          if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
          showToast(
            (t('ideas.savedToast') || 'Saved inspiration: {title}').replace(
              '{title}',
              truncateTitle(text, 24)
            ),
            true
          )
        })
        .catch(fail)
    }
  }

  const processFiles = files => {
    if (!files || files.length === 0) return
    setUploading(true)
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.size > MAX_FILE_SIZE) {
        setUploading(false)
        showToast(t('home.fileTooLarge') || 'File exceeds 50 MiB limit', false)
        return
      }
      if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
        setUploading(false)
        showToast(t('home.fileUnsupported') || 'Unsupported file type', false)
        return
      }
      file
        .arrayBuffer()
        .then(buffer =>
          rest('/upload', {
            method: 'POST',
            body: buffer,
            headers: { 'content-type': file.type },
          })
        )
        .then(uploadRes => {
          if (!uploadRes || !uploadRes.src) return null
          const kind = file.type.indexOf('video') === 0 ? 'video' : 'image'
          const op = {
            op: 'add_item',
            id: `item-${Date.now().toString(36)}`,
            title: file.name,
            kind,
            media: { src: uploadRes.src },
          }
          return rest('/ops', { method: 'POST', body: JSON.stringify({ ops: [op] }) })
        })
        .then(res => {
          setUploading(false)
          if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
          showToast(
            (t('ideas.savedToast') || 'Saved inspiration: {title}').replace(
              '{title}',
              truncateTitle(file.name, 24)
            ),
            true
          )
        })
        .catch(err => {
          setUploading(false)
          showToast((err && err.message) || String(err), false)
        })
    }
  }

  // Pointer interaction: Card dragging with physics vs Canvas panning with inertia
  const onPointerDown = e => {
    if (
      e.button !== 0 ||
      e.target.closest('input, textarea, form, .md-toolrow, .md-dockbar, .md-stamps-bar')
    ) {
      return
    }

    const cardEl = e.target.closest('[data-node]')
    const startX = e.clientX
    const startY = e.clientY
    const c = cam.current
    let moved = false
    suppressClickRef.current = false
    halt()

    // 1. Card Dragging
    if (cardEl) {
      const id = cardEl.dataset.node
      const it = roots.find(i => i.id === id)
      const origin = posOf(it)
      cardEl.style.zIndex = '50'

      const onMove = ev => {
        const dx = (ev.clientX - startX) / c.s
        const dy = (ev.clientY - startY) / c.s
        if (!moved && Math.hypot(dx, dy) < 4) return
        if (!moved) {
          moved = true
          cardEl.classList.add('is-dragging')
          suppressClickRef.current = true
        }
        const next = { x: origin.x + dx, y: origin.y + dy, r: origin.r || 0, d: 0 }
        dragPosRef.current[id] = next
        cardEl.style.left = `${next.x}px`
        cardEl.style.top = `${next.y}px`
      }

      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        cardEl.classList.remove('is-dragging')
        cardEl.style.zIndex = ''
        if (!moved) return
        const next = dragPosRef.current[id]
        setTimeout(() => {
          suppressClickRef.current = false
        }, 50)
        if (next) {
          rest('/ops', {
            method: 'POST',
            body: JSON.stringify({
              ops: [
                {
                  op: 'update_item',
                  id,
                  pos: { x: Math.round(next.x), y: Math.round(next.y), r: next.r || 0 },
                },
              ],
            }),
          })
            .then(res => {
              if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
            })
            .catch(() => {})
        }
        delete dragPosRef.current[id]
        forceUpdate()
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      return
    }

    // 2. Canvas Panning with Inertia
    const baseX = c.x
    const baseY = c.y
    let lastX = startX
    let lastY = startY
    let lastT = performance.now()
    let vx = 0
    let vy = 0
    stageRef.current?.classList.add('is-panning')

    const onMove = ev => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 4) moved = true
      const now = performance.now()
      const dt = Math.max(now - lastT, 1)
      vx = (ev.clientX - lastX) / dt
      vy = (ev.clientY - lastY) / dt
      lastX = ev.clientX
      lastY = ev.clientY
      lastT = now
      flyTo({ x: baseX + ev.clientX - startX, y: baseY + ev.clientY - startY, s: c.s }, { instant: true })
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      stageRef.current?.classList.remove('is-panning')
      if (moved) {
        flyTo({ x: c.x + vx * 180, y: c.y + vy * 180, s: c.s }, { stiffness: 42, damping: 13 })
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Stats calculation
  const waitingCount = roots.filter(i => i.status === 'idea' && !i.production).length
  const weekAhead = new Date()
  weekAhead.setDate(weekAhead.getDate() + 7)
  const scheduledThisWeek = items.filter(
    i =>
      i.scheduledAt &&
      i.status !== 'published' &&
      new Date(i.scheduledAt) >= new Date() &&
      new Date(i.scheduledAt) <= weekAhead
  ).length
  const streak = useMemo(() => computeStreak(items), [items])

  const now = new Date()
  const dateLine = `${now.getFullYear()} · ${now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })} · ${now.toLocaleDateString('en-US', { weekday: 'short' })}`

  const pic = list => list.map(posterOf).find(Boolean)

  // Central Hero Element at (0, 0)
  const hero = jsxs(
    'section',
    {
      'data-card-interactive': 'true',
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        transform: 'translate(-50%, -50%)',
        width: '440px',
        maxWidth: '90vw',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        pointerEvents: 'auto',
      },
      children: [
        jsx('p', {
          style: {
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--ui-text-tertiary)',
            marginBottom: '8px',
          },
          children: dateLine,
        }),
        jsxs('h1', {
          style: {
            fontSize: '24px',
            lineHeight: 1.35,
            fontWeight: 400,
            letterSpacing: '-0.01em',
            color: 'var(--ui-text-tertiary)',
            margin: '0 0 20px',
          },
          children: [
            jsx('span', { children: 'You have ' }),
            jsx('b', {
              style: {
                fontWeight: 600,
                color: 'var(--color-foreground)',
                fontVariantNumeric: 'tabular-nums',
              },
              children: `${waitingCount} ideas `,
            }),
            jsx('span', { children: 'waiting to draft,' }),
            jsx('br', {}),
            jsx('b', {
              style: {
                fontWeight: 600,
                color: 'var(--color-foreground)',
                fontVariantNumeric: 'tabular-nums',
              },
              children: `${scheduledThisWeek} pieces `,
            }),
            jsx('span', { children: 'scheduled this week,' }),
            jsx('br', {}),
            jsx('span', { children: 'and recorded for ' }),
            jsx('em', {
              style: {
                fontFamily: SERIF_FONT,
                fontStyle: 'normal',
                fontSize: '28px',
                fontWeight: 600,
                color: 'var(--color-foreground)',
              },
              children: `${streak} `,
            }),
            jsx('span', { children: streak === 1 ? 'day straight.' : 'days straight.' }),
          ],
        }),

        // Jot down hero input form
        jsxs('form', {
          onSubmit: e => {
            e.preventDefault()
            handleCapture()
          },
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            backgroundColor: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '8px 14px',
            boxShadow: 'var(--shadow-sm)',
            boxSizing: 'border-box',
          },
          children: [
            jsx('span', {
              style: { color: 'var(--ui-text-quaternary)', fontSize: '14px', flexShrink: 0 },
              children: '✦',
            }),
            jsx('input', {
              ref: inputRef,
              type: 'text',
              value: inputText,
              onChange: e => setInputText(e.target.value),
              placeholder: t('home.capturePlaceholder') || 'Jot down an inspiration, or paste a link',
              'aria-label': t('home.capturePlaceholder') || 'Jot down an inspiration',
              style: {
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'var(--color-foreground)',
                fontSize: '13.5px',
                minWidth: 0,
              },
            }),
            jsx('button', {
              type: 'submit',
              disabled: capturing || !inputText.trim(),
              'aria-label': t('home.captureBtn') || 'Capture',
              style: {
                width: '26px',
                height: '26px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: inputText.trim()
                  ? 'var(--theme-primary, var(--ui-accent, var(--ui-blue)))'
                  : 'color-mix(in srgb, var(--color-foreground) 10%, transparent)',
                color: inputText.trim()
                  ? 'var(--theme-primary-foreground, var(--color-primary-foreground, white))'
                  : 'var(--ui-text-quaternary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: inputText.trim() ? 'pointer' : 'default',
                fontSize: '12px',
                flexShrink: 0,
                transition: 'background 0.15s ease',
              },
              children: jsx(Icon, { name: capturing ? 'refresh' : 'send', size: 12, spinning: capturing }),
            }),
          ],
        }),

        // Related ideas banner
        related &&
          jsxs('p', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12.5px',
              color: 'var(--ui-text-secondary)',
              marginTop: '10px',
            },
            children: [
              jsx('span', {
                children: `Found ${related.ids.length} related inspiration${
                  related.ids.length === 1 ? '' : 's'
                } nearby`,
              }),
              jsx('button', {
                type: 'button',
                onClick: () => setRelated(null),
                style: {
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-foreground)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: '12px',
                },
                children: 'Put back',
              }),
            ],
          }),

        // 10-day postage stamps strip
        jsx(MiniStamps, {
          onOpenDay: id => dispatch({ type: 'OPEN_ITEM', payload: id }),
          onOpenSchedule: () => dispatch({ type: 'SET_VIEW', payload: 'schedule' }),
        }),
      ],
    },
    'hero'
  )

  const centerCoords = useCallback(() => {
    const { w, h } = stageBox()
    return [w / 2, h / 2]
  }, [stageBox])

  return jsxs('div', {
    ref: stageRef,
    onPointerDown,
    onKeyDown: e => {
      if (e.key === 'Escape' && related) setRelated(null)
    },
    onDragOver: e => e.preventDefault(),
    onDrop: e => {
      e.preventDefault()
      if (e.dataTransfer && e.dataTransfer.files) processFiles(e.dataTransfer.files)
    },
    style: {
      position: 'relative',
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      userSelect: 'none',
      outline: 'none',
      cursor: 'grab',
      ...DOT_GRID,
    },
    children: [
      jsx('input', {
        type: 'file',
        ref: fileInputRef,
        multiple: true,
        accept: ACCEPTED_FILE_TYPES.join(','),
        style: { display: 'none' },
        onChange: e => processFiles(e.target.files),
      }),

      // World Layer (transformed by Spring Camera)
      jsxs(
        'div',
        {
          ref: worldRef,
          style: {
            position: 'absolute',
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            transformOrigin: '0 0',
            willChange: 'transform',
          },
          children: [
            // SVG Relationship Lines
            jsx(
              'svg',
              {
                style: {
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '1px',
                  height: '1px',
                  overflow: 'visible',
                  pointerEvents: 'none',
                  zIndex: 2,
                },
                children: related
                  ? related.ids.map(id => {
                      const it = roots.find(i => i.id === id)
                      if (!it) return null
                      const p = posOf(it)
                      const d = `M 0 0 C ${p.x * 0.4} 0, ${p.x * 0.6} ${p.y}, ${p.x} ${p.y}`
                      return jsx(
                        'path',
                        {
                          d,
                          fill: 'none',
                          stroke: 'var(--ui-stroke-secondary)',
                          strokeWidth: 1.5,
                          strokeDasharray: '4 4',
                          vectorEffect: 'non-scaling-stroke',
                        },
                        `line-${id}`
                      )
                    })
                  : null,
              },
              'links'
            ),

            hero,

            // Floating Idea Cards
            ...filtered.map((item, index) => {
              const p = posOf(item)
              const isDim = related && !related.ids.includes(item.id) && item.id !== related.newId
              const isRel = related && related.ids.includes(item.id)
              const tone = isDim ? 'dim' : isRel ? 'related' : ''
              return jsx(Node, {
                key: item.id,
                item,
                pos: p,
                index,
                entered,
                tone,
                onOpen: () => {
                  if (suppressClickRef.current) return
                  dispatch({ type: 'OPEN_ITEM', payload: item.id })
                },
                t,
                localeTag,
              })
            }),
          ],
        },
        'world'
      ),

      // Bottom Category Chips Dockbar
      jsxs(
        'div',
        {
          className: 'md-dockbar',
          role: 'toolbar',
          'aria-label': 'Kind filters',
          onPointerDown: e => e.stopPropagation(),
          style: {
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 12px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-md)',
            backdropFilter: 'blur(16px)',
          },
          children: [
            jsx('div', {
              style: { display: 'flex', alignItems: 'center', gap: '3px' },
              children: KIND_FILTERS.map(kf =>
                jsx(
                  'button',
                  {
                    key: kf,
                    type: 'button',
                    onClick: () => setKindFilter(kf),
                    style: {
                      padding: '5px 11px',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      backgroundColor:
                        kindFilter === kf
                          ? 'var(--theme-primary, var(--ui-accent, var(--ui-blue)))'
                          : 'transparent',
                      color:
                        kindFilter === kf
                          ? 'var(--theme-primary-foreground, var(--color-primary-foreground, white))'
                          : 'var(--ui-text-secondary)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      transition: 'all 0.15s ease',
                    },
                    children: kf,
                  },
                  kf
                )
              ),
            }),
            jsx('span', {
              style: {
                width: '1px',
                height: '18px',
                backgroundColor: 'var(--color-border)',
              },
            }),
            jsx('button', {
              type: 'button',
              onClick: () => {
                inputRef.current?.focus()
              },
              title: 'Add new inspiration',
              'aria-label': 'Add new inspiration',
              style: {
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: 'var(--theme-primary, var(--ui-accent, var(--ui-blue)))',
                color: 'var(--theme-primary-foreground, var(--color-primary-foreground, white))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                cursor: 'pointer',
                flexShrink: 0,
              },
              children: jsx(Icon, { name: 'plus', size: 14 }),
            }),
          ],
        },
        'dockbar'
      ),

      // Bottom Right Zoom Controls
      jsxs(
        'div',
        {
          className: 'md-toolrow',
          onPointerDown: e => e.stopPropagation(),
          style: {
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
          },
          children: [
            jsx('button', {
              type: 'button',
              title: 'Zoom Out',
              'aria-label': 'Zoom Out',
              onClick: () => zoomAt(0.8, ...centerCoords(), false),
              style: {
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--ui-text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
              },
              children: jsx(Icon, { name: 'zoomOut', size: 14 }),
            }),
            jsx('button', {
              type: 'button',
              title: 'Reset View',
              'aria-label': 'Reset View',
              onClick: () => flyTo(frameHome()),
              style: {
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--ui-text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
              },
              children: jsx(Icon, { name: 'target', size: 14 }),
            }),
            jsx('button', {
              type: 'button',
              title: 'Zoom In',
              'aria-label': 'Zoom In',
              onClick: () => zoomAt(1.25, ...centerCoords(), false),
              style: {
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--ui-text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
              },
              children: jsx(Icon, { name: 'plus', size: 14 }),
            }),
          ],
        },
        'zoom'
      ),

      // Toast notification with Undo
      toast &&
        jsxs(
          'div',
          {
            role: 'status',
            'aria-live': 'polite',
            style: {
              position: 'absolute',
              bottom: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 30,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-foreground)',
              color: 'var(--color-background)',
              boxShadow: 'var(--shadow-lg)',
              fontSize: '13px',
              fontWeight: 500,
            },
            children: [
              jsx('span', {
                style: { color: 'var(--ui-green)', fontSize: '14px', display: 'inline-flex', alignItems: 'center' },
                children: jsx(Icon, { name: 'check', size: 14 }),
              }),
              jsx('span', { children: toast.msg }),
              toast.undoable &&
                jsx('button', {
                  type: 'button',
                  onClick: handleUndo,
                  style: {
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-background)',
                    textDecoration: 'underline dotted',
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    opacity: 0.9,
                  },
                  children: t('undo.label') || 'Undo',
                }),
            ],
          },
          'toast'
        ),
    ],
  })
}
