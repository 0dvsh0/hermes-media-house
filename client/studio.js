/**
 * Bento Studio Components and Fullscreen Overlay
 * Hero tile, Script editor, Storyboard shots, Progress card, Asset viewer, Studio overlay.
 */

import { jsx, jsxs } from 'react/jsx-runtime'
import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useMemo,
  useCallback,
} from 'react'
import { AppContext } from './app.js'
import { MediaImage, resolveMediaUrl } from './card.js'
import { Icon, IconButton } from './ui.js'
import { SERIF_FONT, GHOST_BTN, PRIMARY_PILL, SECONDARY_PILL, ICON_BTN, SELECT_STYLE, SELECT_OPTION_STYLE } from './constants.js'
import { truncateTitle, formatCompact, normalizeAssetSrc } from './util.js'

// 9. Studio Bento Components (Task 23, Requirements 16.4-16.9)
// ---------------------------------------------------------------------------

const STUDIO_TILE = {
  backgroundColor: 'var(--color-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-sm)',
}

const STUDIO_INPUT = {
  padding: '8px 12px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  backgroundColor: 'color-mix(in srgb, var(--color-foreground) 4%, var(--color-background))',
  color: 'var(--color-foreground)',
  fontSize: '13px',
  outline: 'none',
  minWidth: 0,
}

export function AssetViewer({ assets, activeIndex, onClose, onRegen, onAskAssistant, imageReady, rest, t }) {
  const [index, setIndex] = useState(activeIndex || 0)
  const list = assets || []
  const currentAsset = list[index]
  const dataUrl = useAssetDataUrl(currentAsset && currentAsset.src, rest)
  const downloadUrl =
    dataUrl ||
    (currentAsset &&
    currentAsset.src &&
    (currentAsset.src.startsWith('data:') ||
      currentAsset.src.startsWith('http://') ||
      currentAsset.src.startsWith('https://'))
      ? currentAsset.src
      : null)

  // Window-level keyboard navigation: Escape closes, arrows flip pages.
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && index > 0) setIndex(index - 1)
      else if (e.key === 'ArrowRight' && index < list.length - 1) setIndex(index + 1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [index, list.length, onClose])

  if (!currentAsset) return null
  const src = downloadUrl
  const counter = `${index + 1} / ${list.length}`

  const viewerBtn = {
    padding: '6px 12px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid color-mix(in srgb, var(--color-background) 28%, transparent)',
    backgroundColor: 'color-mix(in srgb, var(--color-background) 12%, transparent)',
    color: 'var(--color-primary-foreground)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  }

  return jsxs('div', {
    style: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'color-mix(in srgb, black 72%, transparent)',
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      boxSizing: 'border-box',
    },
    children: [
      jsxs('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
        },
        children: [
          jsx('span', {
            style: {
              color: 'var(--color-primary-foreground)',
              fontSize: '12.5px',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            },
            children: counter,
          }),
          jsxs('div', {
            style: { display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' },
            children: [
              imageReady && onRegen
                ? jsx('button', {
                    type: 'button',
                    onClick: () => onRegen(currentAsset),
                    style: viewerBtn,
                    children: t('studio.regen'),
                  })
                : null,
              downloadUrl
                ? jsx('a', {
                    href: downloadUrl,
                    download: ((currentAsset && currentAsset.target) || 'asset') + '.png',
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    style: viewerBtn,
                    children: t('studio.download'),
                  })
                : null,
              onAskAssistant
                ? jsx('button', {
                    type: 'button',
                    onClick: () => onAskAssistant(currentAsset),
                    style: viewerBtn,
                    children: t('studio.askAssistant'),
                  })
                : null,
              jsx('button', {
                type: 'button',
                onClick: onClose,
                style: { ...viewerBtn, border: 'none', display: 'inline-flex', alignItems: 'center' },
                children: jsx(Icon, { name: 'close', size: 14 }),
              }),
            ],
          }),
        ],
      }),
      !imageReady
        ? jsx('div', {
            style: {
              marginTop: '8px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'color-mix(in srgb, var(--color-background) 16%, transparent)',
              color: 'var(--color-primary-foreground)',
              fontSize: '12px',
              alignSelf: 'flex-start',
            },
            children: t('studio.noImageProvider'),
          })
        : null,
      jsxs('div', {
        style: {
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          padding: '16px 0',
        },
        children: [
          index > 0
            ? jsx('button', {
                type: 'button',
                onClick: () => setIndex(index - 1),
                'aria-label': 'previous',
                style: {
                  position: 'absolute',
                  left: '8px',
                  zIndex: 2,
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  border: '1px solid color-mix(in srgb, var(--color-background) 28%, transparent)',
                  backgroundColor: 'color-mix(in srgb, var(--color-background) 14%, transparent)',
                  color: 'var(--color-primary-foreground)',
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                children: jsx(Icon, { name: 'chevL', size: 16 }),
              })
            : null,
          dataUrl
            ? jsx('img', {
                src: dataUrl,
                alt: currentAsset.prompt || '',
                style: {
                  maxWidth: '92%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-lg)',
                },
              })
            : jsx('div', {
                style: {
                  color: 'var(--color-primary-foreground)',
                  fontSize: '13px',
                  opacity: 0.8,
                },
                children: currentAsset && (currentAsset.status === 'pending' || currentAsset.status === 'running')
                  ? '...'
                  : (currentAsset && currentAsset.src ? 'Loading asset...' : t('studio.noImageProvider')),
              }),
          index < list.length - 1
            ? jsx('button', {
                type: 'button',
                onClick: () => setIndex(index + 1),
                'aria-label': 'next',
                style: {
                  position: 'absolute',
                  right: '8px',
                  zIndex: 2,
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  border: '1px solid color-mix(in srgb, var(--color-background) 28%, transparent)',
                  backgroundColor: 'color-mix(in srgb, var(--color-background) 14%, transparent)',
                  color: 'var(--color-primary-foreground)',
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                children: jsx(Icon, { name: 'chevR', size: 16 }),
              })
            : null,
        ],
      }),
    ],
  })
}

