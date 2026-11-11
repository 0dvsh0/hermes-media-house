/**
 * Assistant Chat Dock Component
 * Fully aligned with dsh-media-desk UI/UX and Hermes theme design tokens.
 * Provides real LLM responses, receipts, model status indicator, and reversible ops.
 */

import { jsx, jsxs } from 'react/jsx-runtime'
import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useMemo,
  useLayoutEffect,
} from 'react'
import { AppContext } from './app.js'
import { Icon, IconButton } from './ui.js'

const GENERAL_SUGGESTIONS = [
  'Note: "Slow down, it still counts as arriving" can be the opening',
  'What is on the upcoming schedule?',
  'Keep future titles under 20 words',
  "Turn today's best inspiration into a draft",
]

const STUDIO_SUGGESTIONS = [
  'Make title shorter',
  'Make tone lighter',
  'Write a stronger opening hook',
  'Create bolder cover text',
]

function Receipt({ receipt, onOpenItem }) {
  const clickable = receipt.kind === 'item' && receipt.target
  const Tag = clickable ? 'button' : 'div'
  return jsx(Tag, {
    type: clickable ? 'button' : undefined,
    className: 'md-receipt',
    onClick: clickable && onOpenItem ? () => onOpenItem(receipt.target) : undefined,
    children: [
      jsx('span', {
        className: 'md-receipt-check',
        children: jsx(Icon, { name: 'check', size: 10, stroke: 2.2 }),
      }),
      jsx('span', {}, receipt.text),
    ],
  })
}

function Message({ message, canUndoThis, onUndo, onOpenItem }) {
  const isUser = message.role === 'user'
  if (isUser) {
    return jsx('div', {
      className: 'md-msg is-user',
      children: message.text || message.content,
    })
  }

  const receipts = Array.isArray(message.receipts) ? message.receipts : []
  const errors = Array.isArray(message.errors) ? message.errors : []

  return jsxs('div', {
    className: 'md-msg is-bot',
    children: [
      jsx('p', {}, message.text || message.content),
      receipts.map((r, idx) => jsx(Receipt, { key: `rcpt-${idx}`, receipt: r, onOpenItem })),
      errors.map((err, idx) => jsx('p', { key: `err-${idx}`, className: 'md-msg-error' }, err)),
      message.notice ? jsx('p', { className: 'md-msg-note' }, message.notice) : null,
      jsxs('footer', {
        children: [
          jsx('span', {}, message.engine === 'local' ? 'Local Rules' : ''),
          canUndoThis
            ? jsxs('button', {
                type: 'button',
                onClick: onUndo,
                children: [
                  jsx(Icon, { name: 'undo', size: 11 }),
                  jsx('span', {}, 'Undo'),
                ],
              })
            : null,
        ],
      }),
    ],
  })
}

function ModelAlert({ model, error }) {
  if (!error) return null
  return jsxs('div', {
    className: 'md-model-alert',
    role: 'status',
    children: [
      jsx('strong', {}, `Model ${model || 'LLM'} call failed`),
      jsx('p', {}, error.length > 280 ? `${error.slice(0, 280)}...` : error),
    ],
  })
}

