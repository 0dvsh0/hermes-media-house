/**
 * Main Application Shell and Plugin Registration
 */

import { ROUTES_AREA, SIDEBAR_NAV_AREA } from '@hermes/plugin-sdk'
import { jsx, jsxs } from 'react/jsx-runtime'
import React, {
  useState,
  useReducer,
  useEffect,
  useContext,
  createContext,
  useCallback,
  useRef,
  useMemo,
} from 'react'
import { ZH_BUNDLE, EN_BUNDLE, unflatten } from './i18n.js'
import { Icon, IconButton } from './ui.js'
import { HomePage } from './canvas.js'
import { ContentPage } from './content.js'
import { SchedulePage } from './schedule.js'
import { InsightsPage } from './insights.js'
import { StylePage } from './style.js'
import { StudioOverlay } from './studio.js'
import { ChatDock } from './chat.js'
import { SettingsPage } from './settings.js'
import { GHOST_BTN } from './constants.js'

// 3. State Reducer (Requirements 15.5-15.11, 20.2-20.4)
// ---------------------------------------------------------------------------

export const initialState = {
  serverState: null,
  activeView: 'home',
  openItemId: null,
  studioMode: false,
  filters: {
    search: '',
    kind: 'all',
    platform: 'all',
    status: 'all',
    contentViewMode: 'board',
  },
  error: null,
  loading: true,
}

export function applyAssetUpdate(state, { item_id, target, src }) {
  if (!state.serverState || !state.serverState.items) return state

  const items = state.serverState.items.map(item => {
    if (item.id !== item_id || !item.production) return item

    const prod = { ...item.production }
    if (target === 'cover' && prod.cover) {
      prod.cover = { ...prod.cover, src, status: 'done' }
    } else if (target && target.startsWith('figure_') && prod.images) {
      const idx = parseInt(target.split('_')[1], 10) - 1
      if (idx >= 0 && idx < prod.images.length) {
        const nextImages = [...prod.images]
        nextImages[idx] = { ...nextImages[idx], src, status: 'done' }
        prod.images = nextImages
      }
    } else if (target && target.startsWith('shot_') && prod.shots) {
      const idx = parseInt(target.split('_')[1], 10) - 1
      if (idx >= 0 && idx < prod.shots.length) {
        const nextShots = [...prod.shots]
        nextShots[idx] = { ...nextShots[idx], src, status: 'done' }
        prod.shots = nextShots
      }
    }

    return { ...item, production: prod }
  })

  return {
    ...state,
    serverState: { ...state.serverState, items },
  }
}

export function reducer(state, action) {
  switch (action.type) {
    case 'SET_STATE':
      return {
        ...state,
        serverState: action.payload,
        loading: false,
        error: null,
        openItemId:
          action.payload &&
          action.payload.items &&
          action.payload.items.some(i => i.id === state.openItemId)
            ? state.openItemId
            : null,
        studioMode: Boolean(
          state.openItemId &&
            action.payload &&
            action.payload.items &&
            action.payload.items.some(i => i.id === state.openItemId)
        ),
      }
    case 'SET_ASSET':
      return applyAssetUpdate(state, action.payload)
    case 'SET_VIEW':
      return { ...state, activeView: action.payload, openItemId: null, studioMode: false }
    case 'OPEN_ITEM':
      return { ...state, openItemId: action.payload, studioMode: true }
    case 'CLOSE_STUDIO':
    case 'CLOSE_ITEM':
      return { ...state, openItemId: null, studioMode: false }
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } }
    default:
      return state
  }
}

export const AppContext = createContext(null)

// ---------------------------------------------------------------------------


// 5. View Switcher — 5-tab pill + clear-sample / undo / assistant (Requirement 15.2)
//    Colors, radii and shadows come from the live Hermes theme tokens.
// ---------------------------------------------------------------------------

