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
  borderRadius: 'var(--radius-lg)',
}

export const HERO_GRADIENT = {
  background:
    'linear-gradient(125deg, var(--color-background) 0%, color-mix(in srgb, var(--ui-purple) 7%, var(--color-background)) 55%, color-mix(in srgb, var(--ui-orange) 6%, var(--color-background)) 100%)',
}

export const DOT_GRID = {
  backgroundColor: 'var(--color-background)',
  backgroundImage:
    'radial-gradient(circle, color-mix(in srgb, var(--ui-stroke-tertiary) 85%, transparent) 1.25px, transparent 1.25px)',
  backgroundSize: '24px 24px',
}

export const INPUT_STYLE = {
  padding: '7px 12px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  backgroundColor: 'color-mix(in srgb, var(--color-foreground) 4%, var(--color-background))',
  color: 'var(--color-foreground)',
  fontSize: '13px',
  outline: 'none',
  minWidth: 0,
}

export const GHOST_BTN = {
  padding: '6px 14px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-card)',
  color: 'var(--ui-text-secondary)',
  cursor: 'pointer',
  fontSize: '12.5px',
  fontWeight: 500,
}

export const PRIMARY_PILL = {
  padding: '8px 16px',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  backgroundColor: 'var(--theme-primary, var(--ui-accent, var(--ui-blue)))',
  color: 'var(--theme-primary-foreground, var(--color-primary-foreground, white))',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 500,
}

export const SECONDARY_PILL = {
  padding: '8px 14px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-card)',
  color: 'var(--ui-text-secondary)',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 500,
}

export const ICON_BTN = {
  width: '30px',
  height: '30px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-card)',
  color: 'var(--ui-text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '13px',
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
