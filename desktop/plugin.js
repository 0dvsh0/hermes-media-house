/**
 * hermes-media-desk — Desktop Plugin Entry Point, State Management, and Views
 *
 * Built from modular client/ source:
 * - Spatial canvas with spring camera, inertia panning, and draggable cards
 * - Bento Studio overlay (hero, cover collage, script editor, 6-frame storyboard)
 * - Assistant ChatDock, Content Kanban/Table, Schedule calendar, Insights analytics, Styles
 *
 * Strict Hermes theme tokens compliance. 100% English only.
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
  useLayoutEffect,
} from 'react'


// ---------------------------------------------------------------------------
// Module: client/constants.js
// ---------------------------------------------------------------------------
/**
 * Client Constants and Design Token Styles
 * Strict Hermes Theme tokens compliance. No hex/rgb/hsl literals.
 */

export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MiB limit

export const ACCEPTED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
]

export const SERIF_FONT = "'Lora', Georgia, serif"

export const STATUSES = ['idea', 'outline', 'draft', 'ready', 'published']

export const KIND_FILTERS = ['all', 'image', 'video', 'web', 'quote', 'note']

export const STYLE_CATEGORIES = [
  'Tech & Digital',
  'Knowledge & Growth',
  'Lifestyle & Story',
  'Business & Finance',
  'Creativity & Arts',
]

export const KIND_DOT_COLORS = {
  image: 'var(--ui-yellow)',
  video: 'var(--ui-blue)',
  web: 'var(--ui-cyan)',
  quote: 'var(--ui-purple)',
  note: 'var(--ui-text-quaternary)',
}

export const STATUS_DOT_COLORS = {
  idea: 'var(--ui-text-quaternary)',
  outline: 'var(--ui-yellow)',
  draft: 'var(--ui-blue)',
  ready: 'var(--ui-purple)',
  published: 'var(--ui-green)',
}

export const CARD_STYLE = {
  backgroundColor: 'var(--color-card)',
  border: '1px solid var(--color-border)',
  borderRadius: '4px',
}

export const HERO_GRADIENT = {
  background:
    'linear-gradient(125deg, var(--color-card) 0%, color-mix(in srgb, var(--ui-purple) 7%, var(--color-card)) 55%, color-mix(in srgb, var(--ui-orange) 6%, var(--color-card)) 100%)',
}

export const DOT_GRID = {
  backgroundColor: 'var(--color-background)',
  backgroundImage:
    'radial-gradient(circle, color-mix(in srgb, var(--ui-stroke-tertiary) 85%, transparent) 1.25px, transparent 1.25px)',
  backgroundSize: '24px 24px',
}

export const INPUT_STYLE = {
  padding: '6px 10px',
  borderRadius: '2.5px',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-background)',
  color: 'var(--color-foreground)',
  fontSize: '12.5px',
  outline: 'none',
  minWidth: 0,
}

export const GHOST_BTN = {
  padding: '5px 12px',
  borderRadius: '2.5px',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-card)',
  color: 'var(--color-foreground)',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 500,
}

export const PRIMARY_PILL = {
  padding: '6px 14px',
  borderRadius: '2.5px',
  border: 'none',
  backgroundColor: 'var(--color-primary)',
  color: 'var(--color-primary-foreground)',
  cursor: 'pointer',
  fontSize: '12.5px',
  fontWeight: 500,
  transition: 'opacity 100ms ease',
}

export const SECONDARY_PILL = {
  padding: '5px 12px',
  borderRadius: '2.5px',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-card)',
  color: 'var(--color-foreground)',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 500,
}

export const ICON_BTN = {
  width: '28px',
  height: '28px',
  borderRadius: '2.5px',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-card)',
  color: 'var(--color-foreground)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  flexShrink: 0,
}

export const SELECT_STYLE = {
  boxSizing: 'border-box',
  padding: '6px 28px 6px 10px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-card)',
  color: 'var(--color-foreground)',
  colorScheme: 'dark',
  fontSize: '12.5px',
  fontFamily: 'inherit',
  fontWeight: 500,
  outline: 'none',
  cursor: 'pointer',
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  backgroundImage:
    "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  backgroundSize: '13px 13px',
}

export const SELECT_OPTION_STYLE = {
  backgroundColor: 'var(--color-card)',
  color: 'var(--color-foreground)',
  colorScheme: 'dark',
}


// ---------------------------------------------------------------------------
// Module: client/ui.js
// ---------------------------------------------------------------------------
/**
 * UI Primitives: Vector SVG Icons, Hermes Codicon Fallback, IconButton, and StatusDot
 * Strict Hermes theme tokens compliance. 100% English only.
 */



export const PATHS = {
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  send: 'M12 19V5M6 11l6-6 6 6',
  check: 'M5 12.5l4.5 4.5L19 7',
  chevL: 'M14.5 5.5L8 12l6.5 6.5',
  chevR: 'M9.5 5.5L16 12l-6.5 6.5',
  chevD: 'M6 9.5l6 6 6-6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  chat: 'M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 4v-4h0A2.5 2.5 0 0 1 5 13.5z',
  scatter: 'M4 5h6v7H4zM13 4h7v5h-7zM6 15h5v5H6zM14 12h6v8h-6z',
  wall: 'M4 4h7v10H4zM13 4h7v6h-7zM4 16h7v4H4zM13 12h7v8h-7z',
  list: 'M4 6h16M4 12h16M4 18h16',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20c.8-3.4 3.6-5.5 7-5.5s6.2 2.1 7 5.5',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  pen: 'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3',
  film: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4',
  branch: 'M6 4v8a4 4 0 0 0 4 4h6M6 4a2 2 0 1 0 0 .01M18 16a2 2 0 1 0 0 .01M6 12a4 4 0 0 1 4-4h6M18 8a2 2 0 1 0 0 .01',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13',
  pin: 'M9 4h6l-1 6 3 3v2H7v-2l3-3zM12 15v5',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  upload: 'M12 16V5M7 10l5-5 5 5M5 19h14',
  calendar: 'M5 6h14v14H5zM5 10h14M9 3.5v4M15 3.5v4',
  zoomIn: 'M12 6v12M6 12h12',
  zoomOut: 'M6 12h12',
  target: 'M12 4v3M12 17v3M4 12h3M17 12h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  play: 'M8 5.5v13l11-6.5z',
  undo: 'M8 6L4 10l4 4M4 10h10a5 5 0 0 1 0 10h-3',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  refresh: 'M19 8a8 8 0 0 0-14-1L4 9M5 16a8 8 0 0 0 14 1l1-2M4 4v5h5M20 20v-5h-5',
  edit: 'M4 20l1-4L16 5l3 3L8 19z',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  upRight: 'M7 17L17 7M8 7h9v9',
  image: 'M4 5h16v14H4zM4 16l5-4.5 4 3.5 3-2.5 4 3.5M15.5 9.5a1 1 0 1 0 0 .01',
  clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2',
  expand: 'M14 5h5v5M10 19H5v-5M19 5l-6 6M5 19l6-6',
  save: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  folder: 'M4 7h6l2 2h10v10H4z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  gear: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  arrowLeft: 'M19 12H5M12 19l-7-7 7-7',
  arrowRight: 'M5 12h14M12 5l7 7-7 7',
  arrowDown: 'M12 5v14M19 12l-7 7-7-7',
  project: 'M3 3h8v18H3zM13 3h8v10h-8zM13 17h8v4h-8z',
  table: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
  wand: 'M15 4l5 5-11 11H4v-5L15 4zM18 2l4 4',
  export: 'M12 3v12M7 8l5-5 5 5M5 19h14',
  lightbulb: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z',
  graph: 'M3 3v18h18M7 16l4-5 4 3 5-7',
  paintcan: 'M19 11l-8-8-8 8 8 8 8-8zM12 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  video: 'M15 10l5-3v10l-5-3v4H4V6h11v4z',
  quote: 'M3 21c3 0 7-1 7-8V5H4v8h4c0 4-2 6-5 6zm11 0c3 0 7-1 7-8V5h-6v8h4c0 4-2 6-5 6z',
  note: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 0a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10zm-9 10h18',
}

const ALIASES = {
  'zoom-in': 'zoomIn',
  'zoom-out': 'zoomOut',
  'target': 'target',
  'chev-left': 'chevL',
  'chevron-left': 'chevL',
  'arrow-left': 'arrowLeft',
  'chev-right': 'chevR',
  'chevron-right': 'chevR',
  'arrow-right': 'arrowRight',
  'arrow-down': 'arrowDown',
  'sparkle': 'spark',
  'discard': 'undo',
  'clear-all': 'trash',
  'trashcan': 'trash',
  'settings-gear': 'gear',
  'comment-discussion': 'chat',
  'file-media': 'image',
  'device-camera-video': 'video',
  'file-code': 'wand',
}

export function Icon({
  name,
  size = 16,
  className = '',
  style = {},
  spinning = false,
  fill = false,
  stroke = 1.6,
  ...props
}) {
  const sz = typeof size === 'number' ? `${size}px` : size
  const key = ALIASES[name] || name

  // 1. Vector SVG rendering (pixel-perfect, crisp, independent of webfonts)
  if (PATHS[key]) {
    const isSpin = spinning || key === 'loading'
    return jsx('svg', {
      'aria-hidden': 'true',
      width: sz,
      height: sz,
      viewBox: '0 0 24 24',
      fill: fill ? 'currentColor' : 'none',
      stroke: fill ? 'none' : 'currentColor',
      strokeWidth: stroke,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: `md-icon ${isSpin ? 'codicon-modifier-spin ' : ''}${className}`.trim(),
      style: {
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      },
      ...props,
      children: jsx('path', { d: PATHS[key] }),
    })
  }

  // 2. Hermes / VS Code Codicon fallback
  return jsx('i', {
    'aria-hidden': 'true',
    className: `codicon codicon-${name} ${spinning ? 'codicon-modifier-spin ' : ''}${className}`.trim(),
    style: {
      fontSize: sz,
      width: sz,
      height: sz,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      lineHeight: 1,
      textAlign: 'center',
      verticalAlign: 'middle',
      flexShrink: 0,
      ...style,
    },
    ...props,
  })
}

export function IconButton({
  icon,
  label,
  onClick,
  size = 15,
  style = {},
  className = '',
  disabled = false,
  active = false,
  tone = null,
  ...props
}) {
  return jsx('button', {
    type: 'button',
    onClick: disabled ? undefined : onClick,
    disabled,
    title: label,
    'aria-label': label,
    className: `md-icon-btn ${active ? 'is-active ' : ''}${tone ? `is-${tone} ` : ''}${className}`.trim(),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '32px',
      height: '32px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--color-border)',
      backgroundColor: active ? 'var(--color-foreground)' : 'var(--color-card)',
      color: active ? 'var(--color-background)' : 'var(--ui-text-secondary)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      transition: 'all 0.15s ease',
      flexShrink: 0,
      ...style,
    },
    ...props,
    children: jsx(Icon, { name: icon, size }),
  })
}

