// ── Géométrie A4 (mm) ─────────────────────────────────────────────────────────
export const W   = 210;
export const H   = 297;
export const M   = 15;          // marges gauche / droite
export const CW  = W - 2 * M;  // largeur utile = 180 mm
export const BOT = H - 18;      // y max avant zone footer

// ── Palette professionnelle médicale (RGB) ────────────────────────────────────
export type RGB = [number, number, number];
export const C = {
  navy:       [ 15,  47,  95] as RGB,  // bleu marine — titres
  navyMid:    [ 30,  64, 175] as RGB,  // bleu moyen — barres de section
  navyLight:  [219, 234, 254] as RGB,  // bleu pâle — fonds
  teal:       [ 14, 116, 144] as RGB,  // bleu-vert — accent header
  amber:      [180,  83,   9] as RGB,  // ambre — meilleur modèle
  amberBg:    [255, 251, 235] as RGB,  // fond ambre
  slate:      [ 30,  41,  59] as RGB,  // texte principal
  muted:      [100, 116, 139] as RGB,  // texte secondaire
  white:      [255, 255, 255] as RGB,
  bg:         [248, 250, 252] as RGB,  // fond section
  border:     [203, 213, 225] as RGB,  // bordures
  green:      [ 21, 128,  61] as RGB,  // bon
  greenBg:    [240, 253, 244] as RGB,
  orange:     [194, 120,   3] as RGB,  // modéré
  orangeBg:   [255, 251, 235] as RGB,
  red:        [185,  28,  28] as RGB,  // faible
  redBg:      [254, 242, 242] as RGB,
};

// ── Qualité métrique ──────────────────────────────────────────────────────────
export type Quality = 'excellent' | 'good' | 'moderate' | 'poor' | 'na';