export function IdeaCard({ item, activeStyleId, styles, dispatch, rest, t }) {
  const prod = item.production || {}
  const [title, setTitle] = useState(prod.title || item.title || '')
  const [error, setError] = useState('')
  const lastSavedTitleRef = useRef(prod.title || item.title || '')
  const styleOptions = styles || []

  useEffect(() => {
    setTitle(prod.title || item.title || '')
    lastSavedTitleRef.current = prod.title || item.title || ''
  }, [prod.title, item.title])

  const handleBlur = () => {
    const trimmed = title.trim()
    if (trimmed.length < 1 || trimmed.length > 200) {
      setTitle(lastSavedTitleRef.current)
      return
    }
    if (trimmed === lastSavedTitleRef.current) return
    rest('/ops', {
      method: 'POST',
      body: JSON.stringify({
        ops: [{ op: 'update_production', id: item.id, title: trimmed }],
      }),
    })
      .then(res => {
        if (res && res.state) {
          dispatch({ type: 'SET_STATE', payload: res.state })
          lastSavedTitleRef.current = trimmed
        }
      })
      .catch(err => {
        setTitle(lastSavedTitleRef.current)
        setError(err.message || String(err))
      })
  }

  const handleStyleChange = styleId => {
    rest('/ops', {
      method: 'POST',
      body: JSON.stringify({ ops: [{ op: 'set_style', id: styleId || null }] }),
    })
      .then(res => {
        if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
      })
      .catch(err => setError(err.message || String(err)))
  }

  return jsxs('div', {
    style: { display: 'flex', flexDirection: 'column', gap: '8px' },
    children: [
      jsx('div', {
        style: { fontSize: '11px', color: 'var(--ui-text-quaternary)', padding: '0 2px' },
        children: t('studio.back'),
      }),
      jsx('input', {
        type: 'text',
        maxLength: 200,
        value: title,
        onChange: e => setTitle(e.target.value),
        onBlur: handleBlur,
        placeholder: t('item.untitled'),
        'aria-label': t('studio.articleTitle'),
        style: {
          width: '100%',
          boxSizing: 'border-box',
          fontWeight: 600,
          fontSize: '14px',
          lineHeight: 1.35,
          padding: '8px 10px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid transparent',
          backgroundColor: 'transparent',
          color: 'var(--color-foreground)',
          outline: 'none',
        },
      }),
      jsxs('div', {
        style: {
          backgroundColor: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: 'var(--shadow-sm)',
        },
        children: [
          jsx('div', {
            style: { fontSize: '11px', color: 'var(--ui-text-quaternary)', marginBottom: '2px' },
            children: t('studio.stylePicker'),
          }),
          jsx('select', {
            value: activeStyleId || '',
            onChange: e => handleStyleChange(e.target.value),
            style: {
              ...SELECT_STYLE,
              width: '100%',
              fontSize: '12px',
              fontWeight: 500,
            },
            children: [
              jsx('option', { value: '', style: SELECT_OPTION_STYLE, children: t('studio.stylePicker') }),
              styleOptions.map(s =>
                jsx('option', { key: s.id, value: s.id, style: SELECT_OPTION_STYLE, children: s.name })
              ),
            ],
          }),
          error
            ? jsx('div', {
                style: { color: 'var(--ui-red)', fontSize: '11px' },
                children: error,
              })
            : null,
        ],
      }),
    ],
  })
}