export function TabBar({
  activeView,
  onViewChange,
  showChat,
  onToggleChat,
  onClearSample,
  onUndo,
  canUndo,
  hasSampleData,
  t,
}) {
  const tabs = [
    { id: 'home', label: t('nav.home') || 'Ideas', icon: 'lightbulb' },
    { id: 'content', label: t('nav.content') || 'Content', icon: 'project' },
    { id: 'schedule', label: t('nav.schedule') || 'Schedule', icon: 'calendar' },
    { id: 'insights', label: t('nav.insights') || 'Insights', icon: 'graph' },
    { id: 'style', label: t('nav.styles') || 'Style', icon: 'paintcan' },
  ]

  return jsxs('header', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      padding: '10px 16px 6px',
      flexShrink: 0,
    },
    children: [
      // Segmented 5-tab pill with Codicons
      jsx(
        'nav',
        {
          'aria-label': t('nav.label') || 'Media Desk',
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
            padding: '4px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-card)',
            boxShadow: 'var(--shadow-sm)',
          },
          children: tabs.map(tab =>
            jsxs(
              'button',
              {
                key: tab.id,
                type: 'button',
                onClick: () => onViewChange(tab.id),
                style: {
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  backgroundColor: activeView === tab.id ? 'var(--theme-primary, var(--ui-accent, var(--ui-blue)))' : 'transparent',
                  color: activeView === tab.id ? 'var(--theme-primary-foreground, var(--color-primary-foreground, white))' : 'var(--ui-text-secondary)',
                  transition: 'all 0.15s ease',
                },
                children: [
                  jsx(Icon, { name: tab.icon, size: 13 }),
                  tab.label,
                ],
              },
              tab.id
            )
          ),
        },
        'tabs'
      ),

      // Right action controls: clear sample data, undo, assistant
      jsxs('div', {
        style: { display: 'flex', alignItems: 'center', gap: '8px' },
        children: [
          hasSampleData
            ? jsxs('button', {
                type: 'button',
                onClick: onClearSample,
                title: t('sample.clear') || 'Sample Data · Clear',
                'aria-label': t('sample.clear') || 'Sample Data · Clear',
                style: {
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-card)',
                  color: 'var(--ui-text-tertiary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                },
                children: [
                  jsx(Icon, { name: 'trash', size: 12 }),
                  t('sample.clear') || 'Sample Data · Clear',
                ],
              })
            : null,
          jsx(IconButton, {
            icon: 'discard',
            label: t('undo.label') || 'Undo last action',
            onClick: onUndo,
            disabled: !canUndo,
          }),
          jsxs('button', {
            type: 'button',
            onClick: onToggleChat,
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: showChat ? 'var(--theme-primary, var(--ui-accent, var(--ui-blue)))' : 'var(--color-card)',
              color: showChat ? 'var(--theme-primary-foreground, var(--color-primary-foreground, white))' : 'var(--color-foreground)',
              cursor: 'pointer',
              fontSize: '12.5px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            },
            children: [
              jsx(Icon, { name: 'comment-discussion', size: 14 }),
              t('topbar.assistant') || 'Assistant',
            ],
          }),
        ],
      }),
    ],
  })
}

// ---------------------------------------------------------------------------


// 11. App Shell (Task 25; Requirements 15.5-15.11, 20.2-20.5)
// ---------------------------------------------------------------------------

// Module-level bridge so plugin.onEvent handlers can reach the live AppRoot
// reducers without prop drilling (asset.ready / state.changed push events).
const stateBridge = { dispatch: null, refetch: null }

