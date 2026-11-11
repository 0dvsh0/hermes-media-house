/**
 * Assistant Chat Dock Component
 * Contextual chat panel with receipts, undo, and model status
 */

import { jsx, jsxs } from 'react/jsx-runtime'
import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useMemo,
} from 'react'
import { AppContext } from './app.js'
import { GHOST_BTN, ICON_BTN } from './constants.js'
import { Icon, IconButton } from './ui.js'

// 10. Chat Dock (Task 24, Requirements 10.1-10.12)
// ---------------------------------------------------------------------------

const QUICK_ACTIONS = ['studio.shorterTitle', 'studio.lighterTone', 'studio.strongerOpening', 'studio.bolderCover']

export function ChatDock({ itemId, onClose, initialInput, onClearSeed }) {
  const { state, dispatch, rest, t } = useContext(AppContext)
  const [inputMsg, setInputMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [chatError, setChatError] = useState('')
  const [outageNotice, setOutageNotice] = useState('')
  const scrollRef = useRef(null)

  const focusId = itemId || state.openItemId
  const allChat = (state.serverState && state.serverState.chat) || []

  // Scoped to focusId and limited to last 8 messages (Requirements 10.12, 24).
  const scopedChat = useMemo(() => {
    const list = focusId ? allChat.filter(m => m.itemId === focusId) : allChat
    return list.slice(-8)
  }, [allChat, focusId])

  // Adopt selection seeds handed down from the Studio tiles.
  useEffect(() => {
    if (initialInput) {
      setInputMsg(initialInput)
      if (onClearSeed) onClearSeed()
    }
  }, [initialInput, onClearSeed])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [scopedChat.length])

  const handleSend = raw => {
    const msg = (typeof raw === 'string' ? raw : inputMsg).trim()
    if (!msg || loading) return
    setLoading(true)
    setChatError('')
    setOutageNotice('')
    setInputMsg('')
    rest('/chat', {
      method: 'POST',
      body: JSON.stringify({ message: msg, focusId }),
    })
      .then(res => {
        setLoading(false)
        if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
        if (res && res.modelOk === false && res.modelError) {
          setOutageNotice(res.modelError)
        }
      })
      .catch(err => {
        setLoading(false)
        setChatError(err.message || String(err))
      })
  }

  const handleUndo = () => {
    rest('/undo', { method: 'POST' })
      .then(res => {
        if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
      })
      .catch(err => {
        setChatError(err.message || String(err))
      })
  }

  const handleClear = () => {
    rest('/chat/clear', { method: 'POST' })
      .then(res => {
        if (res) dispatch({ type: 'SET_STATE', payload: res })
      })
      .catch(err => {
        setChatError(err.message || String(err))
      })
  }

  const dockBtn = {
    padding: '3px 8px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-card)',
    color: 'var(--ui-text-tertiary)',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  }

  return jsxs('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      backgroundColor: 'var(--color-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-xl)',
      color: 'var(--color-foreground)',
      overflow: 'hidden',
    },
    children: [
      jsxs('div', {
        style: {
          padding: '10px 12px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        },
        children: [
          jsx('span', {
            style: { fontWeight: 600, fontSize: '12.5px' },
            children: t('chat.title'),
          }),
          jsxs('button', {
            type: 'button',
            onClick: handleClear,
            style: { ...dockBtn, display: 'inline-flex', alignItems: 'center', gap: '4px' },
            children: [
              jsx(Icon, { name: 'trash', size: 12 }),
              jsx('span', {}, t('chat.clear')),
            ],
          }),
        ],
      }),
      onClose
        ? jsx('div', {
            style: { display: 'flex', justifyContent: 'flex-end', padding: '4px 8px 0' },
            children: jsx('button', {
              type: 'button',
              onClick: onClose,
              'aria-label': t('common.cancel'),
              style: {
                border: 'none',
                background: 'none',
                color: 'var(--ui-text-quaternary)',
                cursor: 'pointer',
                padding: '2px',
                display: 'inline-flex',
                alignItems: 'center',
              },
              children: jsx(Icon, { name: 'close', size: 13 }),
            }),
          })
        : null,
      outageNotice
        ? jsx('div', {
            style: {
              margin: '8px 12px 0',
              padding: '6px 10px',
              borderRadius: 'var(--radius-md)',
              backgroundColor:
                'color-mix(in srgb, var(--ui-orange) 10%, var(--color-background))',
              color: 'var(--ui-text-secondary)',
              fontSize: '11.5px',
            },
            children: `${t('chat.outage')}: ${outageNotice}`,
          })
        : null,
      chatError
        ? jsx('div', {
            style: {
              margin: '8px 12px 0',
              padding: '6px 10px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'color-mix(in srgb, var(--ui-red) 10%, var(--color-background))',
              color: 'var(--ui-red)',
              fontSize: '11.5px',
            },
            children: chatError,
          })
        : null,
      jsx('div', {
        ref: scrollRef,
        style: {
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          minHeight: 0,
        },
        children:
          scopedChat.length === 0
            ? jsx('div', {
                style: {
                  textAlign: 'center',
                  color: 'var(--ui-text-quaternary)',
                  fontSize: '12px',
                  marginTop: '24px',
                },
                children: t('chat.empty'),
              })
            : scopedChat.map((m, idx) => {
                const isUser = m.role === 'user'
                return jsxs(
                  'div',
                  {
                    style: {
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isUser ? 'flex-end' : 'flex-start',
                      gap: '2px',
                      maxWidth: '100%',
                    },
                    children: [
                      jsx('div', {
                        style: {
                          maxWidth: '88%',
                          padding: '7px 11px',
                          borderRadius: 'var(--radius-lg)',
                          backgroundColor: isUser
                            ? 'var(--color-foreground)'
                            : 'color-mix(in srgb, var(--color-foreground) 5%, var(--color-background))',
                          border: isUser
                            ? 'none'
                            : '1px solid color-mix(in srgb, var(--color-border) 60%, transparent)',
                          color: isUser ? 'var(--color-background)' : 'var(--color-foreground)',
                          fontSize: '12.5px',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        },
                        children: m.content,
                      }),
                      !isUser && m.undoable
                        ? jsxs('button', {
                            type: 'button',
                            onClick: handleUndo,
                            style: { ...dockBtn, marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '4px' },
                            children: [
                              jsx(Icon, { name: 'undo', size: 11 }),
                              jsx('span', {}, t('chat.undo')),
                            ],
                          })
                        : null,
                    ],
                  },
                  `chat-msg-${idx}`
                )
              }),
      }),
      // Quick edit suggestions (studio context only).
      focusId
        ? jsx('div', {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '2px',
              padding: '0 12px',
              flexShrink: 0,
            },
            children: QUICK_ACTIONS.map(key =>
              jsx(
                'button',
                {
                  key,
                  type: 'button',
                  onClick: () => handleSend(t(key)),
                  style: {
                    border: 'none',
                    background: 'none',
                    color: 'var(--ui-text-quaternary)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '2px 0',
                    textAlign: 'left',
                  },
                  children: t(key),
                },
                key
              )
            ),
          })
        : null,
      jsxs('div', {
        style: {
          padding: '10px 12px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          flexShrink: 0,
        },
        children: [
          jsx('input', {
            type: 'text',
            placeholder: t('chat.placeholder'),
            value: inputMsg,
            onChange: e => setInputMsg(e.target.value),
            onKeyDown: e => {
              if (e.key === 'Enter') handleSend()
            },
            style: {
              flex: 1,
              minWidth: 0,
              padding: '7px 11px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'color-mix(in srgb, var(--color-foreground) 4%, var(--color-background))',
              color: 'var(--color-foreground)',
              fontSize: '12.5px',
              outline: 'none',
            },
          }),
          jsx('button', {
            type: 'button',
            onClick: () => handleSend(),
            disabled: loading || !inputMsg.trim(),
            style: {
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor:
                loading || !inputMsg.trim() ? 'var(--color-border)' : 'var(--color-foreground)',
              color: 'var(--color-background)',
              cursor: loading || !inputMsg.trim() ? 'default' : 'pointer',
              fontWeight: 700,
              fontSize: '13px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            },
            children: jsx(Icon, { name: loading ? 'refresh' : 'send', size: 13, spinning: loading }),
          }),
        ],
      }),
    ],
  })
}

// ---------------------------------------------------------------------------
