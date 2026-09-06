// src/lib/pdf/fontConfig.ts
/**
 * Shared Font Configuration for PDF Generation
 *
 * This module provides a centralized font configuration for all PDF components.
 * It registers fonts with @react-pdf/renderer and provides utilities for handling
 * special characters like mathematical symbols and emojis.
 *
 * Registered Fonts:
 * - Tinos: Primary font (Times New Roman compatible) - 12pt, 14pt, 16pt with B/I/U support
 * - Noto Sans: Fallback font for special characters
 * - Noto Sans Math: Mathematical symbols ≤, ≈, ≥, ±, ∞, √, etc.
 * - Noto Sans Symbols 2: Additional symbols, arrows, geometric shapes
 * - Noto Sans Mono: Code snippets
 * - Emoji Source: Renders emojis as images (PDF doesn't support color fonts)
 */

import { Font } from '@react-pdf/renderer'

// Flag to prevent duplicate registration
let fontsRegistered = false

/**
 * Register all fonts for PDF rendering
 * Call this once at the top of your PDF document component
 */
export function registerPdfFonts(): void {
  if (fontsRegistered) return
  fontsRegistered = true

  // Register emoji source for rendering emojis as images
  // Using Cloudflare-hosted Twemoji (working CDN) with variation selector support
  Font.registerEmojiSource({
    format: 'png',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
  })

  // DM Sans - Clean geometric sans-serif for body text
  // Modern, highly legible, professional appearance
  Font.register({
    family: 'DM Sans Body',
    fonts: [
      {
        src: 'https://cdn.jsdelivr.net/fontsource/fonts/dm-sans@latest/latin-400-normal.ttf',
        fontWeight: 400,
      },
      {
        src: 'https://cdn.jsdelivr.net/fontsource/fonts/dm-sans@latest/latin-500-normal.ttf',
        fontWeight: 500,
      },
      {
        src: 'https://cdn.jsdelivr.net/fontsource/fonts/dm-sans@latest/latin-700-normal.ttf',
        fontWeight: 700,
      },
      {
        src: 'https://cdn.jsdelivr.net/fontsource/fonts/dm-sans@latest/latin-400-italic.ttf',
        fontWeight: 400,
        fontStyle: 'italic',
      },
      {
        src: 'https://cdn.jsdelivr.net/fontsource/fonts/dm-sans@latest/latin-500-italic.ttf',
        fontWeight: 500,
        fontStyle: 'italic',
      },
    ],
  })

  // JetBrains Mono - Distinctive monospace for numbers and data
  Font.register({
    family: 'JetBrains Mono',
    fonts: [
      {
        src: 'https://cdn.jsdelivr.net/fontsource/fonts/jetbrains-mono@latest/latin-400-normal.ttf',
        fontWeight: 400,
      },
      {
        src: 'https://cdn.jsdelivr.net/fontsource/fonts/jetbrains-mono@latest/latin-500-normal.ttf',
        fontWeight: 500,
      },
      {
        src: 'https://cdn.jsdelivr.net/fontsource/fonts/jetbrains-mono@latest/latin-700-normal.ttf',
        fontWeight: 700,
      },
    ],
  })

  // Noto Sans - Fallback font for special characters and symbols
  Font.register({
    family: 'Noto Sans',
    fonts: [
      {
        src: 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSans/hinted/ttf/NotoSans-Regular.ttf',
        fontWeight: 400,
      },
      {
        src: 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSans/hinted/ttf/NotoSans-Bold.ttf',
        fontWeight: 700,
      },
      {
        src: 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSans/hinted/ttf/NotoSans-Italic.ttf',
        fontWeight: 400,
        fontStyle: 'italic',
      },
      {
        src: 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSans/hinted/ttf/NotoSans-BoldItalic.ttf',
        fontWeight: 700,
        fontStyle: 'italic',
      },
    ],
  })

  // Noto Sans Math - Mathematical symbols (≤, ≈, ≥, ±, ∞, √, ∑, ∏, etc.)
  Font.register({
    family: 'Noto Sans Math',
    src: 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSansMath/full/ttf/NotoSansMath-Regular.ttf',
  })

  // Noto Sans Symbols 2 - Additional symbols, arrows, geometric shapes
  Font.register({
    family: 'Noto Sans Symbols 2',
    src: 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSansSymbols2/full/ttf/NotoSansSymbols2-Regular.ttf',
  })

  // Noto Sans Mono - For code snippets
  Font.register({
    family: 'Noto Sans Mono',
    src: 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSansMono/hinted/ttf/NotoSansMono-Regular.ttf',
  })

  // DM Sans - Clean modern sans-serif for headings (via Fontsource CDN)
  Font.register({
    family: 'DM Sans',
    fonts: [
      {
        src: 'https://cdn.jsdelivr.net/fontsource/fonts/dm-sans@latest/latin-400-normal.ttf',
        fontWeight: 400,
      },
      {
        src: 'https://cdn.jsdelivr.net/fontsource/fonts/dm-sans@latest/latin-500-normal.ttf',
        fontWeight: 500,
      },
      {
        src: 'https://cdn.jsdelivr.net/fontsource/fonts/dm-sans@latest/latin-600-normal.ttf',
        fontWeight: 600,
      },
      {
        src: 'https://cdn.jsdelivr.net/fontsource/fonts/dm-sans@latest/latin-700-normal.ttf',
        fontWeight: 700,
      },
      {
        src: 'https://cdn.jsdelivr.net/fontsource/fonts/dm-sans@latest/latin-400-italic.ttf',
        fontWeight: 400,
        fontStyle: 'italic',
      },
      {
        src: 'https://cdn.jsdelivr.net/fontsource/fonts/dm-sans@latest/latin-500-italic.ttf',
        fontWeight: 500,
        fontStyle: 'italic',
      },
    ],
  })

  // Register hyphenation callback to improve text wrapping
  Font.registerHyphenationCallback((word) => [word])
}

