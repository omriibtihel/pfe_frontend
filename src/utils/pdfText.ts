/**
 * pdfText.ts - make arbitrary text safe for jsPDF's standard (WinAnsi) fonts.
 *
 * jsPDF's built-in Helvetica/Times only render the WinAnsi (cp1252) character
 * set: ASCII, accented Latin letters (e-acute, a-grave, c-cedilla...) and
 * common typographic punctuation (em/en dash, guillemets, ellipsis, bullet,
 * middle dot, euro, tm, curly quotes). Anything outside that - arrows, math
 * comparators, checkmarks, box glyphs, emojis, and the narrow no-break space
 * that `Number.toLocaleString('fr-FR')` emits - is dropped or rendered as a
 * garbage glyph, which looks broken in an exported report.
 *
 * `sanitizePdfText` maps the realistic offenders to readable ASCII equivalents
 * and replaces any remaining out-of-range character with '?', so a generated
 * report never contains incomprehensible characters.
 */

// cp1252 high-range code points that jsPDF *can* render - kept as-is.
const CP1252_EXTRA = new Set<number>([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

// Exotic spaces -> normal space (NBSP, en/em/thin/figure spaces, narrow NBSP,
// medium math space, ideographic space).
const EXOTIC_SPACE = /[  -   　]/g;
// Zero-width characters -> dropped.
const ZERO_WIDTH = /[​‌‍﻿]/g;

// Symbol -> ASCII replacements (arrows, comparators, marks, bullets).
const SYMBOL_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/[→⇒➜▶►]/g, '->'], // arrows / triangles right
  [/[←◀◄]/g, '<-'], //            arrows / triangles left
  [/↔/g, '<->'],
  [/[‐‑‒―−]/g, '-'], // hyphen/figure dash/minus sign -> ASCII -
  [/≥/g, '>='], //                          >=
  [/≤/g, '<='], //                          <=
  [/≠/g, '!='], //                          !=
  [/≈/g, '~'], //                           approx
  [/[✓✔☑✅]/g, ''], //        check marks
  [/[✗✕✘❌]/g, 'x'], //       ballot x
  [/⚠/g, '!'], //                           warning sign
  [/[▪◦●○■◆♦]/g, '-'], // bullets / squares
  [/★/g, '*'], //                           star
];

export function sanitizePdfText(input: string): string {
  if (!input) return input;

  let s = input.normalize('NFC');

  for (const [re, rep] of SYMBOL_REPLACEMENTS) s = s.replace(re, rep);
  s = s.replace(EXOTIC_SPACE, ' ').replace(ZERO_WIDTH, '');

  // Final guard: anything still outside what jsPDF can draw becomes '?'.
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    out += cp <= 0xff || CP1252_EXTRA.has(cp) ? ch : '?';
  }
  return out;
}

/**
 * Recursively sanitizes every string in a plain object / array, leaving
 * numbers, booleans, Dates and other non-plain objects untouched. Use it once
 * at a PDF builder's entry point to clean all dynamic (e.g. LLM-generated) text.
 */
export function deepSanitizePdf<T>(value: T): T {
  if (typeof value === 'string') return sanitizePdfText(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => deepSanitizePdf(v)) as unknown as T;
  if (value && typeof value === 'object' && (value as object).constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepSanitizePdf(v);
    }
    return out as unknown as T;
  }
  return value;
}

/**
 * Locale-stable integer formatter for PDFs: groups thousands with a regular
 * space (cp1252-safe) instead of the narrow no-break space that
 * `toLocaleString('fr-FR')` produces, which jsPDF cannot render.
 */
export function fmtIntPdf(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return Math.round(value).toLocaleString('fr-FR').replace(EXOTIC_SPACE, ' ');
}
