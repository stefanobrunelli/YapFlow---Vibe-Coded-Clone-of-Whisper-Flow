import { ShortcutConfig } from './types'

const KEYCODE_SYMBOLS: Record<number, string> = {
  3675: '⌘', 3676: '⌘',
  3640: '⌥', 3641: '⌥', 56: '⌥',
  29: '⌃', 3613: '⌃',
  42: '⇧', 3685: '⇧',
  57: 'Space',
  28: 'Return',
  15: 'Tab',
  1: 'Esc',
  14: 'Delete',
  12: '-',
  13: '=',
  26: '[',
  27: ']',
  39: ';',
  40: "'",
  41: '`',
  43: '\\',
  51: ',',
  52: '.',
  53: '/',
  3756: 'F1', 3757: 'F2', 3758: 'F3', 3759: 'F4',
  3760: 'F5', 3761: 'F6', 3762: 'F7', 3763: 'F8',
  3764: 'F9', 3765: 'F10', 3767: 'F11', 3768: 'F12',
  2: '1', 3: '2', 4: '3', 5: '4', 6: '5', 7: '6', 8: '7', 9: '8', 10: '9', 11: '0',
  16: 'Q', 17: 'W', 18: 'E', 19: 'R', 20: 'T',
  21: 'Y', 22: 'U', 23: 'I', 24: 'O', 25: 'P',
  30: 'A', 31: 'S', 32: 'D', 33: 'F', 34: 'G',
  35: 'H', 36: 'J', 37: 'K', 38: 'L',
  44: 'Z', 45: 'X', 46: 'C', 47: 'V',
  48: 'B', 49: 'N', 50: 'M'
}

const KEYCODE_NAMES: Record<number, string> = {
  3675: 'Command', 3676: 'Command',
  3640: 'Option', 3641: 'Option', 56: 'Option',
  29: 'Control', 3613: 'Control',
  42: 'Shift', 3685: 'Shift',
  57: 'Space',
  28: 'Return',
  15: 'Tab',
  1: 'Escape',
  14: 'Delete',
  12: 'Minus',
  13: 'Equals',
  26: 'Left Bracket',
  27: 'Right Bracket',
  39: 'Semicolon',
  40: 'Quote',
  41: 'Backtick',
  43: 'Backslash',
  51: 'Comma',
  52: 'Period',
  53: 'Slash'
}

const MODIFIER_DISPLAY_ORDER = [29, 3613, 42, 3685, 56, 3640, 3641, 3675, 3676]

const MODIFIER_GROUPS: number[][] = [
  [29, 3613],
  [42, 3685],
  [56, 3640, 3641],
  [3675, 3676]
]

export function normalizeShortcutKeyCode(keyCode: number): number {
  const group = MODIFIER_GROUPS.find((codes) => codes.includes(keyCode))
  return group ? group[0] : keyCode
}

export function normalizeShortcutKeyCodes(keyCodes: number[]): number[] {
  return [...new Set(keyCodes.map(normalizeShortcutKeyCode))]
}

export function formatShortcutKeyCodes(keyCodes: number[]): string {
  const sorted = [...normalizeShortcutKeyCodes(keyCodes)].sort((a, b) => {
    const ai = MODIFIER_DISPLAY_ORDER.indexOf(a)
    const bi = MODIFIER_DISPLAY_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return sorted.map((keyCode) => KEYCODE_SYMBOLS[keyCode] ?? `Key ${keyCode}`).join('')
}

export function describeShortcutKeyCodes(keyCodes: number[]): string {
  const sorted = [...normalizeShortcutKeyCodes(keyCodes)].sort((a, b) => {
    const ai = MODIFIER_DISPLAY_ORDER.indexOf(a)
    const bi = MODIFIER_DISPLAY_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a - b
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return sorted.map((keyCode) => KEYCODE_NAMES[keyCode] ?? KEYCODE_SYMBOLS[keyCode] ?? `Key ${keyCode}`).join(' + ')
}

export function withFormattedShortcutDisplay(shortcut: ShortcutConfig): ShortcutConfig {
  const keyCodes = normalizeShortcutKeyCodes(shortcut.keyCodes)
  return {
    keyCodes,
    display: formatShortcutKeyCodes(keyCodes)
  }
}
