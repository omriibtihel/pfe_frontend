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
 * scale = width / value  →  maps any shifted stat to its pixel x position.
 */
export function BoxPlotShape(props: any) {
  const { x, y, width, height, value, s_min, s_p25, s_p50, s_p75, s_max, fill } = props;
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

  return (
    <g>
      {/* Lower whisker: min → p25 */}
      <line x1={xMin} y1={cy}           x2={xP25} y2={cy}           stroke={fill} strokeWidth={1.5} />
      <line x1={xMin} y1={cy - capH / 2} x2={xMin} y2={cy + capH / 2} stroke={fill} strokeWidth={2} />
      {/* Upper whisker: p75 → max */}
      <line x1={xP75} y1={cy}           x2={xMax} y2={cy}           stroke={fill} strokeWidth={1.5} />
      <line x1={xMax} y1={cy - capH / 2} x2={xMax} y2={cy + capH / 2} stroke={fill} strokeWidth={2} />
      {/* IQR box */}
      <rect
        x={xP25} y={boxY}
        width={Math.max(iqrW, 2)} height={boxH}
        fill={fill} fillOpacity={0.18} stroke={fill} strokeWidth={2} rx={3}
      />
      {/* Median line */}
      <line x1={xP50} y1={boxY} x2={xP50} y2={boxY + boxH} stroke={fill} strokeWidth={3} />
    </g>
  );
}