export function ProgressCard({ production, t }) {
  if (!production || production.status !== 'running') return null
  const images = production.images || []
  const shots = production.shots || []
  const steps = [
    { id: 1, label: t('studio.step1'), done: Boolean(production.coverText) },
    {
      id: 2,
      label: `${t('studio.step2')} (${production.article ? production.article.length : 0})`,
      done: Boolean(production.article),
    },
    {
      id: 3,
      label: `${t('studio.step3')} (${images.filter(i => i.status === 'done').length}/${images.length})`,
      done: production.cover && production.cover.status === 'done' && images.every(i => i.status === 'done'),
    },
    {
      id: 4,
      label: `${t('studio.step4')} (${shots.filter(s => s.status === 'done').length}/${shots.length})`,
      done: shots.length > 0 && shots.every(s => s.status === 'done'),
    },
  ]

  return jsxs('div', {
    style: {
      backgroundColor: 'var(--color-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-xl)',
      padding: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      boxShadow: 'var(--shadow-sm)',
    },
    children: [
      jsx('div', {
        style: {
          fontWeight: 600,
          fontSize: '12px',
          color: 'var(--color-foreground)',
        },
        children: t('studio.producing'),
      }),
      jsx('div', {
        style: { display: 'flex', flexDirection: 'column', gap: '8px' },
        children: steps.map(st =>
          jsxs(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11.5px',
                color: st.done ? 'var(--color-foreground)' : 'var(--ui-text-quaternary)',
              },
              children: [
                jsx('span', {
                  style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    backgroundColor: st.done ? 'var(--ui-green)' : 'var(--color-background)',
                    border: st.done ? 'none' : '1px solid var(--color-border)',
                    color: st.done ? 'var(--color-primary-foreground)' : 'var(--ui-text-quaternary)',
                    fontSize: '10px',
                    fontWeight: 700,
                  },
                  children: st.done ? '✓' : st.id,
                }),
                jsx('span', { children: st.label }),
              ],
            },
            st.id
          )
        ),
      }),
    ],
  })
}

