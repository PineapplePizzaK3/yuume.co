/** Temporary full-bleed layout test. Set to false to restore centered max-width. */
export const FULL_BLEED_TEST = false
/** Header-only expansion test. Pages and footer stay centered. */
export const FULL_BLEED_HEADER = true

/**
 * Header inner max-width when FULL_BLEED_HEADER is true.
 * Chrome default is 80 (max-w-7xl). Examples to try: 80, 90, 96, 110.
 * Set to null for 100% of the viewport.
 */
export const HEADER_MAX_WIDTH_REM = null

/** 'rect' | 'underline' | 'icon-badge' */
export const HEADER_FEATURE_STYLE = 'icon-badge'

export const pageShell = FULL_BLEED_TEST
  ? 'mx-auto w-full max-w-none'
  : 'mx-auto max-w-6xl'

export const chromeShell = FULL_BLEED_TEST
  ? 'mx-auto w-full max-w-none'
  : 'mx-auto max-w-7xl'

export const headerShell = FULL_BLEED_HEADER
  ? 'mx-auto w-full'
  : chromeShell

export const headerShellStyle =
  FULL_BLEED_HEADER && HEADER_MAX_WIDTH_REM != null
    ? { maxWidth: `${HEADER_MAX_WIDTH_REM}rem` }
    : undefined
