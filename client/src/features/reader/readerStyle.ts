import type { ReaderFont, ReaderSettings, ReaderTheme } from '@athenaeum/shared';
import type { CSSProperties } from 'react';

/** Reader themes measured from atsu.moe: page background, body text, headings. */
export const THEMES: Record<ReaderTheme, { bg: string; text: string; heading: string; muted: string; surface: string }> = {
  site: { bg: '#1d1e20', text: '#b8bcc0', heading: '#d9dcdf', muted: '#7d8186', surface: '#2a2b2e' },
  dim: { bg: '#1a1917', text: '#9d968b', heading: '#c4bdb2', muted: '#6f695f', surface: '#26241f' },
  sepia: { bg: '#f4ecd8', text: '#4a3f35', heading: '#2f271f', muted: '#8a7b68', surface: '#e9dfc6' },
  light: { bg: '#fbfbfa', text: '#2b2b2b', heading: '#111111', muted: '#7a7a78', surface: '#efefed' },
  day: { bg: '#e8e6e1', text: '#3a3a38', heading: '#1f1f1e', muted: '#7c7a74', surface: '#dcd9d2' },
  night: { bg: '#12161b', text: '#a3b1bd', heading: '#c9d4de', muted: '#64717d', surface: '#1c2228' },
};

export const FONTS: Record<ReaderFont, string> = {
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
  georgia: 'Georgia, "Times New Roman", serif',
  'geist-serif': '"Source Serif 4", "Iowan Old Style", Georgia, serif',
  sans: '"Geist Variable", Geist, system-ui, sans-serif',
  lucida: '"Lucida Bright", "Lucida Grande", "Lucida Sans Unicode", Georgia, serif',
  legible: '"Atkinson Hyperlegible", Verdana, system-ui, sans-serif',
};

/** Turns reader settings into CSS variables on the reader root. Changing a setting never re-renders text. */
export function readerStyle(s: ReaderSettings): CSSProperties {
  const theme = THEMES[s.theme];
  return {
    '--r-bg': theme.bg,
    '--r-text': theme.text,
    '--r-heading': theme.heading,
    '--r-muted': theme.muted,
    '--r-surface': theme.surface,
    '--r-font': FONTS[s.font],
    '--r-size': `${s.size}px`,
    '--r-weight': s.weight,
    '--r-line-height': s.lineHeight,
    // atsu's "66 chars" is a 554px column at 18px: about 0.466em per character.
    '--r-measure': `${Math.round(s.lineWidth * 0.4663 * 100) / 100}em`,
    '--r-letter-spacing': `${s.letterSpacing}px`,
    '--r-paragraph-spacing': `${s.paragraphSpacing}px`,
    '--r-align': s.justify ? 'justify' : 'start',
    '--r-indent': s.indent ? '1.5em' : '0',
  } as CSSProperties;
}