export function HeroTile({ production, onSelectAsset, t }) {
  if (!production) return null
  const coverSrc = resolveMediaUrl(production.cover && production.cover.src)
  const images = production.images || []
  const polaroids = images.slice(0, 3)
  const figureTargets = [production.cover ? { ...production.cover, target: 'cover' } : null]
    .filter(Boolean)
    .concat(images.map((img, i) => ({ ...img, target: `figure_${i + 1}` })))

  const selectCollage = () => {
    if (figureTargets.length === 0) return
    onSelectAsset(figureTargets, 0)
  }

  return jsxs('div', {
    style: {
      ...HERO_GRADIENT,
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-xl)',
      padding: '24px',
      minHeight: '220px',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '20px',
      overflow: 'hidden',
      flexShrink: 0,
    },
    children: [
      jsxs('div', {
        style: { flex: '1 1 260px', minWidth: '220px', position: 'relative', zIndex: 2 },
        children: [
          jsx('div', {
            style: {
              fontSize: '11px',
              color: 'var(--ui-text-quaternary)',
              marginBottom: '6px',
            },
            children: t('studio.heroTitle'),
          }),
          jsx('h1', {
            style: {
              fontSize: '28px',
              lineHeight: 1.25,
              fontWeight: 400,
              letterSpacing: '-0.02em',
              color: 'var(--color-foreground)',
              margin: 0,
              marginBottom: '14px',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
            },
            children: production.coverText || t('studio.heroTitle'),
          }),
          jsxs('div', {
            style: {
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '12px',
              fontSize: '12px',
              color: 'var(--ui-text-quaternary)',
            },
            children: [
              `${t('studio.images')} ${images.filter(i => i.status === 'done').length}/${images.length}`,
              jsx('span', { children: '·' }),
              `${t('studio.step2')} ${production.article ? production.article.length : 0} ${t('studio.chars')}`,
            ],
          }),
        ],
      }),
      // Collage: cover + tilted polaroid figure thumbnails.
      jsxs('div', {
        onClick: selectCollage,
        style: {
          position: 'relative',
          width: 'min(390px, 100%)',
          maxWidth: '390px',
          height: '205px',
          flexShrink: 0,
          cursor: figureTargets.length > 0 ? 'pointer' : 'default',
        },
        children: [
          coverSrc
            ? jsx(MediaImage, {
                src: coverSrc,
                alt: production.coverText || 'cover',
                draggable: false,
                style: {
                  position: 'absolute',
                  left: 0,
                  top: '10px',
                  width: '290px',
                  height: '185px',
                  objectFit: 'cover',
                  borderRadius: 'var(--radius-lg)',
                  border: '4px solid var(--color-card)',
                  boxShadow: 'var(--shadow-lg)',
                  transform: 'rotate(-2deg)',
                },
              })
            : jsx('div', {
                style: {
                  position: 'absolute',
                  left: 0,
                  top: '10px',
                  width: '290px',
                  height: '185px',
                  borderRadius: 'var(--radius-lg)',
                  border: '4px solid var(--color-card)',
                  boxShadow: 'var(--shadow-lg)',
                  transform: 'rotate(-2deg)',
                  background: THUMB_FALLBACK_GRADIENT,
                  display: 'flex',
                  alignItems: 'flex-end',
                  padding: '14px',
                  boxSizing: 'border-box',
                },
                children: jsx('span', {
                  style: {
                    fontFamily: SERIF_FONT,
                    fontSize: '17px',
                    lineHeight: 1.35,
                    color: 'var(--color-primary-foreground)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  },
                  children: truncateTitle(production.coverText || t('studio.heroTitle'), 60),
                }),
              }),
          polaroids.map((img, i) => {
            const src = resolveMediaUrl(img.src)
            const spots = [
              { right: '4px', top: '-6px', w: '118px', h: '78px', rot: 3 },
              { right: '24px', bottom: '-12px', w: '115px', h: '74px', rot: -2 },
              { right: '-8px', bottom: '24px', w: '96px', h: '66px', rot: 6 },
            ]
            const spot = spots[i % spots.length]
            const style = {
              position: 'absolute',
              width: spot.w,
              height: spot.h,
              borderRadius: 'var(--radius-lg)',
              border: '3px solid var(--color-card)',
              boxShadow: 'var(--shadow-md)',
              transform: `rotate(${spot.rot}deg)`,
              overflow: 'hidden',
              backgroundColor: 'var(--color-card)',
            }
            if (spot.right) style.right = spot.right
            if (spot.top) style.top = spot.top
            if (spot.bottom) style.bottom = spot.bottom
            return jsx(
              'div',
              {
                key: `pol-${i}`,
                children: src
                  ? jsx(MediaImage, {
                      src: img.src,
                      alt: `figure ${i + 1}`,
                      draggable: false,
                      style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
                    })
                  : jsx('span', {
                      style: { display: 'block', width: '100%', height: '100%', background: THUMB_FALLBACK_GRADIENT },
                    }),
              },
              `pol-${i}`
            )
          }),
        ],
      }),
    ],
  })
}