// Mathematical operators Unicode ranges
// U+2200–U+22FF: Mathematical Operators
// Also includes common math symbols from other blocks
const MATH_SYMBOL_RANGES = [
  [0x00b1, 0x00b1], // ± Plus-minus sign
  [0x00d7, 0x00d7], // × Multiplication sign
  [0x00f7, 0x00f7], // ÷ Division sign
  [0x2030, 0x2031], // ‰ ‱ Per mille/ten thousand
  [0x2200, 0x22ff], // Mathematical Operators block
  [0x221e, 0x221e], // ∞ Infinity
  [0x2260, 0x226f], // ≠ ≡ ≤ ≥ ≮ ≯ etc.
  [0x2300, 0x23ff], // Miscellaneous Technical (some math)
  [0x27c0, 0x27ef], // Miscellaneous Mathematical Symbols-A
  [0x2980, 0x29ff], // Miscellaneous Mathematical Symbols-B
  [0x2a00, 0x2aff], // Supplemental Mathematical Operators
]

/**
 * Check if a character code is a mathematical symbol
 */
function isMathSymbolCode(code: number): boolean {
  return MATH_SYMBOL_RANGES.some(([start, end]) => code >= start && code <= end)
}

/**
 * Check if a character needs the Math font
 */
export function needsMathFont(char: string): boolean {
  const code = char.codePointAt(0)
  return code !== undefined && isMathSymbolCode(code)
}

/**
 * Segment text into runs by font requirement
 */
export interface TextFontSegment {
  text: string
  font: 'normal' | 'math'
}