export function StatusDot({ status, size = 7, style = {}, title }) {
  const colors = {
    idea: 'var(--ui-text-quaternary)',
    outline: 'var(--ui-yellow)',
    draft: 'var(--ui-blue)',
    ready: 'var(--ui-purple)',
    published: 'var(--ui-green)',
  }
  const bg = colors[status] || 'var(--ui-text-quaternary)'
  return jsx('span', {
    title: title || status,
    style: {
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      backgroundColor: bg,
      display: 'inline-block',
      flexShrink: 0,
      ...style,
    },
  })
}


// ---------------------------------------------------------------------------
// Module: client/i18n.js
// ---------------------------------------------------------------------------
// English Only locale bundles (100% English, no Chinese characters)
export const ZH_BUNDLE = {
  'nav.label': 'Media Desk',
  'nav.home': 'Ideas',
  'nav.content': 'Content',
  'nav.schedule': 'Schedule',
  'nav.insights': 'Insights',
  'nav.style': 'Style Library',
  'nav.ideas': 'Ideas',
  'nav.styles': 'Styles',
  'topbar.clearSample': 'Clear sample data',
  'topbar.assistant': 'Assistant',
  'settings.title': 'Media Desk Settings',
  'settings.imageSource': 'Image Generation Source',
  'settings.imageSource.http': 'HTTP Endpoint (OpenAI-compatible)',
  'settings.imageSource.tool': 'Hermes Tool Provider',
  'settings.baseUrl': 'API Base URL',
  'settings.apiKey': 'API Key',
  'settings.model': 'Image Model',
  'settings.lang': 'Language Preference',
  'settings.lang.auto': 'Auto (System)',
  'settings.lang.zh': 'Chinese',
  'settings.lang.en': 'English',
  'settings.exportDir': 'Export Directory',
  'settings.imageCount': 'Figure Image Count',
  'settings.shotCount': 'Storyboard Shot Count',
  'settings.voiceSample': 'Voice Sample',
  'settings.save': 'Save Settings',
  'settings.saved': 'Settings saved successfully',
  'settings.test': 'Test Image Generation',
  'settings.testing': 'Generating test image...',
  'settings.testSuccess': 'Test image generated successfully',
  'settings.testFailed': 'Image generation test failed',
  'error.backendUnreachable': 'Backend unreachable. Please verify plugin backend status.',
  'error.backendOff': 'Plugin backend is disabled. Please enable it in plugin capabilities.',
  'error.retry': 'Retry Connection',
  'loading': 'Loading Media Desk data...',
  'undo.label': 'Undo',
  'undo.success': 'Successfully reverted change',
  'studio.close': 'Close Studio',
  'studio.back': 'Studio',
  'studio.produce': 'Generate All',
  'studio.producing': 'Producing assets...',
  'studio.cancel': 'Cancel Production',
  'studio.save': 'Export Production',
  'studio.reveal': 'Reveal in File Manager',
  'studio.expand': 'Expand',
  'studio.collapse': 'Collapse',
  'studio.askAssistant': 'Ask assistant to edit this',
  'studio.step1': 'Title and cover text',
  'studio.step2': 'Script',
  'studio.step3': 'Cover and images',
  'studio.step4': 'Storyboard',
  'studio.stylePicker': 'Style',
  'studio.heroTitle': 'Hero & Figures',
  'studio.articleTitle': 'Script',
  'studio.shotsTitle': 'Storyboard',
  'studio.noProduction': 'No production assets yet. Click "Draft it" on the left to start.',
  'studio.regen': 'Re-generate',
  'studio.download': 'Download',
  'studio.noImageProvider': 'No image provider configured. Please configure image settings.',
  'studio.toSettings': 'Settings',
  'studio.pollError': 'Failed to retrieve production status',
  'studio.draftIt': 'Draft it',
  'studio.tellWhatToChange': 'Tell me what to change...',
  'studio.shorterTitle': 'Shorter title',
  'studio.lighterTone': 'Lighter tone',
  'studio.strongerOpening': 'Stronger opening',
  'studio.bolderCover': 'Bolder cover text',
  'studio.copyScript': 'Copy script',
  'studio.downloadCover': 'Download cover',
  'studio.chars': 'chars',
  'studio.shots': 'shots',
  'studio.duration': 's duration',
  'studio.images': 'images',
  'studio.shotsEmpty': 'No shots yet. Click "Draft it" on the left to start.',
  'home.urlPlaceholder': 'Paste article or webpage URL to capture...',
  'home.captureBtn': 'Capture',
  'home.capturing': 'Capturing...',
  'home.dropzone': 'Drop image/video files here or click to browse (max 50MB per file)',
  'home.fileTooLarge': 'File exceeds 50MB size limit and was rejected.',
  'home.fileUnsupported': 'Unsupported format. Allowed: JPG, PNG, WebP, GIF, MP4, WebM.',
  'home.filterKind': 'Kind',
  'home.filterPlatform': 'Platform',
  'home.filterStatus': 'Status',
  'home.all': 'All',
  'home.search': 'Search title or body...',
  'home.empty': 'No matching inspiration items found',
  'home.waitingToDraft': 'ideas waiting to be drafted,',
  'home.scheduledThisWeek': 'pieces scheduled this week,',
  'home.andStreak': 'and your idea streak is',
  'home.day': 'day',
  'home.capturePlaceholder': 'Capture an idea or paste a link...',
  'ideas.savedToast': 'Saved idea "{title}"',
  'ideas.zoomIn': 'Zoom in',
  'ideas.zoomOut': 'Zoom out',
  'ideas.resetView': 'Reset canvas view',
  'ideas.canvas': 'Freeform canvas view',
  'ideas.grid': 'Organized grid view',
  'content.viewTable': 'Table',
  'content.viewBoard': 'Board',
  'content.viewKanban': 'Kanban View',
  'content.colTitle': 'Title',
  'content.colKind': 'Kind',
  'content.colPlatform': 'Platform',
  'content.colStatus': 'Status',
  'content.colScheduled': 'Scheduled At',
  'content.colPublished': 'Published At',
  'content.colActions': 'Actions',
  'content.subtitle': '{total} items · {ideas} ideas to develop · {drafted} drafted · {published} published',
  'content.searchPlaceholder': 'Search titles, tags, platform...',
  'schedule.prevMonth': 'Previous Month',
  'schedule.nextMonth': 'Next Month',
  'schedule.unscheduled': 'Unscheduled',
  'schedule.emptyUnscheduled': 'No unscheduled items',
  'schedule.dateSetSuccess': 'Schedule date updated',
  'schedule.dateSetFailed': 'Failed to update schedule; item restored to previous position',
  'schedule.setDate': 'Set Date',
  'schedule.changeDate': 'Change Schedule',
  'schedule.clear': 'Clear Schedule',
  'schedule.sun': 'Sun',
  'schedule.mon': 'Mon',
  'schedule.tue': 'Tue',
  'schedule.wed': 'Wed',
  'schedule.thu': 'Thu',
  'schedule.fri': 'Fri',
  'schedule.sat': 'Sat',
  'schedule.today': 'Today',
  'schedule.streak': 'Streak',
  'schedule.ideasThisMonth': 'Ideas this month',
  'schedule.postsThisMonth': 'Posts this month',
  'schedule.upNext': 'Up next',
  'schedule.upNextEmpty': 'Nothing scheduled next',
  'schedule.tomorrow': 'Tomorrow',
  'schedule.bestTime': 'Best time to post',
  'schedule.dragToCalendar': 'Drag to the calendar',
  'schedule.subtitle': '{month} items this month · {week} this week',
  'schedule.groupDrafted': 'Drafted',
  'schedule.groupIdeas': 'Ideas',
  'item.untitled': 'Untitled Idea',
  'status.idea': 'Idea',
  'status.outline': 'Outline',
  'status.draft': 'Draft',
  'status.ready': 'Ready',
  'status.published': 'Published',
  'kind.image': 'Image',
  'kind.video': 'Video',
  'kind.web': 'Web',
  'kind.quote': 'Quote',
  'kind.note': 'Note',
  'insights.headline': '{count} pieces drew {total} engagements',
  'insights.ledBy': 'led by',
  'insights.totalEngagements': 'Total engagement',
  'insights.followers': 'Followers',
  'insights.importAccount': 'Import account',
  'insights.addStats': 'Add stats',
  'insights.pasteCsv': 'Paste CSV',
  'insights.dailyChart': 'Daily engagement',
  'insights.byPlatform': 'By platform',
  'insights.topPieces': 'Top pieces',
  'insights.suggestions': 'Suggestions',
  'insights.analyzeAgain': 'Analyze again',
  'insights.publishedPieces': 'Published pieces',
  'insights.chart': 'Chart',
  'insights.table': 'Table',
  'insights.noSeries': 'No daily data yet. Publish content or add stats to see the trend.',
  'insights.statItem': 'Select piece',
  'insights.statSaved': 'Stats saved',
  'insights.suggestionsEmpty': "Click Analyze again to find what's working in your data.",
  'insights.analyzing': 'Analyzing...',
  'insights.title': 'Performance Insights & Analytics',
  'insights.totals': 'Total Engagements',
  'insights.views': 'Views',
  'insights.likes': 'Likes',
  'insights.comments': 'Comments',
  'insights.shares': 'Shares',
  'insights.saves': 'Saves',
  'insights.csvExport': 'Export CSV',
  'insights.learnBtn': 'Learn rules from data',
  'insights.learning': 'Learning rules from data...',
  'insights.learnSuccess': 'Successfully proposed {count} new rules',
  'insights.learnFailed': 'Failed to learn rules',
  'insights.exportSkillBtn': 'Export Skill',
  'insights.exporting': 'Exporting skill...',
  'insights.exportSuccess': 'Skill exported successfully',
  'insights.exportFailed': 'Failed to export skill',
  'insights.empty': 'No insights data available yet. Publish content or import social accounts.',
  'monid.wizardTitle': 'Social Account Import (Monid)',
  'monid.status': 'Monid Status',
  'monid.status.ready': 'Ready',
  'monid.status.missing': 'Monid CLI not installed',
  'monid.status.nokey': 'No API key configured',
  'monid.status.error': 'Connection error',
  'monid.urlPlaceholder': 'Enter profile or post URL, e.g. https://x.com/username...',
  'monid.platform': 'Platform',
  'monid.importBtn': 'Import Posts',
  'monid.importing': 'Importing posts and analyzing style...',
  'monid.receiptTitle': 'Import Receipt',
  'monid.receiptNickname': 'Nickname',
  'monid.receiptCount': 'Fetched',
  'monid.receiptAdded': 'Added',
  'monid.receiptCost': 'Cost',
  'monid.styleError': 'Style Extraction Notice',
  'style.writingPrefix': 'Writing in the',
  'style.writingSuffix': 'style.',
  'style.myStyles': 'My styles',
  'style.inUse': 'in use',
  'style.stopUsing': 'Stop using',
  'style.useThis': 'Use this style',
  'style.pastePosts': 'Paste posts',
  'style.pasteLinks': 'Paste links',
  'style.pastePostsTitle': 'Create style from pasted posts',
  'style.pasteLinksTitle': 'Extract style from post links',
  'style.pasteLinksPlaceholder': 'Paste profile or post URLs, one per line...',
  'style.sampleNamePlaceholder': 'Style name (e.g. Founder Field Notes)',
  'style.extracting': 'Extracting style...',
  'style.extractDone': 'Style created',
  'style.title': 'Style Library & Writing Rules',
  'style.preset': 'Preset',
  'style.custom': 'Custom',
  'style.active': 'Active',
  'style.activate': 'Set Active',
  'style.addBtn': 'New Style',
  'style.editBtn': 'Edit',
  'style.deleteBtn': 'Delete',
  'style.name': 'Style Name',
  'style.category': 'Category',
  'style.summary': 'Summary',
  'style.tone': 'Tone',
  'style.samples': 'Sample quotes',
  'style.save': 'Save Style',
  'style.cancel': 'Cancel',
  'style.skillsTitle': 'Writing Rules & Guidelines (Skills)',
  'style.skillRule': 'Rule',
  'style.skillStatus': 'Status',
  'style.skillActivate': 'Activate',
  'style.skillDeactivate': 'Deactivate',
  'style.skillDelete': 'Delete',
  'style.noSkills': 'No rules yet. Learn rules from Insights.',
  'chat.title': 'Assistant Chat',
  'chat.toggle': 'Assistant',
  'chat.placeholder': 'Ask assistant to edit or write...',
  'chat.send': 'Send',
  'chat.clear': 'Clear History',
  'chat.empty': 'No conversation yet. Ask the assistant anything.',
  'chat.undo': 'Undo Op',
  'chat.outage': 'Model Outage / Fallback Mode',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'sample.clear': 'Clear sample data',
  'insights.date': 'Date',
}

