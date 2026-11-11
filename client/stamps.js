/**
 * Postage Stamp Inspiration Strip
 * Renders daily postage stamps for recent days with media preview
 */

import { jsx, jsxs } from 'react/jsx-runtime'
import { useContext } from 'react'
import { AppContext } from './app.js'
import { dayKey, posterOf, isIdea } from './util.js'
import { MediaImage } from './card.js'
import { Icon } from './ui.js'

export function useDayMap(items) {
  const map = new Map()
  for (const item of items || []) {
    if (!isIdea(item)) continue
    const key = dayKey(item.createdAt)
    if (key) {
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    }
  }
  return map
}

function coverOf(list) {
  if (!list || !list.length) return null
  return list.find(item => posterOf(item)) || list[0]
}

export function Stamp({ list, today, onOpen, label, title }) {
  if (!list || !list.length) {
    return jsx('button', {
      type: 'button',
      onClick: today ? onOpen : undefined,
      disabled: !today,
      title: today ? 'No ideas today - click to jot one down' : label,
      'aria-label': today ? 'No ideas today - click to jot one down' : label,
      style: {
        width: '32px',
        height: '40px',
        borderRadius: 'var(--radius-sm)',
        border: '1px dashed var(--color-border)',
        backgroundColor: today
          ? 'color-mix(in srgb, var(--ui-blue) 8%, var(--color-card))'
          : 'var(--color-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: today ? 'pointer' : 'default',
        fontSize: '12px',
        color: today ? 'var(--ui-blue)' : 'var(--ui-text-quaternary)',
        padding: 0,
        flexShrink: 0,
        transition: 'all 0.15s ease',
      },
      children: today ? jsx(Icon, { name: 'plus', size: 12 }) : null,
    })
  }

  const cover = coverOf(list)
  const poster = posterOf(cover)
  const count = list.length

  return jsxs('button', {
    type: 'button',
    onClick: onOpen,
    title: `${label}: ${cover.title || 'Untitled'} (${count})`,
    'aria-label': `${label}: ${cover.title || 'Untitled'} (${count})`,
    style: {
      position: 'relative',
      width: '32px',
      height: '40px',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--color-border)',
      backgroundColor: 'var(--color-card)',
      overflow: 'hidden',
      cursor: 'pointer',
      padding: 0,
      flexShrink: 0,
      boxShadow: 'var(--shadow-sm)',
    },
    children: [
      poster
        ? jsx(MediaImage, {
            src: poster,
            alt: '',
            style: { width: '100%', height: '100%', objectFit: 'cover' },
          })
        : jsx('span', {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--ui-text-secondary)',
              backgroundColor: 'color-mix(in srgb, var(--color-foreground) 5%, var(--color-card))',
            },
            children: (cover.title || 'U').slice(0, 1).toUpperCase(),
          }),
      count > 1 &&
        jsx('i', {
          style: {
            position: 'absolute',
            bottom: '2px',
            right: '2px',
            fontSize: '9px',
            fontWeight: 700,
            lineHeight: 1,
            padding: '1px 3px',
            borderRadius: 'var(--radius-xs)',
            backgroundColor: 'var(--color-foreground)',
            color: 'var(--color-background)',
            fontStyle: 'normal',
          },
          children: count,
        }),
    ],
  })
}

export function MiniStamps({ onOpenDay, onOpenSchedule }) {
  const { state } = useContext(AppContext)
  const items = (state.serverState && state.serverState.items) || []
  const days = useDayMap(items)
  const now = new Date()
  const cells = []
  for (let i = 9; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    cells.push(d)
  }

  return jsxs('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      marginTop: '12px',
      paddingLeft: '4px',
    },
    children: [
      ...cells.map(d => {
        const key = dayKey(d)
        const list = days.get(key)
        const isToday = key === dayKey(now)
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        return jsx(
          Stamp,
          {
            list,
            today: isToday,
            label,
            onOpen: () => {
              if (list && list.length) {
                onOpenDay(coverOf(list).id)
              }
            },
          },
          key
        )
      }),
      jsx('button', {
        type: 'button',
        onClick: onOpenSchedule,
        title: 'Open Schedule Calendar',
        'aria-label': 'Open Schedule Calendar',
        style: {
          width: '32px',
          height: '40px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-card)',
          color: 'var(--ui-text-secondary)',
          cursor: 'pointer',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        children: jsx(Icon, { name: 'arrowRight', size: 14 }),
      }),
    ],
  })
}
