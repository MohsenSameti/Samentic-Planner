/**
 * Color and WCAG contrast ratio utilities for testing.
 *
 * Implements the WCAG 2.1 relative luminance and contrast ratio formulas:
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */

export interface RGB {
  r: number
  g: number
  b: number
}

const NAMED_COLORS: Readonly<Record<string, string>> = {
  white: '#FFFFFF',
  black: '#000000',
}

/**
 * Parses a 3-digit or 6-digit hex string into RGB values.
 */
export function parseHexColor(hex: string): RGB {
  const clean = hex.replace(/^#/, '').trim()
  if (clean.length === 3) {
    const r = parseInt(clean[0]! + clean[0]!, 16)
    const g = parseInt(clean[1]! + clean[1]!, 16)
    const b = parseInt(clean[2]! + clean[2], 16)
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
      throw new Error(`Invalid hex color: ${hex}`)
    }
    return { r, g, b }
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16)
    const g = parseInt(clean.slice(2, 4), 16)
    const b = parseInt(clean.slice(4, 6), 16)
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
      throw new Error(`Invalid hex color: ${hex}`)
    }
    return { r, g, b }
  }
  throw new Error(`Unsupported hex color format: ${hex}`)
}

/**
 * Parses a CSS color value (hex or supported named color) into RGB values.
 */
export function parseColor(color: string): RGB {
  const trimmed = color.trim().toLowerCase()
  if (trimmed in NAMED_COLORS) {
    return parseHexColor(NAMED_COLORS[trimmed]!)
  }
  return parseHexColor(trimmed)
}

/**
 * Calculates WCAG 2.1 relative luminance for a given color.
 */
export function relativeLuminance(color: string): number {
  const { r, g, b } = parseColor(color)
  const [rl, gl, bl] = [r, g, b].map((val) => {
    const sRGB = val / 255
    return sRGB <= 0.04045 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4)
  }) as [number, number, number]
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
}

/**
 * Calculates the WCAG contrast ratio between two colors (returns ratio:1 as a number >= 1).
 */
export function contrastRatio(color1: string, color2: string): number {
  const lum1 = relativeLuminance(color1)
  const lum2 = relativeLuminance(color2)
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Resolves a CSS color string that may contain `var(--token, fallback)`.
 */
export function resolveCssColor(
  value: string,
  vars: Readonly<Record<string, string>>,
): string {
  const trimmed = value.trim()
  const varMatch = trimmed.match(/^var\(\s*(--[a-zA-Z0-9_-]+)(?:\s*,\s*([^)]+))?\s*\)$/)
  if (varMatch) {
    const varName = varMatch[1]!
    const fallback = varMatch[2]?.trim()
    if (vars[varName] !== undefined) {
      return resolveCssColor(vars[varName]!, vars)
    }
    if (fallback !== undefined) {
      return resolveCssColor(fallback, vars)
    }
    throw new Error(`Unresolved CSS variable: ${varName}`)
  }
  return trimmed
}