export function ArticleTile({ item, isExpanded, onToggleExpand, onAskSelection, dispatch, rest, t }) {
  const prod = item.production || {}
  const [article, setArticle] = useState(prod.article || '')
  const [selectedText, setSelectedText] = useState('')
  const lastSavedRef = useRef(prod.article || '')

  useEffect(() => {
    setArticle(prod.article || '')
    lastSavedRef.current = prod.article || ''
  }, [prod.article])

  const handleBlur = () => {
    if (article === lastSavedRef.current) return
    rest('/ops', {
      method: 'POST',
      body: JSON.stringify({
        ops: [{ op: 'update_production', id: item.id, article }],
      }),
    })
      .then(res => {
        if (res && res.state) {
          dispatch({ type: 'SET_STATE', payload: res.state })
          lastSavedRef.current = article
        }
      })
      .catch(() => setArticle(lastSavedRef.current))
  }

  const handleMouseUp = () => {
    const sel = window.getSelection()
    const str = sel ? sel.toString().trim() : ''
    if (str.length >= 4) {
      setSelectedText(str)
    } else {
      setSelectedText('')
    }
  }

  return jsxs('div', {
    style: {
      position: isExpanded ? 'fixed' : 'relative',
      top: isExpanded ? 0 : 'auto',
      left: isExpanded ? 0 : 'auto',
      width: isExpanded ? '100%' : 'auto',
      height: isExpanded ? '100%' : 'auto',
      zIndex: isExpanded ? 150 : 1,
      transition: 'all 250ms ease-in-out',
      padding: '20px',
      borderRadius: isExpanded ? 0 : 'var(--radius-xl)',
      border: '1px solid var(--color-border)',
      backgroundColor: 'var(--color-card)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      boxSizing: 'border-box',
      boxShadow: 'var(--shadow-sm)',
    },
    children: [
      jsxs('div', {
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        children: [
          jsxs('div', {
            style: { display: 'flex', alignItems: 'center', gap: '8px' },
            children: [
              jsx('div', {
                style: { fontSize: '13.5px', fontWeight: 600, color: 'var(--color-foreground)' },
                children: t('studio.articleTitle'),
              }),
              jsx('span', {
                style: {
                  fontSize: '11.5px',
                  color: 'var(--ui-text-quaternary)',
                  fontVariantNumeric: 'tabular-nums',
                },
                children: `${article.length} ${t('studio.chars')}`,
              }),
            ],
          }),
          jsxs('div', {
            style: { display: 'flex', gap: '6px', alignItems: 'center' },
            children: [
              selectedText
                ? jsx('button', {
                    type: 'button',
                    onClick: () => {
                      onAskSelection(`> ${selectedText}\n\n`)
                      setSelectedText('')
                    },
                    style: {
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      backgroundColor: 'var(--theme-primary, var(--ui-accent, var(--ui-blue)))',
                      color: 'var(--theme-primary-foreground, var(--color-primary-foreground, white))',
                      cursor: 'pointer',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    },
                    children: [
                      jsx(Icon, { name: 'spark', size: 12 }),
                      jsx('span', {}, t('studio.askAssistant')),
                    ],
                  })
                : null,
              jsxs('button', {
                type: 'button',
                onClick: onToggleExpand,
                style: { ...GHOST_BTN, display: 'inline-flex', alignItems: 'center', gap: '4px' },
                children: [
                  jsx(Icon, { name: isExpanded ? 'close' : 'expand', size: 12 }),
                  jsx('span', {}, isExpanded ? t('studio.collapse') : t('studio.expand')),
                ],
              }),
            ],
          }),
        ],
      }),
      jsx('textarea', {
        value: article,
        onChange: e => setArticle(e.target.value),
        onBlur: handleBlur,
        onMouseUp: handleMouseUp,
        placeholder: t('studio.tellWhatToChange'),
        style: {
          flex: 1,
          minHeight: isExpanded ? '85vh' : '260px',
          minWidth: 0,
          padding: '12px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          backgroundColor: 'color-mix(in srgb, var(--color-foreground) 3%, var(--color-background))',
          color: 'var(--color-foreground)',
          fontSize: '13px',
          lineHeight: 1.7,
          resize: 'none',
          outline: 'none',
          boxSizing: 'border-box',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        },
      }),
    ],
  })
}