export const EN_BUNDLE = {
  'nav.label': 'Media Desk',
  'nav.home': 'Ideas',
  'nav.content': 'Content',
  'nav.schedule': 'Schedule',
  'nav.insights': 'Insights',
  'nav.style': 'Style Library',
  'nav.ideas': 'Ideas',
  'nav.styles': 'Styles',
  'topbar.clearSample': 'Clear sample data',
  'topbar.assistant': 'Assistant',
  'settings.title': 'Media Desk Settings',
  'settings.imageSource': 'Image Generation Source',
  'settings.imageSource.http': 'HTTP Endpoint (OpenAI-compatible)',
  'settings.imageSource.tool': 'Hermes Tool Provider',
  'settings.baseUrl': 'API Base URL',
  'settings.apiKey': 'API Key',
  'settings.model': 'Image Model',
  'settings.lang': 'Language Preference',
  'settings.lang.auto': 'Auto (System)',
  'settings.lang.zh': 'Chinese',
  'settings.lang.en': 'English',
  'settings.exportDir': 'Export Directory',
  'settings.imageCount': 'Figure Image Count',
  'settings.shotCount': 'Storyboard Shot Count',
  'settings.voiceSample': 'Voice Sample',
  'settings.save': 'Save Settings',
  'settings.saved': 'Settings saved successfully',
  'settings.test': 'Test Image Generation',
  'settings.testing': 'Generating test image...',
  'settings.testSuccess': 'Test image generated successfully',
  'settings.testFailed': 'Image generation test failed',
  'error.backendUnreachable': 'Backend unreachable. Please verify plugin backend status.',
  'error.backendOff': 'Plugin backend is disabled. Please enable it in plugin capabilities.',
  'error.retry': 'Retry Connection',
  'loading': 'Loading Media Desk data...',
  'undo.label': 'Undo',
  'undo.success': 'Successfully reverted change',
  'studio.close': 'Close Studio',
  'studio.back': 'Studio',
  'studio.produce': 'Generate All',
  'studio.producing': 'Producing assets...',
  'studio.cancel': 'Cancel Production',
  'studio.save': 'Export Production',
  'studio.reveal': 'Reveal in File Manager',
  'studio.expand': 'Expand',
  'studio.collapse': 'Collapse',
  'studio.askAssistant': 'Ask assistant to edit this',
  'studio.step1': 'Title and cover text',
  'studio.step2': 'Script',
  'studio.step3': 'Cover and images',
  'studio.step4': 'Storyboard',
  'studio.stylePicker': 'Style',
  'studio.heroTitle': 'Hero & Figures',
  'studio.articleTitle': 'Script',
  'studio.shotsTitle': 'Storyboard',
  'studio.noProduction': 'No production assets yet. Click "Draft it" on the left to start.',
  'studio.regen': 'Re-generate',
  'studio.download': 'Download',
  'studio.noImageProvider': 'No image provider configured. Please configure image settings.',
  'studio.toSettings': 'Settings',
  'studio.pollError': 'Failed to retrieve production status',
  'studio.draftIt': 'Draft it',
  'studio.tellWhatToChange': 'Tell me what to change...',
  'studio.shorterTitle': 'Shorter title',
  'studio.lighterTone': 'Lighter tone',
  'studio.strongerOpening': 'Stronger opening',
  'studio.bolderCover': 'Bolder cover text',
  'studio.copyScript': 'Copy script',
  'studio.downloadCover': 'Download cover',
  'studio.chars': 'chars',
  'studio.shots': 'shots',
  'studio.duration': 's duration',
  'studio.images': 'images',
  'studio.shotsEmpty': 'No shots yet. Click "Draft it" on the left to start.',
  'home.urlPlaceholder': 'Paste article or webpage URL to capture...',
  'home.captureBtn': 'Capture',
  'home.capturing': 'Capturing...',
  'home.dropzone': 'Drop image/video files here or click to browse (max 50MB per file)',
  'home.fileTooLarge': 'File exceeds 50MB size limit and was rejected.',
  'home.fileUnsupported': 'Unsupported format. Allowed: JPG, PNG, WebP, GIF, MP4, WebM.',
  'home.filterKind': 'Kind',
  'home.filterPlatform': 'Platform',
  'home.filterStatus': 'Status',
  'home.all': 'All',
  'home.search': 'Search title or body...',
  'home.empty': 'No matching inspiration items found',
  'home.waitingToDraft': 'ideas waiting to be drafted,',
  'home.scheduledThisWeek': 'pieces scheduled this week,',
  'home.andStreak': 'and your idea streak is',
  'home.day': 'day',
  'home.capturePlaceholder': 'Capture an idea or paste a link...',
  'ideas.savedToast': 'Saved idea "{title}"',
  'ideas.zoomIn': 'Zoom in',
  'ideas.zoomOut': 'Zoom out',
  'ideas.resetView': 'Reset canvas view',
  'ideas.canvas': 'Freeform canvas view',
  'ideas.grid': 'Organized grid view',
  'content.viewTable': 'Table',
  'content.viewBoard': 'Board',
  'content.viewKanban': 'Kanban View',
  'content.colTitle': 'Title',
  'content.colKind': 'Kind',
  'content.colPlatform': 'Platform',
  'content.colStatus': 'Status',
  'content.colScheduled': 'Scheduled At',
  'content.colPublished': 'Published At',
  'content.colActions': 'Actions',
  'content.subtitle': '{total} items · {ideas} ideas to develop · {drafted} drafted · {published} published',
  'content.searchPlaceholder': 'Search titles, tags, platform...',
  'schedule.prevMonth': 'Previous Month',
  'schedule.nextMonth': 'Next Month',
  'schedule.unscheduled': 'Unscheduled',
  'schedule.emptyUnscheduled': 'No unscheduled items',
  'schedule.dateSetSuccess': 'Schedule date updated',
  'schedule.dateSetFailed': 'Failed to update schedule; item restored to previous position',
  'schedule.setDate': 'Set Date',
  'schedule.changeDate': 'Change Schedule',
  'schedule.clear': 'Clear Schedule',
  'schedule.sun': 'Sun',
  'schedule.mon': 'Mon',
  'schedule.tue': 'Tue',
  'schedule.wed': 'Wed',
  'schedule.thu': 'Thu',
  'schedule.fri': 'Fri',
  'schedule.sat': 'Sat',
  'schedule.today': 'Today',
  'schedule.streak': 'Streak',
  'schedule.ideasThisMonth': 'Ideas this month',
  'schedule.postsThisMonth': 'Posts this month',
  'schedule.upNext': 'Up next',
  'schedule.upNextEmpty': 'Nothing scheduled next',
  'schedule.tomorrow': 'Tomorrow',
  'schedule.bestTime': 'Best time to post',
  'schedule.dragToCalendar': 'Drag to the calendar',
  'schedule.subtitle': '{month} items this month · {week} this week',
  'schedule.groupDrafted': 'Drafted',
  'schedule.groupIdeas': 'Ideas',
  'item.untitled': 'Untitled Idea',
  'status.idea': 'Idea',
  'status.outline': 'Outline',
  'status.draft': 'Draft',
  'status.ready': 'Ready',
  'status.published': 'Published',
  'kind.image': 'Image',
  'kind.video': 'Video',
  'kind.web': 'Web',
  'kind.quote': 'Quote',
  'kind.note': 'Note',
  'insights.headline': '{count} pieces drew {total} engagements',
  'insights.ledBy': 'led by',
  'insights.totalEngagements': 'Total engagement',
  'insights.followers': 'Followers',
  'insights.importAccount': 'Import account',
  'insights.addStats': 'Add stats',
  'insights.pasteCsv': 'Paste CSV',
  'insights.dailyChart': 'Daily engagement',
  'insights.byPlatform': 'By platform',
  'insights.topPieces': 'Top pieces',
  'insights.suggestions': 'Suggestions',
  'insights.analyzeAgain': 'Analyze again',
  'insights.publishedPieces': 'Published pieces',
  'insights.chart': 'Chart',
  'insights.table': 'Table',
  'insights.noSeries': 'No daily data yet. Publish content or add stats to see the trend.',
  'insights.statItem': 'Select piece',
  'insights.statSaved': 'Stats saved',
  'insights.suggestionsEmpty': "Click Analyze again to find what's working in your data.",
  'insights.analyzing': 'Analyzing...',
  'insights.title': 'Performance Insights & Analytics',
  'insights.totals': 'Total Engagements',
  'insights.views': 'Views',
  'insights.likes': 'Likes',
  'insights.comments': 'Comments',
  'insights.shares': 'Shares',
  'insights.saves': 'Saves',
  'insights.csvExport': 'Export CSV',
  'insights.learnBtn': 'Learn rules from data',
  'insights.learning': 'Learning rules from data...',
  'insights.learnSuccess': 'Successfully proposed {count} new rules',
  'insights.learnFailed': 'Failed to learn rules',
  'insights.exportSkillBtn': 'Export Skill',
  'insights.exporting': 'Exporting skill...',
  'insights.exportSuccess': 'Skill exported successfully',
  'insights.exportFailed': 'Failed to export skill',
  'insights.empty': 'No insights data available yet. Publish content or import social accounts.',
  'monid.wizardTitle': 'Social Account Import (Monid)',
  'monid.status': 'Monid Status',
  'monid.status.ready': 'Ready',
  'monid.status.missing': 'Monid CLI not installed',
  'monid.status.nokey': 'No API key configured',
  'monid.status.error': 'Connection error',
  'monid.urlPlaceholder': 'Enter profile or post URL, e.g. https://x.com/username...',
  'monid.platform': 'Platform',
  'monid.importBtn': 'Import Posts',
  'monid.importing': 'Importing posts and analyzing style...',
  'monid.receiptTitle': 'Import Receipt',
  'monid.receiptNickname': 'Nickname',
  'monid.receiptCount': 'Fetched',
  'monid.receiptAdded': 'Added',
  'monid.receiptCost': 'Cost',
  'monid.styleError': 'Style Extraction Notice',
  'style.writingPrefix': 'Writing in the',
  'style.writingSuffix': 'style.',
  'style.myStyles': 'My styles',
  'style.inUse': 'in use',
  'style.stopUsing': 'Stop using',
  'style.useThis': 'Use this style',
  'style.pastePosts': 'Paste posts',
  'style.pasteLinks': 'Paste links',
  'style.pastePostsTitle': 'Create style from pasted posts',
  'style.pasteLinksTitle': 'Extract style from post links',
  'style.pasteLinksPlaceholder': 'Paste profile or post URLs, one per line...',
  'style.sampleNamePlaceholder': 'Style name (e.g. Founder Field Notes)',
  'style.extracting': 'Extracting style...',
  'style.extractDone': 'Style created',
  'style.title': 'Style Library & Writing Rules',
  'style.preset': 'Preset',
  'style.custom': 'Custom',
  'style.active': 'Active',
  'style.activate': 'Set Active',
  'style.addBtn': 'New Style',
  'style.editBtn': 'Edit',
  'style.deleteBtn': 'Delete',
  'style.name': 'Style Name',
  'style.category': 'Category',
  'style.summary': 'Summary',
  'style.tone': 'Tone',
  'style.samples': 'Sample quotes',
  'style.save': 'Save Style',
  'style.cancel': 'Cancel',
  'style.skillsTitle': 'Writing Rules & Guidelines (Skills)',
  'style.skillRule': 'Rule',
  'style.skillStatus': 'Status',
  'style.skillActivate': 'Activate',
  'style.skillDeactivate': 'Deactivate',
  'style.skillDelete': 'Delete',
  'style.noSkills': 'No rules yet. Learn rules from Insights.',
  'chat.title': 'Assistant Chat',
  'chat.toggle': 'Assistant',
  'chat.placeholder': 'Ask assistant to edit or write...',
  'chat.send': 'Send',
  'chat.clear': 'Clear History',
  'chat.empty': 'No conversation yet. Ask the assistant anything.',
  'chat.undo': 'Undo Op',
  'chat.outage': 'Model Outage / Fallback Mode',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'sample.clear': 'Clear sample data',
  'insights.date': 'Date',
}

