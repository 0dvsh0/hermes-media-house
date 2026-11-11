/**
 * UI Primitives: Vector SVG Icons, Hermes Codicon Fallback, IconButton, and StatusDot
 * Strict Hermes theme tokens compliance. 100% English only.
 */

import { jsx } from 'react/jsx-runtime'

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