export function ShotsTile({ production, isExpanded, onToggleExpand, onSelectAsset, t }) {
  if (!production) return null
  const shots = production.shots || []

  return jsxs('div', {
    style: {
      position: isExpanded ? 'fixed' : 'relative',
      top: isExpanded ? 0 : 'auto',
      left: isExpanded ? 0 : 'auto',
      width: isExpanded ? '100%' : 'auto',
      height: isExpanded ? '100%' : 'auto',
      zIndex: isExpanded ? 150 : 1,
      transition: 'all 250ms ease-in-out',
      padding: '20px',
      borderRadius: isExpanded ? 0 : 'var(--radius-xl)',
      border: '1px solid var(--color-border)',
      backgroundColor: 'var(--color-card)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxSizing: 'border-box',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
    },
    children: [
      jsxs('div', {
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        children: [
          jsxs('div', {
            style: { display: 'flex', alignItems: 'center', gap: '8px' },
            children: [
              jsx('div', {
                style: { fontSize: '13.5px', fontWeight: 600, color: 'var(--color-foreground)' },
                children: t('studio.shotsTitle'),
              }),
              jsx('span', {
                style: {
                  fontSize: '11.5px',
                  color: 'var(--ui-text-quaternary)',
                  fontVariantNumeric: 'tabular-nums',
                },
                children: `${shots.length} ${t('studio.shots')}`,
              }),
            ],
          }),
          jsxs('button', {
            type: 'button',
            onClick: onToggleExpand,
            style: { ...GHOST_BTN, display: 'inline-flex', alignItems: 'center', gap: '4px' },
            children: [
              jsx(Icon, { name: isExpanded ? 'close' : 'expand', size: 12 }),
              jsx('span', {}, isExpanded ? t('studio.collapse') : t('studio.expand')),
            ],
          }),
        ],
      }),
      shots.length === 0
        ? jsx('div', {
            style: {
              fontSize: '12.5px',
              color: 'var(--ui-text-quaternary)',
              padding: '16px 0',
            },
            children: t('studio.shotsEmpty'),
          })
        : jsx('div', {
            style: {
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '14px',
              maxHeight: isExpanded ? '85vh' : '480px',
              overflowY: 'auto',
              alignContent: 'start',
            },
            children: shots.map((sh, idx) => {
              const src = resolveMediaUrl(sh.src)
              return jsxs(
                'div',
                {
                  key: `shot-${idx}`,
                  onClick: () => onSelectAsset(shots, idx),
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    cursor: 'pointer',
                    minWidth: 0,
                  },
                  children: [
                    jsxs('div', {
                      style: { display: 'flex', alignItems: 'baseline', gap: '8px' },
                      children: [
                        jsx('span', {
                          style: {
                            fontFamily: SERIF_FONT,
                            fontSize: '24px',
                            lineHeight: 1,
                            color: 'var(--ui-text-quaternary)',
                            fontVariantNumeric: 'tabular-nums',
                          },
                          children: String(idx + 1).padStart(2, '0'),
                        }),
                        jsx('span', {
                          style: { fontSize: '11px', color: 'var(--ui-text-quaternary)' },
                          children: sh.duration ? `${sh.duration} ${t('studio.duration')}` : '',
                        }),
                      ],
                    }),
                    jsx('div', {
                      style: {
                        width: '100%',
                        height: '108px',
                        borderRadius: 'var(--radius-lg)',
                        backgroundColor:
                          'color-mix(in srgb, var(--color-foreground) 4%, var(--color-background))',
                        border: '1px solid color-mix(in srgb, var(--color-border) 60%, transparent)',
                        overflow: 'hidden',
                      },
                      children: src
                        ? jsx(MediaImage, {
                            src: sh.src,
                            alt: sh.visual || '',
                            draggable: false,
                            style: {
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            },
                          })
                        : jsx('span', {
                            style: {
                              display: 'block',
                              width: '100%',
                              height: '100%',
                              background: THUMB_FALLBACK_GRADIENT,
                            },
                          }),
                    }),
                    jsx('div', {
                      style: {
                        fontSize: '11px',
                        color: 'var(--ui-text-quaternary)',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: 1.45,
                      },
                      children: sh.visual || sh.voiceOver || '',
                    }),
                  ],
                },
                `shot-${idx}`
              )
            }),
          }),
    ],
  })
}

// ---------------------------------------------------------------------------
// 9b. Studio Overlay (Requirements 16.1-16.3, 16.10, 16.11)
// ---------------------------------------------------------------------------