export function AppRoot({ ctx, rest, t, locale }) {
  setGlobalRest(rest)
  injectGlobalStyles()
  const [state, dispatch] = useReducer(reducer, initialState)
  const [showChat, setShowChat] = useState(false)
  const reqSeqRef = useRef(0)

  const fetchState = useCallback(() => {
    const currentSeq = ++reqSeqRef.current
    rest('/state')
      .then(serverState => {
        if (currentSeq === reqSeqRef.current && serverState) {
          dispatch({ type: 'SET_STATE', payload: serverState })
        }
      })
      .catch(err => {
        if (currentSeq === reqSeqRef.current) {
          dispatch({
            type: 'SET_ERROR',
            payload: err.message || t('error.backendUnreachable'),
          })
        }
      })
  }, [rest, t])

  // Expose the live dispatch/refetch to the plugin event bridge.
  useEffect(() => {
    stateBridge.dispatch = dispatch
    stateBridge.refetch = fetchState
    return () => {
      stateBridge.dispatch = null
      stateBridge.refetch = null
    }
  }, [dispatch, fetchState])

  // 1. Storage restoration + initial state fetch (Requirements 15.5, 15.9-15.11).
  useEffect(() => {
    const savedView = ctx && ctx.storage ? ctx.storage.get('activeView') : null
    const validViews = ['home', 'content', 'schedule', 'insights', 'style']
    if (savedView && validViews.includes(savedView)) {
      dispatch({ type: 'SET_VIEW', payload: savedView })
    }

    const savedItemId = ctx && ctx.storage ? ctx.storage.get('openItemId') : null
    if (savedItemId) {
      dispatch({ type: 'OPEN_ITEM', payload: savedItemId })
    }

    const savedFilters = ctx && ctx.storage ? ctx.storage.get('filters') : null
    if (savedFilters && typeof savedFilters === 'object') {
      dispatch({ type: 'SET_FILTERS', payload: savedFilters })
    }

    fetchState()
  }, [ctx, fetchState])

  // 2. Persist active view, openItemId, filters.
  useEffect(() => {
    if (ctx && ctx.storage) {
      ctx.storage.set('activeView', state.activeView)
      ctx.storage.set('openItemId', state.openItemId)
      ctx.storage.set('filters', state.filters)
    }
  }, [ctx, state.activeView, state.openItemId, state.filters])

  const handleRetry = () => {
    dispatch({ type: 'SET_LOADING', payload: true })
    fetchState()
  }

  // Clear sample data via the ops pipeline (NOT /chat/clear).
  const handleClearSample = () => {
    rest('/ops', {
      method: 'POST',
      body: JSON.stringify({ ops: [{ op: 'clear_samples' }] }),
    })
      .then(res => {
        if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
      })
      .catch(() => {})
  }

  const handleUndo = () => {
    rest('/undo', { method: 'POST' })
      .then(res => {
        if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
      })
      .catch(() => {})
  }

  const serverState = state.serverState
  const hasSampleData = useMemo(() => {
    if (!serverState) return false
    const collections = ['items', 'people', 'angles', 'metrics', 'accounts', 'skills', 'styles']
    return collections.some(key => {
      const arr = serverState[key]
      return Array.isArray(arr) && arr.some(x => x && x.sample === true)
    })
  }, [serverState])

  const chatLog = (serverState && serverState.chat) || []
  const canUndo = useMemo(() => chatLog.some(m => m && m.undoable), [chatLog])

  // 3. Error screen.
  if (state.error) {
    return jsx('div', {
      style: {
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        boxSizing: 'border-box',
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-foreground)',
        gap: '12px',
      },
      children: [
        jsx('div', {
          style: {
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--ui-red)',
            textAlign: 'center',
            maxWidth: '420px',
            lineHeight: 1.5,
          },
          children: state.error.includes('backend')
            ? t('error.backendOff')
            : t('error.backendUnreachable'),
        }),
        jsx('button', {
          type: 'button',
          onClick: handleRetry,
          style: GHOST_BTN,
          children: t('error.retry'),
        }),
      ],
    })
  }

  // 4. Loading screen.
  if (state.loading && !serverState) {
    return jsx('div', {
      style: {
        padding: '40px',
        textAlign: 'center',
        color: 'var(--ui-text-quaternary)',
        backgroundColor: 'var(--color-background)',
        fontSize: '13px',
      },
      children: t('loading'),
    })
  }

  // 5. Active view.
  let viewContent = null
  if (state.activeView === 'home') {
    viewContent = jsx(HomePage, {})
  } else if (state.activeView === 'content') {
    viewContent = jsx(ContentPage, {})
  } else if (state.activeView === 'schedule') {
    viewContent = jsx(SchedulePage, {})
  } else if (state.activeView === 'insights') {
    viewContent = jsx(InsightsPage, {})
  } else if (state.activeView === 'style') {
    viewContent = jsx(StylePage, {})
  }

  // 6. Workbench shell: TabBar + view + assistant rail + Studio overlay.
  return jsx(AppContext.Provider, {
    value: { state, dispatch, rest, t, localeTag: locale, ctx },
    children: jsxs('div', {
      className: 'md-root',
      style: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: 'var(--ui-bg-chrome, var(--color-background))',
        color: 'var(--color-foreground, var(--ui-text-primary, currentColor))',
        overflow: 'hidden',
        isolation: 'isolate',
      },
      children: [
        jsx(TabBar, {
          activeView: state.activeView,
          onViewChange: view => {
            dispatch({ type: 'CLOSE_STUDIO' })
            dispatch({ type: 'SET_VIEW', payload: view })
          },
          showChat,
          onToggleChat: () => setShowChat(v => !v),
          onClearSample: handleClearSample,
          onUndo: handleUndo,
          canUndo,
          hasSampleData,
          t,
        }),
        jsxs('div', {
          style: { flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 },
          children: [
            jsx('main', {
              style: {
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              },
              children: viewContent,
            }),
            showChat
              ? jsx('aside', {
                  style: {
                    width: '360px',
                    flexShrink: 0,
                    height: '100%',
                    padding: '4px 12px 12px 0',
                    boxSizing: 'border-box',
                  },
                  children: jsx(ChatDock, { onClose: () => setShowChat(false) }),
                })
              : null,
          ],
        }),
        state.openItemId && state.activeView === 'home'
          ? jsx(StudioOverlay, {
              itemId: state.openItemId,
              onClose: () => dispatch({ type: 'CLOSE_STUDIO' }),
            })
          : null,
      ],
    }),
  })
}