/** Convert flat dotted keys into nested objects for Hermes SDK */
export function unflatten(flat) {
  const result = {}
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.')
    let curr = result
    for (let i = 0; i < parts.length - 1; i++) {
      curr[parts[i]] = curr[parts[i]] || {}
      curr = curr[parts[i]]
    }
    curr[parts[parts.length - 1]] = value
  }
  return result
}

export function translate(key, vars) {
  let text = EN_BUNDLE[key]
  if (text === undefined) {
    text = key
  }
  if (vars && typeof vars === 'object') {
    text = String(text).replace(/\{(\w+)\}/g, (match, k) => (vars[k] === undefined ? match : String(vars[k])))
  }
  return text
}



// ---------------------------------------------------------------------------
// Module: client/util.js
// ---------------------------------------------------------------------------
/**
 * Shared utility functions: truncation, asset normalization, dates, streaks, math
 */

export function truncateTitle(title, maxChars = 40) {
  if (!title) return ''
  const str = String(title)
  if (str.length <= maxChars) return str
  return str.slice(0, maxChars) + '...'
}

export function normalizeAssetSrc(src) {
  if (!src || typeof src !== 'string') return ''
  if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) return src
  let clean = src.replace(/^\/+/, '')
  if (clean.startsWith('api/plugins/hermes-media-desk/')) {
    clean = clean.replace(/^api\/plugins\/hermes-media-desk\//, '')
  }
  if (clean.startsWith('files/')) {
    return `media-desk/${clean}`
  }
  if (clean.startsWith('assets/')) {
    return `media-desk/${clean}`
  }
  return clean
}

export function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0
  }
  return h
}

export function hashPos(id) {
  const h = hash(String(id || ''))
  const angle = (h % 360) * (Math.PI / 180)
  const distance = 160 + (h % 280)
  const x = Math.round(Math.cos(angle) * distance)
  const y = Math.round(Math.sin(angle) * distance * 0.72)
  const rotation = ((h % 15) - 7)
  return { x, y, rotation }
}

