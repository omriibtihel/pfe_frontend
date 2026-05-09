import type { RGB } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — neutral professional palette
// ─────────────────────────────────────────────────────────────────────────────

// Text
export const C_INK: RGB = [17, 24, 39]; // body text
export const C_DARK: RGB = [30, 41, 59]; // headings, emphasis
export const C_MUTED: RGB = [100, 116, 139]; // captions, metadata, footnotes

// Structural
export const C_RULE: RGB = [226, 232, 240]; // horizontal rules & table borders
export const C_ROW_ALT: RGB = [248, 250, 252]; // alternating table row
export const C_TH_BG: RGB = [241, 245, 249]; // table header background (neutral)
export const C_WHITE: RGB = [255, 255, 255];
export const C_ACCENT: RGB = [37, 99, 235]; // single accent colour (used sparingly)

// Status — text colours only
export const C_RED: RGB = [185, 28, 28];
export const C_AMBER: RGB = [161, 98, 7];
export const C_GREEN: RGB = [21, 128, 61];

// Highlight box colours (used sparingly — only for genuinely important notices)
export const ALERT = {
  critical: { bg: [254, 242, 242] as RGB, bar: [185, 28, 28] as RGB, text: [153, 27, 27] as RGB },
  warning: { bg: [255, 251, 235] as RGB, bar: [161, 98, 7] as RGB, text: [120, 53, 15] as RGB },
  info: { bg: [239, 246, 255] as RGB, bar: [37, 99, 235] as RGB, text: [30, 58, 138] as RGB },
  success: { bg: [240, 253, 244] as RGB, bar: [21, 128, 61] as RGB, text: [20, 83, 45] as RGB },
};

export type AlertKind = keyof typeof ALERT;