// ---------------------------------------------------------------------------
// 12. Plugin Registration (Requirement 1.3, 15.1, 15.3, 20.2-20.5)
// ---------------------------------------------------------------------------

const PLUGIN_STYLE_ID = 'hermes-media-desk-styles'
function injectGlobalStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(PLUGIN_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = PLUGIN_STYLE_ID
  style.textContent = `
    :root[data-hermes-glass] [data-contrib-shell],
    :root[data-hermes-glass] [data-slot='sidebar-wrapper'] {
      background-color: var(--color-background) !important;
    }
    .md-root {
      position: relative;
      isolation: isolate;
      background-color: var(--color-background) !important;
      background: var(--color-background) !important;
      color: var(--color-foreground);
      opacity: 1 !important;
    }
    .md-board-page {
      background-color: var(--color-background) !important;
      background: var(--color-background) !important;
      opacity: 1 !important;
    }
    .md-root, .md-root * {
      color-scheme: dark;
    }
    .md-root select, select {
      background-color: var(--color-card) !important;
      color: var(--color-foreground) !important;
      color-scheme: dark !important;
    }
    .md-root option, .md-root optgroup, option, optgroup {
      background-color: var(--color-card) !important;
      color: var(--color-foreground) !important;
      color-scheme: dark !important;
    }
    select:focus {
      outline: none !important;
      border-color: var(--theme-primary, var(--ui-accent, var(--ui-blue))) !important;
    }
    .md-node {
      position: absolute;
      z-index: 1;
      transform: translate(-50%, -50%) translate(calc(var(--px, 0px) * var(--d, 0)), calc(var(--py, 0px) * var(--d, 0)));
      transition: opacity .45s cubic-bezier(0.2, 0.8, 0.2, 1), filter .45s cubic-bezier(0.2, 0.8, 0.2, 1), left .6s cubic-bezier(0.2, 0.8, 0.2, 1), top .6s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .md-node:hover, .md-node:focus-within { z-index: 6; }
    .md-node.is-selected { z-index: 8; }
    .md-node.is-dragging { z-index: 20; transition: none; }
    .md-node.is-dim { opacity: .16; filter: saturate(.3); }
    .md-node.is-dim:hover { opacity: .85; filter: none; }
    .md-pop { will-change: transform; }

    .md-node .md-card {
      transform: rotate(var(--r, 0deg));
      transition: transform .5s cubic-bezier(.2, 1.3, .4, 1), box-shadow .3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .md-node:hover .md-card {
      transform: rotate(0deg) translateY(-4px) scale(1.025);
    }
    .md-node.is-dragging .md-card {
      transform: rotate(calc(var(--r, 0deg) * .4)) scale(1.05);
      box-shadow: 0 0 0 .5px var(--color-border), var(--shadow-lg);
      cursor: grabbing;
    }
    .md-node.is-selected .md-card {
      transform: none;
      box-shadow: 0 0 0 1.5px var(--color-foreground), var(--shadow-md);
    }
  `
  document.head.appendChild(style)
}