export function StudioOverlay({ itemId, onClose }) {
  const { state, dispatch, rest, t, localeTag } = useContext(AppContext)
  const [expandedTile, setExpandedTile] = useState(null)
  const [activeViewer, setActiveViewer] = useState(null)
  const [chatSeedText, setChatSeedText] = useState('')
  const [pollError, setPollError] = useState('')
  const consecutiveFailuresRef = useRef(0)
  const pollTimerRef = useRef(null)

  const items = (state.serverState && state.serverState.items) || []
  const item = items.find(i => i.id === itemId)
  const prod = item && item.production

  // Keep a ref to the latest server state so the 700ms poll can merge
  // production snapshots without re-creating the interval on every tick.
  const stateRef = useRef(state)
  stateRef.current = state

  // Escape collapses an expanded bento tile, active viewer, or closes studio.
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape') {
        if (expandedTile) setExpandedTile(null)
        else if (activeViewer) setActiveViewer(null)
        else if (onClose) onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [expandedTile, activeViewer, onClose])

  const isRunning = Boolean(
    prod &&
      (prod.status === 'running' ||
        (prod.cover &&
          (prod.cover.status === 'pending' || prod.cover.status === 'running')) ||
        (prod.images || []).some(a => a.status === 'pending' || a.status === 'running') ||
        (prod.shots || []).some(s => s.status === 'pending' || s.status === 'running'))
  )

  // Poll GET /production?id=<id> every 700ms while work is in flight;
  // stop after 3 consecutive failures (Requirements 16.2, 16.3, 16.11).
  useEffect(() => {
    if (!itemId || !isRunning) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      return undefined
    }
    const poll = () => {
      rest(`/production?id=${itemId}`)
        .then(newProd => {
          consecutiveFailuresRef.current = 0
          const st = stateRef.current.serverState
          if (newProd && st && st.items) {
            const nextItems = st.items.map(it =>
              it.id === itemId ? { ...it, production: newProd } : it
            )
            dispatch({ type: 'SET_STATE', payload: { ...st, items: nextItems } })
          }
        })
        .catch(() => {
          consecutiveFailuresRef.current += 1
          if (consecutiveFailuresRef.current >= 3) {
            setPollError(t('studio.pollError'))
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current)
              pollTimerRef.current = null
            }
          }
        })
    }
    poll()
    pollTimerRef.current = setInterval(poll, 700)
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [itemId, isRunning, rest, dispatch, t])

  const handleProduce = () => {
    rest('/produce', { method: 'POST', body: JSON.stringify({ id: itemId }) })
      .then(res => {
        if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
      })
      .catch(err => window.alert((err && err.message) || String(err)))
  }

  const handleCancel = () => {
    rest('/produce/cancel', { method: 'POST', body: JSON.stringify({ id: itemId }) })
      .then(res => {
        if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
      })
      .catch(err => window.alert((err && err.message) || String(err)))
  }

  const handleSave = () => {
    rest('/produce/save', { method: 'POST', body: JSON.stringify({ id: itemId }) })
      .then(res => window.alert(`${t('studio.save')}: ${res && res.savedPath ? res.savedPath : 'Done'}`))
      .catch(err => window.alert((err && err.message) || String(err)))
  }

  const handleReveal = () => {
    rest('/produce/reveal', { method: 'POST', body: JSON.stringify({ id: itemId }) }).catch(err =>
      window.alert((err && err.message) || String(err))
    )
  }

  if (!item) return null

  const serverStyles = (state.serverState && state.serverState.styles) || []
  const activeStyleId = state.serverState && state.serverState.activeStyleId
  const titleText = item.title || t('item.untitled')

  return jsxs('div', {
    'data-testid': 'studio-overlay',
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'var(--ui-bg-chrome, var(--color-background))',
      color: 'var(--color-foreground, var(--ui-text-primary, currentColor))',
      zIndex: 50,
      display: 'flex',
      overflow: 'hidden',
      isolation: 'isolate',
    },
    children: [
      // Left 305px rail: back, idea card, progress, actions, chat dock.
      jsxs('div', {
        style: {
          width: '305px',
          flexShrink: 0,
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'var(--color-card, var(--ui-bg-chrome, white))',
        },
        children: [
          jsxs('div', {
            style: {
              padding: '14px 14px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              overflowY: 'auto',
              flexShrink: 0,
              maxHeight: '62%',
              boxSizing: 'border-box',
            },
            children: [
              jsxs('div', {
                style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '0 2px' },
                children: [
                  jsx('button', {
                    type: 'button',
                    'data-testid': 'studio-back-btn',
                    onClick: onClose,
                    title: t('studio.back'),
                    'aria-label': t('studio.back'),
                    style: {
                      border: 'none',
                      background: 'none',
                      color: 'var(--ui-text-secondary)',
                      cursor: 'pointer',
                      fontSize: '14px',
                      padding: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                    },
                    children: jsx(Icon, { name: 'arrowLeft', size: 14 }),
                  }),
                  jsx('span', {
                    style: {
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--color-foreground)',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      minWidth: 0,
                      flex: 1,
                    },
                    children: titleText,
                  }),
                  jsx('button', {
                    type: 'button',
                    'data-testid': 'studio-close-btn',
                    onClick: onClose,
                    title: t('studio.close'),
                    'aria-label': t('studio.close'),
                    style: {
                      border: 'none',
                      background: 'none',
                      color: 'var(--ui-text-quaternary)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      flexShrink: 0,
                    },
                    children: jsx(Icon, { name: 'close', size: 14 }),
                  }),
                ],
              }),
              jsx(IdeaCard, {
                item,
                activeStyleId,
                styles: serverStyles,
                dispatch,
                rest,
                t,
              }),
              jsx(ProgressCard, { production: prod, t }),
              jsxs('div', {
                style: {
                  backgroundColor: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: 'var(--shadow-sm)',
                },
                children: [
                  prod && prod.status === 'running'
                    ? jsxs('button', {
                        type: 'button',
                        onClick: handleCancel,
                        style: {
                          ...PRIMARY_PILL,
                          width: '100%',
                          boxSizing: 'border-box',
                          backgroundColor: 'color-mix(in srgb, var(--ui-red) 14%, var(--color-background))',
                          color: 'var(--ui-red)',
                          padding: '10px 16px',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        },
                        children: [
                          jsx(Icon, { name: 'refresh', size: 13, spinning: true }),
                          jsx('span', {}, t('studio.cancel')),
                        ],
                      })
                    : jsxs('button', {
                        type: 'button',
                        onClick: handleProduce,
                        style: {
                          ...PRIMARY_PILL,
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '10px 16px',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        },
                        children: jsx('span', {}, t('studio.produce')),
                      }),
                  jsxs('div', {
                    style: { display: 'flex', gap: '8px' },
                    children: [
                      jsxs('button', {
                        type: 'button',
                        onClick: handleSave,
                        style: {
                          ...GHOST_BTN,
                          flex: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                        },
                        children: [
                          jsx(Icon, { name: 'save', size: 13 }),
                          jsx('span', {}, t('studio.save')),
                        ],
                      }),
                      jsxs('button', {
                        type: 'button',
                        onClick: handleReveal,
                        style: {
                          ...GHOST_BTN,
                          flex: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                        },
                        children: [
                          jsx(Icon, { name: 'folder', size: 13 }),
                          jsx('span', {}, t('studio.reveal')),
                        ],
                      }),
                    ],
                  }),
                  jsx('div', {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11.5px',
                      color: 'var(--ui-text-quaternary)',
                      borderTop: '1px solid color-mix(in srgb, var(--color-border) 60%, transparent)',
                      paddingTop: '8px',
                    },
                    children: [
                      jsx('span', { children: t(`status.${item.status || 'idea'}`) }),
                      jsx('span', { children: '·' }),
                      jsx('span', {
                        children: formatDateLabel(item.createdAt, localeTag),
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          jsx('div', {
            style: { flex: 1, minHeight: 0, padding: '0 14px 14px', display: 'flex' },
            children: jsx(ChatDock, {
              itemId,
              initialInput: chatSeedText,
              onClearSeed: () => setChatSeedText(''),
            }),
          }),
        ],
      }),
      // Right bento area: hero + script/storyboard row.
      jsxs('div', {
        style: {
          flex: 1,
          minWidth: 0,
          height: '100%',
          overflowY: 'auto',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxSizing: 'border-box',
        },
        children: [
          pollError
            ? jsx('div', {
                style: {
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'color-mix(in srgb, var(--ui-red) 12%, var(--color-background))',
                  color: 'var(--ui-red)',
                  fontSize: '12px',
                  flexShrink: 0,
                },
                children: pollError,
              })
            : null,
          !prod
            ? jsx('div', {
                style: {
                  ...STUDIO_TILE,
                  padding: '24px',
                  fontSize: '12.5px',
                  color: 'var(--ui-text-quaternary)',
                  flexShrink: 0,
                },
                children: t('studio.noProduction'),
              })
            : null,
          jsx(HeroTile, {
            production: prod,
            onSelectAsset: (assets, idx) => setActiveViewer({ assets, activeIndex: idx }),
            t,
          }),
          jsxs('div', {
            style: {
              flex: 1,
              minHeight: '380px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '14px',
              alignItems: 'stretch',
            },
            children: [
              jsx(ArticleTile, {
                item,
                isExpanded: expandedTile === 'article',
                onToggleExpand: () =>
                  setExpandedTile(expandedTile === 'article' ? null : 'article'),
                onAskSelection: text => setChatSeedText(text),
                dispatch,
                rest,
                t,
              }),
              jsx(ShotsTile, {
                production: prod,
                isExpanded: expandedTile === 'shots',
                onToggleExpand: () => setExpandedTile(expandedTile === 'shots' ? null : 'shots'),
                onSelectAsset: (assets, idx) => setActiveViewer({ assets, activeIndex: idx }),
                t,
              }),
            ],
          }),
        ],
      }),
      // Full-screen asset viewer modal.
      activeViewer
        ? jsx(AssetViewer, {
            assets: activeViewer.assets,
            activeIndex: activeViewer.activeIndex,
            onClose: () => setActiveViewer(null),
            onRegen: asset => {
              rest('/produce/regen', {
                method: 'POST',
                body: JSON.stringify({ id: itemId, target: asset.target || 'cover' }),
              })
                .then(res => {
                  if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
                })
                .catch(err => window.alert((err && err.message) || String(err)))
            },
            onAskAssistant: asset => {
              setChatSeedText(`> Please refine image prompt: ${asset.prompt || ''}\n\n`)
              setActiveViewer(null)
            },
            imageReady: true,
            t,
          })
        : null,
    ],
  })
}

// ---------------------------------------------------------------------------
