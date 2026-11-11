/**
 * Schedule / Inspiration Calendar Page
 * Month grid with daily postage stamps and Up-Next unscheduled rail.
 */

import { jsx, jsxs } from 'react/jsx-runtime'
import React, {
  useState,
  useContext,
  useMemo,
} from 'react'
import { AppContext } from './app.js'
import { GHOST_BTN } from './constants.js'
import { MediaImage, resolveMediaUrl } from './card.js'
import { Icon } from './ui.js'
import { truncateTitle, formatDateLabel, formatClock, todayLocal, getItemThumbnailSrc } from './util.js'
import { Stamp, useDayMap } from './stamps.js'

// 7. Schedule / Calendar Page (Requirements 17.1-17.6)
// ---------------------------------------------------------------------------

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const THUMB_FALLBACK_GRADIENT =
  'linear-gradient(135deg, color-mix(in srgb, var(--ui-purple) 42%, var(--color-background)), color-mix(in srgb, var(--ui-yellow) 42%, var(--color-background)))'

export function SchedulePage() {
  const { state, dispatch, rest, t, localeTag } = useContext(AppContext)
  const items = (state.serverState && state.serverState.items) || []

  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => todayLocal())
  const [scheduleError, setScheduleError] = useState('')
  const [dragOverDate, setDragOverDate] = useState(null)
  const [trayOver, setTrayOver] = useState(false)
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`

  // schedule_item op with a noon-UTC anchor so the date never shifts across
  // time zones (Requirement 17.4, 17.6). Supports unscheduling when dateStr is null.
  const handleScheduleItem = (itemId, dateStr, platform) => {
    if (!itemId) return
    setScheduleError('')
    let isoDateTime = null
    if (dateStr) {
      if (dateStr.includes('T')) {
        isoDateTime = new Date(dateStr).toISOString()
      } else {
        isoDateTime = new Date(`${dateStr}T12:00:00Z`).toISOString()
      }
    }
    const op = { op: 'schedule_item', id: itemId, scheduledAt: isoDateTime }
    if (platform && typeof platform === 'string') op.platform = platform

    // Optimistic client update for instant feedback
    if (state.serverState && state.serverState.items) {
      const nextItems = state.serverState.items.map(it => {
        if (it.id !== itemId) return it
        const currentStatus = it.status || 'idea'
        let targetStatus = currentStatus
        if (isoDateTime) {
          if (targetStatus !== 'published') {
            targetStatus = targetStatus === 'ready' || targetStatus === 'draft' ? 'ready' : 'outline'
          }
        } else {
          if (targetStatus === 'ready') targetStatus = 'draft'
          else if (targetStatus === 'outline') targetStatus = 'idea'
        }
        return {
          ...it,
          scheduledAt: isoDateTime,
          status: targetStatus,
          ...(platform ? { platform } : {}),
        }
      })
      dispatch({ type: 'SET_STATE', payload: { ...state.serverState, items: nextItems } })
    }

    rest('/ops', {
      method: 'POST',
      body: { ops: [op] },
    })
      .then(res => {
        if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
      })
      .catch(err => {
        setScheduleError(`${t('schedule.dateSetFailed')} ${err.message || String(err)}`)
      })
  }

  const totalDays = new Date(year, month + 1, 0).getDate()
  const firstDayIndex = new Date(year, month, 1).getDay()
  const rowsCount = Math.ceil((firstDayIndex + totalDays) / 7)

  // Unscheduled tray, oldest first (Requirement 17.3).
  const unscheduledItems = useMemo(() => {
    return items
      .filter(i => !i.scheduledAt)
      .slice()
      .sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return da - db
      })
  }, [items])

  const draftedGroup = useMemo(
    () =>
      unscheduledItems.filter(
        i => i.status === 'outline' || i.status === 'draft' || i.status === 'ready'
      ),
    [unscheduledItems]
  )
  const ideasGroup = useMemo(
    () => unscheduledItems.filter(i => !i.status || i.status === 'idea'),
    [unscheduledItems]
  )

  // Soonest upcoming scheduled item drives the Up-next card.
  const upNext = useMemo(() => {
    const now = Date.now() - 12 * 3600 * 1000
    const scheduled = items
      .filter(i => {
        if (!i.scheduledAt) return false
        const ts = new Date(i.scheduledAt).getTime()
        return !isNaN(ts) && ts >= now
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    return scheduled[0] || null
  }, [items])

  const streakDays = useMemo(() => computeStreak(items), [items])
  const ideasThisMonth = items.filter(
    i => i.createdAt && i.createdAt.slice(0, 7) === monthKey
  ).length
  const postsThisMonth = items.filter(i => {
    const src = i.scheduledAt || i.publishedAt
    return Boolean(src && src.slice(0, 7) === monthKey)
  }).length

  const locTag = localeTag === 'zh' ? 'zh-CN' : 'en-US'
  const monthLabel = new Intl.DateTimeFormat(locTag, { month: 'long' }).format(currentDate)
  const headerDay =
    selectedDate && selectedDate.slice(0, 7) === monthKey
      ? Number(selectedDate.slice(8, 10))
      : currentDate.getDate()

  const upNextTs = upNext ? new Date(upNext.scheduledAt) : null
  const upNextIsTomorrow =
    upNextTs && upNextTs.toDateString() === new Date(Date.now() + 24 * 3600 * 1000).toDateString()

  const navBtnStyle = {
    padding: '5px 10px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-card)',
    color: 'var(--ui-text-secondary)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  }
  const dateInputStyle = {
    padding: '2px 4px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    backgroundColor: 'color-mix(in srgb, var(--color-foreground) 4%, var(--color-background))',
    color: 'var(--ui-text-secondary)',
    fontSize: '11px',
    cursor: 'pointer',
    maxWidth: '132px',
  }
  const statBlock = (labelKey, value) =>
    jsx(
      'div',
      {
        children: [
          jsx('div', {
            style: { fontSize: '11px', color: 'var(--ui-text-quaternary)' },
            children: t(labelKey),
          }),
          jsx('div', {
            style: {
              fontFamily: SERIF_FONT,
              fontSize: '20px',
              lineHeight: 1.25,
              color: 'var(--ui-text-secondary)',
              fontVariantNumeric: 'tabular-nums',
            },
            children: value,
          }),
        ],
      },
      labelKey
    )

  const thumbOf = item => {
    const mediaSrc = getItemThumbnailSrc(item)
    return resolveMediaUrl(mediaSrc)
  }

  return jsxs('div', {
    className: 'md-board-page',
    style: {
      display: 'flex',
      gap: '16px',
      flex: 1,
      height: '100%',
      padding: '8px 20px 16px',
      boxSizing: 'border-box',
      overflow: 'hidden',
      backgroundColor: 'var(--ui-bg-chrome, var(--color-background))',
    },
    children: [
      // Left: calendar card.
      jsxs('div', {
        style: {
          flex: 1,
          minWidth: 0,
          backgroundColor: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        },
        children: [
          scheduleError
            ? jsxs('div', {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'color-mix(in srgb, var(--ui-red) 12%, var(--color-background))',
                  color: 'var(--ui-red)',
                  fontSize: '12px',
                  marginBottom: '12px',
                },
                children: [
                  jsx('span', { children: scheduleError }),
                  jsx('button', {
                    type: 'button',
                    onClick: () => setScheduleError(''),
                    style: {
                      border: 'none',
                      background: 'none',
                      color: 'var(--ui-red)',
                      cursor: 'pointer',
                      fontWeight: 700,
                    },
                    children: '✕',
                  }),
                ],
              })
            : null,
          // Header: serif day, month/year, stats, month navigation.
          jsxs('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              flexShrink: 0,
            },
            children: [
              jsxs('div', {
                style: { display: 'flex', alignItems: 'center', gap: '24px' },
                children: [
                  jsxs('div', {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      paddingRight: '16px',
                      borderRight: '1px solid var(--color-border)',
                    },
                    children: [
                      jsx('span', {
                        style: {
                          fontFamily: SERIF_FONT,
                          fontSize: '44px',
                          lineHeight: 1,
                          color: 'var(--ui-text-tertiary)',
                          fontVariantNumeric: 'tabular-nums',
                        },
                        children: headerDay,
                      }),
                      jsx('div', {
                        children: [
                          jsx('div', {
                            style: {
                              fontSize: '11px',
                              color: 'var(--ui-text-quaternary)',
                              fontVariantNumeric: 'tabular-nums',
                            },
                            children: year,
                          }),
                          jsx('div', {
                            style: {
                              fontFamily: SERIF_FONT,
                              fontStyle: 'italic',
                              fontSize: '20px',
                              lineHeight: 1.3,
                              color: 'var(--ui-text-tertiary)',
                            },
                            children: monthLabel,
                          }),
                        ],
                      }),
                    ],
                  }),
                  statBlock('schedule.streak', `${streakDays} ${t('home.day')}`),
                  statBlock('schedule.ideasThisMonth', ideasThisMonth),
                  statBlock('schedule.postsThisMonth', postsThisMonth),
                ],
              }),
              jsxs('div', {
                style: { display: 'flex', alignItems: 'center', gap: '6px' },
                children: [
                  jsx('button', {
                    type: 'button',
                    'aria-label': t('schedule.prevMonth'),
                    onClick: () => setCurrentDate(new Date(year, month - 1, 1)),
                    style: { ...navBtnStyle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
                    children: jsx(Icon, { name: 'chevL', size: 14 }),
                  }),
                  jsx('button', {
                    type: 'button',
                    onClick: () => {
                      setCurrentDate(new Date())
                      setSelectedDate(todayLocal())
                    },
                    style: navBtnStyle,
                    children: jsxs('span', {
                      style: { display: 'inline-flex', alignItems: 'center', gap: '4px' },
                      children: [
                        jsx(Icon, { name: 'calendar', size: 12 }),
                        t('schedule.today'),
                      ],
                    }),
                  }),
                  jsx('button', {
                    type: 'button',
                    'aria-label': t('schedule.nextMonth'),
                    onClick: () => setCurrentDate(new Date(year, month + 1, 1)),
                    style: { ...navBtnStyle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
                    children: jsx(Icon, { name: 'chevR', size: 14 }),
                  }),
                ],
              }),
            ],
          }),
          // Weekday labels.
          jsx('div', {
            style: {
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '6px',
              marginBottom: '6px',
              padding: '0 4px',
              fontSize: '11.5px',
              color: 'var(--ui-text-quaternary)',
              flexShrink: 0,
            },
            children: WEEKDAY_KEYS.map(d =>
              jsx('div', { key: d, children: t(`schedule.${d}`) })
            ),
          }),
          // Month grid; every cell accepts schedule drops.
          jsx('div', {
            style: {
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gridTemplateRows: `repeat(${rowsCount}, minmax(0, 1fr))`,
              gap: '6px',
              minHeight: 0,
            },
            children: Array.from({ length: firstDayIndex + totalDays }).map((_, idx) => {
              const dayNum = idx - firstDayIndex + 1
              const inMonth = dayNum >= 1 && dayNum <= totalDays
              const dateStr = `${monthKey}-${String(Math.max(1, dayNum)).padStart(2, '0')}`
              const isSelected = inMonth && selectedDate === dateStr
              const isToday = inMonth && todayLocal() === dateStr
              const isDragOver = inMonth && dragOverDate === dateStr
              const dayItems = inMonth
                ? items.filter(i => i.scheduledAt && i.scheduledAt.slice(0, 10) === dateStr)
                : []
              const cellStyle = {
                borderRadius: 'var(--radius-lg)',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                gap: '4px',
                border: isDragOver
                  ? '1px dashed var(--theme-primary, var(--ui-accent, var(--ui-blue)))'
                  : (isSelected ? '1px solid var(--theme-primary, var(--ui-accent, var(--ui-blue)))' : '1px solid transparent'),
                cursor: inMonth ? 'pointer' : 'default',
                overflow: 'hidden',
                transition: 'background-color 250ms ease, border-color 250ms ease',
                backgroundColor: isDragOver
                  ? 'color-mix(in srgb, var(--theme-primary, var(--ui-accent, var(--ui-blue))) 12%, var(--color-card))'
                  : (inMonth
                    ? 'color-mix(in srgb, var(--color-foreground) 3%, var(--color-background))'
                    : 'transparent'),
                opacity: inMonth ? 1 : 0.45,
              }
              return jsxs(
                'div',
                {
                  key: `cell-${idx}`,
                  style: cellStyle,
                  onClick: () => {
                    if (inMonth) setSelectedDate(dateStr)
                  },
                  onDragOver: e => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (dragOverDate !== dateStr) setDragOverDate(dateStr)
                  },
                  onDragLeave: e => {
                    if (dragOverDate === dateStr) setDragOverDate(null)
                  },
                  onDrop: e => {
                    e.preventDefault()
                    setDragOverDate(null)
                    const id = e.dataTransfer.getData('text/media-desk-item') || e.dataTransfer.getData('text/plain')
                    if (!id) return
                    const dragged = items.find(i => i.id === id)
                    handleScheduleItem(id, dateStr, dragged ? dragged.platform : null)
                  },
                  children: [
                    jsxs('div', {
                      style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
                      children: [
                        isToday
                          ? jsx('span', {
                              style: {
                                width: '18px',
                                height: '18px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--theme-primary, var(--ui-accent, var(--ui-blue)))',
                                color: 'var(--theme-primary-foreground, var(--color-primary-foreground, white))',
                                fontSize: '10px',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontVariantNumeric: 'tabular-nums',
                              },
                              children: inMonth ? dayNum : '',
                            })
                          : jsx('span', {
                              style: {
                                fontSize: '11px',
                                fontWeight: 500,
                                color: 'var(--ui-text-quaternary)',
                                fontVariantNumeric: 'tabular-nums',
                              },
                              children: inMonth ? dayNum : dayNum > 0 ? dayNum : '',
                            }),
                      ],
                    }),
                    jsx('div', {
                      style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        overflowY: 'auto',
                        minHeight: 0,
                      },
                      children: dayItems.map(item => {
                        const thumb = thumbOf(item)
                        const titleText = (item.title || t('item.untitled')).trim()
                        return jsxs(
                          'div',
                          {
                            key: item.id,
                            title: titleText,
                            draggable: true,
                            onDragStart: e => {
                              e.dataTransfer.setData('text/media-desk-item', item.id)
                              e.dataTransfer.setData('text/plain', item.id)
                              e.dataTransfer.effectAllowed = 'move'
                            },
                            onClick: e => {
                              e.stopPropagation()
                              dispatch({ type: 'OPEN_ITEM', payload: item.id })
                            },
                            style: {
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: 'var(--color-card)',
                              border: '1px solid color-mix(in srgb, var(--color-border) 70%, transparent)',
                              borderRadius: 'var(--radius-md)',
                              padding: '3px',
                              cursor: 'grab',
                              boxShadow: 'var(--shadow-sm)',
                            },
                            children: [
                              thumb
                                ? jsx(MediaImage, {
                                    src: getItemThumbnailSrc(item),
                                    alt: '',
                                    draggable: false,
                                    style: {
                                      width: '20px',
                                      height: '20px',
                                      borderRadius: 'var(--radius-sm)',
                                      objectFit: 'cover',
                                      flexShrink: 0,
                                    },
                                  })
                                : jsx('span', {
                                    style: {
                                      width: '20px',
                                      height: '20px',
                                      borderRadius: 'var(--radius-sm)',
                                      background: THUMB_FALLBACK_GRADIENT,
                                      flexShrink: 0,
                                    },
                                  }),
                              jsx('div', {
                                style: { minWidth: 0, flex: 1, lineHeight: 1.1 },
                                children: [
                                  jsx('div', {
                                    style: {
                                      fontSize: '9px',
                                      color: 'var(--ui-text-quaternary)',
                                      fontVariantNumeric: 'tabular-nums',
                                    },
                                    children: formatClock(item.scheduledAt),
                                  }),
                                  jsx('div', {
                                    style: {
                                      fontSize: '10px',
                                      fontWeight: 500,
                                      color: 'var(--color-foreground)',
                                      marginTop: '1px',
                                      overflow: 'hidden',
                                      whiteSpace: 'nowrap',
                                      textOverflow: 'ellipsis',
                                    },
                                    children: truncateTitle(titleText, 40),
                                  }),
                                ],
                              }),
                            ],
                          },
                          item.id
                        )
                      }),
                    }),
                  ],
                },
                `cell-${idx}`
              )
            }),
          }),
        ],
      }),
      // Right rail: Up-next inverted card + unscheduled tray.
      jsxs('div', {
        style: {
          width: '265px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          overflow: 'hidden',
        },
        children: [
          upNext
            ? jsxs('div', {
                onClick: () => dispatch({ type: 'OPEN_ITEM', payload: upNext.id }),
                style: {
                  backgroundColor: 'var(--color-card)',
                  color: 'var(--color-foreground)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '16px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: 'var(--shadow-sm)',
                },
                children: [
                  jsxs('div', {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11.5px',
                      color: 'var(--ui-text-tertiary)',
                      marginBottom: '6px',
                    },
                    children: [
                      jsx('span', { children: t('schedule.upNext') }),
                      jsx('span', {
                        children: upNextIsTomorrow ? t('schedule.tomorrow') : formatDateLabel(upNext.scheduledAt, localeTag),
                      }),
                    ],
                  }),
                  jsx('div', {
                    style: {
                      fontFamily: SERIF_FONT,
                      fontSize: '31px',
                      lineHeight: 1,
                      marginBottom: '8px',
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--theme-primary, var(--ui-accent, var(--ui-blue)))',
                    },
                    children: formatClock(upNext.scheduledAt),
                  }),
                  jsx('div', {
                    style: { fontSize: '13px', fontWeight: 500, lineHeight: 1.4, marginBottom: '8px', color: 'var(--color-foreground)' },
                    children: truncateTitle(upNext.title || t('item.untitled'), 48),
                  }),
                  jsx('div', {
                    style: {
                      fontSize: '11px',
                      color: 'var(--ui-text-tertiary)',
                    },
                    children: [
                      upNext.platform || '—',
                      ' · ',
                      t(`status.${upNext.status || 'idea'}`),
                      ' · ',
                      formatDateLabel(upNext.scheduledAt, localeTag),
                    ],
                  }),
                ],
              })
            : jsx('div', {
                style: {
                  backgroundColor: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '16px',
                  fontSize: '12px',
                  color: 'var(--ui-text-quaternary)',
                  flexShrink: 0,
                },
                children: t('schedule.upNextEmpty'),
              }),
          // Unscheduled tray grouped Drafted vs Ideas.
          jsxs('div', {
            onDragOver: e => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              if (!trayOver) setTrayOver(true)
            },
            onDragLeave: e => {
              if (!e.currentTarget.contains(e.relatedTarget)) setTrayOver(false)
            },
            onDrop: e => {
              e.preventDefault()
              setTrayOver(false)
              const id = e.dataTransfer.getData('text/media-desk-item') || e.dataTransfer.getData('text/plain')
              if (id) {
                handleScheduleItem(id, null)
              }
            },
            style: {
              flex: 1,
              minHeight: 0,
              backgroundColor: trayOver
                ? 'color-mix(in srgb, var(--theme-primary, var(--ui-accent, var(--ui-blue))) 8%, var(--color-card))'
                : 'var(--color-card)',
              border: trayOver
                ? '1px dashed var(--theme-primary, var(--ui-accent, var(--ui-blue)))'
                : '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-sm)',
              transition: 'background-color 200ms ease, border-color 200ms ease',
            },
            children: [
              jsxs('div', {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                },
                children: [
                  jsx('span', {
                    style: {
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--color-foreground)',
                    },
                    children: t('schedule.unscheduled'),
                  }),
                  jsx('span', {
                    style: { fontSize: '11px', color: 'var(--ui-text-quaternary)' },
                    children: t('schedule.dragToCalendar'),
                  }),
                ],
              }),
              unscheduledItems.length === 0
                ? jsx('div', {
                    style: { fontSize: '12px', color: 'var(--ui-text-quaternary)' },
                    children: t('schedule.emptyUnscheduled'),
                  })
                : null,
              draftedGroup.length > 0
                ? jsx('div', {
                    style: {
                      fontSize: '11.5px',
                      color: 'var(--ui-text-quaternary)',
                      marginBottom: '8px',
                      fontVariantNumeric: 'tabular-nums',
                    },
                    children: `${t('schedule.groupDrafted')} ${draftedGroup.length}`,
                  })
                : null,
              jsx('div', {
                style: { display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' },
                children: draftedGroup.map(item => {
                  const mediaSrc = getItemThumbnailSrc(item)
                  const thumb = thumbOf(item)
                  return jsxs(
                    'div',
                    {
                      key: item.id,
                      draggable: true,
                      onDragStart: e => {
                        e.dataTransfer.setData('text/media-desk-item', item.id)
                        e.dataTransfer.setData('text/plain', item.id)
                        e.dataTransfer.effectAllowed = 'move'
                      },
                      onClick: () => handleScheduleItem(item.id, selectedDate, item.platform),
                      style: { width: '100%', cursor: 'grab' },
                      children: [
                        jsx(
                          'div',
                          {
                            style: {
                              width: '100%',
                              height: '112px',
                              borderRadius: 'var(--radius-lg)',
                              overflow: 'hidden',
                              marginBottom: '6px',
                              backgroundColor: 'var(--color-background)',
                              border: '1px solid color-mix(in srgb, var(--color-border) 60%, transparent)',
                            },
                            children: thumb
                              ? jsx(MediaImage, {
                                  src: mediaSrc,
                                  alt: item.title || t('item.untitled'),
                                  draggable: false,
                                  style: {
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block',
                                    opacity: 0.85,
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
                          },
                          'tray-thumb'
                        ),
                        jsx('div', {
                          style: {
                            fontSize: '12px',
                            fontWeight: 500,
                            color: 'var(--ui-text-secondary)',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                          },
                          children: item.title || t('item.untitled'),
                        }),
                        jsxs('div', {
                          style: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' },
                          onClick: e => e.stopPropagation(),
                          children: [
                            jsx('input', {
                              type: 'date',
                              value: item.scheduledAt ? item.scheduledAt.slice(0, 10) : '',
                              title: t('schedule.changeDate'),
                              onChange: e =>
                                handleScheduleItem(item.id, e.target.value, item.platform),
                              style: dateInputStyle,
                            }),
                            jsx('span', {
                              style: { fontSize: '11px', color: 'var(--ui-text-quaternary)' },
                              children: t('schedule.setDate'),
                            }),
                          ],
                        }),
                      ],
                    },
                    item.id
                  )
                }),
              }),
              ideasGroup.length > 0
                ? jsx('div', {
                    style: {
                      fontSize: '11.5px',
                      color: 'var(--ui-text-quaternary)',
                      marginBottom: '8px',
                      fontVariantNumeric: 'tabular-nums',
                    },
                    children: `${t('schedule.groupIdeas')} ${ideasGroup.length}`,
                  })
                : null,
              jsx('div', {
                style: { display: 'flex', flexDirection: 'column', gap: '4px' },
                children: ideasGroup.map(item =>
                  jsxs(
                    'div',
                    {
                      key: item.id,
                      draggable: true,
                      onDragStart: e => {
                        e.dataTransfer.setData('text/media-desk-item', item.id)
                        e.dataTransfer.setData('text/plain', item.id)
                        e.dataTransfer.effectAllowed = 'move'
                      },
                      onClick: () => handleScheduleItem(item.id, selectedDate, item.platform),
                      style: {
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '6px',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'grab',
                      },
                      children: [
                        jsx('span', {
                          style: {
                            width: '20px',
                            height: '20px',
                            borderRadius: 'var(--radius-sm)',
                            background: THUMB_FALLBACK_GRADIENT,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: SERIF_FONT,
                            fontSize: '10px',
                            color: 'var(--color-foreground)',
                            flexShrink: 0,
                          },
                          children: (item.title || t('item.untitled')).trim().charAt(0) || '·',
                        }),
                        jsx('span', {
                          style: {
                            fontSize: '12px',
                            color: 'var(--ui-text-secondary)',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            minWidth: 0,
                          },
                          children: item.title || t('item.untitled'),
                        }),
                      ],
                    },
                    item.id
                  )
                ),
              }),
            ],
          }),
        ],
      }),
    ],
  })
}

// ---------------------------------------------------------------------------