const plugin = {
  id: 'hermes-media-desk',
  name: 'Media Desk',
  defaultEnabled: true,

  register(ctx) {
    injectGlobalStyles()
    if (ctx && ctx.i18n && ctx.i18n.register) {
      try {
        ctx.i18n.register({ zh: unflatten(ZH_BUNDLE), en: unflatten(EN_BUNDLE) })
      } catch (err) {}
    }
    const t = (key, ...args) => {
      const direct = EN_BUNDLE[key]
      if (direct !== undefined) {
        const vars = args[0]
        if (vars && typeof vars === 'object') {
          return String(direct).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m))
        }
        return direct
      }
      try {
        if (ctx && ctx.i18n && ctx.i18n.t) {
          const res = ctx.i18n.t(key, ...args)
          if (res && res !== key) return res
        }
      } catch (err) {}
      return key
    }
    const locale = () => {
      try {
        return ctx.i18n.locale || 'en'
      } catch (err) {
        return 'en'
      }
    }

    // REST helper tagging plugin-side requests with the active locale.
    const rest = (path, opts = {}) => {
      let body = opts && opts.body
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body)
        } catch (_) {}
      }
      return ctx.rest(path, {
        ...opts,
        body,
        headers: {
          'x-media-desk-lang': locale(),
          'sec-fetch-site': 'same-origin',
          ...((opts && opts.headers) || {}),
        },
      })
    }
    setGlobalRest(rest)

    // Primary route page.
    ctx.register({
      id: 'page',
      area: ROUTES_AREA,
      data: { path: '/media-desk' },
      render: () => jsx(AppRoot, { ctx, rest, t, locale: locale() }),
    })

    // Sidebar navigation entry.
    ctx.register({
      id: 'nav',
      area: SIDEBAR_NAV_AREA,
      data: { path: '/media-desk', label: t('nav.label'), codicon: 'edit' },
    })

    // Settings page.
    if (ctx.registerSettingsPage) {
      ctx.registerSettingsPage({
        id: 'settings',
        title: t('settings.title'),
        icon: 'settings-gear',
        render: () => jsx(SettingsPage, { rest, t }),
      })
    }

    // Push events: full-state refetch and per-asset updates (Requirements 20.2-20.4).
    if (ctx.onEvent) {
      ctx.onEvent('plugin.hermes-media-desk.state.changed', () => {
        if (stateBridge.refetch) stateBridge.refetch()
      })
      ctx.onEvent('plugin.hermes-media-desk.asset.ready', payload => {
        if (stateBridge.dispatch) {
          stateBridge.dispatch({ type: 'SET_ASSET', payload })
        }
      })
    }

    // Disposer: drop bridge references so stale dispatches are impossible.
    return () => {
      stateBridge.dispatch = null
      stateBridge.refetch = null
    }
  },
}

export default plugin
