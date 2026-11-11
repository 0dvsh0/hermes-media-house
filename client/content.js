/**
 * Content Management Page
 * Kanban Board and Table views with inline status moves and search.
 */

import { jsx, jsxs } from 'react/jsx-runtime'
import React, {
  useState,
  useContext,
  useMemo,
} from 'react'
import { AppContext } from './app.js'
import { STATUSES, STATUS_DOT_COLORS, GHOST_BTN, SELECT_STYLE, SELECT_OPTION_STYLE } from './constants.js'
import { MediaImage, resolveMediaUrl } from './card.js'
import { Icon, IconButton } from './ui.js'
import { formatDateLabel, formatClock, truncateTitle, getItemThumbnailSrc } from './util.js'

// 6. Content List Page (Requirements 15.2, 19.4)
// ---------------------------------------------------------------------------

export function ContentPage() {
  const { state, dispatch, rest, t, localeTag } = useContext(AppContext)
  const items = (state.serverState && state.serverState.items) || []
  const filters = state.filters || {}
  const viewMode = filters.contentViewMode || 'board'

  // Inline status update: a single set_status op merged into local state.
  const handleStatusChange = useCallback(
    (itemId, newStatus) => {
      rest('/ops', {
        method: 'POST',
        body: JSON.stringify({
          ops: [{ op: 'set_status', id: itemId, status: newStatus }],
        }),
      })
        .then(res => {
          if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
        })
        .catch(err => {
          window.alert((err && err.message) || String(err))
        })
    },
    [rest, dispatch]
  )

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filters.kind && filters.kind !== 'all' && item.kind !== filters.kind) return false
      if (filters.platform && filters.platform !== 'all' && item.platform !== filters.platform) {
        return false
      }
      if (filters.status && filters.status !== 'all' && item.status !== filters.status) return false
      if (filters.search) {
        const q = filters.search.toLowerCase()
        return (
          (item.title || '').toLowerCase().includes(q) ||
          (item.body || '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [items, filters])

  const ideaCount = items.filter(i => !i.status || i.status === 'idea').length
  const draftedCount = items.filter(
    i => i.status === 'outline' || i.status === 'draft' || i.status === 'ready'
  ).length
  const publishedCount = items.filter(i => i.status === 'published').length
  const subtitle = t('content.subtitle')
    .replace('{total}', String(items.length))
    .replace('{ideas}', String(ideaCount))
    .replace('{drafted}', String(draftedCount))
    .replace('{published}', String(publishedCount))

  const segmentedBtn = active => ({
    padding: '4px 12px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'background-color 250ms ease, color 250ms ease',
    backgroundColor: active ? 'var(--color-card)' : 'transparent',
    color: active ? 'var(--color-foreground)' : 'var(--ui-text-tertiary)',
    boxShadow: active ? 'var(--shadow-sm)' : 'none',
  })

  return jsxs('div', {
    className: 'md-board-page',
    style: {
      flex: 1,
      height: '100%',
      overflowY: 'auto',
      padding: '12px 24px 40px',
      boxSizing: 'border-box',
      backgroundColor: 'var(--ui-bg-chrome, var(--color-background))',
    },
    children: [
      // Header row: title + counts subtitle, search box, Board/Table pill.
      jsxs('div', {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '20px',
        },
        children: [
          jsxs('div', {
            children: [
              jsx('h1', {
                style: {
                  fontSize: '28px',
                  fontWeight: 400,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                  color: 'var(--color-foreground)',
                  margin: 0,
                },
                children: t('nav.content'),
              }),
              jsx('p', {
                style: {
                  fontSize: '12.5px',
                  color: 'var(--ui-text-quaternary)',
                  marginTop: '2px',
                  fontVariantNumeric: 'tabular-nums',
                },
                children: subtitle,
              }),
            ],
          }),
          jsxs('div', {
            style: { display: 'flex', alignItems: 'center', gap: '10px' },
            children: [
              // Search box
              jsxs('div', {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '6px 12px',
                  width: '240px',
                  boxShadow: 'var(--shadow-sm)',
                },
                children: [
                  jsxs(
                    'svg',
                    {
                      width: 14,
                      height: 14,
                      viewBox: '0 0 24 24',
                      fill: 'none',
                      stroke: 'var(--ui-text-quaternary)',
                      strokeWidth: 2,
                      strokeLinecap: 'round',
                      style: { flexShrink: 0 },
                      children: [
                        jsx('circle', { cx: 11, cy: 11, r: 7 }),
                        jsx('line', { x1: 21, y1: 21, x2: 16.2, y2: 16.2 }),
                      ],
                    },
                    'search-ico'
                  ),
                  jsx('input', {
                    type: 'text',
                    value: filters.search || '',
                    onChange: e =>
                      dispatch({ type: 'SET_FILTERS', payload: { search: e.target.value } }),
                    placeholder: t('content.searchPlaceholder'),
                    'aria-label': t('content.searchPlaceholder'),
                    style: {
                      width: '100%',
                      backgroundColor: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: '12.5px',
                      color: 'var(--color-foreground)',
                    },
                  }),
                ],
              }),
              // Board / Table segmented pill
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
                  jsxs('button', {
                    type: 'button',
                    onClick: () =>
                      dispatch({ type: 'SET_FILTERS', payload: { contentViewMode: 'board' } }),
                    style: { ...segmentedBtn(viewMode === 'board'), display: 'inline-flex', alignItems: 'center', gap: '5px' },
                    children: [
                      jsx(Icon, { name: 'project', size: 13 }),
                      jsx('span', {}, t('content.viewBoard')),
                    ],
                  }),
                  jsxs('button', {
                    type: 'button',
                    onClick: () =>
                      dispatch({ type: 'SET_FILTERS', payload: { contentViewMode: 'table' } }),
                    style: { ...segmentedBtn(viewMode === 'table'), display: 'inline-flex', alignItems: 'center', gap: '5px' },
                    children: [
                      jsx(Icon, { name: 'list', size: 13 }),
                      jsx('span', {}, t('content.viewTable')),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      viewMode === 'table'
        ? jsx(TableView, {
            items: filteredItems,
            onStatusChange: handleStatusChange,
            dispatch,
            t,
            localeTag,
          })
        : jsx(KanbanView, { items: filteredItems, dispatch, t, localeTag }),
    ],
  })
}

// ---------------------------------------------------------------------------
// 6a. Content table view (inline status editing)
// ---------------------------------------------------------------------------

export function TableView({ items, onStatusChange, dispatch, t }) {
  const statuses = ['idea', 'outline', 'draft', 'ready', 'published']
  const headCell = { padding: '12px 16px', whiteSpace: 'nowrap' }
  const bodyCell = { padding: '10px 16px', color: 'var(--ui-text-tertiary)' }

  return jsx('div', {
    style: {
      backgroundColor: 'var(--color-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-xl)',
      overflowX: 'auto',
      boxShadow: 'var(--shadow-sm)',
    },
    children: jsxs('table', {
      style: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' },
      children: [
        jsx('thead', {
          children: jsx('tr', {
            style: {
              borderBottom: '1px solid var(--color-border)',
              color: 'var(--ui-text-quaternary)',
              fontSize: '11.5px',
              fontWeight: 500,
            },
            children: [
              jsx('th', { style: headCell, children: t('content.colTitle') }),
              jsx('th', { style: headCell, children: t('content.colKind') }),
              jsx('th', { style: headCell, children: t('content.colPlatform') }),
              jsx('th', { style: headCell, children: t('content.colStatus') }),
              jsx('th', { style: headCell, children: t('content.colScheduled') }),
              jsx('th', { style: headCell, children: t('content.colPublished') }),
            ],
          }),
        }),
        jsx('tbody', {
          children: items.map(item => {
            const kindLabel = item.kind ? t(`kind.${item.kind}`) : t('kind.note')
            return jsxs(
              'tr',
              {
                key: item.id,
                style: {
                  borderBottom: '1px solid color-mix(in srgb, var(--color-border) 55%, transparent)',
                },
                children: [
                  jsx('td', {
                    onClick: () => dispatch({ type: 'OPEN_ITEM', payload: item.id }),
                    style: {
                      padding: '10px 16px',
                      fontWeight: 600,
                      color: 'var(--color-foreground)',
                      cursor: 'pointer',
                      maxWidth: '320px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    },
                    children: item.title || t('item.untitled'),
                  }),
                  jsx('td', { style: bodyCell, children: kindLabel }),
                  jsx('td', { style: bodyCell, children: item.platform || '—' }),
                  jsx('td', {
                    style: { padding: '10px 16px' },
                    children: jsx('select', {
                      value: item.status || 'idea',
                      onChange: e => onStatusChange(item.id, e.target.value),
                      onClick: e => e.stopPropagation(),
                      style: {
                        ...SELECT_STYLE,
                        padding: '4px 24px 4px 8px',
                        fontSize: '12px',
                        fontWeight: 600,
                      },
                      children: statuses.map(st =>
                        jsx('option', {
                          key: st,
                          value: st,
                          style: SELECT_OPTION_STYLE,
                          children: t(`status.${st}`),
                        })
                      ),
                    }),
                  }),
                  jsx('td', {
                    style: {
                      padding: '10px 16px',
                      color: 'var(--ui-text-quaternary)',
                      fontVariantNumeric: 'tabular-nums',
                    },
                    children: item.scheduledAt ? item.scheduledAt.slice(0, 10) : '—',
                  }),
                  jsx('td', {
                    style: {
                      padding: '10px 16px',
                      color: 'var(--ui-text-quaternary)',
                      fontVariantNumeric: 'tabular-nums',
                    },
                    children: item.publishedAt ? item.publishedAt.slice(0, 10) : '—',
                  }),
                ],
              },
              item.id
            )
          }),
        }),
      ],
    }),
  })
}

// ---------------------------------------------------------------------------
// 6b. Content kanban board (five stage columns)
// ---------------------------------------------------------------------------

export function KanbanView({ items, dispatch, t, localeTag }) {
  const columns = ['idea', 'outline', 'draft', 'ready', 'published']

  return jsx('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5, minmax(180px, 1fr))',
      gap: '14px',
      alignItems: 'start',
      overflowX: 'auto',
      paddingBottom: '4px',
    },
    children: columns.map(colStatus => {
      const colItems = items.filter(i => (i.status || 'idea') === colStatus)
      return jsxs(
        'div',
        {
          key: colStatus,
          style: {
            backgroundColor:
              'color-mix(in srgb, var(--color-foreground) 3%, var(--color-background))',
            border: '1px solid color-mix(in srgb, var(--color-border) 60%, transparent)',
            borderRadius: 'var(--radius-xl)',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            minHeight: '180px',
          },
          children: [
            jsxs('div', {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '2px 6px',
                fontSize: '12.5px',
              },
              children: [
                jsx('span', {
                  style: {
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    backgroundColor: STATUS_DOT_COLORS[colStatus] || 'var(--ui-text-quaternary)',
                  },
                }),
                jsx('span', {
                  style: { fontWeight: 600, color: 'var(--color-foreground)' },
                  children: t(`status.${colStatus}`),
                }),
                jsx('span', {
                  style: {
                    color: 'var(--ui-text-quaternary)',
                    fontVariantNumeric: 'tabular-nums',
                  },
                  children: colItems.length,
                }),
              ],
            }),
            jsx('div', {
              style: { display: 'flex', flexDirection: 'column', gap: '10px' },
              children: colItems.map(item => {
                const mediaSrc = getItemThumbnailSrc(item)
                const thumb = resolveMediaUrl(mediaSrc)
                const dateVal = item.publishedAt || item.scheduledAt
                return jsxs(
                  'div',
                  {
                    key: item.id,
                    onClick: () => dispatch({ type: 'OPEN_ITEM', payload: item.id }),
                    style: {
                      width: '100%',
                      textAlign: 'left',
                      backgroundColor: 'var(--color-card)',
                      border: '1px solid color-mix(in srgb, var(--color-border) 80%, transparent)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '10px',
                      cursor: 'pointer',
                      boxShadow: 'var(--shadow-sm)',
                    },
                    children: [
                      thumb
                        ? jsx(
                            'div',
                            {
                              style: {
                                width: '100%',
                                height: '94px',
                                borderRadius: 'var(--radius-md)',
                                overflow: 'hidden',
                                marginBottom: '10px',
                                backgroundColor: 'var(--color-background)',
                              },
                              children: jsx(MediaImage, {
                                src: mediaSrc,
                                alt: item.title || t('item.untitled'),
                                draggable: false,
                                style: {
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  display: 'block',
                                },
                              }),
                            },
                            'kb-thumb'
                          )
                        : null,
                      jsx('div', {
                        style: {
                          fontSize: '12.5px',
                          fontWeight: 600,
                          lineHeight: 1.35,
                          color: 'var(--color-foreground)',
                        },
                        children: item.title || t('item.untitled'),
                      }),
                      item.platform || dateVal
                        ? jsxs('div', {
                            style: {
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '11px',
                              color: 'var(--ui-text-quaternary)',
                              marginTop: '6px',
                            },
                            children: [
                              item.platform ? jsx('span', { children: item.platform }) : null,
                              dateVal
                                ? jsx('span', {
                                    style: {
                                      color: 'color-mix(in srgb, var(--ui-blue) 75%, transparent)',
                                      fontVariantNumeric: 'tabular-nums',
                                    },
                                    children: formatDateLabel(dateVal, localeTag),
                                  })
                                : null,
                            ],
                          })
                        : null,
                    ],
                  },
                  item.id
                )
              }),
            }),
          ],
        },
        colStatus
      )
    }),
  })
}

// ---------------------------------------------------------------------------
