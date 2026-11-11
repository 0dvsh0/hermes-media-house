/**
 * MediaImage and ItemCard Components
 */

import { jsx, jsxs } from 'react/jsx-runtime'
import { useState, useEffect, useContext } from 'react'
import { AppContext } from './app.js'
import { Icon } from './ui.js'
import {
  normalizeAssetSrc,
  getItemThumbnailSrc,
  formatDateLabel,
  formatClock,
  relativeDay,
  SERIF_FONT,
  hash,
} from './util.js'
import { KIND_DOT_COLORS, STATUS_DOT_COLORS } from './constants.js'

export const ASSET_CACHE = new Map()
let _globalRest = null

export function setGlobalRest(restFn) {
  _globalRest = restFn
}

export function useAssetDataUrl(src) {
  const cleanSrc = src && typeof src === 'string' && src.endsWith('.mp4') ? src.replace(/\.mp4$/i, '-poster.jpg') : src
  const norm = normalizeAssetSrc(cleanSrc)
  const [dataUrl, setDataUrl] = useState(() => (norm ? ASSET_CACHE.get(norm) || null : null))
  const ctx = useContext(AppContext)
  const rest = (ctx && ctx.rest) || _globalRest

  useEffect(() => {
    if (!norm) {
      setDataUrl(null)
      return undefined
    }
    if (ASSET_CACHE.has(norm)) {
      setDataUrl(ASSET_CACHE.get(norm))
      return undefined
    }
    if (norm.startsWith('data:') || norm.startsWith('http://') || norm.startsWith('https://')) {
      setDataUrl(norm)
      return undefined
    }
    if (!rest) return undefined

    let cancelled = false
    rest(`/asset?src=${encodeURIComponent(norm)}`)
      .then(res => {
        if (!cancelled && res && res.dataUrl) {
          ASSET_CACHE.set(norm, res.dataUrl)
          setDataUrl(res.dataUrl)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [norm, rest])

  return dataUrl
}

export function MediaImage({ src, alt, style, className, draggable = false, onClick, ...props }) {
  const dataUrl = useAssetDataUrl(src)
  const [loadError, setLoadError] = useState(false)
  const directUrl = resolveMediaUrl(src)
  const displaySrc = dataUrl || directUrl

  if (!displaySrc || loadError) {
    return jsx('div', {
      style: {
        backgroundColor: 'color-mix(in srgb, var(--color-foreground) 6%, var(--color-background))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      },
      className,
      onClick,
      ...props,
      children: jsx(Icon, { name: 'image', size: 20, style: { opacity: 0.3 } }),
    })
  }

  return jsx('img', {
    src: displaySrc,
    alt: alt || '',
    draggable,
    onClick,
    onError: () => {
      if (!dataUrl) setLoadError(true)
    },
    style: {
      display: 'block',
      ...style,
    },
    className,
    ...props,
  })
}

export function resolveMediaUrl(src) {
  if (!src) return null
  let s = src
  if (typeof s === 'string' && s.endsWith('.mp4')) {
    s = s.replace(/\.mp4$/i, '-poster.jpg')
  }
  const norm = normalizeAssetSrc(s)
  if (ASSET_CACHE.has(norm)) {
    return ASSET_CACHE.get(norm)
  }
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) {
    return s
  }
  if (s.startsWith('media-desk/')) {
    return `/api/plugins/hermes-media-desk/${s.slice('media-desk/'.length)}`
  }
  return s
}

export function ItemCard({ item, onOpen, t, localeTag, isDragging = false }) {
  const [hover, setHover] = useState(false)
  const mediaSrc = getItemThumbnailSrc(item)
  const thumbnail = resolveMediaUrl(mediaSrc)
  const isQuote = item.kind === 'quote'
  const isVideo = item.kind === 'video'
  const isNote = item.kind === 'note'
  const titleText = item.title || (t ? t('item.untitled') : 'Untitled')
  const kindDot = KIND_DOT_COLORS[item.kind] || 'var(--ui-text-quaternary)'
  const statusDot = STATUS_DOT_COLORS[item.status] || 'var(--ui-text-quaternary)'
  const lines = (hash(item.id || '') % 2) === 0
  const running = item.production?.status === 'running'

  return jsxs(
    'div',
    {
      className: 'md-card',
      role: 'button',
      tabIndex: 0,
      'aria-label': `${item.kind || 'item'}: ${titleText}`,
      onPointerEnter: () => setHover(true),
      onPointerLeave: () => setHover(false),
      onClick: onOpen,
      onKeyDown: e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen?.(e)
        }
      },
      style: {
        textAlign: 'left',
        backgroundColor: 'var(--color-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        padding: '12px',
        cursor: isDragging ? 'grabbing' : onOpen ? 'pointer' : 'default',
        boxShadow: isDragging
          ? 'var(--shadow-lg), 0 0 0 1px var(--color-border)'
          : hover
          ? 'var(--shadow-md), 0 0 0 1px var(--color-border)'
          : 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        boxSizing: 'border-box',
        transition: isDragging
          ? 'none'
          : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s ease',
        transform: isDragging ? 'scale(1.04)' : hover ? 'translateY(-2px)' : 'none',
        userSelect: 'none',
      },
      children: [
        thumbnail &&
          jsx(
            'div',
            {
              style: {
                position: 'relative',
                width: '100%',
                height: '130px',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                marginBottom: '10px',
                backgroundColor: 'var(--color-background)',
                flexShrink: 0,
              },
              children: [
                jsx(MediaImage, {
                  src: mediaSrc,
                  alt: titleText,
                  draggable: false,
                  style: { width: '100%', height: '100%', objectFit: 'cover' },
                }),
                isVideo &&
                  jsx('span', {
                    style: {
                      position: 'absolute',
                      bottom: '8px',
                      left: '8px',
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: 'color-mix(in srgb, black 65%, transparent)',
                      color: 'var(--color-primary-foreground)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                    },
                    children: jsx(Icon, { name: 'play', size: 10, fill: true }),
                  }),
              ],
            },
            'thumb'
          ),

        isQuote
          ? jsx('blockquote', {
              style: {
                fontFamily: SERIF_FONT,
                fontSize: '14.5px',
                lineHeight: 1.5,
                color: 'var(--color-foreground)',
                fontStyle: 'italic',
                margin: '4px 0 10px',
                padding: '0 4px',
              },
              children: `"${titleText}"`,
            })
          : isNote
          ? jsxs('div', {
              style: { margin: '2px 0 8px' },
              children: [
                jsx('h3', {
                  style: {
                    margin: 0,
                    fontSize: '13.5px',
                    fontWeight: 600,
                    lineHeight: 1.4,
                    color: 'var(--color-foreground)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  },
                  children: titleText,
                }),
                item.body && item.body !== item.title
                  ? jsx('p', {
                      style: {
                        margin: '6px 0 0',
                        fontSize: '12px',
                        lineHeight: 1.5,
                        color: 'var(--ui-text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        ...(lines
                          ? {
                              borderLeft: '2px solid var(--color-border)',
                              paddingLeft: '6px',
                            }
                          : {}),
                      },
                      children: item.body,
                    })
                  : null,
              ],
            })
          : jsx('h3', {
              style: {
                margin: '2px 0 8px',
                fontSize: '13.5px',
                fontWeight: 600,
                lineHeight: 1.4,
                color: 'var(--color-foreground)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              },
              children: titleText,
            }),

        jsxs('footer', {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: 'auto',
            paddingTop: '6px',
            borderTop: '1px solid color-mix(in srgb, var(--color-border) 60%, transparent)',
            fontSize: '11px',
            color: 'var(--ui-text-tertiary)',
          },
          children: [
            jsx('span', {
              style: {
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: statusDot,
                flexShrink: 0,
              },
              title: item.status,
            }),
            jsx('span', {
              style: {
                fontWeight: 500,
                color: 'var(--ui-text-secondary)',
                textTransform: 'capitalize',
              },
              children: item.kind || 'note',
            }),
            jsx('span', { style: { flex: 1 } }),
            jsx('span', {
              style: { fontVariantNumeric: 'tabular-nums' },
              children: running
                ? 'Producing...'
                : item.production?.status === 'done'
                ? 'Drafted'
                : item.scheduledAt
                ? relativeDay(item.scheduledAt)
                : formatDateLabel(item.createdAt, localeTag),
            }),
          ],
        }),
      ],
    }
  )
}
