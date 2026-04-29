/**
 * Custom recharts bar shape that draws a standard box-and-whisker plot.
 *
 * recharts passes (via the Bar props):
 *   x      = pixel of 0 on X axis
 *   width  = pixels for [0 → value]
 *   y      = row top pixel
 *   height = row height in pixels
 *   value  = s_max  (the shifted maximum, used as the full bar width)
 *   s_*    = shifted stat values (s_min, s_p25, s_p50, s_p75, s_max)
 *   fill   = color for this column
 *
 * Extra props (injected via the render-function pattern in BoxplotPanel):
 *   showMean   = draw a ◆ diamond at the mean position
 *   showFences = draw dashed Tukey-fence markers (Q1−1.5·IQR, Q3+1.5·IQR)
 *   shift      = global offset applied to all values so they stay ≥ 0
 *
 * Data-row props used for computed overlays:
 *   _mean  = raw (unshifted) mean value
 *   s_lf   = shifted lower Tukey fence
 *   s_uf   = shifted upper Tukey fence
 *
 * scale = width / value  →  maps any shifted stat to its pixel x position.
 */
type BoxPlotShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number;
  s_min?: number;
  s_p25?: number;
  s_p50?: number;
  s_p75?: number;
  s_max?: number;
  fill?: string;
  showMean?: boolean;
  showFences?: boolean;
  shift?: number;
  _mean?: number | null;
  s_lf?: number | null;
  s_uf?: number | null;
};

export function BoxPlotShape(props: BoxPlotShapeProps) {
  const {
    x, y, width, height, value,
    s_min, s_p25, s_p50, s_p75, s_max,
    fill,
    // Injected by BoxplotPanel render function
    showMean  = false,
    showFences = false,
    shift      = 0,
    // From data row
    _mean,
    s_lf,
    s_uf,
  } = props;

  if (!Number.isFinite(width) || width <= 0 || !value) return null;

  const scale = width / value;
  const xMin  = x + s_min  * scale;
  const xP25  = x + s_p25  * scale;
  const xP50  = x + s_p50  * scale;
  const xP75  = x + s_p75  * scale;
  const xMax  = x + s_max  * scale;

  const iqrW = xP75 - xP25;
  const cy   = y + height / 2;
  const boxH = Math.min(height * 0.65, 34);
  const boxY = cy - boxH / 2;
  const capH = boxH * 0.5;

  // Mean diamond — visible even if outside the whisker range (informative)
  const xMean =
    showMean && _mean != null && Number.isFinite(_mean)
      ? x + (_mean + shift) * scale
      : null;

  // Tukey fences — only draw when the fence falls between the whisker end and the box
  // (i.e. there is a potential outlier zone to flag)
  const xLF =
    showFences && s_lf != null && s_lf > s_min && s_lf < s_p25
      ? x + s_lf * scale
      : null;
  const xUF =
    showFences && s_uf != null && s_uf < s_max && s_uf > s_p75
      ? x + s_uf * scale
      : null;

  const fenceCapH = capH * 0.7;

  return (
    <g>
      {/* ── Lower whisker: min → p25 ───────────────────────────────── */}
      <line x1={xMin} y1={cy}             x2={xP25} y2={cy}             stroke={fill} strokeWidth={1.5} />
      <line x1={xMin} y1={cy - capH / 2} x2={xMin} y2={cy + capH / 2} stroke={fill} strokeWidth={2} />

      {/* ── Upper whisker: p75 → max ───────────────────────────────── */}
      <line x1={xP75} y1={cy}             x2={xMax} y2={cy}             stroke={fill} strokeWidth={1.5} />
      <line x1={xMax} y1={cy - capH / 2} x2={xMax} y2={cy + capH / 2} stroke={fill} strokeWidth={2} />

      {/* ── IQR box ────────────────────────────────────────────────── */}
      <rect
        x={xP25} y={boxY}
        width={Math.max(iqrW, 2)} height={boxH}
        fill={fill} fillOpacity={0.18} stroke={fill} strokeWidth={2} rx={3}
      />

      {/* ── Median line ────────────────────────────────────────────── */}
      <line x1={xP50} y1={boxY} x2={xP50} y2={boxY + boxH} stroke={fill} strokeWidth={3} />

      {/* ── Tukey lower fence (dashed) ─────────────────────────────── */}
      {xLF != null && (
        <line
          x1={xLF} y1={cy - fenceCapH} x2={xLF} y2={cy + fenceCapH}
          stroke={fill} strokeDasharray="3 2" strokeWidth={1.5} strokeOpacity={0.65}
        />
      )}

      {/* ── Tukey upper fence (dashed) ─────────────────────────────── */}
      {xUF != null && (
        <line
          x1={xUF} y1={cy - fenceCapH} x2={xUF} y2={cy + fenceCapH}
          stroke={fill} strokeDasharray="3 2" strokeWidth={1.5} strokeOpacity={0.65}
        />
      )}

      {/* ── Mean diamond ◆ ─────────────────────────────────────────── */}
      {xMean != null && (
        <polygon
          points={`${xMean},${cy - 5} ${xMean + 4.5},${cy} ${xMean},${cy + 5} ${xMean - 4.5},${cy}`}
          fill="white"
          stroke={fill}
          strokeWidth={2}
        />
      )}
    </g>
  );
}