export function ChatDock({ itemId, onClose, initialInput, onClearSeed }) {
  const { state, dispatch, rest, t } = useContext(AppContext)
  const [inputMsg, setInputMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [chatError, setChatError] = useState('')
  const [model, setModel] = useState('stepfun/step-3.7-flash:free')
  const [modelOk, setModelOk] = useState(true)
  const [modelError, setModelError] = useState(null)
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)

  const focusId = itemId || state.openItemId
  const allChat = (state.serverState && state.serverState.chat) || []

  // Scoped to focusId and limited to last 30 messages
  const scopedChat = useMemo(() => {
    const list = focusId ? allChat.filter(m => m.itemId === focusId) : allChat
    return list.slice(-30)
  }, [allChat, focusId])

  // Fetch initial model metadata on mount
  useEffect(() => {
    rest('/models')
      .then(res => {
        if (res && res.default) {
          setModel(res.default)
        }
      })
      .catch(() => {})
  }, [rest])

  // Adopt selection seeds handed down from the Studio tiles
  useEffect(() => {
    if (initialInput) {
      setInputMsg(initialInput)
      if (onClearSeed) onClearSeed()
    }
  }, [initialInput, onClearSeed])

  // Scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [scopedChat.length, loading])

  // Auto-resize composer textarea
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [inputMsg])

  const handleSend = raw => {
    const msg = (typeof raw === 'string' ? raw : inputMsg).trim()
    if (!msg || loading) return
    setLoading(true)
    setChatError('')
    setInputMsg('')

    rest('/chat', {
      method: 'POST',
      body: JSON.stringify({ message: msg, focusId }),
    })
      .then(res => {
        setLoading(false)
        if (res && res.state) {
          dispatch({ type: 'SET_STATE', payload: res.state })
        }
        if (res && res.model) {
          setModel(res.model)
        }
        if (res && typeof res.modelOk === 'boolean') {
          setModelOk(res.modelOk)
        }
        if (res && res.modelError) {
          setModelError(res.modelError)
        } else if (res && res.modelOk) {
          setModelError(null)
        }
      })
      .catch(err => {
        setLoading(false)
        const errMsg = err.message || String(err)
        setChatError(errMsg)
        setModelOk(false)
        setModelError(errMsg)
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

  const handleOpenItem = targetId => {
    if (targetId) {
      dispatch({ type: 'OPEN_STUDIO', payload: targetId })
    }
  }

  const lastBot = [...scopedChat].reverse().find(m => m.role === 'assistant')
  const suggestions = focusId ? STUDIO_SUGGESTIONS : GENERAL_SUGGESTIONS

  return jsxs('div', {
    className: 'md-chat',
    children: [
      // Dock Header
      jsxs('header', {
        className: 'md-dock-head',
        children: [
          jsx('h2', {}, t('chat.title') || 'Assistant'),
          jsx(
            'span',
            {
              className: `md-engine ${modelOk === false ? 'is-down' : 'is-live'}`,
              title:
                modelOk === false
                  ? `Model call failed: ${modelError || 'Error'}`
                  : `Active Hermes Model: ${model}`,
            },
            [
              jsx('i', { key: 'engine-dot' }),
              jsx('span', { key: 'engine-name' }, modelOk === false ? 'Model Error' : model),
            ]
          ),
          jsx('span', { style: { flex: 1 } }),
          scopedChat.length > 0
            ? jsx(IconButton, {
                icon: 'trash',
                label: t('chat.clear') || 'Clear Chat',
                onClick: handleClear,
              })
            : null,
          onClose
            ? jsx(IconButton, {
                icon: 'close',
                label: t('common.close') || 'Close',
                onClick: onClose,
              })
            : null,
        ],
      }),

      // Scrollable Message History
      jsxs('div', {
        ref: scrollRef,
        className: 'md-dock-scroll',
        'aria-live': 'polite',
        children: [
          modelOk === false && modelError
            ? jsx(ModelAlert, { model, error: modelError })
            : null,
          chatError
            ? jsx('div', { className: 'md-msg-error' }, chatError)
            : null,
          scopedChat.length === 0
            ? jsxs('div', {
                className: 'md-dock-intro',
                children: [
                  jsxs('h3', {
                    children: [
                      'Say one thing,',
                      jsx('br', {}),
                      "I'll fill in the rest.",
                    ],
                  }),
                  jsx(
                    'p',
                    {},
                    'Topics, ideas, content, schedule, style, and writing rules can all be instructed directly. Every step can be undone.'
                  ),
                ],
              })
            : scopedChat.map((msg, idx) =>
                jsx(
                  Message,
                  {
                    message: msg,
                    canUndoThis: msg === lastBot && Boolean(msg.undoable),
                    onUndo: handleUndo,
                    onOpenItem: handleOpenItem,
                  },
                  msg.id || `msg-${idx}`
                )
              ),
          loading
            ? jsx('div', {
                className: 'md-msg is-bot',
                children: jsx('span', { className: 'md-shimmer' }, 'Thinking and writing with Hermes...'),
              })
            : null,
        ],
      }),

      // Suggestion Chips
      jsx('div', {
        className: 'md-suggest',
        children: suggestions.slice(0, scopedChat.length ? 2 : 4).map(text =>
          jsx(
            'button',
            {
              key: text,
              type: 'button',
              onClick: () => handleSend(text),
              disabled: loading,
            },
            text
          )
        ),
      }),

      // Composer Area
      jsxs('form', {
        className: 'md-composer',
        onSubmit: e => {
          e.preventDefault()
          handleSend()
        },
        children: [
          jsx('textarea', {
            ref: textareaRef,
            rows: 1,
            'aria-label': 'Message the Assistant',
            placeholder: focusId
              ? 'Refine title, tone, hook, or content...'
              : 'Instruct anything, or ask to revise...',
            value: inputMsg,
            disabled: loading,
            onChange: e => setInputMsg(e.target.value),
            onKeyDown: e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            },
          }),
          jsx('button', {
            type: 'submit',
            className: 'md-send',
            'aria-label': 'Send',
            disabled: !inputMsg.trim() || loading,
            children: jsx(Icon, {
              name: loading ? 'refresh' : 'send',
              size: 13,
              spinning: loading,
            }),
          }),
        ],
      }),
    ],
  })
}