export function segmentTextByFont(text: string): TextFontSegment[] {
  if (!text) return []

  const segments: TextFontSegment[] = []
  let currentSegment = ''
  let currentFont: 'normal' | 'math' = 'normal'

  for (const char of text) {
    const isMath = needsMathFont(char)
    const charFont = isMath ? 'math' : 'normal'

    if (charFont === currentFont) {
      currentSegment += char
    } else {
      if (currentSegment) {
        segments.push({ text: currentSegment, font: currentFont })
      }
      currentSegment = char
      currentFont = charFont
    }
  }

  if (currentSegment) {
    segments.push({ text: currentSegment, font: currentFont })
  }

  return segments
}

/**
 * Check if text contains any math symbols
 */
export function containsMathSymbols(text: string): boolean {
  if (!text) return false
  for (const char of text) {
    if (needsMathFont(char)) return true
  }
  return false
}

/**
 * Normalize text for PDF rendering
 *
 * IMPORTANT: This function now PRESERVES emojis so react-pdf can render them
 * as images via the registered emoji source (Twemoji CDN).
 *
 * Currency symbols are preserved - Noto Sans has full Unicode support.
 *
 * Only removes/converts:
 * - Zero-width characters that break layout
 * - Keycap number emojis (complex sequences that don't render well)
 * - Normalizes dashes for consistency
 */
export function normalizeForPdf(text: string): string {
  if (!text) return ''
  return (
    text
      // Keycap emoji numbers (1️⃣, 2️⃣, etc.) - these are complex sequences that often break
      // Convert to plain numbers with period
      .replace(/0\uFE0F?\u20E3/g, '0.')
      .replace(/1\uFE0F?\u20E3/g, '1.')
      .replace(/2\uFE0F?\u20E3/g, '2.')
      .replace(/3\uFE0F?\u20E3/g, '3.')
      .replace(/4\uFE0F?\u20E3/g, '4.')
      .replace(/5\uFE0F?\u20E3/g, '5.')
      .replace(/6\uFE0F?\u20E3/g, '6.')
      .replace(/7\uFE0F?\u20E3/g, '7.')
      .replace(/8\uFE0F?\u20E3/g, '8.')
      .replace(/9\uFE0F?\u20E3/g, '9.')
      .replace(/🔟/g, '10.')
      // Remove zero-width characters that can cause layout issues
      .replace(/\u200B/g, '') // zero-width space
      .replace(/\u200C/g, '') // zero-width non-joiner
      .replace(/\uFEFF/g, '') // byte order mark
      // NOTE: Keep \u200D (zero-width joiner) - it's needed for compound emojis like 👨‍👩‍👧
      // Normalize special dashes for consistency
      .replace(/\u2011/g, '-') // non-breaking hyphen
      .replace(/\u2012/g, '-') // figure dash
      .replace(/\u2013/g, '–') // en-dash (keep as en-dash)
      .replace(/\u2014/g, '—') // em-dash (keep as em-dash)
      .replace(/\u2015/g, '—') // horizontal bar -> em-dash
  )
  // All other emojis are preserved and will be rendered as images by react-pdf
  // Currency symbols (₦, ₹, ₽, etc.) are supported by Noto Sans
}

// Font family constants for use in styles
export const PDF_FONTS = {
  PRIMARY: 'Noto Sans', // Clean sans-serif with excellent Unicode/currency support
  HEADING: 'DM Sans', // Display font for headings
  MONO: 'JetBrains Mono', // Distinctive mono for numbers/data/code
  FALLBACK: 'Noto Sans', // Fallback for special characters
  MATH: 'Noto Sans Math',
  SYMBOLS: 'Noto Sans Symbols 2',
} as const

// Standardized font sizes (in points)
export const PDF_FONT_SIZES = {
  TITLE: 32, // Main document title - bold and clean
  H1: 22, // Primary headings
  H2: 16, // Secondary headings
  H3: 13, // Tertiary headings
  LARGE: 14, // Legacy
  MEDIUM: 12, // Subheadings
  BODY: 10, // Body text - slightly smaller for density
  SMALL: 8, // Footer, captions, metadata
} as const