export function seeded(seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function dayKey(val) {
  if (!val) return ''
  const d = typeof val === 'string' ? new Date(val) : val
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export function todayLocal() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDateLabel(isoString, locTag = 'en-US') {
  if (!isoString) return ''
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locTag, {
    month: 'short',
    day: 'numeric',
  }).format(d)
}

export function formatCompact(n) {
  const num = Number(n) || 0
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return String(num)
}

export function formatClock(isoString, locTag = 'en-US') {
  if (!isoString) return ''
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locTag, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

export function engagementsOf(item) {
  if (!item) return 0
  if (typeof item.engagements === 'number') return item.engagements
  const m = item.metrics || item
  return (
    Number(m.likes || 0) +
    Number(m.comments || 0) +
    Number(m.shares || 0) +
    Number(m.saves || 0)
  )
}

export function computeStreak(items) {
  if (!items || !items.length) return 0
  const daySet = new Set()
  for (const it of items) {
    if (it.createdAt) {
      const k = dayKey(it.createdAt)
      if (k) daySet.add(k)
    }
  }
  let streak = 0
  const cur = new Date()
  while (true) {
    const k = dayKey(cur)
    if (daySet.has(k)) {
      streak += 1
      cur.setDate(cur.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

export function relativeDay(isoString) {
  if (!isoString) return ''
  const target = new Date(isoString)
  if (isNaN(target.getTime())) return ''
  const now = new Date()
  const diffDays = Math.round((target - now) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 1 && diffDays <= 7) return `in ${diffDays} days`
  if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`
  return target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function displayItem(raw) {
  if (!raw) return { id: '', title: '' }
  const prod = raw.production
  const done = prod && prod.status === 'done'
  return {
    ...raw,
    title: (done && prod.title) || raw.title || 'Untitled',
    body: (done && prod.article) || raw.body || '',
  }
}

export function getItemThumbnailSrc(item) {
  if (!item) return null
  if (item.media) {
    if (item.media.poster) return item.media.poster
    if (item.media.src) {
      if (item.media.src.endsWith('.mp4')) {
        return item.media.src.replace(/\.mp4$/i, '-poster.jpg')
      }
      return item.media.src
    }
  }
  if (item.production && item.production.cover && item.production.cover.src) {
    return item.production.cover.src
  }
  return null
}

export function posterOf(item) {
  const thumb = getItemThumbnailSrc(item)
  return thumb ? normalizeAssetSrc(thumb) : null
}

export function isIdea(item) {
  return !item.parentId
}

export const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function springEasing(stiffness = 170, damping = 20, mass = 1) {
  const w0 = Math.sqrt(stiffness / mass)
  const zeta = damping / (2 * Math.sqrt(stiffness * mass))
  const wd = w0 * Math.sqrt(Math.max(1 - zeta * zeta, 1e-4))
  const at = t =>
    1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t))
  let duration = 0.1
  while (
    duration < 4 &&
    (Math.abs(at(duration) - 1) > 0.002 || Math.abs(at(duration + 0.05) - 1) > 0.002)
  )
    duration += 0.05
  const points = []
  const N = 36
  for (let i = 0; i <= N; i += 1) points.push(Number(at((i / N) * duration).toFixed(4)))
  points[N] = 1
  return {
    easing: `linear(${points.join(',')})`,
    duration: Math.round(duration * 1000),
    stiffness,
    damping,
  }
}

export const SPRING_SOFT = springEasing(120, 16)
export const SPRING_SNAP = springEasing(260, 24)


// ---------------------------------------------------------------------------
// Module: client/layout.js
// ---------------------------------------------------------------------------
/**
 * Spatial Canvas Layout Engine
 * Computes non-overlapping positions spiraling around central Hero box
 */



export const HERO = { w: 540, h: 372 }

export function cardSize(raw) {
  const item = displayItem(raw)
  const h = hash(item.id || '')
  if (item.media && ['image', 'video', 'web'].includes(item.kind)) {
    const width = 180 + (h % 5) * 20
    const ratio = item.media.h && item.media.w ? item.media.h / item.media.w : 0.75
    return { w: width, h: width * ratio + 66 }
  }
  if (item.kind === 'quote') return { w: 220 + (h % 3) * 20, h: 186 }
  return { w: 232, h: 186 }
}

export function scatterLayout(items) {
  const ordered = [...items].sort(
    (a, b) =>
      Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0) ||
      (a.id || '').localeCompare(b.id || '')
  )
  const rand = seeded(7919)
  const nodes = ordered.map((item, index) => {
    const angle = index * 2.39996 + rand() * 0.5
    const radius = 220 + 120 * Math.sqrt(index + 1)
    const size = cardSize(item)
    const jitter = (rand() - 0.5) * 7
    return {
      id: item.id,
      x: item.pos?.x ?? Math.cos(angle) * radius * 1.34,
      y: item.pos?.y ?? Math.sin(angle) * radius * 0.86,
      w: size.w,
      h: size.h,
      fixed: Boolean(item.pos),
      r: item.pos?.r ?? jitter,
    }
  })

  const gap = 20
  for (let step = 0; step < 240; step += 1) {
    let moved = false
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i]
      const hx = (a.w + HERO.w) / 2 + gap - Math.abs(a.x)
      const hy = (a.h + HERO.h) / 2 + gap - Math.abs(a.y)
      if (hx > 0 && hy > 0 && !a.fixed) {
        if (hx < hy) a.x += Math.sign(a.x || 1) * hx
        else a.y += Math.sign(a.y || 1) * hy
        moved = true
      }
      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j]
        if (a.fixed && b.fixed) continue
        const ox = (a.w + b.w) / 2 + gap - Math.abs(a.x - b.x)
        const oy = (a.h + b.h) / 2 + gap - Math.abs(a.y - b.y)
        if (ox <= 0 || oy <= 0) continue
        moved = true
        const horizontal = ox < oy
        const push = (horizontal ? ox : oy) / 2
        const dir = horizontal ? Math.sign(a.x - b.x || 1) : Math.sign(a.y - b.y || 1)
        const shareA = b.fixed ? 2 : a.fixed ? 0 : 1
        const shareB = a.fixed ? 2 : b.fixed ? 0 : 1
        if (horizontal) {
          a.x += dir * push * shareA
          b.x -= dir * push * shareB
        } else {
          a.y += dir * push * shareA
          b.y -= dir * push * shareB
        }
      }
    }
    if (!moved) break
  }

  return Object.fromEntries(
    nodes.map(n => [
      n.id,
      {
        x: Math.round(n.x),
        y: Math.round(n.y),
        r: n.r,
        d: n.fixed ? 0 : ((hash(n.id) % 13) - 6) / 100,
      },
    ])
  )
}


// ---------------------------------------------------------------------------
// Module: client/related.js
// ---------------------------------------------------------------------------
/**
 * Related Ideas Detection and Clustered Layout
 */

const STOP_EN = new Set(
  'a an and are as at be but by can do for from how i if in into is it its me my of on or our so that the this to was we what when why with you your'.split(
    ' '
  )
)

export function terms(text) {
  const out = new Map()
  const add = (term, weight) => {
    if (!out.has(term) || out.get(term) < weight) out.set(term, weight)
  }
  for (const word of (text || '').toLowerCase().match(/[a-z0-9][a-z0-9+#.-]*/g) ?? []) {
    const clean = word.replace(/[.-]+$/, '')
    if (clean.length >= 2 && !STOP_EN.has(clean)) add(clean, 1)
  }
  return [...out].map(([term, weight]) => ({ term, weight }))
}

function has(haystack, term) {
  if (!haystack) return false
  if (/^[a-z0-9]/.test(term)) {
    return new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(
      haystack
    )
  }
  return haystack.includes(term)
}

export function relatedIdeas(items, query, limit = 6) {
  const list = terms(query)
  if (!list.length) return []
  const scored = []
  for (const item of items) {
    const title = `${item.title ?? ''} ${item.production?.title ?? ''}`.toLowerCase()
    const tags = (item.tags ?? []).join(' ').toLowerCase()
    const body = `${item.body ?? ''} ${item.production?.article ?? ''} ${item.source ?? ''}`.toLowerCase()
    let score = 0
    let strong = false
    for (const { term, weight } of list) {
      if (has(title, term)) {
        score += 3 * weight
        strong = strong || weight >= 1
      } else if (has(tags, term)) {
        score += 2 * weight
        strong = strong || weight >= 1
      } else if (has(body, term)) {
        score += weight
        strong = strong || weight >= 1
      }
    }
    if (strong || score >= 3) {
      scored.push({ id: item.id, score, at: Date.parse(item.createdAt || 0) || 0 })
    }
  }
  return scored
    .sort((a, b) => b.score - a.score || b.at - a.at)
    .slice(0, limit)
    .map(row => row.id)
}

export function relatedLayout(cards) {
  const MAX_H = 640
  const GAP = 20
  const sides = { [-1]: [[]], [1]: [[]] }
  cards.forEach((card, index) => {
    const side = sides[index % 2 === 0 ? -1 : 1]
    let column = side[side.length - 1]
    const used = column.reduce((sum, c) => sum + c.h + GAP, 0)
    if (column.length && used + card.h > MAX_H) side.push((column = []))
    column.push(card)
  })
  const out = {}
  for (const sign of [-1, 1]) {
    sides[sign].forEach((column, k) => {
      const total = column.reduce((sum, c) => sum + c.h, 0) + GAP * (column.length - 1)
      let y = -total / 2
      for (const card of column) {
        out[card.id] = { x: sign * (430 + k * 300), y: Math.round(y + card.h / 2) }
        y += card.h + GAP
      }
    })
  }
  return out
}


// ---------------------------------------------------------------------------
// Module: client/camera.js
// ---------------------------------------------------------------------------
/**
 * Spring Camera Hook with Physics, Inertia Panning, and Focal Wheel Zoom
 */




export function useCamera(stageRef, worldRef) {
  const cam = useRef({
    x: 0,
    y: 0,
    s: 1,
    vx: 0,
    vy: 0,
    vs: 0,
    tx: 0,
    ty: 0,
    ts: 1,
    raf: 0,
    stiffness: 90,
    damping: 17,
  })

  const apply = useCallback(() => {
    const c = cam.current
    const world = worldRef.current
    const stage = stageRef.current
    if (!world || !stage) return
    world.style.transform = `translate3d(${c.x}px, ${c.y}px, 0) scale(${c.s})`
    world.style.setProperty('--px', `${c.x / c.s}px`)
    world.style.setProperty('--py', `${c.y / c.s}px`)
    stage.style.setProperty('--grid-x', `${c.x}px`)
    stage.style.setProperty('--grid-y', `${c.y}px`)
    stage.style.setProperty('--grid-size', `${28 * c.s}px`)
  }, [stageRef, worldRef])

  const tick = useCallback(() => {
    const c = cam.current
    const k = c.stiffness ?? 90
    const d = c.damping ?? 17
    const dt = 1 / 60
    c.vx += (k * (c.tx - c.x) - d * c.vx) * dt
    c.vy += (k * (c.ty - c.y) - d * c.vy) * dt
    c.vs += (k * (c.ts - c.s) - d * c.vs) * dt
    c.x += c.vx * dt
    c.y += c.vy * dt
    c.s += c.vs * dt
    apply()
    const idle =
      Math.abs(c.tx - c.x) < 0.2 &&
      Math.abs(c.ty - c.y) < 0.2 &&
      Math.abs(c.ts - c.s) < 0.0005 &&
      Math.abs(c.vx) + Math.abs(c.vy) < 0.5
    if (idle) {
      Object.assign(c, { x: c.tx, y: c.ty, s: c.ts, vx: 0, vy: 0, vs: 0, raf: 0 })
      apply()
      return
    }
    c.raf = requestAnimationFrame(tick)
  }, [apply])

  const flyTo = useCallback(
    (target, { instant = false, stiffness = 90, damping = 17 } = {}) => {
      const c = cam.current
      Object.assign(c, {
        tx: target.x != null ? target.x : c.tx,
        ty: target.y != null ? target.y : c.ty,
        ts: target.s != null ? target.s : c.ts,
        stiffness,
        damping,
      })
      if (instant) {
        cancelAnimationFrame(c.raf)
        Object.assign(c, { x: c.tx, y: c.ty, s: c.ts, vx: 0, vy: 0, vs: 0, raf: 0 })
        apply()
        return
      }
      if (!c.raf) c.raf = requestAnimationFrame(tick)
    },
    [apply, tick]
  )

  const halt = useCallback(() => {
    const c = cam.current
    cancelAnimationFrame(c.raf)
    Object.assign(c, { raf: 0, vx: 0, vy: 0, vs: 0, tx: c.x, ty: c.y, ts: c.s })
  }, [])

  const zoomAt = useCallback(
    (factor, cx, cy, instant = true) => {
      const c = cam.current
      const s = Math.max(0.3, Math.min(2.4, c.ts * factor))
      const k = s / c.ts
      flyTo(
        { x: cx - (cx - c.tx) * k, y: cy - (cy - c.ty) * k, s },
        { instant, stiffness: 160, damping: 24 }
      )
    },
    [flyTo]
  )

  useEffect(() => () => cancelAnimationFrame(cam.current.raf), [])

  return { cam, flyTo, halt, zoomAt, apply }
}


// ---------------------------------------------------------------------------
// Module: client/card.js
// ---------------------------------------------------------------------------
/**
 * MediaImage and ItemCard Components
 */








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


// ---------------------------------------------------------------------------
// Module: client/stamps.js
// ---------------------------------------------------------------------------
/**
 * Postage Stamp Inspiration Strip
 * Renders daily postage stamps for recent days with media preview
 */








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


// ---------------------------------------------------------------------------
// Module: client/canvas.js
// ---------------------------------------------------------------------------
/**
 * Ideas Spatial Canvas View
 * Strictly spatial canvas: Spring camera, inertia panning, focal wheel zoom,
 * draggable cards with physics/easing, SVG relationship lines, and category chips.
 * NO wall/masonry/feed mode.
 */













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


// ---------------------------------------------------------------------------
// Module: client/content.js
// ---------------------------------------------------------------------------
/**
 * Content Management Page
 * Kanban Board and Table views with inline status moves and search.
 */









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


// ---------------------------------------------------------------------------
// Module: client/schedule.js
// ---------------------------------------------------------------------------
/**
 * Schedule / Inspiration Calendar Page
 * Month grid with daily postage stamps and Up-Next unscheduled rail.
 */










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


// ---------------------------------------------------------------------------
// Module: client/insights.js
// ---------------------------------------------------------------------------
/**
 * Analytics and Data Insights Page
 * Performance totals, charts, CSV export, rule learning, and Monid account import.
 */








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


// ---------------------------------------------------------------------------
// Module: client/studio.js
// ---------------------------------------------------------------------------
/**
 * Bento Studio Components and Fullscreen Overlay
 * Hero tile, Script editor, Storyboard shots, Progress card, Asset viewer, Studio overlay.
 */









// 9. Studio Bento Components (Task 23, Requirements 16.4-16.9)
// ---------------------------------------------------------------------------

const STUDIO_TILE = {
  backgroundColor: 'var(--color-card)',
  border: '1px solid var(--color-border)',
  borderRadius: '4px',
  boxShadow: 'var(--shadow-sm)',
  opacity: 1,
}

const STUDIO_INPUT = {
  padding: '6px 10px',
  borderRadius: '2.5px',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-background)',
  color: 'var(--color-foreground)',
  fontSize: '12.5px',
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
      borderRadius: '4px',
      backgroundColor: 'var(--color-card)',
      opacity: 1,
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
      borderRadius: '4px',
      backgroundColor: 'var(--color-card)',
      opacity: 1,
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
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-sm)',
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
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-sm)',
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
              borderRadius: '4px',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
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
      borderRadius: isExpanded ? 0 : '4px',
      border: '1px solid var(--color-border)',
      backgroundColor: 'var(--color-card)',
      opacity: 1,
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
                      borderRadius: '2.5px',
                      border: 'none',
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-primary-foreground)',
                      cursor: 'pointer',
                      fontSize: '11.5px',
                      fontWeight: 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                    },
                    children: jsx('span', {}, t('studio.askAssistant')),
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
      borderRadius: isExpanded ? 0 : '4px',
      border: '1px solid var(--color-border)',
      backgroundColor: 'var(--color-card)',
      opacity: 1,
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
                        borderRadius: '2.5px',
                        backgroundColor: 'var(--color-card)',
                        border: '1px solid var(--color-border)',
                        overflow: 'hidden',
                        position: 'relative',
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
                        : jsx('div', {
                            style: {
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '100%',
                              height: '100%',
                              backgroundColor: 'color-mix(in srgb, var(--color-foreground) 4%, var(--color-card))',
                              color: 'var(--color-muted-foreground)',
                            },
                            children: sh.status === 'running' || sh.status === 'pending'
                              ? jsx(Icon, { name: 'refresh', size: 16, spinning: true })
                              : jsx(Icon, { name: 'image', size: 18, style: { opacity: 0.35 } }),
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
    className: 'md-studio',
    'data-testid': 'studio-overlay',
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'var(--color-background)',
      opacity: 1,
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
          backgroundColor: 'var(--color-card)',
          opacity: 1,
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
                  borderRadius: '4px',
                  padding: '12px',
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
                          ...GHOST_BTN,
                          width: '100%',
                          height: '32px',
                          boxSizing: 'border-box',
                          color: 'var(--ui-red)',
                          borderColor: 'color-mix(in srgb, var(--ui-red) 40%, var(--color-border))',
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
                          height: '32px',
                          boxSizing: 'border-box',
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
          backgroundColor: 'var(--color-background)',
          opacity: 1,
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


// ---------------------------------------------------------------------------
// Module: client/chat.js
// ---------------------------------------------------------------------------
/**
 * Assistant Chat Dock Component
 * Fully aligned with dsh-media-desk UI/UX and Hermes theme design tokens.
 * Provides real LLM responses, receipts, model status indicator, and reversible ops.
 */






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


// ---------------------------------------------------------------------------
// Module: client/settings.js
// ---------------------------------------------------------------------------
/**
 * Settings Page Component
 * Provider configuration, image models, and masked API key.
 */






// 10b. Settings Page (Requirement 15.3)
// ---------------------------------------------------------------------------

export function SettingsPage({ rest, t }) {
  const [settings, setSettings] = useState(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  useEffect(() => {
    rest('/settings')
      .then(data => setSettings(data))
      .catch(err => setStatusMsg((err && err.message) || String(err)))
  }, [rest])

  const handleSave = () => {
    if (!settings) return
    rest('/settings', { method: 'POST', body: JSON.stringify(settings) })
      .then(saved => {
        setSettings(saved)
        setStatusMsg(t('settings.saved'))
        setTimeout(() => setStatusMsg(''), 3000)
      })
      .catch(err => setStatusMsg((err && err.message) || String(err)))
  }

  const handleTest = () => {
    setTesting(true)
    setTestResult(null)
    rest('/settings/test', { method: 'POST', body: JSON.stringify({}) })
      .then(res => {
        setTesting(false)
        setTestResult({ ok: true, src: res && res.src })
      })
      .catch(err => {
        setTesting(false)
        setTestResult({ ok: false, error: (err && err.message) || String(err) })
      })
  }

  if (!settings) {
    return jsx('div', {
      style: { padding: '24px', color: 'var(--ui-text-quaternary)', fontSize: '13px' },
      children: t('loading'),
    })
  }

  const image = settings.image || {}
  const field = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    backgroundColor: 'color-mix(in srgb, var(--color-foreground) 4%, var(--color-background))',
    color: 'var(--color-foreground)',
    fontSize: '13px',
    outline: 'none',
  }
  const labelStyle = {
    display: 'block',
    fontWeight: 600,
    fontSize: '12.5px',
    color: 'var(--color-foreground)',
    marginBottom: '6px',
  }

  return jsxs('div', {
    style: {
      padding: '24px 28px',
      maxWidth: '680px',
      color: 'var(--color-foreground)',
      backgroundColor: 'var(--ui-bg-chrome, var(--color-background))',
    },
    children: [
      jsx('h2', {
        style: { fontSize: '20px', fontWeight: 600, margin: '0 0 20px' },
        children: t('settings.title'),
      }),
      
      jsx('div', { style: { marginBottom: '16px' }, children: [
        jsx('label', { style: labelStyle, children: t('settings.imageSource') }),
        jsx('select', {
          value: image.source || 'http',
          onChange: e =>
            setSettings({ ...settings, image: { ...image, source: e.target.value } }),
          style: { ...SELECT_STYLE, width: '100%' },
          children: [
            jsx('option', { value: 'http', style: SELECT_OPTION_STYLE, children: t('settings.imageSource.http') }),
            jsx('option', { value: 'tool', style: SELECT_OPTION_STYLE, children: t('settings.imageSource.tool') }),
          ],
        }),
      ]}),
      (image.source || 'http') === 'http'
        ? jsxs('div', {
            children: [
              jsx('div', { style: { marginBottom: '16px' }, children: [
                jsx('label', { style: labelStyle, children: t('settings.baseUrl') }),
                jsx('input', {
                  type: 'text',
                  value: image.baseUrl || '',
                  onChange: e =>
                    setSettings({ ...settings, image: { ...image, baseUrl: e.target.value } }),
                  style: field,
                }),
              ]}),
              jsx('div', { style: { marginBottom: '16px' }, children: [
                jsx('label', { style: labelStyle, children: t('settings.apiKey') }),
                jsx('input', {
                  type: 'password',
                  value: image.apiKey || '',
                  onChange: e =>
                    setSettings({ ...settings, image: { ...image, apiKey: e.target.value } }),
                  style: field,
                }),
              ]}),
              jsx('div', { style: { marginBottom: '16px' }, children: [
                jsx('label', { style: labelStyle, children: t('settings.model') }),
                jsx('input', {
                  type: 'text',
                  value: image.model || '',
                  onChange: e =>
                    setSettings({ ...settings, image: { ...image, model: e.target.value } }),
                  style: field,
                }),
              ]}),
            ],
          })
        : null,
      jsx('div', { style: { marginBottom: '16px' }, children: [
        jsx('label', { style: labelStyle, children: t('settings.exportDir') }),
        jsx('input', {
          type: 'text',
          value: settings.exportDir || '',
          onChange: e => setSettings({ ...settings, exportDir: e.target.value }),
          style: field,
        }),
      ]}),
      jsxs('div', {
        style: { display: 'flex', gap: '16px', marginBottom: '16px' },
        children: [
          jsx('div', { style: { flex: 1 }, children: [
            jsx('label', { style: labelStyle, children: t('settings.imageCount') }),
            jsx('input', {
              type: 'number',
              min: 0,
              max: 4,
              value: settings.imageCount != null ? settings.imageCount : 3,
              onChange: e =>
                setSettings({ ...settings, imageCount: parseInt(e.target.value, 10) || 0 }),
              style: field,
            }),
          ]}),
          jsx('div', { style: { flex: 1 }, children: [
            jsx('label', { style: labelStyle, children: t('settings.shotCount') }),
            jsx('input', {
              type: 'number',
              min: 0,
              max: 12,
              value: settings.shotCount != null ? settings.shotCount : 4,
              onChange: e =>
                setSettings({ ...settings, shotCount: parseInt(e.target.value, 10) || 0 }),
              style: field,
            }),
          ]}),
        ],
      }),
      jsx('div', { style: { marginBottom: '16px' }, children: [
        jsx('label', { style: labelStyle, children: t('settings.voiceSample') }),
        jsx('input', {
          type: 'text',
          value: settings.voiceSample || '',
          onChange: e => setSettings({ ...settings, voiceSample: e.target.value }),
          placeholder: t('settings.voiceSample'),
          style: field,
        }),
      ]}),
      jsxs('div', { style: { display: 'flex', gap: '10px', marginTop: '24px' }, children: [
        jsx('button', {
          type: 'button',
          onClick: handleSave,
          style: PRIMARY_PILL,
          children: t('settings.save'),
        }),
        jsx('button', {
          type: 'button',
          onClick: handleTest,
          disabled: testing,
          style: { ...GHOST_BTN, opacity: testing ? 0.6 : 1 },
          children: testing ? t('settings.testing') : t('settings.test'),
        }),
      ]}),
      statusMsg
        ? jsx('div', {
            style: { marginTop: '12px', fontSize: '12.5px', color: 'var(--ui-green)' },
            children: statusMsg,
          })
        : null,
      testResult
        ? jsx('div', {
            style: {
              marginTop: '12px',
              fontSize: '12.5px',
              color: testResult.ok ? 'var(--ui-green)' : 'var(--ui-red)',
            },
            children: testResult.ok
              ? t('settings.testSuccess')
              : `${t('settings.testFailed')}: ${testResult.error}`,
          })
        : null,
      testResult && testResult.ok && testResult.src
        ? jsx('div', {
            style: { marginTop: '10px' },
            children: jsx(MediaImage, {
              src: testResult.src,
              alt: t('settings.testSuccess'),
              style: {
                maxWidth: '280px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
              },
            }),
          })
        : null,
    ],
  })
}

// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Module: client/style.js
// ---------------------------------------------------------------------------
/**
 * Style Presets and Personal Persona Management
 * Custom styles, presets, active style selection, and writing rules.
 */






// 10d. Style Library Page (Task 22, Requirements 12.9, 15.2)
// ---------------------------------------------------------------------------

export function StylePage() {
  const { state, dispatch, rest, t, localeTag } = useContext(AppContext)
  const styles = (state.serverState && state.serverState.styles) || []
  const skills = (state.serverState && state.serverState.skills) || []
  const activeStyleId = state.serverState && state.serverState.activeStyleId
  const activeStyle = styles.find(s => s.id === activeStyleId) || null

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingStyle, setEditingStyle] = useState(null)
  const [formData, setFormData] = useState({ name: '', category: 'General', summary: '', tone: '' })
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [postText, setPostText] = useState('')
  const [linkText, setLinkText] = useState('')
  const [extracting, setExtracting] = useState('')
  const [extractMsg, setExtractMsg] = useState('')
  const [extractError, setExtractError] = useState('')
  const [opError, setOpError] = useState('')

  const runOp = op =>
    rest('/ops', { method: 'POST', body: JSON.stringify({ ops: [op] }) })
      .then(res => {
        if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
      })
      .catch(err => {
        setOpError((err && err.message) || String(err))
      })

  const handleSelectStyle = styleId => {
    setOpError('')
    runOp({ op: 'set_style', id: styleId })
  }

  const handleSaveStyle = () => {
    if (!formData.name.trim()) return
    setOpError('')
    const op = editingStyle
      ? { op: 'update_style', id: editingStyle.id, ...formData }
      : { op: 'add_style', ...formData }
    rest('/ops', { method: 'POST', body: JSON.stringify({ ops: [op] }) })
      .then(res => {
        if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
        setShowAddModal(false)
        setEditingStyle(null)
        setFormData({ name: '', category: 'General', summary: '', tone: '' })
      })
      .catch(err => setOpError((err && err.message) || String(err)))
  }

  const handleDeleteStyle = styleId => {
    setOpError('')
    runOp({ op: 'delete_style', id: styleId })
  }

  const handleToggleSkill = skill => {
    setOpError('')
    const nextStatus = skill.status === 'active' ? 'inactive' : 'active'
    runOp({ op: 'update_skill', id: skill.id, status: nextStatus })
  }

  const handleDeleteSkill = skillId => {
    setOpError('')
    runOp({ op: 'delete_skill', id: skillId })
  }

  const runExtract = payload => {
    setExtracting(payload.urls ? 'links' : 'posts')
    setExtractError('')
    setExtractMsg('')
    rest('/style/extract', { method: 'POST', body: JSON.stringify(payload) })
      .then(res => {
        setExtracting('')
        if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
        setExtractMsg(t('style.extractDone'))
        if (payload.urls) setLinkText('')
        else setPostText('')
      })
      .catch(err => {
        setExtracting('')
        setExtractError((err && err.message) || String(err))
      })
  }

  const categories = useMemo(() => {
    const cats = {}
    styles.forEach(s => {
      const cat = s.category || 'Other'
      if (!cats[cat]) cats[cat] = []
      cats[cat].push(s)
    })
    return cats
  }, [styles])
  const categoryNames = Object.keys(categories)
  const visibleStyles =
    categoryFilter === 'all' ? styles : styles.filter(s => (s.category || 'Other') === categoryFilter)

  const pageInput = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    backgroundColor: 'color-mix(in srgb, var(--color-foreground) 4%, var(--color-background))',
    color: 'var(--color-foreground)',
    fontSize: '12.5px',
    outline: 'none',
  }
  const panelStyle = {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-xl)',
    padding: '20px',
    boxShadow: 'var(--shadow-sm)',
  }

  return jsxs('div', {
    className: 'md-board-page',
    style: {
      flex: 1,
      height: '100%',
      overflowY: 'auto',
      padding: '12px 24px 40px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      backgroundColor: 'var(--ui-bg-chrome, var(--color-background))',
    },
    children: [
      // Header + add button.
      jsxs('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        },
        children: [
          jsx('h1', {
            style: {
              fontSize: '28px',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              color: 'var(--color-foreground)',
              margin: 0,
            },
            children: t('style.title'),
          }),
          jsx('button', {
            type: 'button',
            onClick: () => {
              setEditingStyle(null)
              setFormData({ name: '', category: 'General', summary: '', tone: '' })
              setShowAddModal(true)
            },
            style: PRIMARY_PILL,
            children: t('style.addBtn'),
          }),
        ],
      }),
      // Active style hero sentence.
      activeStyle
        ? jsx('div', {
            style: {
              ...HERO_GRADIENT,
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              padding: '14px 20px',
              fontSize: '15px',
              color: 'var(--color-foreground)',
            },
            children: [
              `${t('style.writingPrefix')} `,
              jsx('span', { style: { fontFamily: SERIF_FONT, fontWeight: 600 }, children: activeStyle.name || '—' }),
              ` ${t('style.writingSuffix')}`,
            ],
          })
        : null,
      opError
        ? jsx('div', {
            style: {
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'color-mix(in srgb, var(--ui-red) 10%, var(--color-background))',
              color: 'var(--ui-red)',
              fontSize: '12px',
            },
            children: opError,
          })
        : null,
      // Extraction cards: paste posts or paste links.
      jsxs('div', {
        style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' },
        children: [
          jsxs('div', { style: panelStyle, children: [
            jsx('h2', {
              style: { fontSize: '13.5px', fontWeight: 600, margin: '0 0 10px', color: 'var(--color-foreground)' },
              children: t('style.pastePostsTitle'),
            }),
            jsx('textarea', {
              rows: 4,
              value: postText,
              onChange: e => setPostText(e.target.value),
              placeholder: t('style.pastePosts'),
              style: { ...pageInput, resize: 'vertical', fontFamily: 'inherit' },
            }),
            jsx('button', {
              type: 'button',
              onClick: () => runExtract({ text: postText.trim() }),
              disabled: extracting === 'posts' || !postText.trim(),
              style: {
                ...SECONDARY_PILL,
                alignSelf: 'flex-start',
                marginTop: '10px',
                opacity: extracting === 'posts' || !postText.trim() ? 0.55 : 1,
              },
              children: extracting === 'posts' ? t('style.extracting') : t('style.pastePosts'),
            }),
          ]}),
          jsxs('div', { style: panelStyle, children: [
            jsx('h2', {
              style: { fontSize: '13.5px', fontWeight: 600, margin: '0 0 10px', color: 'var(--color-foreground)' },
              children: t('style.pasteLinksTitle'),
            }),
            jsx('textarea', {
              rows: 4,
              value: linkText,
              onChange: e => setLinkText(e.target.value),
              placeholder: t('style.pasteLinksPlaceholder'),
              style: { ...pageInput, resize: 'vertical', fontFamily: 'inherit' },
            }),
            jsx('button', {
              type: 'button',
              onClick: () =>
                runExtract({ urls: linkText.split(/\r?\n/).map(s => s.trim()).filter(Boolean) }),
              disabled: extracting === 'links' || !linkText.trim(),
              style: {
                ...SECONDARY_PILL,
                alignSelf: 'flex-start',
                marginTop: '10px',
                opacity: extracting === 'links' || !linkText.trim() ? 0.55 : 1,
              },
              children: extracting === 'links' ? t('style.extracting') : t('style.pasteLinks'),
            }),
          ]}),
        ],
      }),
      (extractMsg || extractError) && !extracting
        ? jsx('div', {
            style: {
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: extractError
                ? 'color-mix(in srgb, var(--ui-red) 10%, var(--color-background))'
                : 'color-mix(in srgb, var(--ui-green) 10%, var(--color-background))',
              color: extractError ? 'var(--ui-red)' : 'var(--ui-green)',
              fontSize: '12px',
            },
            children: extractError || extractMsg,
          })
        : null,
      // Add / edit style form.
      showAddModal
        ? jsxs('div', {
            style: { ...panelStyle, display: 'flex', flexDirection: 'column', gap: '10px' },
            children: [
              jsx('h4', {
                style: { margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'var(--color-foreground)' },
                children: editingStyle ? t('style.editBtn') : t('style.addBtn'),
              }),
              jsxs('div', {
                style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
                children: [
                  jsx('input', {
                    type: 'text',
                    placeholder: t('style.name'),
                    value: formData.name,
                    onChange: e => setFormData({ ...formData, name: e.target.value }),
                    style: pageInput,
                  }),
                  jsx('input', {
                    type: 'text',
                    placeholder: t('style.category'),
                    value: formData.category,
                    onChange: e => setFormData({ ...formData, category: e.target.value }),
                    style: pageInput,
                  }),
                ],
              }),
              jsx('input', {
                type: 'text',
                placeholder: t('style.summary'),
                value: formData.summary,
                onChange: e => setFormData({ ...formData, summary: e.target.value }),
                style: pageInput,
              }),
              jsx('input', {
                type: 'text',
                placeholder: t('style.tone'),
                value: formData.tone,
                onChange: e => setFormData({ ...formData, tone: e.target.value }),
                style: pageInput,
              }),
              jsxs('div', {
                style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' },
                children: [
                  jsx('button', {
                    type: 'button',
                    onClick: () => setShowAddModal(false),
                    style: GHOST_BTN,
                    children: t('style.cancel'),
                  }),
                  jsx('button', {
                    type: 'button',
                    onClick: handleSaveStyle,
                    style: PRIMARY_PILL,
                    children: t('style.save'),
                  }),
                ],
              }),
            ],
          })
        : null,
      // My styles: category pills + card grid.
      jsxs('div', {
        style: { display: 'flex', flexDirection: 'column', gap: '12px' },
        children: [
          jsx('h2', {
            style: { fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--color-foreground)' },
            children: t('style.myStyles'),
          }),
          categoryNames.length > 0
            ? jsx('div', {
                style: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
                children: ['all'].concat(categoryNames).map(cat =>
                  jsx(
                    'button',
                    {
                      key: cat,
                      type: 'button',
                      onClick: () => setCategoryFilter(cat),
                      style: {
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        cursor: 'pointer',
                        fontSize: '11.5px',
                        fontWeight: 500,
                        backgroundColor:
                          categoryFilter === cat
                            ? 'var(--theme-primary, var(--ui-accent, var(--ui-blue)))'
                            : 'var(--color-card)',
                        color:
                          categoryFilter === cat
                            ? 'var(--theme-primary-foreground, var(--color-primary-foreground, white))'
                            : 'var(--ui-text-tertiary)',
                      },
                      children: cat === 'all' ? t('home.all') : cat,
                    },
                    `cat-${cat}`
                  )
                ),
              })
            : null,
          jsx('div', {
            style: {
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
              gap: '12px',
            },
            children: visibleStyles.map(st => {
              const isActive = activeStyleId === st.id
              const isPreset = Boolean(st.preset)
              return jsxs(
                'div',
                {
                  key: st.id,
                  onClick: () => handleSelectStyle(st.id),
                  style: {
                    padding: '14px',
                    borderRadius: 'var(--radius-lg)',
                    border: isActive
                      ? '2px solid var(--theme-primary, var(--ui-accent, var(--ui-blue)))'
                      : '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-card)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px',
                    boxShadow: 'var(--shadow-sm)',
                  },
                  children: [
                    jsxs('div', {
                      children: [
                        jsxs('div', {
                          style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '6px',
                            gap: '8px',
                          },
                          children: [
                            jsx('span', {
                              style: {
                                fontWeight: 600,
                                fontSize: '13px',
                                color: 'var(--color-foreground)',
                              },
                              children: st.name || '—',
                            }),
                            jsx('span', {
                              style: {
                                fontSize: '10.5px',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-sm)',
                                flexShrink: 0,
                                backgroundColor: isPreset
                                  ? 'color-mix(in srgb, var(--color-foreground) 6%, var(--color-background))'
                                  : 'color-mix(in srgb, var(--ui-blue) 14%, var(--color-background))',
                                color: isPreset
                                  ? 'var(--ui-text-tertiary)'
                                  : 'color-mix(in srgb, var(--ui-blue) 85%, var(--color-foreground))',
                              },
                              children: isPreset ? t('style.preset') : t('style.custom'),
                            }),
                          ],
                        }),
                        st.summary
                          ? jsx('div', {
                              style: {
                                fontSize: '11.5px',
                                color: 'var(--ui-text-tertiary)',
                                lineHeight: 1.45,
                              },
                              children: st.summary,
                            })
                          : null,
                        st.tone
                          ? jsx('div', {
                              style: {
                                fontSize: '11.5px',
                                color: 'var(--ui-text-secondary)',
                                marginTop: '4px',
                              },
                              children: `${t('style.tone')}: ${st.tone}`,
                            })
                          : null,
                      ],
                    }),
                    jsxs('div', {
                      style: {
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '8px',
                        borderTop: '1px solid color-mix(in srgb, var(--color-border) 60%, transparent)',
                      },
                      children: [
                        jsx('span', {
                          style: {
                            fontSize: '11px',
                            fontWeight: 600,
                            color: isActive ? 'var(--ui-green)' : 'var(--ui-text-quaternary)',
                          },
                          children: isActive ? t('style.inUse') : t('style.useThis'),
                        }),
                        !isPreset
                          ? jsxs('div', {
                              onClick: e => e.stopPropagation(),
                              style: { display: 'flex', gap: '6px' },
                              children: [
                                jsx('button', {
                                  type: 'button',
                                  onClick: () => {
                                    setEditingStyle(st)
                                    setFormData({
                                      name: st.name || '',
                                      category: st.category || 'General',
                                      summary: st.summary || '',
                                      tone: st.tone || '',
                                    })
                                    setShowAddModal(true)
                                  },
                                  style: {
                                    padding: '2px 8px',
                                    fontSize: '11px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    backgroundColor: 'var(--color-background)',
                                    color: 'var(--ui-text-secondary)',
                                    cursor: 'pointer',
                                  },
                                  children: t('style.editBtn'),
                                }),
                                jsx('button', {
                                  type: 'button',
                                  onClick: () => handleDeleteStyle(st.id),
                                  style: {
                                    padding: '2px 8px',
                                    fontSize: '11px',
                                    borderRadius: 'var(--radius-md)',
                                    border: 'none',
                                    backgroundColor:
                                      'color-mix(in srgb, var(--ui-red) 12%, var(--color-background))',
                                    color: 'var(--ui-red)',
                                    cursor: 'pointer',
                                  },
                                  children: t('style.deleteBtn'),
                                }),
                              ],
                            })
                          : null,
                      ],
                    }),
                  ],
                },
                st.id
              )
            }),
          }),
        ],
      }),
      // Skill rules list.
      jsxs('div', {
        style: { ...panelStyle, display: 'flex', flexDirection: 'column', gap: '10px' },
        children: [
          jsx('h4', {
            style: { margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'var(--color-foreground)' },
            children: t('style.skillsTitle'),
          }),
          skills.length === 0
            ? jsx('div', {
                style: { color: 'var(--ui-text-quaternary)', fontSize: '12px' },
                children: t('style.noSkills'),
              })
            : jsx('div', {
                style: { display: 'flex', flexDirection: 'column', gap: '8px' },
                children: skills.map(sk => {
                  const active = sk.status === 'active' || sk.status === 'exported'
                  return jsxs(
                    'div',
                    {
                      key: sk.id,
                      style: {
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid color-mix(in srgb, var(--color-border) 60%, transparent)',
                        backgroundColor:
                          'var(--color-card)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '14px',
                      },
                      children: [
                        jsxs('div', {
                          style: { flex: 1, display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 },
                          children: [
                            jsx('span', {
                              style: {
                                fontSize: '10.5px',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-sm)',
                                flexShrink: 0,
                                backgroundColor: active
                                  ? 'color-mix(in srgb, var(--ui-green) 14%, var(--color-card))'
                                  : 'color-mix(in srgb, var(--color-foreground) 6%, var(--color-card))',
                                color: active ? 'var(--ui-green)' : 'var(--ui-text-tertiary)',
                                fontWeight: 600,
                              },
                              children: sk.status || 'proposed',
                            }),
                            jsxs('div', {
                              style: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 },
                              children: [
                                jsx('span', {
                                  style: {
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: 'var(--color-foreground)',
                                  },
                                  children: sk.name || sk.rule || sk.text || 'Rule',
                                }),
                                sk.rule && sk.name
                                  ? jsx('span', {
                                      style: {
                                        fontSize: '11.5px',
                                        color: 'var(--ui-text-secondary)',
                                        lineHeight: 1.4,
                                      },
                                      children: sk.rule,
                                    })
                                  : null,
                                sk.evidence
                                  ? jsx('span', {
                                      style: {
                                        fontSize: '10.5px',
                                        color: 'var(--ui-text-quaternary)',
                                      },
                                      children: sk.evidence,
                                    })
                                  : null,
                              ],
                            }),
                          ],
                        }),
                        jsxs('div', {
                          style: { display: 'flex', gap: '6px', flexShrink: 0 },
                          children: [
                            jsx('button', {
                              type: 'button',
                              onClick: () => handleToggleSkill(sk),
                              style: {
                                padding: '3px 10px',
                                fontSize: '11px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)',
                                backgroundColor: 'var(--color-card)',
                                color: 'var(--ui-text-secondary)',
                                cursor: 'pointer',
                              },
                              children: sk.status === 'active'
                                ? t('style.skillDeactivate')
                                : t('style.skillActivate'),
                            }),
                            jsx('button', {
                              type: 'button',
                              onClick: () => handleDeleteSkill(sk.id),
                              style: {
                                padding: '3px 10px',
                                fontSize: '11px',
                                borderRadius: 'var(--radius-md)',
                                border: 'none',
                                backgroundColor:
                                  'color-mix(in srgb, var(--ui-red) 12%, var(--color-background))',
                                color: 'var(--ui-red)',
                                cursor: 'pointer',
                              },
                              children: t('style.skillDelete'),
                            }),
                          ],
                        }),
                      ],
                    },
                    sk.id
                  )
                }),
              }),
        ],
      }),
    ],
  })
}

// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Module: client/app.js
// ---------------------------------------------------------------------------
/**
 * Main Application Shell and Plugin Registration
 */
















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
    .md-root,
    .md-board-page,
    .md-studio {
      background-color: var(--color-background) !important;
      background: var(--color-background) !important;
      opacity: 1 !important;
      isolation: isolate;
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

    /* -------------------------------------------------------------------------
     * Assistant Chat Dock styles aligned with Hermes Desktop Global CSS
     * ---------------------------------------------------------------------- */
    .md-chat {
      flex: 1;
      min-width: 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
      height: 100%;
      background-color: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: 4px;
      color: var(--color-foreground);
      overflow: hidden;
    }
    .md-dock-head {
      flex: none;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--color-border);
      background-color: var(--color-card);
    }
    .md-dock-head h2 {
      font-size: 13.5px;
      line-height: 20px;
      font-weight: 600;
      margin: 0;
      color: var(--color-foreground);
    }
    .md-engine {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      max-width: 155px;
      min-width: 0;
      color: var(--ui-text-tertiary, var(--color-muted-foreground));
      font-size: 11px;
      line-height: 16px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding: 2px 7px;
      border-radius: 2.5px;
      background: color-mix(in srgb, var(--color-foreground) 4%, var(--color-card));
      border: 1px solid var(--color-border);
    }
    .md-engine i {
      flex: none;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--ui-text-quaternary, var(--color-muted));
    }
    .md-engine.is-live i {
      background: var(--ui-green);
    }
    .md-engine.is-down i {
      background: var(--ui-orange);
    }
    .md-dock-scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .md-dock-intro {
      margin: auto 0;
      padding: 20px 8px 12px;
      text-align: left;
    }
    .md-dock-intro h3 {
      font-size: 18px;
      line-height: 24px;
      font-weight: 500;
      letter-spacing: -.01em;
      margin: 0 0 8px 0;
      color: var(--color-foreground);
    }
    .md-dock-intro p {
      color: var(--color-muted-foreground);
      font-size: 12px;
      line-height: 18px;
      margin: 0;
    }
    .md-msg {
      font-size: 12.5px;
      line-height: 19px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .md-msg.is-user {
      align-self: flex-end;
      max-width: 86%;
      padding: 7px 12px;
      border-radius: 2.5px;
      background-color: color-mix(in srgb, var(--color-primary) 14%, var(--color-card)) !important;
      border: 1px solid color-mix(in srgb, var(--color-primary) 35%, transparent) !important;
      color: var(--color-foreground) !important;
    }
    .md-msg.is-bot {
      align-self: flex-start;
      max-width: 98%;
      width: 100%;
      padding: 2px 0;
    }
    .md-msg.is-bot p {
      margin: 0;
      color: var(--color-foreground);
    }
    .md-msg.is-bot p + p {
      margin-top: 6px;
    }
    .md-msg-error {
      color: var(--ui-red) !important;
      font-size: 11.5px;
      margin-top: 4px;
    }
    .md-msg-note {
      color: var(--ui-text-tertiary, var(--color-muted-foreground));
      font-size: 11.5px;
      line-height: 16px;
      margin-top: 4px;
    }
    .md-receipt {
      display: flex;
      align-items: flex-start;
      gap: 7px;
      width: 100%;
      margin-top: 6px;
      padding: 6px 10px;
      border-radius: 2.5px;
      background-color: var(--color-card);
      border: 1px solid var(--color-border);
      font-size: 11.5px;
      line-height: 17px;
      color: var(--color-foreground);
      text-align: left;
    }
    button.md-receipt {
      cursor: pointer;
      transition: transform .15s ease, background-color .15s ease;
    }
    button.md-receipt:hover {
      transform: translateX(2px);
      background-color: color-mix(in srgb, var(--color-foreground) 6%, var(--color-card));
    }
    .md-receipt-check {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 15px;
      height: 15px;
      margin-top: 1px;
      border-radius: 50%;
      background-color: var(--ui-green);
      color: var(--color-background);
    }
    .md-msg footer {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 5px;
      color: var(--ui-text-quaternary, var(--color-muted-foreground));
      font-size: 11px;
    }
    .md-msg footer button {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: none;
      border: none;
      color: var(--ui-text-tertiary, var(--color-muted-foreground));
      cursor: pointer;
      padding: 0;
      font-size: 11px;
    }
    .md-msg footer button:hover {
      color: var(--color-foreground);
    }
    .md-suggest {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 0 12px 8px;
      flex-shrink: 0;
    }
    .md-suggest button {
      display: block;
      width: 100%;
      padding: 5px 10px;
      border-radius: 2.5px;
      border: 1px solid var(--color-border);
      background-color: var(--color-card);
      color: var(--color-foreground);
      font-size: 11.5px;
      line-height: 17px;
      transition: background-color .15s ease, border-color .15s ease;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      cursor: pointer;
      text-align: left;
    }
    .md-suggest button:hover:not(:disabled) {
      background-color: color-mix(in srgb, var(--color-primary) 10%, var(--color-card));
      border-color: var(--color-border);
      color: var(--color-foreground);
    }
    .md-composer {
      position: relative;
      margin: 0 12px 12px;
      padding: 6px 10px;
      border-radius: 2.5px;
      background-color: var(--color-background);
      border: 1px solid var(--color-border);
      display: flex;
      align-items: flex-end;
      gap: 8px;
      flex-shrink: 0;
      transition: border-color .15s ease;
    }
    .md-composer:focus-within {
      border-color: var(--color-ring, var(--color-primary));
    }
    .md-composer textarea {
      flex: 1;
      min-width: 0;
      min-height: 22px;
      max-height: 110px;
      padding: 2px 0;
      border: 0;
      outline: 0;
      background: none;
      resize: none;
      font-size: 12.5px;
      line-height: 18px;
      color: var(--color-foreground);
      font-family: inherit;
    }
    .md-composer .md-send {
      flex: none;
      width: 26px;
      height: 26px;
      border-radius: 2.5px;
      border: none;
      background-color: var(--color-primary);
      color: var(--color-primary-foreground);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity .15s ease;
    }
    .md-composer .md-send:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .md-model-alert {
      margin-bottom: 8px;
      padding: 8px 11px;
      border-radius: var(--radius-md);
      background-color: color-mix(in srgb, var(--ui-orange) 14%, var(--color-card));
      border: 1px solid color-mix(in srgb, var(--ui-orange) 35%, transparent);
      font-size: 11.5px;
      line-height: 17px;
      color: var(--color-foreground);
    }
    .md-model-alert strong {
      display: block;
      font-weight: 600;
      color: var(--ui-orange);
    }
    .md-model-alert p {
      margin: 3px 0 0 0;
      color: var(--ui-text-secondary, var(--color-foreground));
      overflow-wrap: anywhere;
    }
    .md-shimmer {
      display: inline-block;
      opacity: 0.7;
      animation: md-pulse 1.4s ease-in-out infinite;
    }
    @keyframes md-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
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
